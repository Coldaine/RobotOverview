/**
 * Power planner data: load model, pack options, and expansion strategies for
 * BEAST-01. Numbers grounded 2026-07-23 in the Waveshare UPS 3S wiki (3S1P),
 * ST3215/servo + D500 lidar specs, Luxonis OAK-D Pro docs, Livox Mid-360S
 * specs, Molicel/Samsung cell datasheets, and JetsonHacks' V-mount + USB-PD
 * trigger pattern. Watts are modeled at the ~11.1 V nominal pack bus.
 */

export type Rail = 'drive' | 'compute';

export interface LoadMode {
  id: string;
  label: string;
  watts: number;
}

export interface LoadDef {
  id: string;
  name: string;
  rail: Rail;
  modes: LoadMode[];
  defaultMode: string;
  future?: boolean;
  note?: string;
}

/** Presets map load id → mode id. */
export const LOADS: LoadDef[] = [
  {
    id: 'motors', name: 'Track motors ×2', rail: 'drive', defaultMode: 'cruise',
    modes: [
      { id: 'off', label: 'off', watts: 0 },
      { id: 'cruise', label: 'cruise', watts: 17 },
      { id: 'push', label: 'climb', watts: 45 },
      { id: 'stall', label: 'stall', watts: 89 },
    ],
    note: 'stall ≈ 8 A — the transient that stresses the protection circuit and the XH2.54 feed',
  },
  {
    id: 'servos', name: 'Pan-tilt ST3215 ×2', rail: 'drive', defaultMode: 'track',
    modes: [
      { id: 'idle', label: 'idle', watts: 4 },
      { id: 'track', label: 'moving', watts: 7 },
      { id: 'stall', label: 'stall', watts: 60 },
    ],
    note: 'stall 2.7 A each @ 12 V (confirmed spec)',
  },
  {
    id: 'esp32', name: 'ESP32 + OLED + IMU', rail: 'drive', defaultMode: 'on',
    modes: [{ id: 'on', label: 'on', watts: 2 }],
  },
  {
    id: 'spotlight', name: 'LED spotlight', rail: 'drive', defaultMode: 'off',
    modes: [
      { id: 'off', label: 'off', watts: 0 },
      { id: 'on', label: 'on', watts: 4 },
    ],
  },
  {
    id: 'lidar', name: 'D500 LiDAR', rail: 'drive', defaultMode: 'on',
    modes: [
      { id: 'off', label: 'off', watts: 0 },
      { id: 'on', label: 'on', watts: 1.5 },
    ],
  },
  {
    id: 'mid360s', name: 'Livox Mid-360S', rail: 'drive', future: true, defaultMode: 'off',
    modes: [
      { id: 'off', label: 'off', watts: 0 },
      { id: 'on', label: 'on', watts: 6.5 },
      { id: 'cold', label: 'cold start', watts: 14 },
    ],
    note: 'future · pack tap 9–27 V (stays on the drive rail even in split mode)',
  },
  {
    id: 'jetson', name: 'Jetson Orin Nano', rail: 'compute', defaultMode: 'w15',
    modes: [
      { id: 'w7', label: '7 W', watts: 7 },
      { id: 'w15', label: '15 W', watts: 15 },
      { id: 'w25', label: '25 W', watts: 25 },
      { id: 'spike', label: '45 W spike', watts: 45 },
    ],
  },
  {
    id: 'oak', name: 'OAK depth camera (USB)', rail: 'compute', defaultMode: 'lite',
    modes: [
      { id: 'off', label: 'off', watts: 0 },
      { id: 'lite', label: 'Lite 3 W', watts: 3 },
      { id: 'pro', label: 'Pro 5 W', watts: 5 },
      { id: 'proir', label: 'Pro+IR USB 5 W', watts: 5 },
    ],
    note: 'USB draw only — Pro+IR also needs the Y-adapter on the drive rail (~10 W)',
  },
  {
    id: 'oak_aux', name: 'OAK Y-adapter (5 V aux)', rail: 'drive', future: true, defaultMode: 'off',
    modes: [
      { id: 'off', label: 'off', watts: 0 },
      { id: 'on', label: 'on', watts: 10 },
    ],
    note: 'future · from idle Pi buck when Pro+IR is on — not on the V-mount',
  },
  {
    id: 'camup', name: 'Zoom/thermal cam', rail: 'compute', future: true, defaultMode: 'off',
    modes: [
      { id: 'off', label: 'off', watts: 0 },
      { id: 'on', label: 'on', watts: 1 },
    ],
  },
];

