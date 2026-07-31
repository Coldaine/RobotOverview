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

// Parse a numeric field defensively — live diagnostics can carry "unknown",
// empty, or garbage strings that must never render as NaN.
function safeNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Memory-only stores for each topic
let connectionState: ConnectionState = 'disconnected';
let voltageState: CockpitVoltage = { voltage: 0 };
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
};

// Hoisted stable references for useSyncExternalStore
const subscribeConnection = (cb: () => void) => {
  listeners.connection.add(cb);
  return () => listeners.connection.delete(cb);
};
const getConnSnap = () => connectionState;
const getConnServerSnap = () => serverState.connection;

const subscribeVoltage = (cb: () => void) => {
  listeners.voltage.add(cb);
  return () => listeners.voltage.delete(cb);
};
const getVoltSnap = () => voltageState;
const getVoltServerSnap = () => serverState.voltage;

const subscribeOdom = (cb: () => void) => {
  listeners.odom.add(cb);
  return () => listeners.odom.delete(cb);
};
const getOdomSnap = () => odomState;
const getOdomServerSnap = () => serverState.odom;

const subscribeImu = (cb: () => void) => {
  listeners.imu.add(cb);
  return () => listeners.imu.delete(cb);
};
const getImuSnap = () => imuState;
const getImuServerSnap = () => serverState.imu;

const subscribeClearance = (cb: () => void) => {
  listeners.clearance.add(cb);
  return () => listeners.clearance.delete(cb);
};
const getClearanceSnap = () => overheadClearance;
const getClearanceServerSnap = () => serverState.clearance;

const subscribeStatus = (cb: () => void) => {
  listeners.status.add(cb);
  return () => listeners.status.delete(cb);
};
const getStatusSnap = () => statusState;
const getStatusServerSnap = () => serverState.status;

const subscribeDiag = (cb: () => void) => {
  listeners.diagnostics.add(cb);
  return () => listeners.diagnostics.delete(cb);
};
const getDiagSnap = () => diagnosticsState;
const getDiagServerSnap = () => serverState.diagnostics;

const subscribeScan = (cb: () => void) => {
  listeners.scan.add(cb);
  return () => listeners.scan.delete(cb);
};
const getScanSnap = () => scanState;
const getScanServerSnap = () => serverState.scan;

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

// SSR compatible Server Snapshots (stable references)
const serverState = {
  connection: 'disconnected' as ConnectionState,
  voltage: { voltage: 0 } as CockpitVoltage,
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
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
      socket = null;
    }

    // Reset all state to safely handle disconnected screens
    voltageState = { voltage: 0 };
    odomState = { x: 0, y: 0, yaw: 0, linearSpeed: 0, angularSpeed: 0 };
    imuState = { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 };
    overheadClearance = 0;
    statusState = { ...serverState.status };
    diagnosticsState = [];
    scanState = { points: [], angleMin: 0, angleMax: 0, angleIncrement: 0, rangeMin: 0, rangeMax: 0 };

    if (connectionState !== 'disconnected') {
      connectionState = 'disconnected';
      notify('connection');
    }

    notify('voltage');
    notify('odom');
    notify('imu');
    notify('clearance');
    notify('status');
    notify('diagnostics');
    notify('scan');
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

  callService(serviceName: string, args: unknown) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const callId = `call_${Math.random().toString(36).slice(2, 11)}`;
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
        // Normalize MIME type based on format field
        const raw = (msg.format || 'jpeg').toLowerCase();
        const mimeType = raw.includes('png') ? 'image/png' : 'image/jpeg';
        cb(`data:${mimeType};base64,${msg.data}`);
      }
      return; // Handled, bypass React
    }

    switch (topic) {
      case '/ugv/voltage': {
        const v = Number(msg.voltage);
        voltageState = {
          voltage: Number.isFinite(v) ? v : 0,
        };
        notify('voltage');
        break;
      }
      case '/odom': {
        let x = Number(msg.pose?.pose?.position?.x ?? 0);
        let y = Number(msg.pose?.pose?.position?.y ?? 0);
        
        // Convert quaternion to yaw angle
        const qz = msg.pose?.pose?.orientation?.z ?? 0;
        const qw = msg.pose?.pose?.orientation?.w ?? 1;
        let yaw = 2.0 * Math.atan2(qz, qw);

        let linearSpeed = Number(msg.twist?.twist?.linear?.x ?? 0);
        let angularSpeed = Number(msg.twist?.twist?.angular?.z ?? 0);

        x = Number.isFinite(x) ? x : 0;
        y = Number.isFinite(y) ? y : 0;
        yaw = Number.isFinite(yaw) ? yaw : 0;
        linearSpeed = Number.isFinite(linearSpeed) ? linearSpeed : 0;
        angularSpeed = Number.isFinite(angularSpeed) ? angularSpeed : 0;

        odomState = { x, y, yaw, linearSpeed, angularSpeed };
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
  return useSyncExternalStore(subscribeConnection, getConnSnap, getConnServerSnap);
}

export function useCockpitVoltage(): CockpitVoltage {
  return useSyncExternalStore(subscribeVoltage, getVoltSnap, getVoltServerSnap);
}

export function useCockpitOdom(): CockpitOdom {
  return useSyncExternalStore(subscribeOdom, getOdomSnap, getOdomServerSnap);
}

export function useCockpitImu(): CockpitImu {
  return useSyncExternalStore(subscribeImu, getImuSnap, getImuServerSnap);
}

export function useCockpitOverheadClearance(): number {
  return useSyncExternalStore(subscribeClearance, getClearanceSnap, getClearanceServerSnap);
}

export function useCockpitStatus(): CockpitStatus {
  return useSyncExternalStore(subscribeStatus, getStatusSnap, getStatusServerSnap);
}

export function useCockpitDiagnostics(): DiagnosticsItem[] {
  return useSyncExternalStore(subscribeDiag, getDiagSnap, getDiagServerSnap);
}

export function useCockpitScan(): CockpitScan {
  return useSyncExternalStore(subscribeScan, getScanSnap, getScanServerSnap);
}
