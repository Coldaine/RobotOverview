import { describe, it, expect } from 'vitest';
import { hangarData } from '@/data/hangar';
import type { BayId, InventoryItemStatus, UnitStatus } from '@/data/types';

const VALID_BAY_IDS: BayId[] = ['robotics', 'compute', 'network', 'home', 'audio'];
const VALID_UNIT_STATUSES: UnitStatus[] = [
  'operational',
  'needs-attention',
  'blocked',
  'in-mission',
  'wishlist',
  'on-order',
  'researching',
  'retired',
];
const VALID_ITEM_STATUSES: InventoryItemStatus[] = [
  'owned',
  'on-order',
  'wishlist',
  'researching',
  'deployed',
  'retired',
  'rejected',
];

describe('hangar.ts data integrity', () => {
  const unitIds = new Set(hangarData.units.map((u) => u.id));
  const missionIds = new Set(hangarData.missions.map((m) => m.id));
  const wishlistIds = new Set(hangarData.wishlist.map((w) => w.id));
  const capabilityIds = new Set(hangarData.capabilities.map((c) => c.id));
  const insightIds = new Set(hangarData.insights.map((i) => i.id));

  it('has no duplicate unit IDs', () => {
    const ids = hangarData.units.map((u) => u.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('has no duplicate mission IDs', () => {
    const ids = hangarData.missions.map((m) => m.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('has no duplicate wishlist IDs', () => {
    const ids = hangarData.wishlist.map((w) => w.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('has no duplicate capability IDs', () => {
    const ids = hangarData.capabilities.map((c) => c.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('all unit.bay values are valid BayIds', () => {
    hangarData.units.forEach((u) => {
      expect(VALID_BAY_IDS, `unit "${u.id}" has invalid bay "${u.bay}"`).toContain(u.bay);
    });
  });

  it('all unit.status values are valid UnitStatus values', () => {
    hangarData.units.forEach((u) => {
      expect(VALID_UNIT_STATUSES, `unit "${u.id}" has invalid status "${u.status}"`).toContain(u.status);
    });
  });

  it('all mission.requisitionedUnits IDs exist in units', () => {
    hangarData.missions.forEach((m) => {
      m.requisitionedUnits.forEach((uid) => {
        expect(unitIds.has(uid), `mission "${m.id}" references unknown unit "${uid}"`).toBe(true);
      });
    });
  });

  it('all mission.wishlist IDs exist in the wishlist collection', () => {
    hangarData.missions.forEach((m) => {
      (m.wishlist ?? []).forEach((wid) => {
        expect(wishlistIds.has(wid), `mission "${m.id}" references unknown wishlist item "${wid}"`).toBe(true);
      });
    });
  });

  it('all wishlist.forUnit IDs exist in units', () => {
    hangarData.wishlist.forEach((w) => {
      if (w.forUnit) {
        expect(unitIds.has(w.forUnit), `wishlist item "${w.id}" references unknown unit "${w.forUnit}"`).toBe(true);
      }
    });
  });

  it('all wishlist.forMission IDs exist in missions', () => {
    hangarData.wishlist.forEach((w) => {
      if (w.forMission) {
        expect(missionIds.has(w.forMission), `wishlist item "${w.id}" references unknown mission "${w.forMission}"`).toBe(true);
      }
    });
  });

  it('all capability.unlockedBy IDs exist in units or wishlist', () => {
    const allIds = new Set([...unitIds, ...wishlistIds]);
    hangarData.capabilities.forEach((cap) => {
      cap.unlockedBy.forEach((id) => {
        expect(allIds.has(id), `capability "${cap.id}" unlockedBy references unknown ID "${id}"`).toBe(true);
      });
    });
  });

  it('all capability.dependsOn IDs exist in capabilities', () => {
    hangarData.capabilities.forEach((cap) => {
      (cap.dependsOn ?? []).forEach((id) => {
        expect(capabilityIds.has(id), `capability "${cap.id}" dependsOn references unknown capability "${id}"`).toBe(true);
      });
    });
  });

  it('all unit.insights IDs exist in the insights collection', () => {
    hangarData.units.forEach((u) => {
      (u.insights ?? []).forEach((iid) => {
        expect(insightIds.has(iid), `unit "${u.id}" references unknown insight "${iid}"`).toBe(true);
      });
    });
  });

  it('all mission.insights IDs exist in the insights collection', () => {
    hangarData.missions.forEach((m) => {
      (m.insights ?? []).forEach((iid) => {
        expect(insightIds.has(iid), `mission "${m.id}" references unknown insight "${iid}"`).toBe(true);
      });
    });
  });

  it('all loadout.hotspotId values reference a hotspot on the same unit', () => {
    hangarData.units.forEach((u) => {
      if (!u.loadout || !u.hotspots) return;
      const hotspotIds = new Set(u.hotspots.map((h) => h.id));
      u.loadout.forEach((slot) => {
        if (slot.hotspotId) {
          expect(
            hotspotIds.has(slot.hotspotId),
            `unit "${u.id}" slot "${slot.slot}" references unknown hotspot "${slot.hotspotId}"`
          ).toBe(true);
        }
      });
    });
  });

  it('all loadout.filledBy unit IDs (initial data) reference existing units', () => {
    hangarData.units.forEach((u) => {
      (u.loadout ?? []).forEach((slot) => {
        if (slot.filledBy) {
          expect(unitIds.has(slot.filledBy), `unit "${u.id}" slot "${slot.slot}" filledBy unknown unit "${slot.filledBy}"`).toBe(true);
        }
      });
    });
  });

  // ── Inventory items ──────────────────────────────────────────────────────
  it('has no duplicate item IDs', () => {
    const ids = hangarData.items.map((it) => it.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('all item.bay values are valid BayIds', () => {
    hangarData.items.forEach((it) => {
      expect(VALID_BAY_IDS, `item "${it.id}" has invalid bay "${it.bay}"`).toContain(it.bay);
    });
  });

  it('all item.status values are valid InventoryItemStatus values', () => {
    hangarData.items.forEach((it) => {
      expect(VALID_ITEM_STATUSES, `item "${it.id}" has invalid status "${it.status}"`).toContain(it.status);
    });
  });

  it('all item.relatedUnits IDs exist in units', () => {
    hangarData.items.forEach((it) => {
      (it.relatedUnits ?? []).forEach((id) => {
        expect(unitIds.has(id), `item "${it.id}" references unknown unit "${id}"`).toBe(true);
      });
    });
  });

  it('all item.relatedMissions IDs exist in missions', () => {
    hangarData.items.forEach((it) => {
      (it.relatedMissions ?? []).forEach((id) => {
        expect(missionIds.has(id), `item "${it.id}" references unknown mission "${id}"`).toBe(true);
      });
    });
  });

  it('all item.relatedCapabilities IDs exist in capabilities', () => {
    hangarData.items.forEach((it) => {
      (it.relatedCapabilities ?? []).forEach((id) => {
        expect(capabilityIds.has(id), `item "${it.id}" references unknown capability "${id}"`).toBe(true);
      });
    });
  });

  it('all item.relatedInsights IDs exist in the insights collection', () => {
    hangarData.items.forEach((it) => {
      (it.relatedInsights ?? []).forEach((id) => {
        expect(insightIds.has(id), `item "${it.id}" references unknown insight "${id}"`).toBe(true);
      });
    });
  });

  // ── Connected twin: terminals + nets + documents ──────────────────────────
  const terminalIds = new Set(hangarData.terminals.map((t) => t.id));
  const documentIds = new Set(hangarData.documents.map((d) => d.id));

  it('has no duplicate terminal, net, or document IDs', () => {
    expect(hangarData.terminals.length).toBe(terminalIds.size);
    const netIds = hangarData.nets.map((n) => n.id);
    expect(netIds.length).toBe(new Set(netIds).size);
    expect(hangarData.documents.length).toBe(documentIds.size);
  });

  it('all terminal.unitId values reference existing units', () => {
    hangarData.terminals.forEach((t) => {
      expect(unitIds.has(t.unitId), `terminal "${t.id}" references unknown unit "${t.unitId}"`).toBe(true);
    });
  });

  it('every net joins at least two existing, distinct terminals', () => {
    hangarData.nets.forEach((n) => {
      expect(n.terminals.length, `net "${n.id}" must join ≥2 terminals`).toBeGreaterThanOrEqual(2);
      expect(new Set(n.terminals).size, `net "${n.id}" lists a terminal twice`).toBe(n.terminals.length);
      n.terminals.forEach((tid) => {
        expect(terminalIds.has(tid), `net "${n.id}" references unknown terminal "${tid}"`).toBe(true);
      });
    });
  });

  it('all net.documents IDs exist in the documents collection', () => {
    hangarData.nets.forEach((n) => {
      (n.documents ?? []).forEach((did) => {
        expect(documentIds.has(did), `net "${n.id}" references unknown document "${did}"`).toBe(true);
      });
    });
  });

  it('all document.units IDs exist in units', () => {
    hangarData.documents.forEach((d) => {
      (d.units ?? []).forEach((uid) => {
        expect(unitIds.has(uid), `document "${d.id}" references unknown unit "${uid}"`).toBe(true);
      });
    });
  });

  it('every document has a stable archive path', () => {
    hangarData.documents.forEach((d) => {
      expect(d.archivePath.startsWith('UGV-Beast-Archive/'), `document "${d.id}" archivePath must live under UGV-Beast-Archive/`).toBe(true);
    });
  });
});
