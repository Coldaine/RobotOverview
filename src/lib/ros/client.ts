"use client";

import { useSyncExternalStore } from "react";
import {
  getEstopState,
  setEstopState,
  useCockpitEstop,
  type CockpitEstop,
} from "./estop-store";

export { useCockpitEstop };
export type { CockpitEstop };

export type ConnectionState = "connecting" | "connected" | "disconnected";

// ── ROBOT-SIDE MESSAGE-TYPE CONTRACT ────────────────────────────────────────
// Verified against Coldaine/ugv_ws@fc1c29e. These strings are not cosmetic: DDS
// matches publisher and subscriber by type, so a wrong type here means the
// robot's subscriber never matches and the control is silently DEAD — no error,
// no motion, nothing. `src/__tests__/ros-client.test.ts` pins every one of them.
//
//   /ugv/led_ctrl            Float32MultiArray  (was Int32MultiArray → headlights dead)
//   /ugv/pt_steady_ctrl      Float32MultiArray  (was Float64MultiArray → steady dead)
//   /pt_joint_position_controller/commands
//                            Float64MultiArray  (ros2_control — CORRECT as-is.
//                            Do NOT "harmonize" this with pt_steady_ctrl; they
//                            are different robot-side subscribers.)
//   /imu/raw                 sensor_msgs/msg/Imu (nothing publishes /imu/data)
export const ROS_SUBSCRIPTIONS = [
  { topic: "/ugv/voltage", type: "sensor_msgs/msg/BatteryState" },
  { topic: "/scan", type: "sensor_msgs/msg/LaserScan" },
  { topic: "/odom", type: "nav_msgs/msg/Odometry" },
  // ugv_bringup publishes /imu/raw. /imu/data has no publisher on this robot.
  { topic: "/imu/raw", type: "sensor_msgs/msg/Imu" },
  { topic: "/cockpit/overhead_clearance", type: "std_msgs/msg/Float32" },
  { topic: "/cockpit/status", type: "diagnostic_msgs/msg/DiagnosticArray" },
  { topic: "/diagnostics", type: "diagnostic_msgs/msg/DiagnosticArray" },
  // Dedicated safety topics. NOT YET DEPLOYED on the robot (robot-side PR in
  // flight) — until then these produce nothing and every field they feed must
  // render UNKNOWN, never a cleared/false default.
  { topic: "/ugv/allow_motion", type: "std_msgs/msg/Bool" },
  {
    topic: "/ugv/watchdog_state",
    type: "diagnostic_msgs/msg/DiagnosticStatus",
  },
  {
    topic: "/oak/rgb/image_raw/compressed",
    type: "sensor_msgs/msg/CompressedImage",
  },
  {
    topic: "/cockpit/depth/compressed",
    type: "sensor_msgs/msg/CompressedImage",
  },
] as const;

export const ROS_PUBLICATIONS = [
  { topic: "/cmd_vel_ui", type: "geometry_msgs/msg/Twist" },
  { topic: "/ugv/led_ctrl", type: "std_msgs/msg/Float32MultiArray" },
  {
    topic: "/pt_joint_position_controller/commands",
    type: "std_msgs/msg/Float64MultiArray",
  },
  { topic: "/ugv/pt_steady_ctrl", type: "std_msgs/msg/Float32MultiArray" },
  { topic: "/cmd_vel_estop_lock", type: "std_msgs/msg/Bool" },
] as const;

export const IMAGE_TOPICS = [
  "/oak/rgb/image_raw/compressed",
  "/cockpit/depth/compressed",
] as const;

// Streams worth silencing when the cockpit is not on screen but the socket has
// to stay open (an engaged e-stop). Bandwidth, not safety.
export const HEAVY_TOPICS = ["/scan", ...IMAGE_TOPICS] as const;

// ── LiDAR BLIND-SECTOR CROP ─────────────────────────────────────────────────
// The single source of truth for the cropped sector. The scan parser deletes
// this range and SpatialView draws its wedge from the SAME constant through the
// SAME ROS→canvas mapping the points use, so the picture cannot drift from the
// deletion again (before this, the crop removed ROS 45°–134.5° while the wedge
// was drawn across the canvas rear — a 90° lie).
//
// !! ORIENTATION IS UNVERIFIED AGAINST THE PHYSICAL ROBOT !!
// These bounds came from a bin-index calculation, not from a live scan. In ROS
// REP-103 body frame (+x forward, +y left) 45°–134.5° is the robot's LEFT side,
// which is NOT obviously where the LD19's occluded arc should be — the mast and
// the OAK-D sit elsewhere. Before trusting this display:
//   ros2 topic echo /scan --once     # which index range is `inf`?
// and reconcile that index range with angle_min/angle_increment. TODO tracked
// with the beast-paces shakedown (`.claude/skills/beast-paces/SKILL.md`); it
// needs the robot powered and stationary, so it is deliberately NOT changed
// here. This PR only makes the drawing agree with the code.
export const LIDAR_CROP_SECTOR_DEG = { startDeg: 45, endDeg: 134.5 } as const;

/**
 * Map a ROS scan bearing (rad, +x forward / +y left) to the top-down canvas the
 * cockpit draws, where forward is up. Returns canvas pixel offsets from centre
 * per unit range — exactly the transform SpatialView applies to scan points, so
 * anything drawn through it lands where the matching points would.
 */
export function rosBearingToCanvasOffset(angleRad: number): {
  dx: number;
  dy: number;
} {
  // x = r·cos(θ) forward, y = r·sin(θ) left; canvas px = Cx − y, py = Cy − x.
  return { dx: -Math.sin(angleRad), dy: -Math.cos(angleRad) };
}

export interface InboundMsg {
  data?: string | number | boolean | number[];
  format?: string;
  voltage?: number;
  header?: { stamp?: { sec?: number; nanosec?: number } };
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
  // DiagnosticArray carries `status[]`; a bare DiagnosticStatus carries these
  // at the top level.
  status?: Array<{
    name?: string;
    message?: string;
    level?: number;
    hardware_id?: string;
    values?: Array<{ key: string; value: string }>;
  }>;
  name?: string;
  message?: string;
  level?: number;
  values?: Array<{ key: string; value: string }>;
  ranges?: Array<number | null>;
  angle_min?: number;
  angle_max?: number;
  angle_increment?: number;
  range_min?: number;
  range_max?: number;
}