export const PRESETS: { id: string; label: string; modes: Record<string, string> }[] = [
  {
    id: 'idle', label: 'Idle',
    modes: { motors: 'off', servos: 'idle', spotlight: 'off', lidar: 'on', jetson: 'w7', oak: 'lite', oak_aux: 'off', mid360s: 'off', camup: 'off' },
  },
  {
    id: 'cruise', label: 'Cruise',
    modes: { motors: 'cruise', servos: 'track', spotlight: 'off', lidar: 'on', jetson: 'w15', oak: 'lite', oak_aux: 'off', mid360s: 'off', camup: 'off' },
  },
  {
    id: 'future', label: 'Future cruise',
    modes: { motors: 'cruise', servos: 'track', spotlight: 'off', lidar: 'on', jetson: 'w25', oak: 'pro', oak_aux: 'off', mid360s: 'on', camup: 'on' },
  },
  {
    id: 'worst', label: 'Worst case',
    modes: { motors: 'stall', servos: 'stall', spotlight: 'on', lidar: 'on', jetson: 'spike', oak: 'proir', oak_aux: 'on', mid360s: 'cold', camup: 'on' },
  },
];

export interface PackDef {
  id: string;
  name: string;
  wh: number;
  maxAmps: number;
  note: string;
}

/** UPS options for the pack (drive) rail. 3S1P ⇒ pack limit = one cell's limit. */
export const PACKS: PackDef[] = [
  {
    id: 'p30b', name: 'Molicel P30B ×3 (installed)', wh: 33, maxAmps: 30,
    note: '3.0 Ah · 30 A continuous — verified from the purchase record 2026-07-24. Solid headroom: ~30 A pack ceiling vs ~20 A worst-case spike. No power problems have been observed in service.',
  },
  {
    id: 's35e', name: 'Samsung 35E ×3', wh: 37, maxAmps: 8,
    note: '3.45 Ah but only 8 A continuous — more Wh, worse under stall transients. Shown for contrast: do not "upgrade" to energy cells.',
  },
  {
    id: 'dual', name: 'Dual UPS · ideal-diode OR', wh: 66, maxAmps: 20,
    note: 'second UPS 3S (P30B cells) ORed through a FET ideal-diode board (~20 A class). Each pack keeps its own charge port.',
  },
];

/** Compute-rail source in split mode. */
export const VMOUNT = {
  name: 'V-mount 99 Wh · 65 W PD',
  wh: 99,
  maxWatts: 45, // 15 V / 3 A trigger cable into the barrel jack
  note: 'SmallRig VB99 / Neewer 99 Wh V-mount → 15 V/3 A USB-C PD trigger → 5.5×2.5 barrel. Sustains 45 W the way consumer power banks do not.',
};

export const NOMINAL_V = 11.1;

export interface StrategyDef {
  id: string;
  tag: 'USE' | 'FALLBACK' | 'NOTE';
  title: string;
  body: string;
}

export const STRATEGIES: StrategyDef[] = [
  {
    id: 'split', tag: 'USE',
    title: 'Split rails (primary recommendation)',
    body: 'Keep the UPS on the driver board (motors/servos/lidar/spotlight) and give the Jetson its own 15 V/3 A USB-C PD trigger from a 99 Wh V-mount battery. No paralleling risk, fault domains isolated — a motor stall can no longer brown out the Orin — and the compute rail alone gets ~3× the Wh of today’s whole system.',
  },
  {
    id: 'p30b', tag: 'NOTE',
    title: 'Cells verified: Molicel P30B — no swap needed',
    body: 'The installed cells are P30B (3.0 Ah, 30 A continuous) — the 3S1P ceiling is comfortably above the ~20 A worst-case spike, and no power problems have actually been observed on the Pi build. This planner is FORWARD-LOOKING: the question is headroom and runtime once the Jetson (7–25 W+) and future sensors join, not fixing a fault. Baseline the INA219 pack telemetry before the conversion so before/after comparisons are real data.',
  },
  {
    id: 'dual', tag: 'FALLBACK',
    title: 'Second UPS via ideal-diode ORing',
    body: 'If you want one combined bus instead: never hard-parallel two protected packs (independent BMSes back-feed and latch off). OR the discharge outputs through a FET ideal-diode board (e.g. BrownieBoards 3-ch 20 A; Schottky isolators waste ~0.4 V — skip). Both packs keep charging independently through their own 12.6 V ports.',
  },
  {
    id: 'xt30', tag: 'NOTE',
    title: 'Re-connector new power runs as XT30',
    body: 'XH2.54 pins are ~3 A each — fine for the stock leads, marginal for new pack-level interconnects. Any new tap (Mid-360S feed, ORing board, second pack) should be XT30 (~25 A real-world). The one-time UPS arming quirk applies after every cell swap.',
  },
];
