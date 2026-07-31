'use client';

import { useSyncExternalStore } from 'react';
import {
  getEstopState,
  setEstopState,
  useCockpitEstop,
  type CockpitEstop,
} from './estop-store';

// Re-exported so cockpit components keep importing everything from one place.
export { useCockpitEstop };
export type { CockpitEstop };

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

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
  { topic: '/ugv/voltage', type: 'sensor_msgs/msg/BatteryState' },
  { topic: '/scan', type: 'sensor_msgs/msg/LaserScan' },
  { topic: '/odom', type: 'nav_msgs/msg/Odometry' },
  // ugv_bringup publishes /imu/raw. /imu/data has no publisher on this robot.
  { topic: '/imu/raw', type: 'sensor_msgs/msg/Imu' },
  { topic: '/cockpit/overhead_clearance', type: 'std_msgs/msg/Float32' },
  { topic: '/cockpit/status', type: 'diagnostic_msgs/msg/DiagnosticArray' },
  { topic: '/diagnostics', type: 'diagnostic_msgs/msg/DiagnosticArray' },
  // Dedicated safety topics. NOT YET DEPLOYED on the robot (robot-side PR in
  // flight) — until then these produce nothing and every field they feed must
  // render UNKNOWN, never a cleared/false default.
  { topic: '/ugv/allow_motion', type: 'std_msgs/msg/Bool' },
  { topic: '/ugv/watchdog_state', type: 'diagnostic_msgs/msg/DiagnosticStatus' },
  { topic: '/oak/rgb/image_raw/compressed', type: 'sensor_msgs/msg/CompressedImage' },
  { topic: '/cockpit/depth/compressed', type: 'sensor_msgs/msg/CompressedImage' },
] as const;

export const ROS_PUBLICATIONS = [
  { topic: '/cmd_vel_ui', type: 'geometry_msgs/msg/Twist' },
  { topic: '/ugv/led_ctrl', type: 'std_msgs/msg/Float32MultiArray' },
  { topic: '/pt_joint_position_controller/commands', type: 'std_msgs/msg/Float64MultiArray' },
  { topic: '/ugv/pt_steady_ctrl', type: 'std_msgs/msg/Float32MultiArray' },
  { topic: '/cmd_vel_estop_lock', type: 'std_msgs/msg/Bool' },
] as const;

export const IMAGE_TOPICS = [
  '/oak/rgb/image_raw/compressed',
  '/cockpit/depth/compressed',
] as const;