// ── STALENESS ───────────────────────────────────────────────────────────────
// Every slice carries when it last heard from the robot. A cockpit that keeps
// rendering the last good number in confident live styling after the feed dies
// is worse than one that renders nothing, so:
//   * `hasReceived` is false until the first message OF THIS CONNECTION lands —
//     a field whose topic has no publisher renders "UNKNOWN — no publisher",
//     never a default.
//   * `stale` flips when nothing has arrived inside the slice's budget, and is
//     forced true for EVERY slice the instant the socket closes.
export interface SliceMeta {
  /** Epoch ms of the most recent message for this slice, null if none. */
  receivedAt: number | null;
  /** Has this slice received anything since the current connection opened? */
  hasReceived: boolean;
  /** Nothing has arrived inside the freshness budget (or the socket is down). */
  stale: boolean;
}

const FRESHNESS_MS = {
  voltage: 2000,
  odom: 1000,
  imu: 1000,
  clearance: 2000,
  status: 2000,
  diagnostics: 2000,
  scan: 2000,
} as const;

type SliceKey = keyof typeof FRESHNESS_MS;

const STALENESS_TICK_MS = 250;

export interface CockpitVoltage extends SliceMeta {
  /** Pack volts, or null when the robot has not reported a usable number. */
  voltage: number | null;
}

export interface CockpitOdom extends SliceMeta {
  x: number | null;
  y: number | null;
  yaw: number | null;
  linearSpeed: number | null;
  angularSpeed: number | null;
}

export interface CockpitImu extends SliceMeta {
  ax: number | null;
  ay: number | null;
  az: number | null;
  gx: number | null;
  gy: number | null;
  gz: number | null;
}

export interface CockpitClearance extends SliceMeta {
  meters: number | null;
}

/**
 * Every field is `null` until the robot actually reports it. `null` means
 * UNKNOWN and must render as such — it is NOT "false", "clear", or "NONE".
 * The topics behind `allowMotion` / `watchdog*` / `muxSource` are not deployed
 * on the robot yet, so `null` is the expected steady state today.
 */
export interface CockpitStatus extends SliceMeta {
  muxSource: string | null;
  /** Seconds since the last /cmd_vel. The robot sends -1 for "unknown". */
  cmdAge: number | null;
  pubCount: number | null;
  allowMotion: boolean | null;
  watchdogArmed: boolean | null;
  watchdogFired: boolean | null;
  wifiRssi: number | null;
  diskFree: string | null;
  cpuTemp: number | null;
  gpuTemp: number | null;
}

export interface CockpitScanPoint {
  range: number;
  angle: number;
  x: number;
  y: number;
}

export interface CockpitScan extends SliceMeta {
  points: CockpitScanPoint[];
  angleMin: number;
  angleMax: number;
  angleIncrement: number;
  rangeMin: number;
  rangeMax: number;
  /** Mean interval between the last few scans, ms — null until measurable. */
  intervalMs: number | null;
}

export interface DiagnosticsItem {
  name: string;
  message: string;
  level: number;
  hardware_id?: string;
  values: Record<string, string>;
  /** Message header stamp in epoch ms — NOT the time we happened to render. */
  stampMs: number | null;
}

export interface CockpitDiagnostics extends SliceMeta {
  items: DiagnosticsItem[];
}

/** A rosbridge `op:"status"` frame — the bridge refusing or complaining. */
export interface BridgeFault {
  /** The op id we attached, e.g. `adv:/ugv/led_ctrl`. null if unattributable. */
  id: string | null;
  level: "error" | "warning";
  msg: string;
  at: number;
  /** Topic parsed out of `id`, when the fault is attributable to one. */
  topic: string | null;
}

export interface CockpitBridge {
  faults: BridgeFault[];
  /** Topics the bridge has thrown an ERROR about — treat their controls as dead. */
  deadTopics: string[];
}

const MAX_BRIDGE_FAULTS = 12;

// Parse a numeric field defensively — live diagnostics can carry "unknown",
// empty, or garbage strings that must never render as NaN. Returns null (not a
// fallback number) so callers render UNKNOWN instead of a plausible lie.
function safeNumber(value: string | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * A number, or null when the field is absent/unusable. `null` must NOT coerce:
 * `Number(null)` is 0, which is how a repaired NaN would silently render as a
 * real reading of zero.
 */
function finite(value: unknown): number | null {
  if (typeof value !== "number") return null;
  return Number.isFinite(value) ? value : null;
}

function safeBool(value: string | undefined): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function stampToMs(header: InboundMsg["header"]): number | null {
  const sec = header?.stamp?.sec;
  const nanosec = header?.stamp?.nanosec;
  if (typeof sec !== "number" || !Number.isFinite(sec)) return null;
  const ns =
    typeof nanosec === "number" && Number.isFinite(nanosec) ? nanosec : 0;
  return sec * 1000 + ns / 1e6;
}

// ── SLICE STORAGE ───────────────────────────────────────────────────────────
// Payload and freshness metadata are kept apart so a staleness tick can rebuild
// a slice without re-deriving its data, and so `useSyncExternalStore` snapshots
// stay referentially stable when nothing changed.
function blankMeta(): SliceMeta {
  return { receivedAt: null, hasReceived: false, stale: false };
}

const meta: Record<SliceKey, SliceMeta> = {
  voltage: blankMeta(),
  odom: blankMeta(),
  imu: blankMeta(),
  clearance: blankMeta(),
  status: blankMeta(),
  diagnostics: blankMeta(),
  scan: blankMeta(),
};

type VoltageData = { voltage: number | null };
type OdomData = Omit<CockpitOdom, keyof SliceMeta>;
type ImuData = Omit<CockpitImu, keyof SliceMeta>;
type ClearanceData = { meters: number | null };
type StatusData = Omit<CockpitStatus, keyof SliceMeta>;
type ScanData = Omit<CockpitScan, keyof SliceMeta>;
type DiagnosticsData = { items: DiagnosticsItem[] };

function blankStatus(): StatusData {
  return {
    muxSource: null,
    cmdAge: null,
    pubCount: null,
    allowMotion: null,
    watchdogArmed: null,
    watchdogFired: null,
    wifiRssi: null,
    diskFree: null,
    cpuTemp: null,
    gpuTemp: null,
  };
}

function blankScan(): ScanData {
  return {
    points: [],
    angleMin: 0,
    angleMax: 0,
    angleIncrement: 0,
    rangeMin: 0,
    rangeMax: 0,
    intervalMs: null,
  };
}

let voltageData: VoltageData = { voltage: null };
let odomData: OdomData = {
  x: null,
  y: null,
  yaw: null,
  linearSpeed: null,
  angularSpeed: null,
};
let imuData: ImuData = {
  ax: null,
  ay: null,
  az: null,
  gx: null,
  gy: null,
  gz: null,
};
let clearanceData: ClearanceData = { meters: null };
let statusData: StatusData = blankStatus();
type StatusGroup = "mux" | "allowMotion" | "watchdog" | "system";
let statusGroupAt: Record<StatusGroup, number | null> = {
  mux: null,
  allowMotion: null,
  watchdog: null,
  system: null,
};
let allowMotionDirectAt: number | null = null;
let watchdogDirectAt: number | null = null;
const DIRECT_SAFETY_AUTHORITY_MS = FRESHNESS_MS.status;

function directSafetyIsFresh(at: number | null): boolean {
  return at !== null && Date.now() - at <= DIRECT_SAFETY_AUTHORITY_MS;
}
let scanData: ScanData = blankScan();
let diagnosticsData: DiagnosticsData = { items: [] };

let connectionState: ConnectionState = "disconnected";
let voltageState: CockpitVoltage = { ...voltageData, ...meta.voltage };
let odomState: CockpitOdom = { ...odomData, ...meta.odom };
let imuState: CockpitImu = { ...imuData, ...meta.imu };
let clearanceState: CockpitClearance = { ...clearanceData, ...meta.clearance };
let statusState: CockpitStatus = { ...statusData, ...meta.status };
let scanState: CockpitScan = { ...scanData, ...meta.scan };
let diagnosticsState: CockpitDiagnostics = {
  ...diagnosticsData,
  ...meta.diagnostics,
};
let bridgeState: CockpitBridge = { faults: [], deadTopics: [] };

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
  bridge: new Set<() => void>(),
};

