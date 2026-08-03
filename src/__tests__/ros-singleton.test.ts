import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createBeastRosClient,
  resetBeastRosClientForTests,
  type ActionHandle,
  type RosHandle,
  type RosLibLike,
} from '@/server/beast/ros-singleton';

type Listener = (...args: unknown[]) => void;

function createMockRosLib() {
  const topics: Array<{ name: string; subscribe: ReturnType<typeof vi.fn> }> = [];
  const actions: Array<{ name: string; sendGoal: ReturnType<typeof vi.fn> }> = [];
  let ros: RosHandle | null = null;
  const listeners = new Map<string, Set<Listener>>();

  const roslib: RosLibLike = {
    Ros: class MockRos {
      isConnected = false;
      url: string | null = null;

      constructor() {
        ros = this as unknown as RosHandle;
      }

      on(event: string, cb: Listener) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(cb);
        return this;
      }

      off(event: string, cb: Listener) {
        listeners.get(event)?.delete(cb);
        return this;
      }

      connect(url: string) {
        this.url = url;
      }

      close() {
        this.isConnected = false;
        for (const cb of listeners.get('close') ?? []) cb();
      }

      /** test helper */
      __open() {
        this.isConnected = true;
        for (const cb of listeners.get('connection') ?? []) cb();
      }
    } as unknown as RosLibLike['Ros'],

    Topic: class MockTopic {
      name: string;
      subscribe = vi.fn();
      unsubscribe = vi.fn();

      constructor(opts: { name: string }) {
        this.name = opts.name;
        topics.push(this);
      }
    } as unknown as RosLibLike['Topic'],

    Action: class MockAction {
      name: string;
      sendGoal = vi.fn();
      cancelAllGoals = vi.fn();

      constructor(opts: { name: string }) {
        this.name = opts.name;
        actions.push(this);
      }
    } as unknown as RosLibLike['Action'],
  };

  return {
    roslib,
    topics,
    actions,
    getRos: () => ros as (RosHandle & { __open: () => void; url: string | null }) | null,
    emit: (event: string) => {
      for (const cb of listeners.get(event) ?? []) cb();
    },
  };
}

describe('BeastRosClient singleton', () => {
  beforeEach(() => {
    resetBeastRosClientForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetBeastRosClientForTests();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('stays unconfigured when BEAST_COCKPIT_WS_URL is unset', async () => {
    vi.stubEnv('BEAST_COCKPIT_WS_URL', '');
    const client = createBeastRosClient({ url: null, roslib: createMockRosLib().roslib });
    await client.start();
    expect(client.getConnectionState()).toBe('unconfigured');
    const snap = await client.getStatus();
    expect(snap.connection).toBe('unconfigured');
    expect(snap.lockReason).toMatch(/BEAST_COCKPIT_WS_URL unset/i);
    expect(snap.allowMotion).toBeNull();
  });

  it('connects, subscribes, and reconnects after close', async () => {
    const mock = createMockRosLib();
    const client = createBeastRosClient({
      url: 'wss://beast-test:9090',
      roslib: mock.roslib,
      reconnectMs: 1000,
    });

    await client.start();
    expect(client.getConnectionState()).toBe('connecting');
    mock.getRos()?.__open();
    expect(client.getConnectionState()).toBe('connected');
    expect(mock.topics.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        '/ugv/allow_motion',
        '/ugv/watchdog_state',
        '/ugv/voltage',
        '/scan',
      ]),
    );

    mock.getRos()?.close();
    expect(client.getConnectionState()).toBe('disconnected');

    await vi.advanceTimersByTimeAsync(1000);
    expect(client.getConnectionState()).toBe('connecting');
    mock.getRos()?.__open();
    expect(client.getConnectionState()).toBe('connected');
  });

  it('ingests allow_motion / voltage / scan into getStatus', async () => {
    const mock = createMockRosLib();
    const now = 1_700_000_000_000;
    const client = createBeastRosClient({
      url: 'wss://beast-test:9090',
      roslib: mock.roslib,
      now: () => now,
    });
    await client.start();
    mock.getRos()?.__open();

    client.__ingestTopicForTests('/ugv/allow_motion', { data: false });
    client.__ingestTopicForTests('/ugv/voltage', { voltage: 10.8 });
    client.__ingestTopicForTests('/scan', { ranges: [1, 2, 3] });
    client.__ingestTopicForTests('/ugv/watchdog_state', {
      values: [
        { key: 'armed', value: 'true' },
        { key: 'fired', value: 'false' },
      ],
    });

    const snap = await client.getStatus();
    expect(snap.allowMotion).toBe(false);
    expect(snap.voltage).toBe(10.8);
    expect(snap.scanAlive).toBe(true);
    expect(snap.watchdogArmed).toBe(true);
    expect(snap.watchdogFired).toBe(false);
  });

  it('refuses action dispatch when disconnected; sends when connected', async () => {
    const mock = createMockRosLib();
    const client = createBeastRosClient({
      url: 'wss://beast-test:9090',
      roslib: mock.roslib,
    });

    const refused = await client.driveOnHeading({ meters: 1 });
    expect(refused.status).toBe('bridge_unavailable');

    await client.start();
    mock.getRos()?.__open();

    const sent = await client.driveOnHeading({ meters: 1, speed: 0.1 });
    expect(sent).toMatchObject({ ok: true, status: 'dispatched' });
    const drive = mock.actions.find((a) => a.name === '/drive_on_heading') as
      | (ActionHandle & { sendGoal: ReturnType<typeof vi.fn> })
      | undefined;
    expect(drive?.sendGoal).toHaveBeenCalledOnce();
  });
});
