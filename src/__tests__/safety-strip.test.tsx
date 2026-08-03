import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SafetyStrip } from '@/components/cockpit/SafetyStrip';

const mocks = vi.hoisted(() => ({
  allowMotion: true as boolean | null,
  isCharging: false,
  isEthernetConnected: false,
  receivedAt: 1_000,
  setMotionAllowed: vi.fn(),
}));

vi.mock('@/lib/ros/client', () => ({
  rosClient: { setMotionAllowed: mocks.setMotionAllowed },
  useConnectionState: () => 'connected',
  useCockpitVoltage: () => ({ voltage: null, stale: false, hasReceived: false }),
  useCockpitStatus: () => ({
    muxSource: null,
    cmdAge: null,
    pubCount: null,
    allowMotion: mocks.allowMotion,
    watchdogArmed: null,
    watchdogFired: null,
    wifiRssi: null,
    diskFree: null,
    cpuTemp: null,
    gpuTemp: null,
    isCharging: mocks.isCharging,
    isEthernetConnected: mocks.isEthernetConnected,
    hasReceived: true,
    receivedAt: mocks.receivedAt,
    stale: false,
  }),
}));

function motionState() {
  return screen.getByText('Motion state').parentElement!;
}

describe('SafetyStrip motion authority', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    mocks.allowMotion = true;
    mocks.isCharging = false;
    mocks.isEthernetConnected = false;
    mocks.receivedAt = 1_000;
    mocks.setMotionAllowed.mockReset();
    mocks.setMotionAllowed.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows LOCKED when charging even if motion is currently allowed', () => {
    mocks.isCharging = true;

    render(<SafetyStrip />);

    expect(within(motionState()).getByText('LOCKED')).toBeInTheDocument();
    expect(within(motionState()).queryByText('ARMED')).not.toBeInTheDocument();
  });

  it('shows UNCONFIRMED as the primary state after a failed service call', async () => {
    mocks.setMotionAllowed.mockResolvedValue({ ok: false, message: 'bridge refused' });
    render(<SafetyStrip />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /DISARM/i }));
    });

    expect(within(motionState()).getByText('UNCONFIRMED')).toBeInTheDocument();
    expect(within(motionState()).queryByText('ARMED')).not.toBeInTheDocument();
  });

  it('shows UNCONFIRMED when the service echo times out', () => {
    const view = render(<SafetyStrip />);
    fireEvent.click(screen.getByRole('button', { name: /DISARM/i }));

    mocks.receivedAt = 5_001;
    view.rerender(<SafetyStrip />);

    expect(within(motionState()).getByText('UNCONFIRMED')).toBeInTheDocument();
    expect(within(motionState()).queryByText('ARMED')).not.toBeInTheDocument();
  });

  it('keeps DISARM enabled and calls the safe direction when state is unknown', () => {
    mocks.allowMotion = null;
    render(<SafetyStrip />);
    const button = screen.getByRole('button', { name: /DISARM/i });

    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(mocks.setMotionAllowed).toHaveBeenCalledWith(false);
  });

  it('requires a two-second hold to re-arm from confirmed disarmed state', async () => {
    mocks.allowMotion = false;
    render(<SafetyStrip />);
    const button = screen.getByRole('button', { name: /RE-ARM/i });

    fireEvent.pointerDown(button);
    expect(mocks.setMotionAllowed).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1_999);
    });
    expect(mocks.setMotionAllowed).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(mocks.setMotionAllowed).toHaveBeenCalledWith(true);
  });
});
