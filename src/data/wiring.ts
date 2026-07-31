// ─────────────────────────────────────────────────────────────────────────────
// BEAST-01 wiring — the single surface that holds what is connected to what.
//
// Two views project from this file; neither owns a copy of the facts:
//   • The Board  (/board)     renders `grain: 'module'`      — subsystem trunks
//   • Live Plug  (/datacore)  renders connector loom         — individual cables
//
// A fact is written here once. Layout coordinates, plug state, and conversion
// procedure are NOT facts and stay with the view that draws them.
//
// Grain:
//   module     board-to-board / subsystem wiring  → MODULE_NETS
//   connector  one physical cable                 → WIRING_LINKS (parentNet → module)
//   internal   intra-board rail (VDD5V, M2 gate)  → not yet populated
// ─────────────────────────────────────────────────────────────────────────────

import type { Build, Net, PortCategory } from './types';

/**
 * One physical cable. `from`/`to` are bench node ids — a board port or a
 * peripheral, resolved through `NODE_INDEX` in the console.
 *
 * `parentNet` names the module-grain net this cable is a strand of. Null means
 * the trunk does not exist yet: either the subsystem genuinely has no
 * module-level representation (RF stubs, audio), or the spine is incomplete.
 */
export interface WiringLink {
  from: string;
  to: string;
  cat: PortCategory;
  label: string;
  /** module-grain net id, or null if this strand has no trunk yet */
  parentNet: string | null;
  /** absent = present in both builds */
  build?: Build;
  /** proposed hardware, not on the robot */
  era?: 'future';
  /** document ids proving this link; prefer a sheet zone (`doc-x#C6`) over a bare PDF */
  documents?: string[];
}

/**
 * Bench Live Plug port ids ↔ Board Connected Twin terminal ids for the same
 * physical connector. Overlap CI fails when either side renames alone.
 */
export const BENCH_TERMINAL_ALIAS: Record<string, string> = {
  'drv-esp32-usb': 'gdb-usb-esp32',
  'drv-dcin': 'gdb-power-in',
  'drv-servo': 'gdb-servo-bus',
  'drv-m1': 'gdb-motor-a',
  'drv-m2': 'gdb-motor-b',
  'drv-i2c': 'gdb-i2c',
  'drv-lidar-sensor': 'gdb-lidar-uart',
  'drv-40pin': 'gdb-host-uart',
  'jet-barrel': 'orin-dc-in',
  'jet-40pin': 'orin-uart',
  'jet-usb1': 'orin-usb',
  'jet-usb2': 'orin-usb',
  'jet-usb3': 'orin-usb',
  'jet-usb4': 'orin-usb',
  'pi-40pin': 'pi5-40pin',
  'pi-usb2': 'pi5-usb',
  'pi-usb3a': 'pi5-usb',
  'pi-usb3b': 'pi5-usb',
  'ups-out1': 'ups-rail-out',
  'ups-out2': 'ups-rail-out',
  'motor-l': 'beast-motor-left',
  'motor-r': 'beast-motor-right',
  pantilt: 'beast-pan-tilt',
  camera: 'beast-camera',
  oled: 'beast-oled',
  oakd: 'oak-usb',
  lidar: 'd500-uart',
};