// Streams worth silencing when the cockpit is not on screen but the socket has
// to stay open (an engaged e-stop). Bandwidth, not safety.
export const HEAVY_TOPICS = ['/scan', ...IMAGE_TOPICS] as const;

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
export function rosBearingToCanvasOffset(angleRad: number): { dx: number; dy: number } {
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
  ranges?: number[];
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
  level: 'error' | 'warning';
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
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * A number, or null when the field is absent/unusable. `null` must NOT coerce:
 * `Number(null)` is 0, which is how a repaired NaN would silently render as a
 * real reading of zero.
 */
function finite(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  return Number.isFinite(value) ? value : null;
}

function safeBool(value: string | undefined): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function stampToMs(header: InboundMsg['header']): number | null {
  const sec = header?.stamp?.sec;
  const nanosec = header?.stamp?.nanosec;
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return null;
  const ns = typeof nanosec === 'number' && Number.isFinite(nanosec) ? nanosec : 0;
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
let odomData: OdomData = { x: null, y: null, yaw: null, linearSpeed: null, angularSpeed: null };
let imuData: ImuData = { ax: null, ay: null, az: null, gx: null, gy: null, gz: null };
let clearanceData: ClearanceData = { meters: null };
let statusData: StatusData = blankStatus();

// ── DIRECT TOPIC vs AGGREGATOR PROVENANCE ───────────────────────────────────
// `/cockpit/status` is a 1 Hz roll-up that also reports allow_motion and the
// watchdog. When the robot has nothing real to put there it emits placeholders,
// and those would overwrite the dedicated `/ugv/allow_motion` and
// `/ugv/watchdog_state` topics we subscribe to precisely so we do not depend on
// the roll-up — the aggregator would defeat its own hedge, once a second.
//
// So the dedicated topic wins while it is fresh, and the aggregator fills in
// only where the dedicated topic has never published or has gone stale.
const DIRECT_TOPIC_AUTHORITY_MS = 2000;
let allowMotionDirectAt: number | null = null;
let watchdogDirectAt: number | null = null;

function directStillAuthoritative(at: number | null): boolean {
  return at !== null && Date.now() - at <= DIRECT_TOPIC_AUTHORITY_MS;
}
let scanData: ScanData = blankScan();
let diagnosticsData: DiagnosticsData = { items: [] };

let connectionState: ConnectionState = 'disconnected';
let voltageState: CockpitVoltage = { ...voltageData, ...meta.voltage };
let odomState: CockpitOdom = { ...odomData, ...meta.odom };
let imuState: CockpitImu = { ...imuData, ...meta.imu };
let clearanceState: CockpitClearance = { ...clearanceData, ...meta.clearance };
let statusState: CockpitStatus = { ...statusData, ...meta.status };
let scanState: CockpitScan = { ...scanData, ...meta.scan };
let diagnosticsState: CockpitDiagnostics = { ...diagnosticsData, ...meta.diagnostics };
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
    notify('voltage');
  },
  odom: () => {
    odomState = { ...odomData, ...meta.odom };
    notify('odom');
  },
  imu: () => {
    imuState = { ...imuData, ...meta.imu };
    notify('imu');
  },
  clearance: () => {
    clearanceState = { ...clearanceData, ...meta.clearance };
    notify('clearance');
  },
  status: () => {
    statusState = { ...statusData, ...meta.status };
    notify('status');
  },
  diagnostics: () => {
    diagnosticsState = { ...diagnosticsData, ...meta.diagnostics };
    notify('diagnostics');
  },
  scan: () => {
    scanState = { ...scanData, ...meta.scan };
    notify('scan');
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
    const stale = m.receivedAt === null ? m.stale : now - m.receivedAt > FRESHNESS_MS[key];
    if (stale !== m.stale) {
      meta[key] = { ...m, stale };
      rebuild[key]();
    }
  });
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
  odomData = { x: null, y: null, yaw: null, linearSpeed: null, angularSpeed: null };
  imuData = { ax: null, ay: null, az: null, gx: null, gy: null, gz: null };
  clearanceData = { meters: null };
  statusData = blankStatus();
  scanData = blankScan();
  diagnosticsData = { items: [] };
  scanArrivals = [];
  allowMotionDirectAt = null;
  watchdogDirectAt = null;
  (Object.keys(meta) as SliceKey[]).forEach((key) => {
    meta[key] = blankMeta();
    rebuild[key]();
  });
  bridgeState = { faults: [], deadTopics: [] };
  notify('bridge');
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
let lastWsUrl = '';
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
const ESTOP_TOPIC = '/cmd_vel_estop_lock';
const ESTOP_HEARTBEAT_MS = 500; // 2 Hz — contract floor is 1 Hz
const ESTOP_RELEASE_INTERVAL_MS = 400;
const ESTOP_RELEASE_SENDS = 4; // ~1.2 s of `false` before going quiet
/** How long an unconfirmed assertion stays quiet before it reads as a failure. */
export const ESTOP_CONFIRM_GRACE_MS = 2000;
/** twist_mux reports this exact string (U+00B7 middle dot elsewhere in the set). */
export const ESTOP_MUX_SOURCE = 'E-STOP lock';

let operatorEngaged = false;
let estopHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
let estopReleaseTimer: ReturnType<typeof setInterval> | null = null;
let estopReleaseSends = 0;


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

