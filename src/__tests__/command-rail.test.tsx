import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandRail } from '@/components/cockpit/CommandRail';

const mocks = vi.hoisted(() => ({
  publish: vi.fn<(topic: string, message: unknown) => boolean>(() => true),
  writer: true,
  commandReady: true,
  allowMotion: true as boolean | null,
}));

vi.mock('@/lib/ros/client', () => ({
  ESTOP_MUX_SOURCE: 'E-STOP lock',
  rosClient: { publish: mocks.publish },
  useConnectionState: () => 'connected',
  useCockpitBridge: () => ({ faults: [], deadTopics: [] }),
  useCockpitEstop: () => ({
    engaged: false,
    heartbeat: false,
    releasing: false,
    engagedAt: null,
    writer: mocks.writer,
    commandReady: mocks.commandReady,
  }),
  useCockpitStatus: () => ({
    muxSource: 'NONE',
    commandAge: null,
    publisherCount: 1,
    watchdogArmed: true,
    watchdogFired: false,
    allowMotion: mocks.allowMotion,
    wifiRssi: null,
    diskFree: null,
    cpuTemp: null,
    gpuTemp: null,
    hasReceived: true,
    receivedAt: Date.now(),
    stale: false,
  }),
}));

type Twist = { linear: { x: number }; angular: { z: number } };

function twistPublishes() {
  return mocks.publish.mock.calls.filter(([topic]) => topic === '/cmd_vel_ui');
}

function movingPublishes() {
  return twistPublishes().filter(([, message]) => {
    const twist = message as Twist;
    return twist.linear.x !== 0 || twist.angular.z !== 0;
  });
}

describe('CommandRail control lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.publish.mockClear();
    mocks.publish.mockReturnValue(true);
    mocks.writer = true;
    mocks.commandReady = true;
    mocks.allowMotion = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishes held intent at 10 Hz and exactly one zero on release', () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));
    mocks.publish.mockClear();

    fireEvent.keyDown(window, { key: 'w', repeat: false });
    expect(movingPublishes()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(300));
    expect(movingPublishes()).toHaveLength(4);

    fireEvent.keyUp(window, { key: 'w' });
    const zeroes = twistPublishes().filter(([, message]) => {
      const twist = message as Twist;
      return twist.linear.x === 0 && twist.angular.z === 0;
    });
    expect(zeroes).toHaveLength(1);

    act(() => vi.advanceTimersByTime(300));
    expect(movingPublishes()).toHaveLength(4);
    expect(twistPublishes()).toHaveLength(5);
  });

  it('stops a held pointer intent when the pointer leaves', () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));
    mocks.publish.mockClear();
    const forward = screen.getByTitle('Forward (W)') as HTMLButtonElement;
    forward.setPointerCapture = vi.fn();

    fireEvent.pointerDown(forward, { pointerId: 7 });
    act(() => vi.advanceTimersByTime(200));
    expect(movingPublishes()).toHaveLength(3);
    fireEvent.pointerLeave(forward, { pointerId: 7 });
    act(() => vi.advanceTimersByTime(200));

    expect(movingPublishes()).toHaveLength(3);
    expect(twistPublishes()).toHaveLength(4);
  });

  it('keeps all command controls inert in a non-writer tab', () => {
    mocks.writer = false;
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(500));
    mocks.publish.mockClear();

    fireEvent.keyDown(window, { key: 'w', repeat: false });
    fireEvent.change(screen.getByTitle('Chassis headlights PWM duty'), {
      target: { value: '128' },
    });
    fireEvent.click(screen.getByTitle('Center Gimbal'));

    expect(mocks.publish).not.toHaveBeenCalled();
    expect(screen.getAllByText(/another tab owns the command surface/i).length).toBeGreaterThan(0);
  });
});
