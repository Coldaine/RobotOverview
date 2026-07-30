// ─────────────────────────────────────────────────────────────────────────────
// BEAST-01 wiring — the single surface that holds what is connected to what.
//
// Intended end state (tracked in docs/plans/2026-07-30-wiring-model-completion.md):
// two views project from this file and neither owns a copy of the facts:
//   • The Board  (/board)     renders `grain: 'module'`      — subsystem trunks
//   • Live Plug  (/datacore)  renders `grain: 'connector'`   — individual cables
//
// TODAY only Live Plug projects from this file (via EXPECTED_CABLES in
// bench-data.ts). The Board still reads hangar.ts nets directly — the unification
// is half-landed, and the grain model below is not yet in types.ts. Phase 1 of
// the plan closes this; until then, a wiring fact must be written in BOTH this
// file and hangar.ts nets.
//
// A fact is written here once. Layout coordinates, plug state, and conversion
// procedure are NOT facts and stay with the view that draws them.
//
// Grain (planned — not yet on Net):
//   module     board-to-board / subsystem wiring          → hangar.ts nets
//   connector  one physical cable between two named ends  → the loom below
//   internal   intra-board rail (VDD5V, the M2 gate)      → not yet populated
// ─────────────────────────────────────────────────────────────────────────────

import type { Build, PortCategory } from './types';

/**
 * One physical cable. `from`/`to` are bench node ids — a board port or a
 * peripheral, resolved through `NODE_INDEX` in the console.
 *
 * `parentNet` names the module-grain net in `hangar.ts` this cable is a strand
 * of. Null means the trunk does not exist yet: either the subsystem genuinely
 * has no module-level representation (RF stubs, audio), or the spine is
 * incomplete. Both are worth knowing; neither is an error.
 */
export interface WiringLink {
  from: string;
  to: string;
  cat: PortCategory;
  label: string;
  /** module-grain net id in hangar.ts, or null if this strand has no trunk yet */
  parentNet: string | null;
  /** absent = present in both builds */
  build?: Build;
  /** proposed hardware, not on the robot */
  era?: 'future';
  /** document ids proving this link; prefer a sheet zone (`doc-x#C6`) over a bare PDF */
  documents?: string[];
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