function notify(category: keyof typeof listeners) {
  for (const l of listeners[category]) {
    l();
  }
}

const rebuild: Record<SliceKey, () => void> = {
  voltage: () => {
    voltageState = { ...voltageData, ...meta.voltage };
    notify("voltage");
  },
  odom: () => {
    odomState = { ...odomData, ...meta.odom };
    notify("odom");
  },
  imu: () => {
    imuState = { ...imuData, ...meta.imu };
    notify("imu");
  },
  clearance: () => {
    clearanceState = { ...clearanceData, ...meta.clearance };
    notify("clearance");
  },
  status: () => {
    const now = Date.now();
    const fresh = (group: StatusGroup) =>
      !meta.status.stale &&
      statusGroupAt[group] !== null &&
      now - statusGroupAt[group]! <= FRESHNESS_MS.status;
    const next: CockpitStatus = {
      ...statusData,
      ...(!fresh("mux") && { muxSource: null, cmdAge: null, pubCount: null }),
      ...(!fresh("allowMotion") && { allowMotion: null }),
      ...(!fresh("watchdog") && { watchdogArmed: null, watchdogFired: null }),
      ...(!fresh("system") && {
        wifiRssi: null,
        diskFree: null,
        cpuTemp: null,
        gpuTemp: null,
      }),
      ...meta.status,
    };
    const changed = (Object.keys(next) as Array<keyof CockpitStatus>).some(
      (key) => next[key] !== statusState[key],
    );
    if (changed) {
      statusState = next;
      notify("status");
    }
  },
  diagnostics: () => {
    diagnosticsState = { ...diagnosticsData, ...meta.diagnostics };
    notify("diagnostics");
  },
  scan: () => {
    scanState = { ...scanData, ...meta.scan };
    notify("scan");
  },
};

/** Stamp a slice as freshly received and republish its snapshot. */
function commit(key: SliceKey) {
  meta[key] = { receivedAt: Date.now(), hasReceived: true, stale: false };
  rebuild[key]();
}

/** Recompute `stale` for every slice; rebuild only the ones that changed. */
function tickStaleness() {
  const now = Date.now();
  (Object.keys(meta) as SliceKey[]).forEach((key) => {
    const m = meta[key];
    const stale =
      m.receivedAt === null ? m.stale : now - m.receivedAt > FRESHNESS_MS[key];
    if (stale !== m.stale) {
      meta[key] = { ...m, stale };
      rebuild[key]();
    }
  });
  // Safety fields have independent publishers. Re-evaluate their individual
  // deadlines even when unrelated status traffic keeps the aggregate slice
  // fresh; the comparison in rebuild avoids no-op React notifications.
  rebuild.status();
}

/**
 * The socket is gone: nothing on screen is live any more. Mark everything stale
 * at once rather than letting each slice age out on its own budget.
 */
function markAllStale() {
  (Object.keys(meta) as SliceKey[]).forEach((key) => {
    if (!meta[key].stale) {
      meta[key] = { ...meta[key], stale: true };
      rebuild[key]();
    }
  });
}

/** A new connection: "has this topic ever published?" restarts from zero. */
function resetSlicesForNewConnection() {
  voltageData = { voltage: null };
  odomData = {
    x: null,
    y: null,
    yaw: null,
    linearSpeed: null,
    angularSpeed: null,
  };
  imuData = { ax: null, ay: null, az: null, gx: null, gy: null, gz: null };
  clearanceData = { meters: null };
  statusData = blankStatus();
  statusGroupAt = {
    mux: null,
    allowMotion: null,
    watchdog: null,
    system: null,
  };
  allowMotionDirectAt = null;
  watchdogDirectAt = null;
  scanData = blankScan();
  diagnosticsData = { items: [] };
  scanArrivals = [];
  (Object.keys(meta) as SliceKey[]).forEach((key) => {
    meta[key] = blankMeta();
    rebuild[key]();
  });
  bridgeState = { faults: [], deadTopics: [] };
  notify("bridge");
}