// ── SINGLE-WRITER ELECTION ──────────────────────────────────────────────────
// Two cockpit tabs both holding an e-stop heartbeat is a hazard: tab A releases,
// tab B is still republishing `true`, and the operator watches a lock they just
// cleared refuse to clear. Elect one writer per browser via BroadcastChannel.
//
// RANKING, HIGHEST FIRST:
//   1. A tab that is actively HOLDING a stop. It never yields, whatever its id.
//   2. Lowest tab id.
//
// Rule 1 exists because demoting the holder is worse than the collision it
// prevents. Demotion only gates *new* commands — it cannot stop the running
// heartbeat — so a demoted holder keeps publishing `true` while its own UI shows
// a disabled control it cannot use, and the new writer's release burst is
// overwritten within 500 ms. The robot ends up locked with no tab able to clear
// it. Holding a live stop therefore outranks id.
//
// A tab claims the role immediately and yields the moment it hears a peer that
// outranks it; convergence is one message hop. The deliberate trade: a newly
// opened tab is briefly a writer before it hears an incumbent. The alternative —
// start read-only and promote after a quiet window — leaves the E-STOP BUTTON
// DEAD for a quarter second on every mount. A momentary double-assert is
// harmless (both tabs assert *stop*); an unavailable stop button is not.
const ESTOP_CHANNEL_NAME = 'beast-cockpit-estop-writer';
// How long a re-probe waits for an incumbent to answer before self-promoting.
const ESTOP_PROBE_GRACE_MS = 300;
// How often a non-writer re-probes. Without this, a writer tab that is CLOSED
// (rather than unmounted) strands every survivor as a permanent non-writer with
// a dead e-stop button, captioned with a tab that no longer exists.
const ESTOP_PROBE_INTERVAL_MS = 1000;

