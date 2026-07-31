'use client';

import { useSyncExternalStore } from 'react';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface InboundMsg {
  data?: string | number;
  format?: string;
  voltage?: number;
  pose?: {
    pose?: {
      position?: { x?: number; y?: number };
      orientation?: { z?: number; w?: number };
    };
  };
  twist?: {
    twist?: {
      linear?: { x?: number };
      angular?: { z?: number };
    };
  };
  linear_acceleration?: { x?: number; y?: number; z?: number };
  angular_velocity?: { x?: number; y?: number; z?: number };
  status?: Array<{
    name?: string;
    message?: string;
    level?: number;
    hardware_id?: string;
    values?: Array<{ key: string; value: string }>;
  }>;
  ranges?: number[];
  angle_min?: number;
  angle_max?: number;
  angle_increment?: number;
  range_min?: number;
  range_max?: number;
}

export interface CockpitVoltage {
  voltage: number;
  percentage: number;
}

export interface CockpitOdom {
  x: number;
  y: number;
  yaw: number;
  linearSpeed: number;
  angularSpeed: number;
}

export interface CockpitImu {
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
}

export interface CockpitStatus {
  muxSource: string;
  cmdAge: number;
  pubCount: number;
  allowMotion: boolean;
  watchdogArmed: boolean;
  watchdogFired: boolean;
  wifiRssi: number;
  diskFree: string;
  cpuTemp: number;
  gpuTemp: number;
  systemLoading?: string;
}

export interface CockpitScanPoint {
  range: number;
  angle: number;
  x: number;
  y: number;
}

export interface CockpitScan {
  points: CockpitScanPoint[];
  angleMin: number;
  angleMax: number;
  angleIncrement: number;
  rangeMin: number;
  rangeMax: number;
}

export interface DiagnosticsItem {
  name: string;
  message: string;
  level: number;
  hardware_id?: string;
  values: Record<string, string>;
}

export interface CockpitEstop {
  /**
   * Operator intent — the stop is latched down. Survives component unmount and
   * socket drops; only an explicit release clears it.
   */
  engaged: boolean;
  /** The >= 1 Hz `true` republish is actually running on an open socket. */
  heartbeat: boolean;
  /** The post-release `false` burst is still in flight. */
  releasing: boolean;
}

// Parse a numeric field defensively — live diagnostics can carry "unknown",
// empty, or garbage strings that must never render as NaN.
function safeNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Memory-only stores for each topic
let connectionState: ConnectionState = 'disconnected';
let voltageState: CockpitVoltage = { voltage: 0, percentage: 0 };
let odomState: CockpitOdom = { x: 0, y: 0, yaw: 0, linearSpeed: 0, angularSpeed: 0 };
let imuState: CockpitImu = { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 };
let overheadClearance: number = 0;
let statusState: CockpitStatus = {
  muxSource: 'NONE',
  cmdAge: -1,
  pubCount: 0,
  allowMotion: false,
  watchdogArmed: false,
  watchdogFired: false,
  wifiRssi: -100,
  diskFree: 'unknown',
  cpuTemp: 0,
  gpuTemp: 0,
};
let diagnosticsState: DiagnosticsItem[] = [];
let scanState: CockpitScan = { points: [], angleMin: 0, angleMax: 0, angleIncrement: 0, rangeMin: 0, rangeMax: 0 };
let estopState: CockpitEstop = { engaged: false, heartbeat: false, releasing: false };

// Listeners per category
const listeners = {
  connection: new Set<() => void>(),
  voltage: new Set<() => void>(),
  odom: new Set<() => void>(),
  imu: new Set<() => void>(),
  clearance: new Set<() => void>(),
  status: new Set<() => void>(),
  diagnostics: new Set<() => void>(),
  scan: new Set<() => void>(),
  estop: new Set<() => void>(),
};

// Ref for reactive-image-rendering callbacks that bypass React state
const imageCallbacks = new Map<string, (url: string) => void>();

let socket: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 10000;
let lastWsUrl = '';

function notify(category: keyof typeof listeners) {
  for (const l of listeners[category]) {
    l();
  }
}

