import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rosClient } from "@/lib/ros/client";
import { getEstopState } from "@/lib/ros/estop-store";

/**
 * Election tests run on REAL timers and a REAL BroadcastChannel.
 *
 * The protocol is defined by message round-trips between tabs, so faking either
 * one would test the mock instead of the mechanism. The costs are a few hundred
 * ms of genuine waiting, which is the price of exercising the actual paths that
 * decide whether an operator can reach the e-stop.
 */
const CHANNEL = "beast-cockpit-estop-writer";

// One macrotask hop is enough for BroadcastChannel delivery in jsdom.
const flush = () => new Promise((r) => setTimeout(r, 20));

// Tab ids are UUIDs (hex + dashes). '0' sorts below every one of them and
// 'zzzz' sorts above, which lets a test pin its rank without knowing the id.
const LOWER = "0";
const HIGHER = "zzzz";

type Msg = {
  k: "hello" | "mine" | "yield" | "handoff";
  from: string;
  to?: string;
  engagedAt?: number | null;
  releasePending?: boolean;
};

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
  static latestInstance: MockWebSocket | null = null;
  constructor(url: string) {
    this.url = url;
    MockWebSocket.latestInstance = this;
  }
  triggerOpen() {
    this.readyState = 1;
    this.onopen?.();
  }
}