// Ref for reactive-image-rendering callbacks that bypass React state
type ImageFrame = { src: string; latencyMs: number | null };
const imageCallbacks = new Map<string, (frame: ImageFrame) => void>();
const imageObjectUrls = new Map<string, string>();

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let stalenessTimer: ReturnType<typeof setInterval> | null = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 10000;
let lastWsUrl = "";
let heavyStreamsPaused = false;
let scanArrivals: number[] = [];

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
//
// CONFIRMATION: latching intent is NOT proof the robot is stopped. Only
// `/cockpit/status` reporting `active_source == 'E-STOP lock'` is. The UI must
// distinguish "we are asserting" from "the robot confirmed" — see SafetyStrip.
const ESTOP_TOPIC = "/cmd_vel_estop_lock";
const ESTOP_HEARTBEAT_MS = 500; // 2 Hz — contract floor is 1 Hz
const ESTOP_RELEASE_INTERVAL_MS = 400;
const ESTOP_RELEASE_SENDS = 4; // ~1.2 s of `false` before going quiet
/** How long an unconfirmed assertion stays quiet before it reads as a failure. */
export const ESTOP_CONFIRM_GRACE_MS = 2000;
/** twist_mux reports this exact string (U+00B7 middle dot elsewhere in the set). */
export const ESTOP_MUX_SOURCE = "E-STOP lock";

let operatorEngaged = false;
let estopHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
let estopReleaseTimer: ReturnType<typeof setInterval> | null = null;
let estopReleaseSends = 0;
let estopReleasePending = false;

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
  estopReleasePending = false;
  setEstopState({ releasing: false });
}

function suspendEstopRelease() {
  if (estopReleaseTimer) clearInterval(estopReleaseTimer);
  estopReleaseTimer = null;
  estopReleaseSends = 0;
  estopReleasePending = true;
  setEstopState({ releasing: true });
}

function stopEstopTimers() {
  stopEstopHeartbeat();
  stopEstopRelease();
}

function suspendEstopTimers() {
  stopEstopHeartbeat();
  if (getEstopState().releasing || estopReleasePending) suspendEstopRelease();
  else stopEstopRelease();
}

