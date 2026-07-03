import { describe, it, expect } from 'vitest';
import { hangarData } from '@/data/hangar';
import {
  buildBoardLayout,
  buildBusLayout,
  buildIsoLayout,
  buildLayout,
  documentsForNet,
  netKindColor,
  netsForTerminal,
  resolveActive,
  traceFromNet,
  traceFromTerminal,
  type TwinLayout,
  type ViewMode,
} from '@/lib/twin';

const { units, terminals, nets, documents } = hangarData;
const terminalIds = new Set(terminals.map((t) => t.id));

describe('twin graph helpers', () => {
  it('maps every net kind to a stable color key', () => {
    expect(netKindColor('power')).toBe('amber');
    expect(netKindColor('data')).toBe('cyan');
    expect(netKindColor('mixed')).toBe('mixed');
    expect(netKindColor('mechanical')).toBe('idle');
  });

  it('netsForTerminal round-trips against the net terminal lists', () => {
    for (const net of nets) {
      for (const tid of net.terminals) {
        expect(netsForTerminal(nets, tid).map((n) => n.id)).toContain(net.id);
      }
    }
    // pi5-40pin is the super-hub — it belongs to three nets.
    expect(netsForTerminal(nets, 'pi5-40pin').map((n) => n.id).sort()).toEqual(
      ['net-5v-host', 'net-host-uart', 'net-ups-telemetry'].sort(),
    );
  });

  it('resolves proving documents for a net in order', () => {
    const servo = nets.find((n) => n.id === 'net-servo-bus')!;
    expect(documentsForNet(documents, servo).map((d) => d.id)).toEqual([
      'doc-st-protocol',
      'doc-st-circuit',
      'doc-st3215-manual',
    ]);
    const bare = documentsForNet(documents, { ...servo, documents: undefined });
    expect(bare).toEqual([]);
  });

  it('traces a terminal to its nets and sibling terminals', () => {
    const trace = traceFromTerminal(nets, 'gdb-servo-bus');
    expect(trace.netIds.has('net-servo-bus')).toBe(true);
    expect(trace.terminalIds.has('beast-pan-tilt')).toBe(true);
    expect(trace.terminalIds.has('roarm-servo-in')).toBe(true);
    // Not on the servo bus.
    expect(trace.terminalIds.has('pi5-40pin')).toBe(false);
  });

  it('traces a net to exactly its own terminals', () => {
    const trace = traceFromNet(nets, 'net-5v-host');
    expect([...trace.netIds]).toEqual(['net-5v-host']);
    expect([...trace.terminalIds].sort()).toEqual(['gdb-5v-host', 'pi5-40pin'].sort());
  });
});

describe('resolveActive (host swap)', () => {
  it('lights the Pi stack path and dims the Orin under pi5', () => {
    const active = resolveActive(terminals, nets, 'pi5');
    expect(active.terminalIds.has('pi5-40pin')).toBe(true);
    expect(active.terminalIds.has('orin-uart')).toBe(false);
    expect(active.terminalIds.has('orin-dc-in')).toBe(false);
    // The 5V host rail powers the Pi; UPS telemetry and camera reach the Pi.
    expect(active.netIds.has('net-5v-host')).toBe(true);
    expect(active.netIds.has('net-ups-telemetry')).toBe(true);
    expect(active.netIds.has('net-camera')).toBe(true);
    // UART is live via the stacked header.
    expect(active.netIds.has('net-host-uart')).toBe(true);
  });

  it('lights the Orin jumpers and drops the 5V rail under orin', () => {
    const active = resolveActive(terminals, nets, 'orin');
    expect(active.terminalIds.has('orin-uart')).toBe(true);
    expect(active.terminalIds.has('orin-dc-in')).toBe(true);
    expect(active.terminalIds.has('pi5-40pin')).toBe(false);
    // Orin can't draw header 5V, and Pi-bound telemetry/camera go dark.
    expect(active.netIds.has('net-5v-host')).toBe(false);
    expect(active.netIds.has('net-ups-telemetry')).toBe(false);
    expect(active.netIds.has('net-camera')).toBe(false);
    // UART stays live via TX/RX/GND jumpers; battery rail still energized.
    expect(active.netIds.has('net-host-uart')).toBe(true);
    expect(active.netIds.has('net-battery-rail')).toBe(true);
  });

  it('keeps host-agnostic subsystems live under either host', () => {
    for (const host of ['pi5', 'orin'] as const) {
      const active = resolveActive(terminals, nets, host);
      expect(active.netIds.has('net-servo-bus')).toBe(true);
      expect(active.netIds.has('net-motor-left')).toBe(true);
      expect(active.netIds.has('net-motor-right')).toBe(true);
      expect(active.netIds.has('net-oled-i2c')).toBe(true);
    }
  });
});