/** Module-grain trunks — what The Board draws. Single source for hangarData.nets. */
export const MODULE_NETS: Net[] = [
  {
    id: 'net-battery-rail',
    name: 'Battery Rail',
    kind: 'power',
    grain: 'module',
    carries: '3S pack · 9–12.6V',
    terminals: ['ups-rail-out', 'gdb-power-in', 'orin-dc-in'],
    documents: ['doc-ups-schematic', 'doc-gdb-schematic', 'doc-ups-wiki'],
    note: 'UPS → driver board; feeds motors + servo bus directly. The Orin taps this rail in the Jetson swap (the 5V host rail cannot power it).',
  },
  {
    id: 'net-5v-host',
    name: '5V Host Rail',
    kind: 'power',
    grain: 'module',
    carries: '5V ≈5A (MP8759 buck)',
    terminals: ['gdb-5v-host', 'pi5-40pin'],
    documents: ['doc-gdb-schematic', 'doc-gdb-wiki'],
    note: 'Powers the Raspberry Pi 5 through the stacked 40-pin header.',
  },
  {
    id: 'net-host-uart',
    name: 'Host ↔ ESP32 UART',
    kind: 'data',
    grain: 'module',
    carries: 'UART JSON commands + telemetry',
    terminals: ['gdb-host-uart', 'pi5-40pin', 'orin-uart'],
    documents: ['doc-gdb-wiki', 'doc-beast-product'],
    note: 'The only Pi GPIO interface the robot occupies. Orin swap uses TX/RX/GND jumpers instead of stacking.',
  },
  {
    id: 'net-servo-bus',
    name: 'ST3215 Serial Servo Bus',
    kind: 'mixed',
    grain: 'module',
    carries: 'TTL half-duplex @ 1 Mbps + pack voltage (5A limit)',
    terminals: ['gdb-servo-bus', 'beast-pan-tilt'],
    documents: ['doc-st-protocol', 'doc-st-circuit', 'doc-st3215-manual'],
    note: 'Daisy-chained, ID-addressed. BEAST-01 uses the stock two-servo pan-tilt only.',
  },
  {
    id: 'net-motor-left',
    name: 'Left Track Drive',
    kind: 'mixed',
    grain: 'module',
    carries: 'TB6612FNG PWM + encoder feedback',
    terminals: ['gdb-motor-a', 'beast-motor-left'],
    documents: ['doc-gdb-schematic', 'doc-gdb-wiki'],
  },
  {
    id: 'net-motor-right',
    name: 'Right Track Drive',
    kind: 'mixed',
    grain: 'module',
    carries: 'TB6612FNG PWM + encoder feedback',
    terminals: ['gdb-motor-b', 'beast-motor-right'],
    documents: ['doc-gdb-schematic', 'doc-gdb-wiki'],
  },
  {
    id: 'net-camera',
    name: 'Camera Feed',
    kind: 'data',
    grain: 'module',
    carries: 'USB video (MJPEG upstream)',
    terminals: ['beast-camera', 'pi5-usb', 'orin-usb'],
    documents: ['doc-beast-product'],
  },
  {
    id: 'net-oak-camera',
    name: 'OAK-D Lite RGB-D',
    kind: 'data',
    grain: 'module',
    carries: 'USB RGB + stereo depth + device inference',
    terminals: ['oak-usb', 'pi5-usb', 'orin-usb'],
    documents: ['doc-beast-product'],
    note: 'Pi 5 is the current host; the Jetson becomes the host after cutover.',
  },
  {
    id: 'net-d500-lidar',
    name: 'D500 LiDAR Scan',
    kind: 'data',
    grain: 'module',
    carries: 'STL-19P/LDS19 UART @ 230400 baud via USB bridge',
    terminals: ['d500-uart', 'gdb-lidar-uart', 'pi5-usb', 'orin-usb'],
    documents: ['doc-beast-product'],
    note: 'ROS 2 uses LDLIDAR_MODEL=ld19; Pi 5 is the current host and Jetson is the cutover target.',
  },
  {
    id: 'net-oled-i2c',
    name: 'OLED Telemetry',
    kind: 'data',
    grain: 'module',
    carries: 'I²C',
    terminals: ['gdb-i2c', 'beast-oled'],
    documents: ['doc-gdb-wiki'],
  },
  {
    id: 'net-ups-telemetry',
    name: 'UPS Battery Telemetry',
    kind: 'data',
    grain: 'module',
    carries: 'I²C V/I readings',
    terminals: ['ups-telemetry', 'pi5-40pin'],
    documents: ['doc-ups-wiki', 'doc-ups-code'],
    note: 'Per the UPS wiki RPi wiring table (SDA/SCL/5V/GND); optional hookup on the Beast.',
  },
];

export function netsAtGrain(grain: Net['grain'], nets: Net[] = MODULE_NETS): Net[] {
  return nets.filter((n) => n.grain === grain);
}

/**
 * The loom. One entry per physical cable, ordered shared → Pi 5 → Orin → future.
 *
 * Verified 2026-07-27 during the Orin cutover:
 *   • The ESP32 host link is driver-board USB-C **connector 6** (silkscreen
 *     `USB`, left of the pair beside the DC jack). Connector 7 is `LIDAR` and
 *     is idle on this robot.
 *   • The D500 rides the Audio HAT's LiDAR socket on the Pi build — the stock
 *     kit route — not the driver board's own LiDAR pair.
 */
