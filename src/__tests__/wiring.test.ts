import { describe, it, expect } from 'vitest';
import { hangarData } from '@/data/hangar';
import {
  WIRING_LINKS,
  MODULE_NETS,
  BENCH_TERMINAL_ALIAS,
  linksForNet,
  orphanLinks,
  netsAtGrain,
} from '@/data/wiring';
import { EXPECTED_CABLES, NODE_INDEX } from '@/components/datacore/beast-console/bench-data';
import { BOARD_PORTS } from '@/components/datacore/DriverBoardSchematic';

describe('wiring surface', () => {
  const netIds = new Set(netsAtGrain('module').map((n) => n.id));

  it('hangarData.nets is the module-grain spine (single source)', () => {
    expect(hangarData.nets).toBe(MODULE_NETS);
    expect(hangarData.nets.every((n) => n.grain === 'module')).toBe(true);
  });

  it('every link endpoint resolves to a board port or a peripheral', () => {
    WIRING_LINKS.forEach((link) => {
      expect(NODE_INDEX[link.from], `link ${link.from} → ${link.to}: unknown "from"`).toBeDefined();
      expect(NODE_INDEX[link.to], `link ${link.from} → ${link.to}: unknown "to"`).toBeDefined();
    });
  });

  it('every parentNet names a real module-grain net', () => {
    WIRING_LINKS.forEach((link) => {
      if (link.parentNet === null) return;
      expect(
        netIds.has(link.parentNet),
        `link ${link.from} → ${link.to} claims parent net "${link.parentNet}", which does not exist`,
      ).toBe(true);
    });
  });

  it('no link is declared twice for the same build', () => {
    const seen = new Set<string>();
    WIRING_LINKS.forEach((link) => {
      const key = `${link.from}→${link.to}:${link.build ?? 'both'}`;
      expect(seen.has(key), `duplicate link ${key}`).toBe(false);
      seen.add(key);
    });
  });

  it('a link never connects a node to itself', () => {
    WIRING_LINKS.forEach((link) => {
      expect(link.from, `link connects ${link.from} to itself`).not.toBe(link.to);
    });
  });

  it('the console loom is the wiring surface (no parallel CableDef copy)', () => {
    expect(EXPECTED_CABLES).toBe(WIRING_LINKS);
  });

  it('linksForNet returns exactly the strands of a trunk', () => {
    const strands = linksForNet('net-battery-rail');
    expect(strands.length).toBeGreaterThan(0);
    strands.forEach((l) => expect(l.parentNet).toBe('net-battery-rail'));
  });

  // Not a failure — these are the spine's real coverage gaps, and the count is
  // pinned so closing one is a deliberate act rather than an accident.
  it('records how many strands still have no module-grain trunk', () => {
    const orphans = orphanLinks();
    expect(
      orphans.length,
      `orphan strands: ${orphans.map((o) => `${o.from}→${o.to}`).join(', ')}`,
    ).toBe(7);
  });
});

describe('Board ↔ Console terminal overlap', () => {
  const hangarTerminalIds = new Set(hangarData.terminals.map((t) => t.id));

  it('every aliased Board terminal exists in hangar terminals', () => {
    Object.values(BENCH_TERMINAL_ALIAS).forEach((boardId) => {
      expect(
        hangarTerminalIds.has(boardId),
        `alias targets missing Board terminal "${boardId}"`,
      ).toBe(true);
    });
  });

  it('every aliased Live Plug id exists in the console NODE_INDEX', () => {
    Object.keys(BENCH_TERMINAL_ALIAS).forEach((benchId) => {
      expect(
        NODE_INDEX[benchId],
        `alias source missing Live Plug node "${benchId}"`,
      ).toBeDefined();
    });
  });

  it('overlap pairs agree by name for known physical connectors', () => {
    expect(BENCH_TERMINAL_ALIAS['drv-esp32-usb']).toBe('gdb-usb-esp32');
    expect(BENCH_TERMINAL_ALIAS['jet-barrel']).toBe('orin-dc-in');
    expect(BENCH_TERMINAL_ALIAS['drv-dcin']).toBe('gdb-power-in');
    expect(BENCH_TERMINAL_ALIAS['pi-40pin']).toBe('pi5-40pin');
  });

  it('named loom ends with a parentNet land on that module net via alias', () => {
    // Only assert unambiguous single-net peripherals / power taps — multi-role
    // hubs (40-pin stack mate) intentionally span more than one module trunk.
    const cases: Array<{ bench: string; net: string }> = [
      { bench: 'jet-barrel', net: 'net-battery-rail' },
      { bench: 'drv-dcin', net: 'net-battery-rail' },
      { bench: 'ups-out1', net: 'net-battery-rail' },
      { bench: 'motor-l', net: 'net-motor-left' },
      { bench: 'drv-m1', net: 'net-motor-left' },
      { bench: 'pantilt', net: 'net-servo-bus' },
      { bench: 'drv-servo', net: 'net-servo-bus' },
      { bench: 'oled', net: 'net-oled-i2c' },
      { bench: 'drv-i2c', net: 'net-oled-i2c' },
      { bench: 'camera', net: 'net-camera' },
      { bench: 'oakd', net: 'net-oak-camera' },
      { bench: 'jet-40pin', net: 'net-host-uart' },
    ];
    for (const { bench, net: netId } of cases) {
      const boardId = BENCH_TERMINAL_ALIAS[bench];
      const net = MODULE_NETS.find((n) => n.id === netId);
      expect(boardId, `missing alias for ${bench}`).toBeDefined();
      expect(net, `missing net ${netId}`).toBeDefined();
      expect(
        net!.terminals.includes(boardId!),
        `${bench} → ${boardId} should sit on ${netId}`,
      ).toBe(true);
    }
  });
});

describe('DriverBoardSchematic slot join', () => {
  // This diagram joins to the spine on a human-readable label, not an id.
  // Renaming a slot for readability in hangar.ts would silently stop the
  // schematic highlighting that port, with no type error to catch it.
  it('every board port matches a real beast loadout slot name', () => {
    const beast = hangarData.units.find((u) => u.id === 'beast');
    expect(beast, 'the beast unit must exist').toBeDefined();
    const slotNames = new Set((beast?.loadout ?? []).map((s) => s.slot));

    BOARD_PORTS.forEach((port) => {
      expect(
        slotNames.has(port.slot),
        `DriverBoardSchematic port "${port.id}" joins on slot name "${port.slot}", ` +
          `which no longer exists in the beast loadout — the diagram is silently unwired`,
      ).toBe(true);
    });
  });
});
