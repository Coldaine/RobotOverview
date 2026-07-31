import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  rosClient,
  useConnectionState,
  useCockpitVoltage,
  useCockpitOdom,
  useCockpitOverheadClearance,
  useCockpitScan,
  useCockpitEstop,
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

const ESTOP_TOPIC = '/cmd_vel_estop_lock';

// Every `{data: …}` value this client has put on the lock topic, in order.
function estopPublishes(ws: MockWebSocket): boolean[] {
  return ws.send.mock.calls
    .map((c) => JSON.parse(c[0]))
    .filter((m) => m.op === 'publish' && m.topic === ESTOP_TOPIC)
    .map((m) => m.msg.data as boolean);
}

function wireOps(ws: MockWebSocket): Array<{ op: string; topic?: string }> {
  return ws.send.mock.calls.map((c) => JSON.parse(c[0]));
}

function openSocket(url = 'wss://beast-test-url:9090'): MockWebSocket {
  act(() => {
    rosClient.connect(url);
    MockWebSocket.latestInstance?.triggerOpen();
  });
  return MockWebSocket.latestInstance!;
}

describe('rosClient and hooks', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Operator intent is module state that deliberately outlives the socket, so
    // it has to be cleared explicitly or it bleeds into the next test.
    rosClient.clearEstopIntent();
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

  // ── E-STOP LOCK REPUBLISH CONTRACT ────────────────────────────────────────
  // twist_mux takes lock topics with VOLATILE durability at `timeout: 0.0`, so
  // a one-shot publish can lose the discovery race and the lock does not
  // survive a mux restart. The client must hold the lock at >= 1 Hz.
  describe('e-stop lock republish contract', () => {
    it('republishes `true` at >= 1 Hz for as long as the stop is engaged', () => {
      const ws = openSocket();
      ws.send.mockClear();

      act(() => {
        expect(rosClient.setEstopLock(true)).toBe(true);
      });

      // The stop must land on the wire on the click, not one tick later.
      expect(estopPublishes(ws)).toEqual([true]);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      const sends = estopPublishes(ws);
      // 1 immediate + at least 2 more over 2 s satisfies the 1 Hz floor.
      expect(sends.length).toBeGreaterThanOrEqual(3);
      expect(sends.every((v) => v === true)).toBe(true);
      expect(rosClient.isEstopEngaged()).toBe(true);
    });

    it('bursts `false` on release and then goes quiet', () => {
      const ws = openSocket();
      act(() => {
        rosClient.setEstopLock(true);
      });
      ws.send.mockClear();

      act(() => {
        rosClient.setEstopLock(false);
      });
      expect(estopPublishes(ws)).toEqual([false]);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      const burst = estopPublishes(ws);
      expect(burst.length).toBeGreaterThanOrEqual(3);
      expect(burst.every((v) => v === false)).toBe(true);
      expect(rosClient.isEstopEngaged()).toBe(false);

      // Burst over — nothing keeps talking on the lock topic.
      ws.send.mockClear();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(estopPublishes(ws)).toHaveLength(0);
    });

    it('re-advertises and resumes the heartbeat on reconnect', () => {
      openSocket();
      act(() => {
        rosClient.setEstopLock(true);
      });
      const firstSocket = MockWebSocket.latestInstance!;

      act(() => {
        firstSocket.triggerClose();
      });

      // Nothing should be published into a dead socket.
      firstSocket.send.mockClear();
      act(() => {
        vi.advanceTimersByTime(900);
      });
      expect(estopPublishes(firstSocket)).toHaveLength(0);

      act(() => {
        vi.advanceTimersByTime(300); // backoff elapses, new socket constructed
      });
      const secondSocket = MockWebSocket.latestInstance!;
      expect(secondSocket).not.toBe(firstSocket);

      act(() => {
        secondSocket.triggerOpen();
      });

      // The mux may have restarted while we were gone, so the lock is asserted
      // immediately — and only after the publisher is advertised.
      const ops = wireOps(secondSocket);
      const advertiseIdx = ops.findIndex((m) => m.op === 'advertise' && m.topic === ESTOP_TOPIC);
      const publishIdx = ops.findIndex((m) => m.op === 'publish' && m.topic === ESTOP_TOPIC);
      expect(advertiseIdx).toBeGreaterThanOrEqual(0);
      expect(publishIdx).toBeGreaterThan(advertiseIdx);
      expect(estopPublishes(secondSocket)).toEqual([true]);

      // And the heartbeat keeps running on the new socket.
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(estopPublishes(secondSocket).length).toBeGreaterThanOrEqual(3);
    });

    it('leaves no timers behind once the release burst finishes', () => {
      const ws = openSocket();

      act(() => {
        rosClient.setEstopLock(true);
      });
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      act(() => {
        rosClient.setEstopLock(false);
        vi.advanceTimersByTime(3000);
      });

      // No heartbeat, no release burst, no reconnect backoff pending.
      expect(vi.getTimerCount()).toBe(0);

      ws.send.mockClear();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(ws.send).not.toHaveBeenCalled();
    });

    it('is idempotent — a second engage does not stack a second heartbeat', () => {
      openSocket();

      act(() => {
        rosClient.setEstopLock(true);
      });
      const timers = vi.getTimerCount();

      act(() => {
        rosClient.setEstopLock(true);
      });
      expect(vi.getTimerCount()).toBe(timers);
    });

    it('refuses to latch the lock when the socket is down', () => {
      // No connect at all: nothing can reach the mux, so the client must not
      // claim the robot is locked.
      expect(rosClient.setEstopLock(true)).toBe(false);
      expect(rosClient.isEstopEngaged()).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('reports heartbeat honestly and keeps holding after the React tree unmounts', () => {
      const ws = openSocket();
      const hook = renderHook(() => useCockpitEstop());

      expect(hook.result.current.engaged).toBe(false);

      act(() => {
        rosClient.setEstopLock(true);
      });
      expect(hook.result.current.engaged).toBe(true);
      expect(hook.result.current.heartbeat).toBe(true);

      // A dropped socket must stop claiming a live heartbeat, while intent
      // (what reconnect will re-assert) stays latched.
      act(() => {
        ws.triggerClose();
      });
      expect(hook.result.current.heartbeat).toBe(false);
      expect(hook.result.current.engaged).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1200);
        MockWebSocket.latestInstance?.triggerOpen();
      });
      const live = MockWebSocket.latestInstance!;
      expect(hook.result.current.heartbeat).toBe(true);

      // The heartbeat is client state, not effect state: unmounting the whole
      // cockpit must not mute an engaged stop.
      hook.unmount();
      live.send.mockClear();
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(estopPublishes(live).length).toBeGreaterThanOrEqual(2);
      expect(estopPublishes(live).every((v) => v === true)).toBe(true);
    });
  });
});