// ── E-STOP LOCK REPUBLISH CONTRACT ──────────────────────────────────────────
// The robot arbitrates motion with twist_mux. `/cmd_vel_estop_lock` is a lock
// topic at priority 255 configured `timeout: 0.0` (manual toggle), and
// twist_mux subscribes to lock topics with VOLATILE durability and a shallow
// queue. That imposes a hard client contract, because a one-shot publish is
// not sufficient:
//
//   1. MATCHING RACE — a volatile message only reaches subscriptions that are
//      already matched at the instant it is sent. A publisher that advertises
//      and immediately publishes can lose the race with discovery, and the
//      e-stop silently does nothing. That is the worst possible failure for
//      this control. (Over rosbridge the ROS-side publisher lives in the
//      long-lived rosbridge_websocket node, so the exposure is narrowed to the
//      first publish after an `advertise` — but it is not eliminated.)
//   2. MUX RESTART — lock state does not survive a twist_mux restart. A mux
//      that crashes and comes back starts RELEASED regardless of what was
//      published before, so an engaged e-stop can quietly un-engage itself
//      under the operator.
//
// THEREFORE: republish `{data: true}` at >= 1 Hz for the whole time the stop is
// held, and publish `{data: false}` repeatedly on release. We run 2 Hz for
// margin.
//
// LIFETIME — WHY THIS LIVES HERE AND NOT IN A REACT EFFECT:
// A safety heartbeat must not stop because a component unmounted. A
// `useEffect` interval dies on route change, Strict Mode's double invoke, or
// any remount, which would mute an engaged stop with no operator-visible
// signal. So the machine is module state in the ros client and the invariant
// is:
//
//     the heartbeat timer runs exactly while (operatorEngaged && socket OPEN)
//
// `operatorEngaged` outlives both the React tree and the socket. Reconnect
// re-advertises and resumes the heartbeat immediately (see
// advertiseAndSubscribe) because the mux may have restarted while we were
// gone. Only an explicit release clears the intent — and CockpitClient keeps
// the socket open on unmount while the stop is engaged, so navigating away
// cannot silence it either.
const ESTOP_TOPIC = '/cmd_vel_estop_lock';
const ESTOP_HEARTBEAT_MS = 500; // 2 Hz — contract floor is 1 Hz
const ESTOP_RELEASE_INTERVAL_MS = 400;
const ESTOP_RELEASE_SENDS = 4; // ~1.2 s of `false` before going quiet

let operatorEngaged = false;
let estopHeartbeatTimer: NodeJS.Timeout | null = null;
let estopReleaseTimer: NodeJS.Timeout | null = null;
let estopReleaseSends = 0;

function setEstopState(next: Partial<CockpitEstop>) {
  const merged = { ...estopState, ...next };
  if (
    merged.engaged === estopState.engaged &&
    merged.heartbeat === estopState.heartbeat &&
    merged.releasing === estopState.releasing
  ) {
    return; // keep the snapshot referentially stable for useSyncExternalStore
  }
  estopState = merged;
  notify('estop');
}

function publishEstopLock(value: boolean): boolean {
  return rosClient.publish(ESTOP_TOPIC, { data: value });
}

function stopEstopHeartbeat() {
  if (estopHeartbeatTimer) {
    clearInterval(estopHeartbeatTimer);
    estopHeartbeatTimer = null;
  }
  setEstopState({ heartbeat: false });
}

function stopEstopRelease() {
  if (estopReleaseTimer) {
    clearInterval(estopReleaseTimer);
    estopReleaseTimer = null;
  }
  estopReleaseSends = 0;
  setEstopState({ releasing: false });
}

function stopEstopTimers() {
  stopEstopHeartbeat();
  stopEstopRelease();
}

// Assert the lock now, then hold it. Idempotent — a second engage reuses the
// running interval instead of stacking a second one.
function startEstopHeartbeat(): boolean {
  stopEstopRelease();
  if (!publishEstopLock(true)) {
    // Socket went away. Drop the timer; the next successful connect resumes it
    // from advertiseAndSubscribe.
    stopEstopHeartbeat();
    return false;
  }
  if (!estopHeartbeatTimer) {
    estopHeartbeatTimer = setInterval(() => {
      if (!publishEstopLock(true)) stopEstopHeartbeat();
    }, ESTOP_HEARTBEAT_MS);
  }
  setEstopState({ heartbeat: true });
  return true;
}