let estopChannel: BroadcastChannel | null = null;
let estopPageHideHandler: (() => void) | null = null;
let estopProbeTimer: ReturnType<typeof setInterval> | null = null;
let estopProbeGraceTimer: ReturnType<typeof setTimeout> | null = null;
let estopProbeAnswered = false;
const estopTabId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2, 11)}`;

type EstopElectionMsg = {
  k: 'hello' | 'mine' | 'yield';
  from: string;
  /** True when the sender is actively holding a stop. Outranks `from`. */
  engaged?: boolean;
};

function postElection(k: EstopElectionMsg['k']) {
  estopChannel?.postMessage({
    k,
    from: estopTabId,
    engaged: operatorEngaged,
  } satisfies EstopElectionMsg);
}

function stopWriterProbe() {
  if (estopProbeTimer) {
    clearInterval(estopProbeTimer);
    estopProbeTimer = null;
  }
  if (estopProbeGraceTimer) {
    clearTimeout(estopProbeGraceTimer);
    estopProbeGraceTimer = null;
  }
}

/**
 * While this tab is a non-writer, keep asking whether the incumbent still
 * exists. An unanswered probe means it does not, so promote. This is what makes
 * a closed writer tab recoverable without the operator reloading anything.
 */
function startWriterProbe() {
  if (estopProbeTimer || !estopChannel) return;
  estopProbeTimer = setInterval(() => {
    if (getEstopState().writer) {
      stopWriterProbe();
      return;
    }
    estopProbeAnswered = false;
    postElection('hello');
    if (estopProbeGraceTimer) clearTimeout(estopProbeGraceTimer);
    estopProbeGraceTimer = setTimeout(() => {
      estopProbeGraceTimer = null;
      if (!estopProbeAnswered && !getEstopState().writer) setWriter(true);
    }, ESTOP_PROBE_GRACE_MS);
  }, ESTOP_PROBE_INTERVAL_MS);
}

/** Single place that flips writer status, so the probe can't drift out of sync. */
function setWriter(next: boolean) {
  if (getEstopState().writer !== next) setEstopState({ writer: next });
  if (next) stopWriterProbe();
  else startWriterProbe();
}

/**
 * Re-probe on demand. The UI calls this when the operator reaches for a stop
 * button that is disabled, so a stale "held by another tab" can never be the
 * last word between the operator and an e-stop.
 */
function probeEstopWriter() {
  if (!estopChannel || getEstopState().writer) return;
  estopProbeAnswered = false;
  postElection('hello');
  if (estopProbeGraceTimer) clearTimeout(estopProbeGraceTimer);
  estopProbeGraceTimer = setTimeout(() => {
    estopProbeGraceTimer = null;
    if (!estopProbeAnswered && !getEstopState().writer) setWriter(true);
  }, ESTOP_PROBE_GRACE_MS);
}

/** Hand the role back. Safe to call from unmount and from pagehide alike. */
function yieldEstopWriter() {
  if (getEstopState().writer && !operatorEngaged) postElection('yield');
}

function handleElectionMessage(ev: MessageEvent<EstopElectionMsg>) {
  const m = ev.data;
  if (!m || m.from === estopTabId) return;

  if (m.k === 'hello') {
    // Rule 1: never stand down while holding a live stop.
    if (operatorEngaged) {
      postElection('mine');
      return;
    }
    // Rule 1 applied to the peer: a holder outranks us regardless of id.
    // Rule 2: otherwise lowest id wins.
    if (m.engaged || m.from < estopTabId) {
      setWriter(false);
    } else if (getEstopState().writer) {
      postElection('mine');
    }
  } else if (m.k === 'mine') {
    // Someone answered a probe, so an incumbent exists — do not self-promote.
    estopProbeAnswered = true;
    // …but a holder still does not stand down. `mine` is never replied to, so
    // two holders (only reachable via the startup race, and safe because both
    // assert *stop*) settle without a message loop.
    if (!operatorEngaged) setWriter(false);
  } else if (m.k === 'yield') {
    // The incumbent left. Re-announce; ranking settles any tie between the
    // remaining tabs without another timer.
    setWriter(true);
    postElection('hello');
  }
}

/** Fully leave the election: no channel, no probe, no page-teardown listener. */
function leaveEstopElection() {
  if (estopPageHideHandler) {
    window.removeEventListener('pagehide', estopPageHideHandler);
    estopPageHideHandler = null;
  }
  stopWriterProbe();
  estopChannel?.close();
  estopChannel = null;
}

/**
 * Join the single-writer election for this browser. Returns a teardown that
 * hands the role back so another open tab can take it. When BroadcastChannel is
 * unavailable there is nothing to coordinate with, so this tab is the writer.
 *
 * ── INVARIANT ──────────────────────────────────────────────────────────────
 * A TAB THAT IS PUBLISHING THE HEARTBEAT IS ALWAYS REACHABLE BY THE ELECTION.
 *
 * The socket and the 2 Hz `true` deliberately outlive an unmount, so the
 * channel has to outlive it too. If a holder leaves the election while still
 * heartbeating, a peer's `hello` goes unanswered, the peer self-promotes after
 * 300 ms with `operatorEngaged === false`, and its 1.2 s release burst is
 * overwritten by the holder's next heartbeat within 500 ms — an unclearable
 * lock in the second tab. That is N1's failure shape re-entered through
 * teardown, so the teardown checks the same condition rule 1 does.
 */
function claimEstopWriter(): () => void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    setEstopState({ writer: true });
    return () => {};
  }

  if (!estopChannel) {
    estopChannel = new BroadcastChannel(ESTOP_CHANNEL_NAME);
    estopChannel.onmessage = handleElectionMessage;
    // A closed tab never runs React teardown, and `beforeunload` is not fired
    // reliably for it. `pagehide` is, including on mobile Safari.
    estopPageHideHandler = () => yieldEstopWriter();
    window.addEventListener('pagehide', estopPageHideHandler);
    setWriter(true);
  }
  // Re-announce on every claim. On a first claim this is the opening bid; on a
  // remount (we never left, because a held stop keeps us in) it re-asserts our
  // rank. Either way the id/holder comparison settles it — no timer, and no
  // stub teardown that would strand the role on a tab that has gone away.
  postElection('hello');

  return () => {
    if (operatorEngaged) return; // see INVARIANT above
    yieldEstopWriter();
    leaveEstopElection();
    // Nothing left to coordinate with from this tab's perspective.
    setEstopState({ writer: true });
  };
}

// ── ROSBRIDGE STATUS FRAMES ─────────────────────────────────────────────────
// rosbridge 2.0.7 answers a refused op with
//   {"op":"status","level":"error"|"warning","msg":"…","id":"<our op id>"}
// A glob-whitelisted bridge denies unlisted topics EXACTLY this way and
// otherwise silently. Without ids on our ops the message is unattributable, so
// every advertise/subscribe/publish carries one.
function opId(kind: 'sub' | 'unsub' | 'adv' | 'pub', topic: string): string {
  return `${kind}:${topic}`;
}

function topicFromOpId(id: string | null): string | null {
  if (!id) return null;
  const m = /^(?:sub|unsub|adv|pub):(.+)$/.exec(id);
  return m ? m[1] : null;
}

function recordBridgeFault(level: 'error' | 'warning', msg: string, id: string | null) {
  const topic = topicFromOpId(id);
  const fault: BridgeFault = { id, level, msg, at: Date.now(), topic };
  const faults = [fault, ...bridgeState.faults].slice(0, MAX_BRIDGE_FAULTS);
  const deadTopics = level === 'error' && topic && !bridgeState.deadTopics.includes(topic)
    ? [...bridgeState.deadTopics, topic]
    : bridgeState.deadTopics;
  bridgeState = { faults, deadTopics };
  notify('bridge');
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

/** Matches a bare non-finite literal at an exact offset. Sticky, not global. */
const NON_FINITE_TOKEN = /-?(?:NaN|Infinity)/y;

/**
 * Rewrite bare `NaN` / `Infinity` to `null`, but ONLY outside string literals.
 *
 * A plain regex corrupts payloads: `/diagnostics` carries operator-facing text,
 * and a status message like "covariance NaN, using defaults" would silently
 * become "covariance null, using defaults" — we would be editing the robot's
 * words while claiming to repair its numbers. Scanning with string-awareness
 * costs one pass and is exact, so it needs no per-topic allowlist to stay safe.
 *
 * Outside a string, a bare non-finite token is unambiguously the malformed JSON
 * we are here to fix, so no delimiter guessing is required either.
 */
function repairNonFiniteTokens(raw: string): string {
  let out = '';
  let i = 0;
  let inString = false;
  while (i < raw.length) {
    const ch = raw[i];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        // Copy the escaped character verbatim so \" does not end the string.
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
      out += 'null';
      i += match[0].length;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function decodeImageFrame(topic: string, msg: InboundMsg): ImageFrame | null {
  if (typeof msg.data !== 'string' || msg.data.length === 0) return null;
  // Whitelist the format token — it lands in an <img> source. Not an XSS sink
  // (src, not innerHTML), but keeps a malformed value from silently producing a
  // broken frame.
  const raw = (msg.format || 'jpeg').toLowerCase();
  const format = raw.includes('png') ? 'png' : 'jpeg';
  const mime = `image/${format}`;

  // Latency from the message stamp. This is robot clock vs browser clock, so it
  // is only meaningful while both track NTP — treat it as an indicator, not a
  // measurement, and never let a negative skew read as "fresh".
  const stamp = stampToMs(msg.header);
  const latencyMs = stamp === null ? null : Math.max(0, Date.now() - stamp);

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
  connection: 'disconnected' as ConnectionState,
  voltage: { voltage: null, ...blankMeta() } as CockpitVoltage,
  odom: { x: null, y: null, yaw: null, linearSpeed: null, angularSpeed: null, ...blankMeta() } as CockpitOdom,
  imu: { ax: null, ay: null, az: null, gx: null, gy: null, gz: null, ...blankMeta() } as CockpitImu,
  clearance: { meters: null, ...blankMeta() } as CockpitClearance,
  status: { ...blankStatus(), ...blankMeta() } as CockpitStatus,
  diagnostics: { items: [], ...blankMeta() } as CockpitDiagnostics,
  scan: { ...blankScan(), ...blankMeta() } as CockpitScan,
  bridge: { faults: [], deadTopics: [] } as CockpitBridge,
};

export const rosClient = {
  connect(url: string) {
    if (typeof window === 'undefined') return;
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
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
      socket = null;
    }
    heavyStreamsPaused = false;
    if (connectionState !== 'disconnected') {
      connectionState = 'disconnected';
      markAllStale();
      notify('connection');
    }
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
      heavyStreamsPaused = false;
      resetSlicesForNewConnection();
      notify('connection');
      this.advertiseAndSubscribe();
      this.startStalenessTicker();
    };

    socket.onclose = () => {
      connectionState = 'disconnected';
      // Hold the timers while the socket is down so the UI stops claiming a
      // live heartbeat; advertiseAndSubscribe restarts it on the next open.
      stopEstopTimers();
      this.stopStalenessTicker();
      markAllStale();
      notify('connection');
      this.handleScheduleReconnect(url);
    };

    socket.onerror = () => {
      connectionState = 'disconnected';
      // Same reasoning as onclose: a socket in error is not carrying a
      // heartbeat, so stop claiming one.
      stopEstopTimers();
      this.stopStalenessTicker();
      markAllStale();
      notify('connection');
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
        if (data.op === 'publish' && data.topic) {
          this.handleInboundPublish(data.topic, data.msg as InboundMsg);
        } else if (data.op === 'status') {
          const level = data.level === 'error' ? 'error' : data.level === 'warning' ? 'warning' : null;
          if (level) {
            recordBridgeFault(level, String((data as { msg?: unknown }).msg ?? ''), data.id ?? null);
          }
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

    // Ask the bridge to actually tell us about refusals. Default `level: none`
    // means a glob-whitelisted bridge denies our topics in total silence.
    socket.send(JSON.stringify({ op: 'set_level', level: 'warning' }));

    ROS_SUBSCRIPTIONS.forEach(({ topic, type }) => {
      if (heavyStreamsPaused && (HEAVY_TOPICS as readonly string[]).includes(topic)) return;
      const isImage = (IMAGE_TOPICS as readonly string[]).includes(topic);
      socket?.send(JSON.stringify({
        op: 'subscribe',
        id: opId('sub', topic),
        topic,
        type,
        throttle_rate: isImage ? 100 : 50,
        // Never buffer video: one frame deep means a slow link drops frames
        // instead of queueing a growing lag behind the robot.
        ...(isImage ? { queue_length: 1 } : {}),
      }));
    });

    ROS_PUBLICATIONS.forEach(({ topic, type }) => {
      socket?.send(JSON.stringify({
        op: 'advertise',
        id: opId('adv', topic),
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
      socket?.send(JSON.stringify({ op: 'unsubscribe', id: opId('unsub', topic), topic }));
    });
  },

  publish(topic: string, msg: unknown): boolean {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({
      op: 'publish',
      id: opId('pub', topic),
      topic,
      msg,
    }));
    return true;
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
    if (typeof window === 'undefined') return false;
    const live = !!socket && socket.readyState === WebSocket.OPEN;

    if (engaged) {
      // Another tab owns the lock; two heartbeats fighting is the hazard this
      // guards against. Only ENGAGE is gated on being the writer — a release
      // must always be able to drop this tab's own intent.
      if (!getEstopState().writer) return false;
      // No socket means no way to reach the mux. Refusing here is what keeps
      // the UI honest: we never latch a state we could not transmit.
      if (!live) return false;
      const armed = startEstopHeartbeat();
      if (!armed) return false;
      operatorEngaged = true;
      setEstopState({ engaged: true, engagedAt: getEstopState().engagedAt ?? Date.now() });
      return true;
    }

    // A refused RELEASE must still drop local intent, or the next reconnect
    // would re-assert a lock the operator already cleared.
    operatorEngaged = false;
    if (!live) {
      stopEstopTimers();
      setEstopState({ engaged: false, engagedAt: null });
      return false;
    }
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
    setEstopState({ engaged: false, releasing: true, engagedAt: null });
    return sent;
  },

  /** Operator intent, readable outside React (e.g. unmount teardown checks). */
  isEstopEngaged(): boolean {
    return operatorEngaged;
  },

  claimEstopWriter,

  /**
   * Ask again whether the incumbent writer still exists. Called when the
   * operator reaches for a disabled stop button: a tab that closed without
   * yielding must never be the last word between the operator and an e-stop.
   */
  probeEstopWriter,

  /**
   * Drop operator intent and every timer WITHOUT telling the robot. Teardown
   * and test hygiene only — never use this to release a live stop, because the
   * mux would keep holding the lock with nothing left to clear it. Use
   * `setEstopLock(false)` for that.
   *
   * Deliberately does NOT touch writer status: clearing local intent is not a
   * claim on the role, and silently promoting this tab would let a teardown win
   * an election it never stood in.
   */
  clearEstopIntent() {
    operatorEngaged = false;
    stopEstopTimers();
    setEstopState({ engaged: false, engagedAt: null });
  },

  /**
   * Leave the election and reset writer status. Teardown seam — the normal path
   * is the disposer returned by `claimEstopWriter`.
   */
  resetEstopElection() {
    // Unconditional, unlike the teardown from `claimEstopWriter` — this is the
    // seam that has to work even when a test left a stop engaged.
    leaveEstopElection();
    setEstopState({ writer: true });
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
      case '/ugv/voltage': {
        voltageData = { voltage: finite(msg.voltage) };
        commit('voltage');
        break;
      }
      case '/odom': {
        const qz = finite(msg.pose?.pose?.orientation?.z) ?? 0;
        const qw = finite(msg.pose?.pose?.orientation?.w) ?? 1;
        odomData = {
          x: finite(msg.pose?.pose?.position?.x),
          y: finite(msg.pose?.pose?.position?.y),
          yaw: 2.0 * Math.atan2(qz, qw),
          linearSpeed: finite(msg.twist?.twist?.linear?.x),
          angularSpeed: finite(msg.twist?.twist?.angular?.z),
        };
        commit('odom');
        break;
      }
      case '/imu/raw': {
        imuData = {
          ax: finite(msg.linear_acceleration?.x),
          ay: finite(msg.linear_acceleration?.y),
          az: finite(msg.linear_acceleration?.z),
          gx: finite(msg.angular_velocity?.x),
          gy: finite(msg.angular_velocity?.y),
          gz: finite(msg.angular_velocity?.z),
        };
        commit('imu');
        break;
      }
      case '/cockpit/overhead_clearance': {
        clearanceData = { meters: finite(msg.data) };
        commit('clearance');
        break;
      }
      case '/ugv/allow_motion': {
        // A std_msgs/Bool carries a real boolean. Anything else is a malformed
        // frame, and `=== true` would silently render that as "motion locked"
        // instead of "we do not know".
        statusData = {
          ...statusData,
          allowMotion: typeof msg.data === 'boolean' ? msg.data : null,
        };
        allowMotionDirectAt = Date.now();
        commit('status');
        break;
      }
      case '/ugv/watchdog_state': {
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
        commit('status');
        break;
      }
      case '/cockpit/status': {
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

            if (d.name === 'cockpit_safety_watchdog') {
              // Aggregator fills in only where the dedicated topic is silent.
              if (!directStillAuthoritative(watchdogDirectAt)) {
                next.watchdogArmed = safeBool(values.armed);
                next.watchdogFired = safeBool(values.fired);
              }
            } else if (d.name === 'twist_mux') {
              // No fallback to 'NONE': absent means unknown, and "NONE" reads
              // as a positive report that nothing holds the mux.
              next.muxSource = values.active_source ?? null;
              next.cmdAge = safeNumber(values.command_age);
              const pubs = safeNumber(values.publisher_count);
              next.pubCount = pubs === null ? null : Math.max(0, pubs);
            } else if (d.name === 'bringup') {
              if (!directStillAuthoritative(allowMotionDirectAt)) {
                next.allowMotion = safeBool(values.allow_motion);
              }
            } else if (d.name === 'system_metrics') {
              next.wifiRssi = safeNumber(values.wifi_rssi);
              next.diskFree = values.disk_free || null;
              next.cpuTemp = safeNumber(values.cpu_temp);
              next.gpuTemp = safeNumber(values.gpu_temp);
            }
          });
        }
        statusData = next;
        commit('status');
        break;
      }
      case '/diagnostics': {
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
                name: d.name ?? 'unknown',
                message: d.message ?? '',
                level: finite(d.level) ?? 0,
                hardware_id: d.hardware_id ?? '',
                values,
                stampMs,
              };
            }),
          };
          commit('diagnostics');
        }
        break;
      }
      case '/scan': {
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
          if (r === null || r === undefined || !Number.isFinite(r) || r < rangeMin || r > rangeMax) {
            continue;
          }

          const angle = angleMin + i * angleIncrement;
          let normDeg = ((angle * 180.0) / Math.PI) % 360;
          if (normDeg < 0) normDeg += 360;

          if (normDeg >= LIDAR_CROP_SECTOR_DEG.startDeg && normDeg <= LIDAR_CROP_SECTOR_DEG.endDeg) {
            continue; // inside the blind sector — see LIDAR_CROP_SECTOR_DEG
          }

          points.push({ range: r, angle, x: r * Math.cos(angle), y: r * Math.sin(angle) });
        }

        // Measure the real scan rate instead of printing a nominal one.
        const now = Date.now();
        scanArrivals = [...scanArrivals, now].slice(-8);
        const intervalMs =
          scanArrivals.length >= 2
            ? (scanArrivals[scanArrivals.length - 1] - scanArrivals[0]) / (scanArrivals.length - 1)
            : null;

        scanData = { points, angleMin, angleMax, angleIncrement, rangeMin, rangeMax, intervalMs };
        commit('scan');
        break;
      }
    }
  },
};

// ── REACT BINDINGS ──────────────────────────────────────────────────────────
// Every subscribe/getSnapshot function below is defined ONCE at module scope.
//
// Passing inline arrow functions to useSyncExternalStore hands React a new
// `subscribe` identity on every render, so React tears the subscription down and
// rebuilds it every time — for every hook, in every mounted component. That is
// pure overhead on the cockpit, and it stopped being cockpit-only when the shell
// started subscribing to e-stop state on every route in the app.
//
// Stable identities mean React subscribes once and keeps it.
type Unsubscribe = () => void;

function makeSubscriber(key: keyof typeof listeners): (cb: () => void) => Unsubscribe {
  return (cb) => {
    listeners[key].add(cb);
    return () => listeners[key].delete(cb);
  };
}

const subscribeConnection = makeSubscriber('connection');
const subscribeVoltage = makeSubscriber('voltage');
const subscribeOdom = makeSubscriber('odom');
const subscribeImu = makeSubscriber('imu');
const subscribeClearance = makeSubscriber('clearance');
const subscribeStatus = makeSubscriber('status');
const subscribeDiagnostics = makeSubscriber('diagnostics');
const subscribeBridge = makeSubscriber('bridge');
const subscribeScan = makeSubscriber('scan');

const getConnection = () => connectionState;
const getVoltage = () => voltageState;
const getOdom = () => odomState;
const getImu = () => imuState;
const getClearance = () => clearanceState;
const getStatus = () => statusState;
const getDiagnostics = () => diagnosticsState;
const getBridge = () => bridgeState;
const getScan = () => scanState;

// Server snapshots are constants, so these are stable by construction.
const getServerConnection = () => serverState.connection;
const getServerVoltage = () => serverState.voltage;
const getServerOdom = () => serverState.odom;
const getServerImu = () => serverState.imu;
const getServerClearance = () => serverState.clearance;
const getServerStatus = () => serverState.status;
const getServerDiagnostics = () => serverState.diagnostics;
const getServerBridge = () => serverState.bridge;
const getServerScan = () => serverState.scan;

export function useConnectionState(): ConnectionState {
  return useSyncExternalStore(subscribeConnection, getConnection, getServerConnection);
}

export function useCockpitVoltage(): CockpitVoltage {
  return useSyncExternalStore(subscribeVoltage, getVoltage, getServerVoltage);
}

export function useCockpitOdom(): CockpitOdom {
  return useSyncExternalStore(subscribeOdom, getOdom, getServerOdom);
}

export function useCockpitImu(): CockpitImu {
  return useSyncExternalStore(subscribeImu, getImu, getServerImu);
}

export function useCockpitOverheadClearance(): CockpitClearance {
  return useSyncExternalStore(subscribeClearance, getClearance, getServerClearance);
}

export function useCockpitStatus(): CockpitStatus {
  return useSyncExternalStore(subscribeStatus, getStatus, getServerStatus);
}

export function useCockpitDiagnostics(): CockpitDiagnostics {
  return useSyncExternalStore(subscribeDiagnostics, getDiagnostics, getServerDiagnostics);
}


export function useCockpitBridge(): CockpitBridge {
  return useSyncExternalStore(subscribeBridge, getBridge, getServerBridge);
}

export function useCockpitScan(): CockpitScan {
  return useSyncExternalStore(subscribeScan, getScan, getServerScan);
}
