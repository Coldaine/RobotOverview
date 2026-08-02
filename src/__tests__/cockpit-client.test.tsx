import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CockpitClient } from '@/app/cockpit/CockpitClient';
import { rosClient } from '@/lib/ros/client';

// The real component, not just the hook: the unmount behaviour that keeps an
// engaged e-stop alive lives in CockpitClient's effect cleanup, and a hook-only
// test cannot see it.
class MockWebSocket {
  url: string;
  readyState = 0;
  send = vi.fn();
  close = vi.fn();
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  static OPEN = 1;
  static CONNECTING = 0;
  static latestInstance: MockWebSocket | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.latestInstance = this;
  }

  triggerOpen() {
    this.readyState = 1;
    if (this.onopen) this.onopen();
  }
}

const WS_URL = 'wss://beast-test-url:9090';

function ops(ws: MockWebSocket) {
  return ws.send.mock.calls.map((c) => JSON.parse(c[0]));
}

describe('CockpitClient', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    // Freeze the panels' own intervals (FPS sampling, staleness) so they cannot
    // fire outside act() and drown the run in warnings.
    vi.useFakeTimers();
  });

  afterEach(() => {
    rosClient.clearEstopIntent();
    rosClient.disconnect();
    MockWebSocket.latestInstance = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('degrades loudly when the transport env var is unset', () => {
    render(<CockpitClient wsUrl="" />);
    expect(screen.getByText(/COCKPIT DEGRADED/i)).toBeInTheDocument();
    expect(MockWebSocket.latestInstance).toBeNull();
  });

  it('connects and subscribes on mount', () => {
    render(<CockpitClient wsUrl={WS_URL} />);
    const ws = MockWebSocket.latestInstance!;
    expect(ws.url).toBe(WS_URL);

    act(() => {
      ws.triggerOpen();
    });

    const topics = ops(ws)
      .filter((o) => o.op === 'subscribe')
      .map((o) => o.topic);
    expect(topics).toContain('/scan');
    expect(topics).toContain('/imu/raw');
  });

  it('disconnects on unmount', () => {
    const view = render(<CockpitClient wsUrl={WS_URL} />);
    const ws = MockWebSocket.latestInstance!;
    act(() => {
      ws.triggerOpen();
    });

    view.unmount();
    expect(ws.close).toHaveBeenCalled();
  });

  it('surfaces a rosbridge error frame as a persistent banner', () => {
    render(<CockpitClient wsUrl={WS_URL} />);
    const ws = MockWebSocket.latestInstance!;
    act(() => {
      ws.triggerOpen();
      ws.onmessage?.({
        data: JSON.stringify({
          op: 'status',
          level: 'error',
          msg: 'Topic /ugv/led_ctrl is not in the whitelist',
          id: 'adv:/ugv/led_ctrl',
        }),
      });
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/rosbridge refused/i);
    expect(screen.getByRole('alert')).toHaveTextContent('/ugv/led_ctrl');
  });
});