// SSR compatible Server Snapshots (stable references)
const serverState = {
  connection: 'disconnected' as ConnectionState,
  voltage: { voltage: 0, percentage: 0 } as CockpitVoltage,
  odom: { x: 0, y: 0, yaw: 0, linearSpeed: 0, angularSpeed: 0 } as CockpitOdom,
  imu: { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 } as CockpitImu,
  clearance: 0,
  status: {
    muxSource: 'NONE',
    cmdAge: -1,
    pubCount: 0,
    allowMotion: false,
    watchdogArmed: false,
    watchdogFired: false,
    wifiRssi: -100,
    diskFree: 'unknown',
    cpuTemp: 0,
    gpuTemp: 0,
  } as CockpitStatus,
  diagnostics: [] as DiagnosticsItem[],
  scan: { points: [], angleMin: 0, angleMax: 0, angleIncrement: 0, rangeMin: 0, rangeMax: 0 } as CockpitScan,
  estop: { engaged: false, heartbeat: false, releasing: false } as CockpitEstop,
};

export const rosClient = {
  connect(url: string) {
    if (typeof window === 'undefined') return;
    if (socket && lastWsUrl === url) {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        return;
      }
    }
    lastWsUrl = url;
    this.disconnect();
    this.initiateConnection(url);
  },

  disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    // Timers die with the socket — publishing into a closed socket is a no-op
    // and a spinning interval with nowhere to send is a leak. Operator intent
    // is deliberately preserved: reconnecting re-asserts the lock.
    stopEstopTimers();
    if (socket) {
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
      socket = null;
    }
    if (connectionState !== 'disconnected') {
      connectionState = 'disconnected';
      notify('connection');
    }
  },

  initiateConnection(url: string) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    connectionState = 'connecting';
    notify('connection');

    try {
      socket = new WebSocket(url);
    } catch (e) {
      console.error('WebSocket connection failed:', e);
      this.handleScheduleReconnect(url);
      return;
    }

    socket.onopen = () => {
      connectionState = 'connected';
      reconnectDelay = 1000;
      notify('connection');
      this.advertiseAndSubscribe();
    };

    socket.onclose = () => {
      connectionState = 'disconnected';
      // Hold the timers while the socket is down so the UI stops claiming a
      // live heartbeat; advertiseAndSubscribe restarts it on the next open.
      stopEstopTimers();
      notify('connection');
      this.handleScheduleReconnect(url);
    };

    socket.onerror = () => {
      connectionState = 'disconnected';
      notify('connection');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.op === 'publish') {
          this.handleInboundPublish(data.topic, data.msg);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
  },

  handleScheduleReconnect(url: string) {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
      this.initiateConnection(url);
    }, reconnectDelay);
  },

  advertiseAndSubscribe() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    // Subscriptions
    const subscriptions = [
      { topic: '/ugv/voltage', type: 'sensor_msgs/msg/BatteryState' },
      { topic: '/scan', type: 'sensor_msgs/msg/LaserScan' },
      { topic: '/odom', type: 'nav_msgs/msg/Odometry' },
      { topic: '/imu/data', type: 'sensor_msgs/msg/Imu' },
      { topic: '/cockpit/overhead_clearance', type: 'std_msgs/msg/Float32' },
      { topic: '/cockpit/status', type: 'diagnostic_msgs/msg/DiagnosticArray' },
      { topic: '/diagnostics', type: 'diagnostic_msgs/msg/DiagnosticArray' },
      // Compressed image topics
      { topic: '/oak/rgb/image_raw/compressed', type: 'sensor_msgs/msg/CompressedImage' },
      { topic: '/cockpit/depth/compressed', type: 'sensor_msgs/msg/CompressedImage' },
    ];

    subscriptions.forEach(({ topic, type }) => {
      socket?.send(JSON.stringify({
        op: 'subscribe',
        topic,
        type,
        throttle_rate: topic.includes('compressed') ? 100 : 50,
      }));
    });

    // Advertisements for publishing
    const publications = [
      { topic: '/cmd_vel_ui', type: 'geometry_msgs/msg/Twist' },
      { topic: '/ugv/led_ctrl', type: 'std_msgs/msg/Int32MultiArray' },
      { topic: '/pt_joint_position_controller/commands', type: 'std_msgs/msg/Float64MultiArray' },
      { topic: '/ugv/pt_steady_ctrl', type: 'std_msgs/msg/Float64MultiArray' },
      { topic: '/cmd_vel_estop_lock', type: 'std_msgs/msg/Bool' },
    ];

    publications.forEach(({ topic, type }) => {
      socket?.send(JSON.stringify({
        op: 'advertise',
        topic,
        type,
      }));
    });

    // Contract: every (re)connect must re-assert a held stop immediately. The
    // mux may have restarted while we were disconnected and come back with the
    // lock RELEASED. This runs after the advertise above so the publisher
    // exists before the first message.
    if (operatorEngaged) {
      startEstopHeartbeat();
    }
  },

  publish(topic: string, msg: unknown): boolean {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({
      op: 'publish',
      topic,
      msg,
    }));
    return true;
  },

  /**
   * Engage or release the twist_mux e-stop lock under the republish contract
   * documented above. Returns whether the command actually left the socket —
   * callers must not render "LOCKED" on a `false`.
   *
   * Engage latches operator intent and starts the 2 Hz `true` heartbeat.
   * Release stops the heartbeat and fires a short burst of `false`, then goes
   * quiet; a release that never lands leaves the robot STOPPED, which is the
   * safe direction to fail. Release always publishes even when we hold no
   * intent, so the operator can clear a lock the robot reports but we did not
   * set. Both directions are idempotent.
   */
  setEstopLock(engaged: boolean): boolean {
    if (typeof window === 'undefined') return false;
    // No socket means no way to reach the mux. Refusing here is what keeps the
    // UI honest: we never latch a state we could not transmit.
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;

    if (engaged) {
      const armed = startEstopHeartbeat();
      if (!armed) return false;
      operatorEngaged = true;
      setEstopState({ engaged: true });
      return true;
    }

    operatorEngaged = false;
    stopEstopHeartbeat();
    const sent = publishEstopLock(false);
    estopReleaseSends = sent ? 1 : 0;
    if (!estopReleaseTimer) {
      estopReleaseTimer = setInterval(() => {
        if (estopReleaseSends >= ESTOP_RELEASE_SENDS || !publishEstopLock(false)) {
          stopEstopRelease();
          return;
        }
        estopReleaseSends += 1;
      }, ESTOP_RELEASE_INTERVAL_MS);
    }
    setEstopState({ engaged: false, releasing: true });
    return sent;
  },

  /** Operator intent, readable outside React (e.g. unmount teardown checks). */
  isEstopEngaged(): boolean {
    return operatorEngaged;
  },

  /**
   * Drop operator intent and every timer WITHOUT telling the robot. Teardown
   * and test hygiene only — never use this to release a live stop, because the
   * mux would keep holding the lock with nothing left to clear it. Use
   * `setEstopLock(false)` for that.
   */
  clearEstopIntent() {
    operatorEngaged = false;
    stopEstopTimers();
    setEstopState({ engaged: false });
  },

  callService(serviceName: string, args: unknown) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const callId = `call_${Math.random().toString(36).substr(2, 9)}`;
    const triggerMsg = JSON.stringify({
      op: 'call_service',
      service: serviceName,
      args,
      id: callId,
    });

    // In a dynamic or simple implementation, service returns go over a distinct op. 
    // We just fire-and-forget for this client since our standard safety calls like /ugv/set_allow_motion 
    // use feedback in the status topic state.
    socket.send(triggerMsg);
  },

  registerImageCallback(topic: string, callback: (src: string) => void) {
    imageCallbacks.set(topic, callback);
    return () => {
      imageCallbacks.delete(topic);
    };
  },

  handleInboundPublish(topic: string, msg: InboundMsg) {
    if (!msg) return;

    if (imageCallbacks.has(topic)) {
      const cb = imageCallbacks.get(topic);
      if (cb && msg.data) {
        // Whitelist the format token — it lands in an <img> data URI. Not an XSS
        // sink (src, not innerHTML), but keeps a malformed value from silently
        // producing a broken frame.
        const raw = (msg.format || 'jpeg').toLowerCase();
        const format = raw.includes('png') ? 'png' : 'jpeg';
        cb(`data:image/${format};base64,${msg.data}`);
      }
      return; // Handled, bypass React
    }

    switch (topic) {
      case '/ugv/voltage': {
        const v = Number(msg.voltage);
        // Pack voltage: clamp fake percentage for display safety
        const p = isNaN(v) ? 0 : Math.max(0, Math.min(100, Math.round((v / 12.6) * 100)));
        voltageState = {
          voltage: isNaN(v) ? 0 : v,
          percentage: p,
        };
        notify('voltage');
        break;
      }
      case '/odom': {
        const x = Number(msg.pose?.pose?.position?.x ?? 0);
        const y = Number(msg.pose?.pose?.position?.y ?? 0);
        
        // Convert quaternion to yaw angle
        const qz = msg.pose?.pose?.orientation?.z ?? 0;
        const qw = msg.pose?.pose?.orientation?.w ?? 1;
        const yaw = 2.0 * Math.atan2(qz, qw);

        const linearSpeed = Number(msg.twist?.twist?.linear?.x ?? 0);
        const angularSpeed = Number(msg.twist?.twist?.angular?.z ?? 0);

        odomState = { x: isNaN(x) ? 0 : x, y: isNaN(y) ? 0 : y, yaw: isNaN(yaw) ? 0 : yaw, linearSpeed, angularSpeed };
        notify('odom');
        break;
      }
      case '/imu/data': {
        const ax = Number(msg.linear_acceleration?.x ?? 0);
        const ay = Number(msg.linear_acceleration?.y ?? 0);
        const az = Number(msg.linear_acceleration?.z ?? 0);
        const gx = Number(msg.angular_velocity?.x ?? 0);
        const gy = Number(msg.angular_velocity?.y ?? 0);
        const gz = Number(msg.angular_velocity?.z ?? 0);

        imuState = {
          ax: isNaN(ax) ? 0 : ax,
          ay: isNaN(ay) ? 0 : ay,
          az: isNaN(az) ? 0 : az,
          gx: isNaN(gx) ? 0 : gx,
          gy: isNaN(gy) ? 0 : gy,
          gz: isNaN(gz) ? 0 : gz,
        };
        notify('imu');
        break;
      }
      case '/cockpit/overhead_clearance': {
        const val = Number(msg.data ?? 0);
        overheadClearance = isNaN(val) ? 0 : val;
        notify('clearance');
        break;
      }
      case '/cockpit/status': {
        // DiagnosticArray structure expected
        const statusObj: CockpitStatus = { ...statusState };
        const diagArray = msg.status;
        if (diagArray && Array.isArray(diagArray)) {
          diagArray.forEach((d) => {
            const values: Record<string, string> = {};
            if (d.values && Array.isArray(d.values)) {
              d.values.forEach((kv) => {
                values[kv.key] = kv.value;
              });
            }

            if (d.name === 'cockpit_safety_watchdog') {
              statusObj.watchdogArmed = values.armed === 'true';
              statusObj.watchdogFired = values.fired === 'true';
            } else if (d.name === 'twist_mux') {
              statusObj.muxSource = values.active_source || 'NONE';
              statusObj.cmdAge = safeNumber(values.command_age, -1);
              statusObj.pubCount = Math.max(0, safeNumber(values.publisher_count, 0));
            } else if (d.name === 'bringup') {
              statusObj.allowMotion = values.allow_motion === 'true';
            } else if (d.name === 'system_metrics') {
              statusObj.wifiRssi = safeNumber(values.wifi_rssi, -100);
              statusObj.diskFree = values.disk_free || 'unknown';
              statusObj.cpuTemp = safeNumber(values.cpu_temp, 0);
              statusObj.gpuTemp = safeNumber(values.gpu_temp, 0);
            }
          });
        }
        statusState = statusObj;
        notify('status');
        break;
      }
      case '/diagnostics': {
        const rawDiags = msg.status;
        if (rawDiags && Array.isArray(rawDiags)) {
          diagnosticsState = rawDiags.map((d) => {
            const values: Record<string, string> = {};
            if (d.values && Array.isArray(d.values)) {
              d.values.forEach((kv) => {
                values[kv.key] = kv.value;
              });
            }
            return {
              name: d.name ?? 'unknown',
              message: d.message ?? '',
              level: Number(d.level ?? 0),
              hardware_id: d.hardware_id ?? '',
              values,
            };
          });
          notify('diagnostics');
        }
        break;
      }
      case '/scan': {
        const ranges = msg.ranges as number[];
        const angleMin = Number(msg.angle_min ?? 0);
        const angleMax = Number(msg.angle_max ?? 0);
        const angleIncrement = Number(msg.angle_increment ?? 0);
        const rangeMin = Number(msg.range_min ?? 0);
        const rangeMax = Number(msg.range_max ?? 0);

        if (ranges && Array.isArray(ranges)) {
          const points: CockpitScanPoint[] = [];

          // Published rear blind sector is bins 60 - 179 = 45° to 134.5° (rear of robot)
          // Pre-mirror raw was 225-315.
          // Let's filter out ranges that are NaN, Infinity, or outside safety limits
          for (let i = 0; i < ranges.length; i++) {
            const r = ranges[i];
            if (isNaN(r) || r === null || r < rangeMin || r > rangeMax) {
              continue;
            }

            const angle = angleMin + i * angleIncrement;
            const angleDeg = (angle * 180.0) / Math.PI;
            // Let's normalize angle to 0 - 360 degrees
            let normDeg = angleDeg % 360;
            if (normDeg < 0) normDeg += 360;

            // Crop rear-blind sector: 45° - 134.5°
            if (normDeg >= 45 && normDeg <= 134.5) {
              continue; // cropped
            }

            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            points.push({ range: r, angle, x, y });
          }

          scanState = {
            points,
            angleMin,
            angleMax,
            angleIncrement,
            rangeMin,
            rangeMax,
          };
          notify('scan');
        }
        break;
      }
    }
  },
};

