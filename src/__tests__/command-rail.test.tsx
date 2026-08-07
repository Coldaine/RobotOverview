import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandRail } from "@/components/cockpit/CommandRail";

const mocks = vi.hoisted(() => ({
  publish: vi.fn<(topic: string, message: unknown) => boolean>(() => true),
  allowMotion: true as boolean | null,
  isCharging: false,
  isEthernetConnected: false,
}));

vi.mock("@/lib/ros/client", () => ({
  rosClient: { publish: mocks.publish },
  useConnectionState: () => "connected",
  useCockpitBridge: () => ({ faults: [], deadTopics: [] }),
  useCockpitStatus: () => ({
    muxSource: "NONE",
    commandAge: null,
    publisherCount: 1,
    allowMotion: mocks.allowMotion,
    isCharging: mocks.isCharging,
    isEthernetConnected: mocks.isEthernetConnected,
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
  return mocks.publish.mock.calls.filter(([topic]) => topic === "/cmd_vel_ui");
}

function movingPublishes() {
  return twistPublishes().filter(([, message]) => {
    const twist = message as Twist;
    return twist.linear.x !== 0 || twist.angular.z !== 0;
  });
}

describe("CommandRail control lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.publish.mockClear();
    mocks.publish.mockReturnValue(true);
    mocks.allowMotion = true;
    mocks.isCharging = false;
    mocks.isEthernetConnected = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("publishes held intent at 10 Hz and exactly one zero on release", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));
    mocks.publish.mockClear();

    fireEvent.keyDown(window, { key: "w", repeat: false });
    expect(movingPublishes()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(300));
    expect(movingPublishes()).toHaveLength(4);

    fireEvent.keyUp(window, { key: "w" });
    const zeroes = twistPublishes().filter(([, message]) => {
      const twist = message as Twist;
      return twist.linear.x === 0 && twist.angular.z === 0;
    });
    expect(zeroes).toHaveLength(1);

    act(() => vi.advanceTimersByTime(300));
    expect(movingPublishes()).toHaveLength(4);
    expect(twistPublishes()).toHaveLength(5);
  });

  it("stops a held pointer intent when the pointer leaves", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));
    mocks.publish.mockClear();
    const forward = screen.getByTitle("Forward (W)") as HTMLButtonElement;
    forward.setPointerCapture = vi.fn();

    fireEvent.pointerDown(forward, { pointerId: 7 });
    act(() => vi.advanceTimersByTime(200));
    expect(movingPublishes()).toHaveLength(3);
    fireEvent.pointerUp(forward, { pointerId: 7 });
    act(() => vi.advanceTimersByTime(200));

    const lastPublish = twistPublishes().slice(-1)[0][1] as { linear: { x: number } };
    expect(lastPublish.linear.x).toBe(0);
  });

  it("does not gate drive controls while charging — no automatic interlock (ugv_safety_monitor removed 2026-08-07)", () => {
    mocks.isCharging = true;
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(500));
    mocks.publish.mockClear();

    fireEvent.keyDown(window, { key: "w", repeat: false });

    expect(mocks.publish).toHaveBeenCalled();
    expect(screen.queryByText(/drive disabled/i)).not.toBeInTheDocument();
  });

  it("gates drive controls when motion is disarmed", () => {
    mocks.allowMotion = false;
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(500));
    mocks.publish.mockClear();

    fireEvent.keyDown(window, { key: "w", repeat: false });

    expect(mocks.publish).not.toHaveBeenCalled();
    expect(
      screen.getAllByText(/motion disarmed/i).length,
    ).toBeGreaterThan(0);
  });

  it("does not gate drive controls on Ethernet connection — no automatic interlock (ugv_safety_monitor removed 2026-08-07)", () => {
    mocks.isEthernetConnected = true;
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(500));
    mocks.publish.mockClear();

    fireEvent.keyDown(window, { key: "w", repeat: false });

    expect(mocks.publish).toHaveBeenCalled();
    expect(screen.queryByText(/drive disabled/i)).not.toBeInTheDocument();
  });
});
