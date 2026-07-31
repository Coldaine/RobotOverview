import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  rosClient,
  useConnectionState,
  useCockpitVoltage,
  useCockpitOdom,
  useCockpitOverheadClearance,
  useCockpitScan,
  useCockpitStatus,
  useCockpitEstop,
  useCockpitBridge,
  useCockpitDiagnostics,
  ROS_SUBSCRIPTIONS,
  ROS_PUBLICATIONS,
  LIDAR_CROP_SECTOR_DEG,
} from '@/lib/ros/client';
import { renderHook, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
    this.triggerRaw(JSON.stringify(data));
  }

  /**
   * Deliver a payload EXACTLY as it came off the wire. Required for anything
   * testing malformed JSON: `triggerMessage` would serialise NaN to `null` and
   * quietly turn the assertion into a tautology.
   */
  triggerRaw(raw: string) {
    if (this.onmessage) this.onmessage({ data: raw });
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

function wireOps(ws: MockWebSocket): Array<{ op: string; topic?: string; type?: string; id?: string }> {
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

    const subscribeCalls = wireOps(MockWebSocket.latestInstance!).filter((c) => c.op === 'subscribe');
    expect(subscribeCalls.some((s) => s.topic === '/scan')).toBe(true);

    // Close and test reconnect
    act(() => {
      MockWebSocket.latestInstance?.triggerClose();
    });

    expect(result.current).toBe('disconnected');

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current).toBe('connecting');
  });

  it("manages topic slice snapshot identity and doesn't trigger unrelated notifications", () => {
    openSocket();

    const voltageHook = renderHook(() => useCockpitVoltage());
    const odomHook = renderHook(() => useCockpitOdom());

    const initialVoltage = voltageHook.result.current;
    const initialOdom = odomHook.result.current;

    act(() => {
      MockWebSocket.latestInstance?.triggerMessage({
        op: 'publish',
        topic: '/ugv/voltage',
        msg: { voltage: 11.5 },
      });
    });

    // Voltage hook should see new value, but odom hook MUST stay referentially stable!
    expect(voltageHook.result.current.voltage).toBe(11.5);
    expect(voltageHook.result.current.hasReceived).toBe(true);
    expect(voltageHook.result.current).not.toBe(initialVoltage);
    expect(odomHook.result.current).toBe(initialOdom); // REFERENTIALLY EQUAL
  });

  // ── ROBOT MESSAGE-TYPE CONTRACT ───────────────────────────────────────────
  // DDS matches by type. A wrong type string means the robot's subscriber never
  // matches and the control is silently dead — the exact failure that left the
  // headlights and the steady toggle inert. Pin every string against
  // ugv_ws@fc1c29e so a "harmonising" edit has to break a test to land.
  describe('message-type contract', () => {
    const EXPECTED_SUBSCRIPTIONS: Record<string, string> = {
      '/ugv/voltage': 'sensor_msgs/msg/BatteryState',
      '/scan': 'sensor_msgs/msg/LaserScan',
      '/odom': 'nav_msgs/msg/Odometry',
      '/imu/raw': 'sensor_msgs/msg/Imu',
      '/cockpit/overhead_clearance': 'std_msgs/msg/Float32',
      '/cockpit/status': 'diagnostic_msgs/msg/DiagnosticArray',
      '/diagnostics': 'diagnostic_msgs/msg/DiagnosticArray',
      '/ugv/allow_motion': 'std_msgs/msg/Bool',
      '/ugv/watchdog_state': 'diagnostic_msgs/msg/DiagnosticStatus',
      '/oak/rgb/image_raw/compressed': 'sensor_msgs/msg/CompressedImage',
      '/cockpit/depth/compressed': 'sensor_msgs/msg/CompressedImage',
    };

    const EXPECTED_PUBLICATIONS: Record<string, string> = {
      '/cmd_vel_ui': 'geometry_msgs/msg/Twist',
      // Robot subscriber is Float32MultiArray. Int32MultiArray never matches.
      '/ugv/led_ctrl': 'std_msgs/msg/Float32MultiArray',
      // ros2_control controller — genuinely Float64. Do NOT harmonise with the
      // Float32 topic above; they are different robot-side subscribers.
      '/pt_joint_position_controller/commands': 'std_msgs/msg/Float64MultiArray',
      '/ugv/pt_steady_ctrl': 'std_msgs/msg/Float32MultiArray',
      '/cmd_vel_estop_lock': 'std_msgs/msg/Bool',
    };

    it('declares exactly the robot-side topic set', () => {
      expect(Object.fromEntries(ROS_SUBSCRIPTIONS.map((s) => [s.topic, s.type]))).toEqual(
        EXPECTED_SUBSCRIPTIONS,
      );
      expect(Object.fromEntries(ROS_PUBLICATIONS.map((p) => [p.topic, p.type]))).toEqual(
        EXPECTED_PUBLICATIONS,
      );
    });

    it('puts those exact types on the wire, with attributable ids', () => {
      const ws = openSocket();
      const ops = wireOps(ws);

      Object.entries(EXPECTED_SUBSCRIPTIONS).forEach(([topic, type]) => {
        const op = ops.find((o) => o.op === 'subscribe' && o.topic === topic);
        expect(op, `no subscribe for ${topic}`).toBeTruthy();
        expect(op!.type).toBe(type);
        // Without ids, a glob-whitelist denial is unattributable.
        expect(op!.id).toBe(`sub:${topic}`);
      });

      Object.entries(EXPECTED_PUBLICATIONS).forEach(([topic, type]) => {
        const op = ops.find((o) => o.op === 'advertise' && o.topic === topic);
        expect(op, `no advertise for ${topic}`).toBeTruthy();
        expect(op!.type).toBe(type);
        expect(op!.id).toBe(`adv:${topic}`);
      });
    });

    it('never subscribes /imu/data — nothing publishes it on this robot', () => {
      const ws = openSocket();
      const topics = wireOps(ws).map((o) => o.topic);
      expect(topics).not.toContain('/imu/data');
      expect(topics).toContain('/imu/raw');
    });

    it('caps the image subscriptions at one queued frame', () => {
      const ws = openSocket();
      const images = wireOps(ws).filter(
        (o) => o.op === 'subscribe' && typeof o.topic === 'string' && o.topic.includes('compressed'),
      ) as Array<{ queue_length?: number }>;
      expect(images).toHaveLength(2);
      images.forEach((op) => expect(op.queue_length).toBe(1));
    });

    it('raises the bridge status level so refusals are not silent', () => {
      const ws = openSocket();
      expect(wireOps(ws).some((o) => o.op === 'set_level')).toBe(true);
    });
  });

  // ── MALFORMED JSON FROM THE BRIDGE ────────────────────────────────────────
  // rosbridge emits float NaN/Infinity as BARE tokens, which are not valid JSON.
  // These payloads are raw strings on purpose: JSON.stringify would turn them
  // into `null` and the test would prove nothing.
  describe('non-finite defence (raw wire payloads)', () => {
    it('survives bare NaN/Infinity tokens instead of dropping the whole frame', () => {
      openSocket();
      const scanHook = renderHook(() => useCockpitScan());

      act(() => {
        MockWebSocket.latestInstance?.triggerRaw(
          '{"op":"publish","topic":"/scan","msg":{"ranges":[1.0,NaN,Infinity,-Infinity,2.0],' +
            '"angle_min":0,"angle_max":0,"angle_increment":0,"range_min":0.1,"range_max":10.0}}',
        );
      });

      // The frame parsed at all (the old client threw in JSON.parse and lost it)
      // and the non-finite bins were dropped rather than rendered.
      expect(scanHook.result.current.hasReceived).toBe(true);
      expect(scanHook.result.current.points.map((p) => p.range)).toEqual([1.0, 2.0]);
    });

    it('renders a NaN voltage as unknown, not as zero volts', () => {
      openSocket();
      const voltageHook = renderHook(() => useCockpitVoltage());

      act(() => {
        MockWebSocket.latestInstance?.triggerRaw(
          '{"op":"publish","topic":"/ugv/voltage","msg":{"voltage":NaN}}',
        );
      });

      expect(voltageHook.result.current.voltage).toBeNull();
    });

    // ── N6: repair numbers, never the robot's words ─────────────────────────
    it('leaves NaN INSIDE a quoted string alone while repairing a bare one', () => {
      openSocket();
      const diagHook = renderHook(() => useCockpitDiagnostics());

      // One frame, both cases: a bare NaN that must become null, and the same
      // token inside operator-facing text that must survive untouched.
      act(() => {
        MockWebSocket.latestInstance?.triggerRaw(
          '{"op":"publish","topic":"/diagnostics","msg":{"status":[{"name":"imu",' +
            '"level":1,"message":"covariance NaN, using defaults",' +
            '"values":[{"key":"bias","value":"x"}]}],' +
            '"header":{"stamp":{"sec":NaN,"nanosec":0}}}}',
        );
      });

      expect(diagHook.result.current.items).toHaveLength(1);
      // A blind regex rewrites this to "covariance null, using defaults" —
      // editing the robot's words while claiming to repair its numbers.
      expect(diagHook.result.current.items[0].message).toBe('covariance NaN, using defaults');
      // …and the bare token in the header still got repaired.
      expect(diagHook.result.current.items[0].stampMs).toBeNull();
    });

    it('does not mistake an escaped quote for the end of a string', () => {
      openSocket();
      const diagHook = renderHook(() => useCockpitDiagnostics());

      act(() => {
        MockWebSocket.latestInstance?.triggerRaw(
          '{"op":"publish","topic":"/diagnostics","msg":{"status":[{"name":"imu",' +
            '"level":1,"message":"said \\"NaN\\" loudly","values":[]}],' +
            '"header":{"stamp":{"sec":NaN,"nanosec":0}}}}',
        );
      });

      expect(diagHook.result.current.items[0].message).toBe('said "NaN" loudly');
    });

    // ── N7: no lookbehind — it is a PARSE-time SyntaxError on iOS Safari <16.4,
    // which would take down every route that imports this module, on a platform
    // the spec names as a core use case.
    it('uses no lookbehind assertions anywhere in the client', () => {
      const source = readFileSync(resolve(process.cwd(), 'src/lib/ros/client.ts'), 'utf8');
      expect(source).not.toMatch(/\(\?<[=!]/);
    });

    it('rejects a non-finite clearance', () => {
      openSocket();
      const clearanceHook = renderHook(() => useCockpitOverheadClearance());

      act(() => {
        MockWebSocket.latestInstance?.triggerRaw(
          '{"op":"publish","topic":"/cockpit/overhead_clearance","msg":{"data":Infinity}}',
        );
      });

      expect(clearanceHook.result.current.meters).toBeNull();
    });
  });

  // ── LiDAR CROP ────────────────────────────────────────────────────────────
  describe('LiDAR blind-sector crop', () => {
    // 360 bins starting at 0 rad with a 1° increment, so bin index == bearing in
    // degrees and sector membership is exact rather than approximate.
    const send360 = () => {
      const ranges = Array(360).fill(2.0);
      act(() => {
        MockWebSocket.latestInstance?.triggerMessage({
          op: 'publish',
          topic: '/scan',
          msg: {
            ranges,
            angle_min: 0,
            angle_max: Math.PI * 2,
            angle_increment: (Math.PI * 2) / 360,
            range_min: 0.1,
            range_max: 10.0,
          },
        });
      });
    };

    const degreesOf = (points: Array<{ angle: number }>) =>
      points.map((p) => Math.round((p.angle * 180) / Math.PI));

    it('drops exactly the declared sector and keeps everything else', () => {
      openSocket();
      const scanHook = renderHook(() => useCockpitScan());
      send360();

      const { startDeg, endDeg } = LIDAR_CROP_SECTOR_DEG;
      const expectedDropped: number[] = [];
      const expectedRetained: number[] = [];
      for (let deg = 0; deg < 360; deg++) {
        (deg >= startDeg && deg <= endDeg ? expectedDropped : expectedRetained).push(deg);
      }

      const retained = degreesOf(scanHook.result.current.points);

      // Absolute membership on BOTH sides — not just "fewer than 360".
      expect(retained).toEqual(expectedRetained);
      expect(retained).toHaveLength(270);
      expectedDropped.forEach((deg) => expect(retained).not.toContain(deg));

      // Boundary bins, spelled out: 44 kept, 45 dropped, 134 dropped, 135 kept.
      expect(retained).toContain(44);
      expect(retained).not.toContain(45);
      expect(retained).not.toContain(134);
      expect(retained).toContain(135);
    });

    it('measures the scan rate from arrivals rather than asserting a nominal one', () => {
      openSocket();
      const scanHook = renderHook(() => useCockpitScan());

      send360();
      expect(scanHook.result.current.intervalMs).toBeNull(); // one sample proves nothing

      act(() => {
        vi.advanceTimersByTime(100);
      });
      send360();
      expect(scanHook.result.current.intervalMs).toBeCloseTo(100, 0);
    });
  });

  // ── STALENESS ─────────────────────────────────────────────────────────────
  describe('staleness', () => {
    it('marks a slice stale once its freshness budget lapses', () => {
      openSocket();
      const voltageHook = renderHook(() => useCockpitVoltage());

      act(() => {
        MockWebSocket.latestInstance?.triggerMessage({
          op: 'publish',
          topic: '/ugv/voltage',
          msg: { voltage: 11.5 },
        });
      });
      expect(voltageHook.result.current.stale).toBe(false);

      act(() => {
        vi.advanceTimersByTime(2500); // budget is 2 s
      });
      expect(voltageHook.result.current.stale).toBe(true);
      // The last good value is still available — it is just no longer "live".
      expect(voltageHook.result.current.voltage).toBe(11.5);
    });

    it('marks every slice stale the instant the socket closes', () => {
      const ws = openSocket();
      const voltageHook = renderHook(() => useCockpitVoltage());
      const scanHook = renderHook(() => useCockpitScan());

      act(() => {
        ws.triggerMessage({ op: 'publish', topic: '/ugv/voltage', msg: { voltage: 11.5 } });
      });
      expect(voltageHook.result.current.stale).toBe(false);

      act(() => {
        ws.triggerClose();
      });

      // No waiting for the per-slice budget: the link is gone, nothing is live.
      expect(voltageHook.result.current.stale).toBe(true);
      expect(scanHook.result.current.stale).toBe(true);
    });

    it('reports UNKNOWN (not a default) for a topic that never published', () => {
      openSocket();
      const statusHook = renderHook(() => useCockpitStatus());

      expect(statusHook.result.current.hasReceived).toBe(false);
      // `allowMotion: false` would read as "the robot says motion is locked".
      // It has said nothing at all.
      expect(statusHook.result.current.allowMotion).toBeNull();
      expect(statusHook.result.current.muxSource).toBeNull();
      expect(statusHook.result.current.watchdogArmed).toBeNull();
    });

    it('clears has-received when a new connection opens', () => {
      const ws = openSocket();
      const voltageHook = renderHook(() => useCockpitVoltage());

      act(() => {
        ws.triggerMessage({ op: 'publish', topic: '/ugv/voltage', msg: { voltage: 11.5 } });
      });
      expect(voltageHook.result.current.hasReceived).toBe(true);

      act(() => {
        ws.triggerClose();
        vi.advanceTimersByTime(1100);
        MockWebSocket.latestInstance?.triggerOpen();
      });

      expect(voltageHook.result.current.hasReceived).toBe(false);
      expect(voltageHook.result.current.voltage).toBeNull();
    });
  });

  // ── ROBOT-REPORTED SAFETY STATE ───────────────────────────────────────────
  describe('status parsing', () => {
    it('reads allow_motion and the watchdog from their dedicated topics', () => {
      const ws = openSocket();
      const statusHook = renderHook(() => useCockpitStatus());

      act(() => {
        ws.triggerMessage({ op: 'publish', topic: '/ugv/allow_motion', msg: { data: true } });
        ws.triggerMessage({
          op: 'publish',
          topic: '/ugv/watchdog_state',
          msg: {
            name: 'cockpit_safety_watchdog',
            values: [
              { key: 'armed', value: 'true' },
              { key: 'fired', value: 'false' },
            ],
          },
        });
      });

      expect(statusHook.result.current.allowMotion).toBe(true);
      expect(statusHook.result.current.watchdogArmed).toBe(true);
      expect(statusHook.result.current.watchdogFired).toBe(false);
    });

    // ── N4: the 1 Hz roll-up must not clobber the dedicated topics ──────────
    it('keeps a fresh direct allow_motion over an aggregator placeholder', () => {
      const ws = openSocket();
      const statusHook = renderHook(() => useCockpitStatus());

      act(() => {
        ws.triggerMessage({ op: 'publish', topic: '/ugv/allow_motion', msg: { data: true } });
      });
      expect(statusHook.result.current.allowMotion).toBe(true);

      // The robot's aggregator emits a placeholder when it has nothing real.
      // Letting it win would defeat the very hedge those direct subscriptions
      // exist for — once a second, silently.
      act(() => {
        ws.triggerMessage({
          op: 'publish',
          topic: '/cockpit/status',
          msg: { status: [{ name: 'bringup', values: [{ key: 'allow_motion', value: 'false' }] }] },
        });
      });
      expect(statusHook.result.current.allowMotion).toBe(true);
    });

    it('keeps a fresh direct watchdog state over an aggregator placeholder', () => {
      const ws = openSocket();
      const statusHook = renderHook(() => useCockpitStatus());

      act(() => {
        ws.triggerMessage({
          op: 'publish',
          topic: '/ugv/watchdog_state',
          msg: { values: [{ key: 'armed', value: 'true' }, { key: 'fired', value: 'false' }] },
        });
      });
      expect(statusHook.result.current.watchdogArmed).toBe(true);

      act(() => {
        ws.triggerMessage({
          op: 'publish',
          topic: '/cockpit/status',
          msg: {
            status: [
              {
                name: 'cockpit_safety_watchdog',
                values: [{ key: 'armed', value: 'false' }, { key: 'fired', value: 'false' }],
              },
            ],
          },
        });
      });
      expect(statusHook.result.current.watchdogArmed).toBe(true);
    });

    it('lets the aggregator fill in once the direct topic has gone stale', () => {
      const ws = openSocket();
      const statusHook = renderHook(() => useCockpitStatus());

      act(() => {
        ws.triggerMessage({ op: 'publish', topic: '/ugv/allow_motion', msg: { data: true } });
      });

      act(() => {
        vi.advanceTimersByTime(2500); // past the direct-topic authority window
        ws.triggerMessage({
          op: 'publish',
          topic: '/cockpit/status',
          msg: { status: [{ name: 'bringup', values: [{ key: 'allow_motion', value: 'false' }] }] },
        });
      });

      // Deference is to a FRESH direct value, not to a permanently latched one.
      expect(statusHook.result.current.allowMotion).toBe(false);
    });

    it('fills in from the aggregator when the direct topic never published', () => {
      const ws = openSocket();
      const statusHook = renderHook(() => useCockpitStatus());

      act(() => {
        ws.triggerMessage({
          op: 'publish',
          topic: '/cockpit/status',
          msg: { status: [{ name: 'bringup', values: [{ key: 'allow_motion', value: 'true' }] }] },
        });
      });
      expect(statusHook.result.current.allowMotion).toBe(true);
    });

    // ── N10 ─────────────────────────────────────────────────────────────────
    it('treats a non-boolean allow_motion payload as unknown, not as locked', () => {
      const ws = openSocket();
      const statusHook = renderHook(() => useCockpitStatus());

      act(() => {
        ws.triggerMessage({ op: 'publish', topic: '/ugv/allow_motion', msg: { data: 'true' } });
      });

      // `msg.data === true` would render a malformed frame as a confident
      // "robot reports motion locked".
      expect(statusHook.result.current.allowMotion).toBeNull();
    });

    it('keeps the mux source verbatim and does not invent NONE', () => {
      const ws = openSocket();
      const statusHook = renderHook(() => useCockpitStatus());

      act(() => {
        ws.triggerMessage({
          op: 'publish',
          topic: '/cockpit/status',
          msg: {
            status: [
              {
                name: 'twist_mux',
                values: [
                  { key: 'active_source', value: 'E-STOP lock' },
                  { key: 'command_age', value: '-1' },
                  { key: 'publisher_count', value: '2' },
                ],
              },
            ],
          },
        });
      });

      expect(statusHook.result.current.muxSource).toBe('E-STOP lock');
      expect(statusHook.result.current.cmdAge).toBe(-1); // robot's "unknown"
      expect(statusHook.result.current.pubCount).toBe(2);
    });
  });

  // ── ROSBRIDGE STATUS FRAMES ───────────────────────────────────────────────
  describe('bridge status frames', () => {
    it('attributes an error frame to the topic whose op was refused', () => {
      const ws = openSocket();
      const bridgeHook = renderHook(() => useCockpitBridge());

      act(() => {
        ws.triggerMessage({
          op: 'status',
          level: 'error',
          msg: 'Topic /ugv/led_ctrl is not in the whitelist',
          id: 'adv:/ugv/led_ctrl',
        });
      });

      expect(bridgeHook.result.current.deadTopics).toContain('/ugv/led_ctrl');
      expect(bridgeHook.result.current.faults[0].level).toBe('error');
      expect(bridgeHook.result.current.faults[0].topic).toBe('/ugv/led_ctrl');
    });

    it('records a warning without declaring the control dead', () => {
      const ws = openSocket();
      const bridgeHook = renderHook(() => useCockpitBridge());

      act(() => {
        ws.triggerMessage({ op: 'status', level: 'warning', msg: 'slow subscriber', id: 'sub:/scan' });
      });

      expect(bridgeHook.result.current.faults).toHaveLength(1);
      expect(bridgeHook.result.current.deadTopics).toEqual([]);
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

    it('leaves no e-stop timers behind once the release burst finishes', () => {
      const ws = openSocket();
      // Baseline excludes the always-on staleness ticker, which is a property of
      // being connected rather than of the e-stop.
      const baseline = vi.getTimerCount();

      act(() => {
        rosClient.setEstopLock(true);
      });
      expect(vi.getTimerCount()).toBeGreaterThan(baseline);

      act(() => {
        rosClient.setEstopLock(false);
        vi.advanceTimersByTime(3000);
      });

      // No heartbeat, no release burst, no reconnect backoff pending.
      expect(vi.getTimerCount()).toBe(baseline);

      ws.send.mockClear();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(estopPublishes(ws)).toHaveLength(0);
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

    it('drops local intent when a release cannot reach the mux', () => {
      const ws = openSocket();
      act(() => {
        rosClient.setEstopLock(true);
        ws.triggerClose();
      });

      act(() => {
        expect(rosClient.setEstopLock(false)).toBe(false);
      });
      expect(rosClient.isEstopEngaged()).toBe(false);

      act(() => {
        vi.advanceTimersByTime(1200);
        MockWebSocket.latestInstance?.triggerOpen();
      });
      expect(estopPublishes(MockWebSocket.latestInstance!)).toHaveLength(0);
    });

    it('stamps when intent latched so the UI can escalate an unconfirmed stop', () => {
      openSocket();
      const hook = renderHook(() => useCockpitEstop());

      expect(hook.result.current.engagedAt).toBeNull();
      act(() => {
        rosClient.setEstopLock(true);
      });
      expect(hook.result.current.engagedAt).toBeTypeOf('number');

      act(() => {
        rosClient.setEstopLock(false);
      });
      expect(hook.result.current.engagedAt).toBeNull();
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

  // ── RETURNING TO A COCKPIT THAT NEVER DISCONNECTED ────────────────────────
  describe('reconnecting to a live socket', () => {
    it('re-subscribes instead of early-returning on an already-open socket', () => {
      const ws = openSocket();
      ws.send.mockClear();

      // Same URL, socket still OPEN — the path taken when the operator returns
      // to the cockpit with an e-stop held. Previously this returned bare and
      // left the remounted page with no subscriptions.
      act(() => {
        rosClient.connect('wss://beast-test-url:9090');
      });

      const topics = wireOps(ws)
        .filter((o) => o.op === 'subscribe')
        .map((o) => o.topic);
      expect(topics).toContain('/scan');
      expect(topics).toContain('/cockpit/status');
    });

    it('unsubscribes the heavy streams without dropping the socket', () => {
      const ws = openSocket();
      ws.send.mockClear();

      act(() => {
        rosClient.releaseHeavyStreams();
      });

      const unsubscribed = wireOps(ws)
        .filter((o) => o.op === 'unsubscribe')
        .map((o) => o.topic);
      expect(unsubscribed).toEqual(
        expect.arrayContaining(['/scan', '/oak/rgb/image_raw/compressed', '/cockpit/depth/compressed']),
      );
      expect(ws.close).not.toHaveBeenCalled();
    });
  });
});