describe("e-stop single-writer election", () => {
  let peer: BroadcastChannel;
  let heard: Msg[];
  let release: (() => void) | null = null;

  beforeEach(() => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    heard = [];
    peer = new BroadcastChannel(CHANNEL);
    peer.onmessage = (ev: MessageEvent<Msg>) => heard.push(ev.data);
  });

  afterEach(() => {
    release?.();
    release = null;
    peer.close();
    rosClient.clearEstopIntent();
    rosClient.resetEstopElection();
    rosClient.disconnect();
    MockWebSocket.latestInstance = null;
    vi.restoreAllMocks();
  });

  const claim = async () => {
    release = rosClient.claimEstopWriter();
    await flush();
    heard.length = 0;
  };

  const openSocket = () => {
    rosClient.connect("wss://beast-test-url:9090");
    MockWebSocket.latestInstance!.triggerOpen();
    return MockWebSocket.latestInstance!;
  };

  it("claims the role immediately so the stop button is never dead on mount", async () => {
    await claim();
    expect(getEstopState().writer).toBe(true);
  });

  it("yields to a lower-id peer when it holds no stop", async () => {
    await claim();

    peer.postMessage({ k: "hello", from: LOWER } satisfies Msg);
    await flush();

    expect(getEstopState().writer).toBe(false);
  });

  // ── N1 ────────────────────────────────────────────────────────────────────
  it("hands a held stop to a lower-id winner before yielding", async () => {
    openSocket();
    await claim();

    expect(rosClient.setEstopLock(true)).toBe(true);
    expect(rosClient.isEstopEngaged()).toBe(true);

    peer.postMessage({ k: "hello", from: LOWER } satisfies Msg);
    await flush();

    expect(getEstopState().writer).toBe(false);
    expect(getEstopState().heartbeat).toBe(false);
    expect(heard.some((m) => m.k === "handoff" && m.to === LOWER)).toBe(true);
  });

  it("hands off on a direct lower-id `mine` while holding a stop", async () => {
    openSocket();
    await claim();
    rosClient.setEstopLock(true);

    peer.postMessage({ k: "mine", from: LOWER } satisfies Msg);
    await flush();

    expect(getEstopState().writer).toBe(false);
    expect(getEstopState().heartbeat).toBe(false);
    expect(heard.some((m) => m.k === "handoff" && m.to === LOWER)).toBe(true);
  });

  it("does not yield to a higher-id peer", async () => {
    await claim();

    peer.postMessage({ k: "hello", from: HIGHER } satisfies Msg);
    await flush();

    expect(getEstopState().writer).toBe(true);
  });

  it("transfers the engagement timestamp in a held-stop handoff", async () => {
    openSocket();
    await claim();
    rosClient.setEstopLock(true);

    peer.postMessage({ k: "hello", from: LOWER } satisfies Msg);
    await flush();

    const handoff = heard.find((m) => m.k === "handoff");
    expect(handoff?.to).toBe(LOWER);
    expect(handoff?.engagedAt).toEqual(expect.any(Number));
  });

  // ── N2 ────────────────────────────────────────────────────────────────────
  it("recovers the role when the writer tab CLOSES without yielding", async () => {
    await claim();

    // An incumbent answers once, so this tab stands down…
    peer.postMessage({ k: "mine", from: LOWER } satisfies Msg);
    await flush();
    expect(getEstopState().writer).toBe(false);

    // …then that tab is closed. Nothing answers the periodic re-probe, so this
    // tab must promote itself rather than sit forever with a dead stop button
    // captioned with a tab that no longer exists.
    await new Promise((r) => setTimeout(r, 1600));
    expect(getEstopState().writer).toBe(true);
  }, 10_000);

  it("promotes on an unanswered on-demand probe", async () => {
    await claim();
    peer.postMessage({ k: "mine", from: LOWER } satisfies Msg);
    await flush();
    expect(getEstopState().writer).toBe(false);

    rosClient.probeEstopWriter();
    await new Promise((r) => setTimeout(r, 400));

    expect(getEstopState().writer).toBe(true);
  });

  it("does NOT promote while a live incumbent still answers", async () => {
    await claim();
    peer.postMessage({ k: "mine", from: LOWER } satisfies Msg);
    await flush();
    expect(getEstopState().writer).toBe(false);

    // A still-open incumbent answers every probe.
    peer.onmessage = (ev: MessageEvent<Msg>) => {
      heard.push(ev.data);
      if (ev.data.k === "hello")
        peer.postMessage({ k: "mine", from: LOWER } satisfies Msg);
    };

    rosClient.probeEstopWriter();
    await new Promise((r) => setTimeout(r, 500));

    expect(getEstopState().writer).toBe(false);
  });

  it("yields on pagehide, which is what a closing tab actually fires", async () => {
    await claim();

    window.dispatchEvent(new Event("pagehide"));
    await flush();

    expect(heard.some((m) => m.k === "yield")).toBe(true);
  });

  it("does not yield on pagehide while holding a stop", async () => {
    openSocket();
    await claim();
    rosClient.setEstopLock(true);

    window.dispatchEvent(new Event("pagehide"));
    await flush();

    // The heartbeat outlives the page teardown by design; handing the role away
    // would leave the surviving tab unable to clear a lock this one still holds.
    expect(heard.some((m) => m.k === "yield")).toBe(false);
  });

  it("promotes a survivor when the writer yields", async () => {
    await claim();
    peer.postMessage({ k: "mine", from: LOWER } satisfies Msg);
    await flush();
    expect(getEstopState().writer).toBe(false);

    peer.postMessage({ k: "yield", from: LOWER } satisfies Msg);
    await flush();

    expect(getEstopState().writer).toBe(true);
  });

  it("leaves clearEstopIntent out of the election entirely", async () => {
    await claim();
    peer.postMessage({ k: "hello", from: LOWER } satisfies Msg);
    await flush();
    expect(getEstopState().writer).toBe(false);

    // Teardown hygiene must not silently win a role this tab lost.
    rosClient.clearEstopIntent();
    expect(getEstopState().writer).toBe(false);
  });
});

// ── STARTUP RACE ────────────────────────────────────────────────────────────
// Two real module instances, so this is tab-vs-tab rather than tab-vs-fixture.
describe("e-stop election startup race", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("settles on exactly one writer when two tabs claim simultaneously", async () => {
    vi.resetModules();
    const tabA = await import("@/lib/ros/client");
    const storeA = await import("@/lib/ros/estop-store");

    vi.resetModules();
    const tabB = await import("@/lib/ros/client");
    const storeB = await import("@/lib/ros/estop-store");

    expect(storeA).not.toBe(storeB); // genuinely separate "tabs"

    const releaseA = tabA.rosClient.claimEstopWriter();
    const releaseB = tabB.rosClient.claimEstopWriter();

    await new Promise((r) => setTimeout(r, 120));

    const writers = [
      storeA.getEstopState().writer,
      storeB.getEstopState().writer,
    ].filter(Boolean);
    expect(writers).toHaveLength(1);

    releaseA();
    releaseB();
    tabA.rosClient.resetEstopElection();
    tabB.rosClient.resetEstopElection();
  }, 10_000);
});