export const WIRING_LINKS: WiringLink[] = [
  // ── shared by both builds ──────────────────────────────────────────────────
  { from: 'ups-out1', to: 'drv-dcin', cat: 'power', label: 'XH2.54 lead · via power switch', parentNet: 'net-battery-rail' },
  { from: 'charger', to: 'ups-chg', cat: 'power', label: 'Charger (arming + top-up)', parentNet: 'net-battery-rail' },
  { from: 'drv-40pin', to: 'hat-40pin-top', cat: 'uart', label: 'stack mate · 5 V + UART pass-through', parentNet: 'net-5v-host' },
  { from: 'fan2507', to: 'hat-fan', cat: 'power', label: 'integral fan · 2-pin', parentNet: 'net-5v-host' },
  { from: 'speaker', to: 'hat-spk', cat: 'audio', label: '2× 2-pin speaker leads', parentNet: null },
  { from: 'oled', to: 'drv-i2c', cat: 'i2c', label: 'PH2.0 4-wire', parentNet: 'net-oled-i2c' },
  { from: 'spotlight', to: 'drv-io45', cat: 'power', label: '2-wire switched feed', parentNet: null },
  { from: 'motor-l', to: 'drv-m1', cat: 'motor', label: 'PH2.0 6-wire', parentNet: 'net-motor-left' },
  { from: 'motor-r', to: 'drv-m2', cat: 'motor', label: 'PH2.0 6-wire', parentNet: 'net-motor-right' },
  { from: 'pantilt', to: 'drv-servo', cat: 'servo', label: '3-wire servo daisy chain', parentNet: 'net-servo-bus' },
  { from: 'antenna', to: 'drv-ipex', cat: 'rf', label: 'IPEX lead', parentNet: null },

  // ── original Pi 5 build ────────────────────────────────────────────────────
  { from: 'hat-40pin-bot', to: 'pi-40pin', cat: 'uart', label: 'stack dock · Pi 5 inverted below', parentNet: 'net-5v-host', build: 'pi5' },
  { from: 'hat-usbc', to: 'pi-usb2', cat: 'usb', label: 'USB-C → USB-A (audio + LiDAR via hub)', parentNet: null, build: 'pi5' },
  { from: 'lidar', to: 'hat-lidar', cat: 'sensor', label: 'D500 → HAT LiDAR socket (stock route)', parentNet: 'net-d500-lidar', build: 'pi5' },
  { from: 'camera', to: 'pi-usb3b', cat: 'video', label: 'USB', parentNet: 'net-camera', build: 'pi5' },
  { from: 'oakd', to: 'pi-usb3a', cat: 'video', label: 'USB-C → USB-A (USB3)', parentNet: 'net-oak-camera', build: 'pi5' },

  // ── Jetson Orin build ──────────────────────────────────────────────────────
  { from: 'ups-out2', to: 'jet-barrel', cat: 'power', label: 'Pigtail → 5.5×2.5 barrel', parentNet: 'net-battery-rail', build: 'orin' },
  { from: 'antenna-jet', to: 'jet-wifi', cat: 'rf', label: 'MHF4 leads ×2', parentNet: null, build: 'orin' },
  { from: 'hat-40pin-bot', to: 'jet-40pin', cat: 'uart', label: "3× M-F jumpers from the Pi's vacated dock (8↔10 crossed, 6→6)", parentNet: 'net-host-uart', build: 'orin' },
  { from: 'lidar', to: 'drv-lidar-sensor', cat: 'sensor', label: 'ZH1.5T-4P LiDAR cable', parentNet: 'net-d500-lidar', build: 'orin' },
  { from: 'drv-lidar-usb', to: 'jet-usb1', cat: 'usb', label: 'USB-C → USB-A (LiDAR data)', parentNet: 'net-d500-lidar', build: 'orin' },
  { from: 'camera', to: 'jet-usb2', cat: 'video', label: 'USB', parentNet: 'net-camera', build: 'orin' },
  { from: 'oakd', to: 'jet-usb3', cat: 'video', label: 'USB-C → USB-A (USB3)', parentNet: 'net-oak-camera', build: 'orin' },
  { from: 'hat-usbc', to: 'jet-usb4', cat: 'usb', label: 'USB-C → USB-A (audio · hub free for LiDAR)', parentNet: null, build: 'orin' },

  // ── future loadout — proposals, not state-tracked ──────────────────────────
  { from: 'oakdpro', to: 'jet-usb3', cat: 'video', label: 'USB3 ≤2 m shielded (replaces Lite)', parentNet: 'net-oak-camera', era: 'future', build: 'orin' },
  { from: 'camup', to: 'jet-usb2', cat: 'video', label: 'UVC USB (replaces 5MP cam)', parentNet: 'net-camera', era: 'future', build: 'orin' },
  { from: 'oakdpro', to: 'drv-5v', cat: 'power', label: 'Y-adapter aux 5 V ← Pi-freed buck (5 A)', parentNet: 'net-5v-host', era: 'future', build: 'orin' },
  { from: 'mid360s', to: 'jet-rj45', cat: 'net', label: 'M12 pigtail → RJ45 (100BASE-TX)', parentNet: null, era: 'future', build: 'orin' },
  { from: 'mid360s', to: 'ups-aux', cat: 'power', label: '9–27 V pack tap (add XT30)', parentNet: 'net-battery-rail', era: 'future', build: 'orin' },
];

/** Strands of a module-grain trunk. Powers "what cables make up this net?". */
export function linksForNet(netId: string): WiringLink[] {
  return WIRING_LINKS.filter((l) => l.parentNet === netId);
}

/** Links with no module-grain trunk — the spine's coverage gaps, made visible. */
export function orphanLinks(): WiringLink[] {
  return WIRING_LINKS.filter((l) => l.parentNet === null);
}
