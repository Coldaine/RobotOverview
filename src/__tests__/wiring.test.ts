import { describe, it, expect } from 'vitest';
import { hangarData } from '@/data/hangar';
import { WIRING_LINKS, linksForNet, orphanLinks } from '@/data/wiring';
import { EXPECTED_CABLES, NODE_INDEX } from '@/components/datacore/beast-console/bench-data';
import { BOARD_PORTS } from '@/components/datacore/DriverBoardSchematic';

describe('wiring surface', () => {
  const netIds = new Set(hangarData.nets.map((n) => n.id));

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

  // The console renders from this projection. If it ever stops matching the
  // surface, Live Plug is drawing a loom nothing else agrees with.
  it('the console loom is a faithful projection of the wiring surface', () => {
    expect(EXPECTED_CABLES.length).toBe(WIRING_LINKS.length);
    EXPECTED_CABLES.forEach((cable, i) => {
      const link = WIRING_LINKS[i];
      expect(cable.from).toBe(link.from);
      expect(cable.to).toBe(link.to);
      expect(cable.cat).toBe(link.cat);
      expect(cable.label).toBe(link.label);
      expect(cable.build).toBe(link.build);
      expect(cable.era).toBe(link.era);
    });
  });

  it('the console loom carries no spine bookkeeping', () => {
    EXPECTED_CABLES.forEach((cable) => {
      expect('parentNet' in cable, `${cable.from} → ${cable.to} leaked parentNet into the view`).toBe(false);
      expect('documents' in cable, `${cable.from} → ${cable.to} leaked documents into the view`).toBe(false);
    });
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
