import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rosClient } from '@/lib/ros/client';
import { getEstopState } from '@/lib/ros/estop-store';

/**
 * Election tests run on REAL timers and a REAL BroadcastChannel.
 *
 * The protocol is defined by message round-trips between tabs, so faking either
 * one would test the mock instead of the mechanism. The costs are a few hundred
 * ms of genuine waiting, which is the price of exercising the actual paths that
 * decide whether an operator can reach the e-stop.
 */
const CHANNEL = 'beast-cockpit-estop-writer';

// One macrotask hop is enough for BroadcastChannel delivery in jsdom.
const flush = () => new Promise((r) => setTimeout(r, 20));

// Tab ids are UUIDs (hex + dashes). '0' sorts below every one of them and
// 'zzzz' sorts above, which lets a test pin its rank without knowing the id.
const LOWER = '0';
const HIGHER = 'zzzz';

type Msg = { k: 'hello' | 'mine' | 'yield'; from: string; engaged?: boolean };

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

describe('e-stop single-writer election', () => {
  let peer: BroadcastChannel;
  let heard: Msg[];
  let release: (() => void) | null = null;

  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
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
    rosClient.connect('wss://beast-test-url:9090');
    MockWebSocket.latestInstance!.triggerOpen();
    return MockWebSocket.latestInstance!;
  };

  it('claims the role immediately so the stop button is never dead on mount', async () => {
    await claim();
    expect(getEstopState().writer).toBe(true);
  });

  it('yields to a lower-id peer when it holds no stop', async () => {
    await claim();

    peer.postMessage({ k: 'hello', from: LOWER, engaged: false } satisfies Msg);
    await flush();

    expect(getEstopState().writer).toBe(false);
  });

  // ── N1 ────────────────────────────────────────────────────────────────────
  it('REFUSES to yield while actively holding a stop, even to a lower id', async () => {
    openSocket();
    await claim();

    expect(rosClient.setEstopLock(true)).toBe(true);
    expect(rosClient.isEstopEngaged()).toBe(true);

    peer.postMessage({ k: 'hello', from: LOWER, engaged: false } satisfies Msg);
    await flush();

    // Demotion here would be unrecoverable: it gates new commands but cannot
    // stop the running heartbeat, so this tab would keep publishing `true`
    // while its own UI refused to release, and the new writer's release burst
    // would be overwritten within 500 ms. The robot would stay locked with no
    // tab able to clear it.
    expect(getEstopState().writer).toBe(true);
    expect(heard.some((m) => m.k === 'mine')).toBe(true);
  });

  it('refuses to yield on a direct `mine` while holding a stop', async () => {
    openSocket();
    await claim();
    rosClient.setEstopLock(true);

    peer.postMessage({ k: 'mine', from: LOWER } satisfies Msg);
    await flush();

    expect(getEstopState().writer).toBe(true);
  });

  it('yields to a peer that IS holding a stop, even with a higher id', async () => {
    await claim();

    peer.postMessage({ k: 'hello', from: HIGHER, engaged: true } satisfies Msg);
    await flush();

    // Holding outranks id in both directions, or the rule would not be a rule.
    expect(getEstopState().writer).toBe(false);
  });

  it('advertises its own engaged flag so peers can rank it', async () => {
    openSocket();
    await claim();
    rosClient.setEstopLock(true);

    peer.postMessage({ k: 'hello', from: HIGHER } satisfies Msg);
    await flush();

    const mine = heard.find((m) => m.k === 'mine');
    expect(mine?.engaged).toBe(true);
  });

  // ── N2 ────────────────────────────────────────────────────────────────────
  it('recovers the role when the writer tab CLOSES without yielding', async () => {
    await claim();

    // An incumbent answers once, so this tab stands down…
    peer.postMessage({ k: 'mine', from: LOWER } satisfies Msg);
    await flush();
    expect(getEstopState().writer).toBe(false);

    // …then that tab is closed. Nothing answers the periodic re-probe, so this
    // tab must promote itself rather than sit forever with a dead stop button
    // captioned with a tab that no longer exists.
    await new Promise((r) => setTimeout(r, 1600));
    expect(getEstopState().writer).toBe(true);
  }, 10_000);

  it('promotes on an unanswered on-demand probe', async () => {
    await claim();
    peer.postMessage({ k: 'mine', from: LOWER } satisfies Msg);
    await flush();
    expect(getEstopState().writer).toBe(false);

    rosClient.probeEstopWriter();
    await new Promise((r) => setTimeout(r, 400));

    expect(getEstopState().writer).toBe(true);
  });

  it('does NOT promote while a live incumbent still answers', async () => {
    await claim();
    peer.postMessage({ k: 'mine', from: LOWER } satisfies Msg);
    await flush();
    expect(getEstopState().writer).toBe(false);

    // A still-open incumbent answers every probe.
    peer.onmessage = (ev: MessageEvent<Msg>) => {
      heard.push(ev.data);
      if (ev.data.k === 'hello') peer.postMessage({ k: 'mine', from: LOWER } satisfies Msg);
    };

    rosClient.probeEstopWriter();
    await new Promise((r) => setTimeout(r, 500));

    expect(getEstopState().writer).toBe(false);
  });

  it('yields on pagehide, which is what a closing tab actually fires', async () => {
    await claim();

    window.dispatchEvent(new Event('pagehide'));
    await flush();

    expect(heard.some((m) => m.k === 'yield')).toBe(true);
  });

  it('does not yield on pagehide while holding a stop', async () => {
    openSocket();
    await claim();
    rosClient.setEstopLock(true);

    window.dispatchEvent(new Event('pagehide'));
    await flush();

    // The heartbeat outlives the page teardown by design; handing the role away
    // would leave the surviving tab unable to clear a lock this one still holds.
    expect(heard.some((m) => m.k === 'yield')).toBe(false);
  });

  it('promotes a survivor when the writer yields', async () => {
    await claim();
    peer.postMessage({ k: 'mine', from: LOWER } satisfies Msg);
    await flush();
    expect(getEstopState().writer).toBe(false);

    peer.postMessage({ k: 'yield', from: LOWER } satisfies Msg);
    await flush();

    expect(getEstopState().writer).toBe(true);
  });

  // ── N11 ───────────────────────────────────────────────────────────────────
  // INVARIANT: a tab that is publishing the heartbeat is always reachable by
  // the election. Leaving the election while the heartbeat runs is N1's failure
  // shape re-entered through teardown.
  it('stays in the election after unmounting WHILE HOLDING a stop', async () => {
    openSocket();
    await claim();
    rosClient.setEstopLock(true);

    // Route change away from /cockpit. The socket and the 2 Hz `true` survive
    // this by design — so the channel must too.
    release?.();
    release = null;
    heard.length = 0;

    peer.postMessage({ k: 'hello', from: LOWER } satisfies Msg);
    await flush();

    // Unanswered here means the peer self-promotes, then cannot clear a lock
    // this tab keeps republishing every 500 ms.
    const mine = heard.find((m) => m.k === 'mine');
    expect(mine).toBeTruthy();
    expect(mine?.engaged).toBe(true);
    expect(getEstopState().writer).toBe(true);
    expect(rosClient.isEstopEngaged()).toBe(true);
  });

  it('does not let a peer self-promote while an unmounted tab still holds', async () => {
    const ws = openSocket();
    await claim();
    rosClient.setEstopLock(true);
    release?.();
    release = null;

    // Stand in for the peer's probe loop: ask, and only promote if unanswered.
    let peerAnswered = false;
    peer.onmessage = (ev: MessageEvent<Msg>) => {
      if (ev.data.k === 'mine') peerAnswered = true;
    };
    peer.postMessage({ k: 'hello', from: LOWER } satisfies Msg);
    // Past the 300 ms self-promotion grace AND past one 500 ms heartbeat beat,
    // so the next assertion sees the republish that would overwrite a release.
    await new Promise((r) => setTimeout(r, 700));

    expect(peerAnswered).toBe(true);

    // And the heartbeat really was still running throughout.
    const sends = ws.send.mock.calls
      .map((c) => JSON.parse(c[0]))
      .filter((m) => m.op === 'publish' && m.topic === '/cmd_vel_estop_lock');
    expect(sends.length).toBeGreaterThanOrEqual(2);
    expect(sends.every((m) => m.msg.data === true)).toBe(true);
  });

  it('remounts to exactly one writer with the heartbeat uninterrupted', async () => {
    const ws = openSocket();
    await claim();
    rosClient.setEstopLock(true);

    release?.();
    release = null;
    await flush();

    // Back to /cockpit. claimEstopWriter must re-arm a real teardown rather
    // than hand back a stub over stale state.
    ws.send.mockClear();
    release = rosClient.claimEstopWriter();
    await flush();

    expect(getEstopState().writer).toBe(true);
    expect(rosClient.isEstopEngaged()).toBe(true);

    // A peer that tries to take over still loses to the holder.
    peer.postMessage({ k: 'hello', from: LOWER } satisfies Msg);
    await flush();
    expect(getEstopState().writer).toBe(true);

    const stillBeating = ws.send.mock.calls
      .map((c) => JSON.parse(c[0]))
      .filter((m) => m.op === 'publish' && m.topic === '/cmd_vel_estop_lock');
    expect(stillBeating.every((m) => m.msg.data === true)).toBe(true);
  });

  it('hands back a REAL teardown on remount, not a stub over stale state', async () => {
    const ws = openSocket();
    await claim();
    rosClient.setEstopLock(true);

    // Leave while holding — we stay in the election (N11).
    release?.();
    release = null;
    await flush();

    // Come back. An early-return stub here would look fine right up until the
    // operator clears the stop and leaves again: the no-op teardown would
    // strand the writer role on a tab that is gone, and every peer would stay
    // permanently read-only with no way to command the e-stop.
    release = rosClient.claimEstopWriter();
    await flush();

    rosClient.setEstopLock(false);
    expect(rosClient.isEstopEngaged()).toBe(false);

    release?.();
    release = null;
    await flush();
    heard.length = 0;

    peer.postMessage({ k: 'hello', from: HIGHER } satisfies Msg);
    await flush();
    expect(heard.some((m) => m.k === 'mine')).toBe(false);
    void ws;
  });

  it('STILL yields on unmount when no stop is held', async () => {
    await claim();

    release?.();
    release = null;
    await flush();

    // The N2 recovery path must not regress into "never yields".
    expect(heard.some((m) => m.k === 'yield')).toBe(true);

    // And the tab really did leave: a later `hello` goes unanswered, so a peer
    // is free to promote itself.
    heard.length = 0;
    peer.postMessage({ k: 'hello', from: HIGHER } satisfies Msg);
    await flush();
    expect(heard.some((m) => m.k === 'mine')).toBe(false);
  });

  it('leaves clearEstopIntent out of the election entirely', async () => {
    await claim();
    peer.postMessage({ k: 'hello', from: LOWER } satisfies Msg);
    await flush();
    expect(getEstopState().writer).toBe(false);

    // Teardown hygiene must not silently win a role this tab lost.
    rosClient.clearEstopIntent();
    expect(getEstopState().writer).toBe(false);
  });
});

// ── STARTUP RACE ────────────────────────────────────────────────────────────
// Two real module instances, so this is tab-vs-tab rather than tab-vs-fixture.
describe('e-stop election startup race', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('settles on exactly one writer when two tabs claim simultaneously', async () => {
    vi.resetModules();
    const tabA = await import('@/lib/ros/client');
    const storeA = await import('@/lib/ros/estop-store');

    vi.resetModules();
    const tabB = await import('@/lib/ros/client');
    const storeB = await import('@/lib/ros/estop-store');

    expect(storeA).not.toBe(storeB); // genuinely separate "tabs"

    const releaseA = tabA.rosClient.claimEstopWriter();
    const releaseB = tabB.rosClient.claimEstopWriter();

    await new Promise((r) => setTimeout(r, 120));

    const writers = [storeA.getEstopState().writer, storeB.getEstopState().writer].filter(Boolean);
    expect(writers).toHaveLength(1);

    releaseA();
    releaseB();
    tabA.rosClient.resetEstopElection();
    tabB.rosClient.resetEstopElection();
  }, 10_000);
});
