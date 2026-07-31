import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  rosClient,
  useConnectionState,
  useCockpitVoltage,
  useCockpitOdom,
  useCockpitOverheadClearance,
  useCockpitScan,
} from '@/lib/ros/client';
import { renderHook, act } from '@testing-library/react';

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number = 0; // CONNECTING
  send = vi.fn();
  close = vi.fn();
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  static OPEN = 1;
  static CONNECTING = 0;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.latestInstance = this;
  }

  static latestInstance: MockWebSocket | null = null;

  triggerOpen() {
    this.readyState = 1; // OPEN
    if (this.onopen) this.onopen();
  }

  triggerClose() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }

  triggerMessage(data: Record<string, unknown>) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
}

describe('rosClient and hooks', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rosClient.disconnect();
    MockWebSocket.latestInstance = null;
  });

  it('manages connection state and reconnect backoff correctly', () => {
    const { result } = renderHook(() => useConnectionState());
    expect(result.current).toBe('disconnected');

    act(() => {
      rosClient.connect('wss://beast-test-url:9090');
    });

    expect(result.current).toBe('connecting');
    expect(MockWebSocket.latestInstance).toBeTruthy();

    act(() => {
      MockWebSocket.latestInstance?.triggerOpen();
    });

    expect(result.current).toBe('connected');

    // Test subscription message sending
    expect(MockWebSocket.latestInstance?.send).toHaveBeenCalled();
    const calls = MockWebSocket.latestInstance?.send.mock.calls || [];
    const subscribeCalls = calls.map(c => JSON.parse(c[0])).filter(c => c.op === 'subscribe');
    expect(subscribeCalls.some(s => s.topic === '/scan')).toBe(true);

    // Close and test reconnect
    act(() => {
      MockWebSocket.latestInstance?.triggerClose();
    });

    expect(result.current).toBe('disconnected');

    // Run timer to trigger reconnect
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current).toBe('connecting');
  });

  it('manages topic slice snapshot identity and doesn\'t trigger unrelated notifications', () => {
    act(() => {
      rosClient.connect('wss://beast-test-url:9090');
      MockWebSocket.latestInstance?.triggerOpen();
    });

    const voltageHook = renderHook(() => useCockpitVoltage());
    const odomHook = renderHook(() => useCockpitOdom());

    const initialVoltage = voltageHook.result.current;
    const initialOdom = odomHook.result.current;

    // Trigger a voltage update
    act(() => {
      MockWebSocket.latestInstance?.triggerMessage({
        op: 'publish',
        topic: '/ugv/voltage',
        msg: { voltage: 11.5, percentage: 0.9 },
      });
    });

    // Voltage hook should see new value, but odom hook MUST stay referentially stable!
    expect(voltageHook.result.current.voltage).toBe(11.5);
    expect(voltageHook.result.current.percentage).toBe(91); // v / 12.6 = 11.5/12.6 = 91%
    expect(voltageHook.result.current).not.toBe(initialVoltage);
    expect(odomHook.result.current).toBe(initialOdom); // REFERENTIALLY EQUAL
  });

  it('safely handles non-finite numbers (NaN/Infinity defence)', () => {
    act(() => {
      rosClient.connect('wss://beast-test-url:9090');
      MockWebSocket.latestInstance?.triggerOpen();
    });

    const voltageHook = renderHook(() => useCockpitVoltage());
    const clearanceHook = renderHook(() => useCockpitOverheadClearance());

    // Trigger malformed payloads
    act(() => {
      MockWebSocket.latestInstance?.triggerMessage({
        op: 'publish',
        topic: '/ugv/voltage',
        msg: { voltage: NaN },
      });
      MockWebSocket.latestInstance?.triggerMessage({
        op: 'publish',
        topic: '/cockpit/overhead_clearance',
        msg: { data: Infinity },
      });
    });

    expect(voltageHook.result.current.voltage).toBe(0);
    expect(voltageHook.result.current.percentage).toBe(0);
    expect(clearanceHook.result.current).toBe(0);
  });

  it('processes and crops LiDAR scans correctly based on published blind sector', () => {
    act(() => {
      rosClient.connect('wss://beast-test-url:9090');
      MockWebSocket.latestInstance?.triggerOpen();
    });

    const scanHook = renderHook(() => useCockpitScan());

    // Send ranges representing full 360 array (let's use 360 bins for 1 deg resolution)
    const ranges = Array(360).fill(2.0); // 2 meters all around
    act(() => {
      MockWebSocket.latestInstance?.triggerMessage({
        op: 'publish',
        topic: '/scan',
        msg: {
          ranges,
          angle_min: -Math.PI,
          angle_max: Math.PI,
          angle_increment: (Math.PI * 2) / 360,
          range_min: 0.1,
          range_max: 10.0,
        },
      });
    });

    // Cropping active between 45° and 134.5°
    // Total angles is 360.
    // Ensure cropped angles are missing or skipped in points array
    const points = scanHook.result.current.points;
    expect(points.length).toBeLessThan(360);

    points.forEach(pt => {
      let deg = (pt.angle * 180) / Math.PI;
      if (deg < 0) deg += 360;
      const isBlinded = deg >= 45 && deg <= 134.5;
      expect(isBlinded).toBe(false);
    });
  });
});