function startEstopReleaseBurst(): boolean {
  stopEstopHeartbeat();
  if (estopReleaseTimer) clearInterval(estopReleaseTimer);
  estopReleaseTimer = null;
  estopReleaseSends = 0;

  const sent = publishEstopLock(false);
  if (!sent) {
    suspendEstopRelease();
    return false;
  }

  estopReleasePending = false;
  estopReleaseSends = 1;
  setEstopState({ engaged: false, releasing: true, engagedAt: null });
  estopReleaseTimer = setInterval(() => {
    if (estopReleaseSends >= ESTOP_RELEASE_SENDS) {
      stopEstopRelease();
      return;
    }
    if (!publishEstopLock(false)) {
      suspendEstopRelease();
      return;
    }
    estopReleaseSends += 1;
  }, ESTOP_RELEASE_INTERVAL_MS);
  return true;
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

// ── SINGLE-WRITER ELECTION ──────────────────────────────────────────────────
// Two cockpit tabs both holding an e-stop heartbeat is a hazard: tab A releases,
// tab B is still republishing `true`, and the operator watches a lock they just
// cleared refuse to clear. Elect one writer per browser via BroadcastChannel.
//
// RESOLUTION IS BY TAB ID, NOT BY A TIMER. A tab claims the role immediately and
// yields the instant it hears from a peer with a lower id; the lowest id present
// always ends up as the sole writer, and it converges in one message hop.
//
// The deliberate trade: a newly opened tab is briefly (one hop, sub-millisecond
// in-process) a writer before it hears an incumbent. The alternative — start
// read-only and promote after a quiet window — would leave the E-STOP BUTTON
// DEAD for a quarter second on every single mount. A momentary double-assert is
// harmless (both tabs assert *stop*); an unavailable stop button is not.
const ESTOP_CHANNEL_NAME = "beast-cockpit-estop-writer";
const COMMAND_ELECTION_SETTLE_MS = 250;
const ESTOP_PROBE_GRACE_MS = 300;
const ESTOP_PROBE_INTERVAL_MS = 1000;

let estopChannel: BroadcastChannel | null = null;
let commandReadyTimer: ReturnType<typeof setTimeout> | null = null;
let estopProbeTimer: ReturnType<typeof setInterval> | null = null;
let estopProbeGraceTimer: ReturnType<typeof setTimeout> | null = null;
let estopProbeAnswered = false;
let estopPageHideHandler: (() => void) | null = null;
const estopTabId =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2, 11)}`;

type EstopElectionMsg = {
  k: "hello" | "mine" | "yield" | "handoff";
  from: string;
  to?: string;
  engagedAt?: number | null;
  releasePending?: boolean;
};

function postElection(k: EstopElectionMsg["k"]) {
  estopChannel?.postMessage({ k, from: estopTabId } satisfies EstopElectionMsg);
}

function revokeCommandReady() {
  if (commandReadyTimer) clearTimeout(commandReadyTimer);
  commandReadyTimer = null;
  setEstopState({ commandReady: false });
}

function settleCommandWriter() {
  revokeCommandReady();
  commandReadyTimer = setTimeout(() => {
    commandReadyTimer = null;
    if (getEstopState().writer) setEstopState({ commandReady: true });
  }, COMMAND_ELECTION_SETTLE_MS);
}

function stopWriterProbe() {
  if (estopProbeTimer) clearInterval(estopProbeTimer);
  if (estopProbeGraceTimer) clearTimeout(estopProbeGraceTimer);
  estopProbeTimer = null;
  estopProbeGraceTimer = null;
}

function probeEstopWriter() {
  if (!estopChannel || getEstopState().writer) return;
  estopProbeAnswered = false;
  postElection("hello");
  if (estopProbeGraceTimer) clearTimeout(estopProbeGraceTimer);
  estopProbeGraceTimer = setTimeout(() => {
    estopProbeGraceTimer = null;
    if (!estopProbeAnswered && !getEstopState().writer) {
      stopWriterProbe();
      setEstopState({ writer: true });
      settleCommandWriter();
      postElection("hello");
    }
  }, ESTOP_PROBE_GRACE_MS);
}

function startWriterProbe() {
  if (estopProbeTimer || !estopChannel) return;
  estopProbeTimer = setInterval(probeEstopWriter, ESTOP_PROBE_INTERVAL_MS);
}

/** Transfer a held stop before this tab relinquishes command ownership. */
function handoffWriter(to: string) {
  const releasePending = getEstopState().releasing || estopReleasePending;
  if (operatorEngaged || releasePending) {
    estopChannel?.postMessage({
      k: "handoff",
      from: estopTabId,
      to,
      engagedAt: getEstopState().engagedAt,
      releasePending,
    } satisfies EstopElectionMsg);
  }
  operatorEngaged = false;
  stopEstopTimers();
  revokeCommandReady();
  setEstopState({
    writer: false,
    engaged: false,
    heartbeat: false,
    releasing: false,
    engagedAt: null,
  });
  startWriterProbe();
}

function releaseEstopWriterClaim() {
  if (getEstopState().writer) postElection("yield");
  stopWriterProbe();
  revokeCommandReady();
  if (estopPageHideHandler)
    window.removeEventListener("pagehide", estopPageHideHandler);
  estopPageHideHandler = null;
  estopChannel?.close();
  estopChannel = null;
  // Nothing left to coordinate with from this tab's perspective.
  setEstopState({ writer: true, commandReady: false });
}

/**
 * Join the single-writer election for this browser. Returns a teardown that
 * hands the role back so another open tab can take it. When BroadcastChannel is
 * unavailable there is nothing to coordinate with, so this tab is the writer.
 */
function claimEstopWriter(): () => void {
  if (
    typeof window === "undefined" ||
    typeof BroadcastChannel === "undefined"
  ) {
    setEstopState({ writer: true, commandReady: true });
    return () => {};
  }
  // A held stop deliberately keeps this channel alive across a route change.
  // A remounted cockpit must still receive the real teardown so it can close
  // the inherited channel after the operator releases the stop.
  if (estopChannel) return releaseEstopWriterClaim;

  estopChannel = new BroadcastChannel(ESTOP_CHANNEL_NAME);
  estopChannel.onmessage = (ev: MessageEvent<EstopElectionMsg>) => {
    const m = ev.data;
    if (!m || m.from === estopTabId) return;
    if (m.k === "hello") {
      // Lowest id wins, so the answer is the same whoever announced first.
      if (m.from < estopTabId) {
        handoffWriter(m.from);
      } else if (getEstopState().writer) {
        postElection("mine");
      }
    } else if (m.k === "mine") {
      estopProbeAnswered = true;
      if (m.from < estopTabId) {
        handoffWriter(m.from);
      } else if (getEstopState().writer) {
        postElection("mine");
      }
    } else if (m.k === "handoff" && m.to === estopTabId) {
      stopWriterProbe();
      operatorEngaged = !m.releasePending;
      setEstopState(
        m.releasePending
          ? {
              writer: true,
              engaged: false,
              heartbeat: false,
              releasing: true,
              engagedAt: null,
            }
          : {
              writer: true,
              engaged: true,
              releasing: false,
              engagedAt: m.engagedAt ?? Date.now(),
            },
      );
      settleCommandWriter();
      if (m.releasePending) {
        if (socket?.readyState === WebSocket.OPEN) startEstopReleaseBurst();
        else suspendEstopRelease();
      } else if (socket?.readyState === WebSocket.OPEN) {
        startEstopHeartbeat();
      }
    } else if (m.k === "yield") {
      // The incumbent left. Re-announce; the id comparison settles any tie
      // between the remaining tabs without another timer.
      setEstopState({ writer: true });
      stopWriterProbe();
      settleCommandWriter();
      postElection("hello");
    }
  };

  estopPageHideHandler = () => {
    if (
      getEstopState().writer &&
      !operatorEngaged &&
      !getEstopState().releasing
    ) {
      postElection("yield");
    }
  };
  window.addEventListener("pagehide", estopPageHideHandler);

  setEstopState({ writer: true });
  settleCommandWriter();
  postElection("hello");

  return releaseEstopWriterClaim;
}

// ── ROSBRIDGE STATUS FRAMES ─────────────────────────────────────────────────
// rosbridge 2.0.7 answers a refused op with
//   {"op":"status","level":"error"|"warning","msg":"…","id":"<our op id>"}
// A glob-whitelisted bridge denies unlisted topics EXACTLY this way and
// otherwise silently. Without ids on our ops the message is unattributable, so
// every advertise/subscribe/publish carries one.
function opId(kind: "sub" | "unsub" | "adv" | "pub", topic: string): string {
  return `${kind}:${topic}`;
}

function topicFromOpId(id: string | null): string | null {
  if (!id) return null;
  const m = /^(?:sub|unsub|adv|pub):(.+)$/.exec(id);
  return m ? m[1] : null;
}

function recordBridgeFault(
  level: "error" | "warning",
  msg: string,
  id: string | null,
) {
  const topic = topicFromOpId(id);
  const fault: BridgeFault = { id, level, msg, at: Date.now(), topic };
  const faults = [fault, ...bridgeState.faults].slice(0, MAX_BRIDGE_FAULTS);
  const deadTopics =
    level === "error" && topic && !bridgeState.deadTopics.includes(topic)
      ? [...bridgeState.deadTopics, topic]
      : bridgeState.deadTopics;
  bridgeState = { faults, deadTopics };
  notify("bridge");
}

/**
 * rosbridge emits floats as bare `NaN` / `Infinity` tokens, which are NOT valid
 * JSON — `JSON.parse` throws and the whole frame (a scan, a voltage) is lost
 * before any of our NaN guards can run. Retry a failed parse with those tokens
 * rewritten to `null`, which the per-field guards already handle. Only failed
 * parses take this path, so well-formed frames are untouched by the regex.
 */
function parseRosbridgeFrame(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(repairNonFiniteTokens(raw));
  }
}

const NON_FINITE_TOKEN = /-?(?:NaN|Infinity)/y;

/** Rewrite bare non-finite literals without touching operator-facing strings. */
function repairNonFiniteTokens(raw: string): string {
  let out = "";
  let i = 0;
  let inString = false;
  while (i < raw.length) {
    const ch = raw[i];
    if (inString) {
      out += ch;
      if (ch === "\\") {
        i += 1;
        if (i < raw.length) out += raw[i];
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }
    NON_FINITE_TOKEN.lastIndex = i;
    const match = NON_FINITE_TOKEN.exec(raw);
    if (match) {
      out += "null";
      i += match[0].length;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function decodeImageFrame(topic: string, msg: InboundMsg): ImageFrame | null {
  if (typeof msg.data !== "string" || msg.data.length === 0) return null;
  // Whitelist the format token — it lands in an <img> source. Not an XSS sink
  // (src, not innerHTML), but keeps a malformed value from silently producing a
  // broken frame.
  const raw = (msg.format || "jpeg").toLowerCase();
  const format = raw.includes("png") ? "png" : "jpeg";
  const mime = `image/${format}`;

  // Latency from the message stamp. This is robot clock vs browser clock, so it
  // is only meaningful while both track NTP — treat it as an indicator, not a
  // measurement, and never let a negative skew read as "fresh".
  const stamp = stampToMs(msg.header);
  const delta = stamp === null ? null : Date.now() - stamp;
  // A robot clock ahead of the browser is clock skew, not a zero-latency
  // frame. Unknown keeps the UI from blessing it as fresh.
  const latencyMs = delta === null || delta < 0 ? null : delta;

  // Object URLs beat data: URLs here — a data URL re-encodes ~30 KB of base64
  // into a fresh string on every frame and pins it in the DOM attribute.
  let src: string;
  try {
    const bin = atob(msg.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    src = URL.createObjectURL(new Blob([bytes], { type: mime }));
    // Revoke the PREVIOUS frame, not this one: the old frame is already decoded
    // and painted, and revoking the live src would blank the feed.
    const previous = imageObjectUrls.get(topic);
    if (previous) URL.revokeObjectURL(previous);
    imageObjectUrls.set(topic, src);
  } catch {
    // No Blob/createObjectURL (jsdom, locked-down runtimes) — fall back.
    src = `data:${mime};base64,${msg.data}`;
  }
  return { src, latencyMs };
}

function releaseImageUrls() {
  imageObjectUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* nothing holds it; ignore */
    }
  });
  imageObjectUrls.clear();
}

// SSR compatible Server Snapshots (stable references)
const serverState = {
  connection: "disconnected" as ConnectionState,
  voltage: { voltage: null, ...blankMeta() } as CockpitVoltage,
  odom: {
    x: null,
    y: null,
    yaw: null,
    linearSpeed: null,
    angularSpeed: null,
    ...blankMeta(),
  } as CockpitOdom,
  imu: {
    ax: null,
    ay: null,
    az: null,
    gx: null,
    gy: null,
    gz: null,
    ...blankMeta(),
  } as CockpitImu,
  clearance: { meters: null, ...blankMeta() } as CockpitClearance,
  status: { ...blankStatus(), ...blankMeta() } as CockpitStatus,
  diagnostics: { items: [], ...blankMeta() } as CockpitDiagnostics,
  scan: { ...blankScan(), ...blankMeta() } as CockpitScan,
  bridge: { faults: [], deadTopics: [] } as CockpitBridge,
};

export const rosClient = {
  connect(url: string) {
    if (typeof window === "undefined") return;
    if (socket && lastWsUrl === url) {
      if (socket.readyState === WebSocket.OPEN) {
        // The socket outlived the component (an engaged e-stop keeps it up).
        // Returning bare here is what left a remounted cockpit with no
        // subscriptions and a dead-looking screen — re-arm the wire instead.
        // Someone is looking at the page again, so the streams we shed on the
        // way out come back too.
        heavyStreamsPaused = false;
        this.advertiseAndSubscribe();
        return;
      }
      if (socket.readyState === WebSocket.CONNECTING) return;
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
    this.stopStalenessTicker();
    releaseImageUrls();
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
      socket = null;
    }
    heavyStreamsPaused = false;
    if (connectionState !== "disconnected") {
      connectionState = "disconnected";
      markAllStale();
      notify("connection");
    }

    notify('voltage');
    notify('odom');
    notify('imu');
    notify('clearance');
    notify('status');
    notify('diagnostics');
    notify('scan');
  },

  startStalenessTicker() {
    if (stalenessTimer) return;
    stalenessTimer = setInterval(tickStaleness, STALENESS_TICK_MS);
  },

  stopStalenessTicker() {
    if (stalenessTimer) {
      clearInterval(stalenessTimer);
      stalenessTimer = null;
    }
  },

  initiateConnection(url: string) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    connectionState = "connecting";
    notify("connection");

    try {
      socket = new WebSocket(url);
    } catch (e) {
      console.error("WebSocket connection failed:", e);
      this.handleScheduleReconnect(url);
      return;
    }

    socket.onopen = () => {
      connectionState = "connected";
      reconnectDelay = 1000;
      heavyStreamsPaused = false;
      resetSlicesForNewConnection();
      notify("connection");
      this.advertiseAndSubscribe();
      this.startStalenessTicker();
    };

    socket.onclose = () => {
      connectionState = "disconnected";
      // Hold the timers while the socket is down so the UI stops claiming a
      // live heartbeat; advertiseAndSubscribe restarts it on the next open.
      suspendEstopTimers();
      this.stopStalenessTicker();
      markAllStale();
      notify("connection");
      this.handleScheduleReconnect(url);
    };

    socket.onerror = () => {
      connectionState = "disconnected";
      // Same reasoning as onclose: a socket in error is not carrying a
      // heartbeat, so stop claiming one.
      suspendEstopTimers();
      this.stopStalenessTicker();
      markAllStale();
      notify("connection");
    };

    socket.onmessage = (event) => {
      try {
        const data = parseRosbridgeFrame(event.data) as {
          op?: string;
          topic?: string;
          msg?: InboundMsg;
          level?: string;
          id?: string;
        };
        if (data.op === "publish" && data.topic) {
          this.handleInboundPublish(data.topic, data.msg as InboundMsg);
        } else if (data.op === "status") {
          const level =
            data.level === "error"
              ? "error"
              : data.level === "warning"
                ? "warning"
                : null;
          if (level) {
            recordBridgeFault(
              level,
              String((data as { msg?: unknown }).msg ?? ""),
              data.id ?? null,
            );
          }
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
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

    // Ask the bridge to actually tell us about refusals. Default `level: none`
    // means a glob-whitelisted bridge denies our topics in total silence.
    socket.send(JSON.stringify({ op: "set_level", level: "warning" }));

    ROS_SUBSCRIPTIONS.forEach(({ topic, type }) => {
      if (
        heavyStreamsPaused &&
        (HEAVY_TOPICS as readonly string[]).includes(topic)
      )
        return;
      const isImage = (IMAGE_TOPICS as readonly string[]).includes(topic);
      socket?.send(
        JSON.stringify({
          op: "subscribe",
          id: opId("sub", topic),
          topic,
          type,
          throttle_rate: isImage ? 100 : 50,
          // Never buffer video: one frame deep means a slow link drops frames
          // instead of queueing a growing lag behind the robot.
          ...(isImage ? { queue_length: 1 } : {}),
        }),
      );
    });

    ROS_PUBLICATIONS.forEach(({ topic, type }) => {
      socket?.send(
        JSON.stringify({
          op: "advertise",
          id: opId("adv", topic),
          topic,
          type,
        }),
      );
    });

    // Contract: every (re)connect must re-assert a held stop immediately. The
    // mux may have restarted while we were disconnected and come back with the
    // lock RELEASED. This runs after the advertise above so the publisher
    // exists before the first message.
    if (operatorEngaged) {
      startEstopHeartbeat();
    } else if (estopReleasePending) {
      startEstopReleaseBurst();
    }
  },

  /**
   * Silence the bandwidth-heavy streams without dropping the socket. Used when
   * the cockpit unmounts while an e-stop is held: the lock heartbeat has to keep
   * running, but there is no reason to keep pulling video and LiDAR into a page
   * nobody is looking at.
   */
  releaseHeavyStreams() {
    heavyStreamsPaused = true;
    releaseImageUrls();
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    HEAVY_TOPICS.forEach((topic) => {
      socket?.send(
        JSON.stringify({ op: "unsubscribe", id: opId("unsub", topic), topic }),
      );
    });
  },

  publish(topic: string, msg: unknown): boolean {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(
      JSON.stringify({
        op: "publish",
        id: opId("pub", topic),
        topic,
        msg,
      }),
    );
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
    socket.send(triggerMsg);
  },

  /**
   * Engage or release the twist_mux e-stop lock under the republish contract
   * documented above. Returns whether the command actually left the socket —
   * callers must not render "LOCKED" on a `false`, and must not render it on a
   * `true` either: only a robot echo confirms the lock.
   *
   * Engage latches operator intent and starts the 2 Hz `true` heartbeat.
   * Release stops the heartbeat and fires a short burst of `false`, then goes
   * quiet; a release that never lands leaves the robot STOPPED, which is the
   * safe direction to fail. Release always publishes even when we hold no
   * intent, so the operator can clear a lock the robot reports but we did not
   * set. Both directions are idempotent.
   */
  setEstopLock(engaged: boolean): boolean {
    if (typeof window === "undefined") return false;
    // Another tab owns the lock. If an invariant break left this tab with an
    // old heartbeat, a local release must silence it without publishing a
    // competing `false` against the current writer.
    if (!getEstopState().writer) {
      if (!engaged && operatorEngaged) {
        operatorEngaged = false;
        stopEstopTimers();
        setEstopState({ engaged: false, engagedAt: null });
      }
      return false;
    }
    const live = !!socket && socket.readyState === WebSocket.OPEN;
    // No socket means no way to reach the mux. Refusing to ENGAGE keeps the UI
    // honest. A refused RELEASE must still drop local intent or reconnect would
    // re-assert a lock the operator already cleared.
    if (!live) {
      if (engaged) return false;
      operatorEngaged = false;
      stopEstopHeartbeat();
      suspendEstopRelease();
      setEstopState({ engaged: false, engagedAt: null, releasing: true });
      return false;
    }

    if (engaged) {
      const armed = startEstopHeartbeat();
      if (!armed) return false;
      operatorEngaged = true;
      setEstopState({
        engaged: true,
        engagedAt: getEstopState().engagedAt ?? Date.now(),
      });
      return true;
    }

    operatorEngaged = false;
    return startEstopReleaseBurst();
  },

  /** Operator intent, readable outside React (e.g. unmount teardown checks). */
  isEstopEngaged(): boolean {
    return operatorEngaged;
  },

  shouldKeepEstopTransport(): boolean {
    return operatorEngaged || estopReleasePending || getEstopState().releasing;
  },

  claimEstopWriter,
  probeEstopWriter,

  resetEstopElection() {
    releaseEstopWriterClaim();
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
    setEstopState({ engaged: false, engagedAt: null });
  },

  registerImageCallback(topic: string, callback: (frame: ImageFrame) => void) {
    imageCallbacks.set(topic, callback);
    return () => {
      imageCallbacks.delete(topic);
      const url = imageObjectUrls.get(topic);
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
        imageObjectUrls.delete(topic);
      }
    };
  },

  handleInboundPublish(topic: string, msg: InboundMsg) {
    if (!msg) return;

    if ((IMAGE_TOPICS as readonly string[]).includes(topic)) {
      const cb = imageCallbacks.get(topic);
      if (!cb) return;
      const frame = decodeImageFrame(topic, msg);
      if (frame) cb(frame);
      return; // Handled, bypass React
    }

    switch (topic) {
      case "/ugv/voltage": {
        voltageData = { voltage: finite(msg.voltage) };
        commit("voltage");
        break;
      }
      case "/odom": {
        const qz = finite(msg.pose?.pose?.orientation?.z) ?? 0;
        const qw = finite(msg.pose?.pose?.orientation?.w) ?? 1;
        odomData = {
          x: finite(msg.pose?.pose?.position?.x),
          y: finite(msg.pose?.pose?.position?.y),
          yaw: 2.0 * Math.atan2(qz, qw),
          linearSpeed: finite(msg.twist?.twist?.linear?.x),
          angularSpeed: finite(msg.twist?.twist?.angular?.z),
        };
        commit("odom");
        break;
      }
      case "/imu/raw": {
        imuData = {
          ax: finite(msg.linear_acceleration?.x),
          ay: finite(msg.linear_acceleration?.y),
          az: finite(msg.linear_acceleration?.z),
          gx: finite(msg.angular_velocity?.x),
          gy: finite(msg.angular_velocity?.y),
          gz: finite(msg.angular_velocity?.z),
        };
        commit("imu");
        break;
      }
      case "/cockpit/overhead_clearance": {
        clearanceData = { meters: finite(msg.data) };
        commit("clearance");
        break;
      }
      case "/ugv/allow_motion": {
        statusData = {
          ...statusData,
          allowMotion: typeof msg.data === "boolean" ? msg.data : null,
        };
        allowMotionDirectAt = Date.now();
        statusGroupAt.allowMotion = allowMotionDirectAt;
        commit("status");
        break;
      }
      case "/ugv/watchdog_state": {
        const values: Record<string, string> = {};
        (msg.values ?? []).forEach((kv) => {
          values[kv.key] = kv.value;
        });
        statusData = {
          ...statusData,
          watchdogArmed: safeBool(values.armed),
          watchdogFired: safeBool(values.fired),
        };
        watchdogDirectAt = Date.now();
        statusGroupAt.watchdog = watchdogDirectAt;
        commit("status");
        break;
      }
      case "/cockpit/status": {
        const next: StatusData = { ...statusData };
        const diagArray = msg.status;
        if (diagArray && Array.isArray(diagArray)) {
          diagArray.forEach((d) => {
            const values: Record<string, string> = {};
            if (d.values && Array.isArray(d.values)) {
              d.values.forEach((kv) => {
                values[kv.key] = kv.value;
              });
            }

            if (d.name === "cockpit_safety_watchdog") {
              if (!directSafetyIsFresh(watchdogDirectAt)) {
                next.watchdogArmed = safeBool(values.armed);
                next.watchdogFired = safeBool(values.fired);
                statusGroupAt.watchdog = Date.now();
              }
            } else if (d.name === "twist_mux") {
              // No fallback to 'NONE': absent means unknown, and "NONE" reads
              // as a positive report that nothing holds the mux.
              next.muxSource = values.active_source ?? null;
              next.cmdAge = safeNumber(values.command_age);
              const pubs = safeNumber(values.publisher_count);
              next.pubCount = pubs === null ? null : Math.max(0, pubs);
              statusGroupAt.mux = Date.now();
            } else if (d.name === "bringup") {
              if (!directSafetyIsFresh(allowMotionDirectAt)) {
                next.allowMotion = safeBool(values.allow_motion);
                statusGroupAt.allowMotion = Date.now();
              }
            } else if (d.name === "system_metrics") {
              next.wifiRssi = safeNumber(values.wifi_rssi);
              next.diskFree = values.disk_free || null;
              next.cpuTemp = safeNumber(values.cpu_temp);
              next.gpuTemp = safeNumber(values.gpu_temp);
              statusGroupAt.system = Date.now();
            }
          });
        }
        statusData = next;
        commit("status");
        break;
      }
      case "/diagnostics": {
        const rawDiags = msg.status;
        if (rawDiags && Array.isArray(rawDiags)) {
          // One header stamp covers the whole array — that is the robot's own
          // timestamp for these entries, not the moment we drew them.
          const stampMs = stampToMs(msg.header);
          diagnosticsData = {
            items: rawDiags.map((d) => {
              const values: Record<string, string> = {};
              if (d.values && Array.isArray(d.values)) {
                d.values.forEach((kv) => {
                  values[kv.key] = kv.value;
                });
              }
              return {
                name: d.name ?? "unknown",
                message: d.message ?? "",
                level: finite(d.level) ?? 0,
                hardware_id: d.hardware_id ?? "",
                values,
                stampMs,
              };
            }),
          };
          commit("diagnostics");
        }
        break;
      }
      case "/scan": {
        const ranges = msg.ranges;
        if (!ranges || !Array.isArray(ranges)) break;

        const angleMin = finite(msg.angle_min) ?? 0;
        const angleMax = finite(msg.angle_max) ?? 0;
        const angleIncrement = finite(msg.angle_increment) ?? 0;
        const rangeMin = finite(msg.range_min) ?? 0;
        const rangeMax = finite(msg.range_max) ?? 0;

        const points: CockpitScanPoint[] = [];
        for (let i = 0; i < ranges.length; i++) {
          const r = ranges[i];
          // `null` arrives from the NaN/Infinity repair above; Number(null) is
          // 0, so the explicit null check has to come first.
          if (
            r === null ||
            r === undefined ||
            !Number.isFinite(r) ||
            r < rangeMin ||
            r > rangeMax
          ) {
            continue;
          }

          const angle = angleMin + i * angleIncrement;
          let normDeg = ((angle * 180.0) / Math.PI) % 360;
          if (normDeg < 0) normDeg += 360;

          if (
            normDeg >= LIDAR_CROP_SECTOR_DEG.startDeg &&
            normDeg <= LIDAR_CROP_SECTOR_DEG.endDeg
          ) {
            continue; // inside the blind sector — see LIDAR_CROP_SECTOR_DEG
          }

          points.push({
            range: r,
            angle,
            x: r * Math.cos(angle),
            y: r * Math.sin(angle),
          });
        }

        // Measure the real scan rate instead of printing a nominal one.
        const now = Date.now();
        scanArrivals = [...scanArrivals, now].slice(-8);
        const intervalMs =
          scanArrivals.length >= 2
            ? (scanArrivals[scanArrivals.length - 1] - scanArrivals[0]) /
              (scanArrivals.length - 1)
            : null;

        scanData = {
          points,
          angleMin,
          angleMax,
          angleIncrement,
          rangeMin,
          rangeMax,
          intervalMs,
        };
        commit("scan");
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
    () => serverState.connection,
  );
}

export function useCockpitVoltage(): CockpitVoltage {
  return useSyncExternalStore(
    (cb) => {
      listeners.voltage.add(cb);
      return () => listeners.voltage.delete(cb);
    },
    () => voltageState,
    () => serverState.voltage,
  );
}

export function useCockpitOdom(): CockpitOdom {
  return useSyncExternalStore(
    (cb) => {
      listeners.odom.add(cb);
      return () => listeners.odom.delete(cb);
    },
    () => odomState,
    () => serverState.odom,
  );
}

export function useCockpitImu(): CockpitImu {
  return useSyncExternalStore(
    (cb) => {
      listeners.imu.add(cb);
      return () => listeners.imu.delete(cb);
    },
    () => imuState,
    () => serverState.imu,
  );
}

export function useCockpitOverheadClearance(): CockpitClearance {
  return useSyncExternalStore(
    (cb) => {
      listeners.clearance.add(cb);
      return () => listeners.clearance.delete(cb);
    },
    () => clearanceState,
    () => serverState.clearance,
  );
}

export function useCockpitStatus(): CockpitStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.status.add(cb);
      return () => listeners.status.delete(cb);
    },
    () => statusState,
    () => serverState.status,
  );
}

export function useCockpitDiagnostics(): CockpitDiagnostics {
  return useSyncExternalStore(
    (cb) => {
      listeners.diagnostics.add(cb);
      return () => listeners.diagnostics.delete(cb);
    },
    () => diagnosticsState,
    () => serverState.diagnostics,
  );
}

export function useCockpitBridge(): CockpitBridge {
  return useSyncExternalStore(
    (cb) => {
      listeners.bridge.add(cb);
      return () => listeners.bridge.delete(cb);
    },
    () => bridgeState,
    () => serverState.bridge,
  );
}

export function useCockpitScan(): CockpitScan {
  return useSyncExternalStore(
    (cb) => {
      listeners.scan.add(cb);
      return () => listeners.scan.delete(cb);
    },
    () => scanState,
    () => serverState.scan,
  );
}