const MODES: ViewMode[] = ['board', 'iso', 'bus'];
const wiredUnitCount = new Set(terminals.map((t) => t.unitId)).size;

function everyCoordFinite(layout: TwinLayout): boolean {
  const nums = [
    layout.width,
    layout.height,
    ...layout.modules.flatMap((m) => [m.x, m.y, m.w, m.h]),
    ...layout.ports.flatMap((p) => [p.x, p.y, p.nx, p.ny]),
    ...layout.wires.flatMap((w) => [w.midX, w.midY]),
  ];
  return nums.every((n) => Number.isFinite(n));
}

describe.each(MODES)('layout builder: %s', (mode) => {
  const layout = buildLayout(mode, units, terminals, nets);

  it('emits a module for every wired unit', () => {
    expect(layout.modules.length).toBe(wiredUnitCount);
    expect(new Set(layout.modules.map((m) => m.unitId)).size).toBe(wiredUnitCount);
  });

  it('emits a non-empty path for every net', () => {
    expect(layout.wires.length).toBe(nets.length);
    for (const w of layout.wires) {
      expect(w.d.length, `net "${w.netId}" has empty path`).toBeGreaterThan(0);
      expect(w.d.includes('NaN'), `net "${w.netId}" path has NaN`).toBe(false);
    }
  });

  it('only references real terminals in ports', () => {
    for (const p of layout.ports) {
      expect(terminalIds.has(p.terminalId), `port references unknown terminal "${p.terminalId}"`).toBe(true);
    }
  });

  it('has only finite coordinates', () => {
    expect(everyCoordFinite(layout)).toBe(true);
  });

  it('is deterministic', () => {
    const again = buildLayout(mode, units, terminals, nets);
    expect(again).toEqual(layout);
  });
});

describe('board & iso place every terminal', () => {
  it.each([
    ['board', buildBoardLayout],
    ['iso', buildIsoLayout],
  ] as const)('%s has a port for each terminal exactly once', (_mode, build) => {
    const layout = build(units, terminals, nets);
    const portTerminals = layout.ports.map((p) => p.terminalId);
    expect(new Set(portTerminals).size).toBe(terminals.length);
    expect(portTerminals.length).toBe(terminals.length);
  });
});

describe('bus taps each net terminal on its row', () => {
  it('gives every net at least two tap nodes', () => {
    const layout = buildBusLayout(units, terminals, nets);
    for (const net of nets) {
      const taps = layout.ports.filter((p) => p.netId === net.id);
      expect(taps.length, `net "${net.id}" should tap ≥2 columns`).toBeGreaterThanOrEqual(2);
    }
  });

  it('lets the super-hub terminal tap multiple rows', () => {
    const layout = buildBusLayout(units, terminals, nets);
    const taps = layout.ports.filter((p) => p.terminalId === 'pi5-40pin');
    expect(taps.length).toBe(3);
    expect(new Set(taps.map((p) => p.netId)).size).toBe(3);
  });
});