// Custom React hooks with useSyncExternalStore for granular state updates
export function useConnectionState(): ConnectionState {
  return useSyncExternalStore(
    (cb) => {
      listeners.connection.add(cb);
      return () => listeners.connection.delete(cb);
    },
    () => connectionState,
    () => serverState.connection
  );
}

export function useCockpitVoltage(): CockpitVoltage {
  return useSyncExternalStore(
    (cb) => {
      listeners.voltage.add(cb);
      return () => listeners.voltage.delete(cb);
    },
    () => voltageState,
    () => serverState.voltage
  );
}

export function useCockpitOdom(): CockpitOdom {
  return useSyncExternalStore(
    (cb) => {
      listeners.odom.add(cb);
      return () => listeners.odom.delete(cb);
    },
    () => odomState,
    () => serverState.odom
  );
}

export function useCockpitImu(): CockpitImu {
  return useSyncExternalStore(
    (cb) => {
      listeners.imu.add(cb);
      return () => listeners.imu.delete(cb);
    },
    () => imuState,
    () => serverState.imu
  );
}

export function useCockpitOverheadClearance(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.clearance.add(cb);
      return () => listeners.clearance.delete(cb);
    },
    () => overheadClearance,
    () => serverState.clearance
  );
}

export function useCockpitStatus(): CockpitStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.status.add(cb);
      return () => listeners.status.delete(cb);
    },
    () => statusState,
    () => serverState.status
  );
}

export function useCockpitDiagnostics(): DiagnosticsItem[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.diagnostics.add(cb);
      return () => listeners.diagnostics.delete(cb);
    },
    () => diagnosticsState,
    () => serverState.diagnostics
  );
}

export function useCockpitEstop(): CockpitEstop {
  return useSyncExternalStore(
    (cb) => {
      listeners.estop.add(cb);
      return () => listeners.estop.delete(cb);
    },
    () => estopState,
    () => serverState.estop
  );
}

export function useCockpitScan(): CockpitScan {
  return useSyncExternalStore(
    (cb) => {
      listeners.scan.add(cb);
      return () => listeners.scan.delete(cb);
    },
    () => scanState,
    () => serverState.scan
  );
}
