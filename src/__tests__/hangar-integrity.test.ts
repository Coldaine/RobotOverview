import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { HANGAR_BAY_IDS, hangarData } from '@/data/hangar';
import { seedSql } from '../../db/hangar/gen-seed';
import { isTrimmedTimestamp } from '@/server/hangar/validators';
import {
  ACTIVITY_KINDS,
  BAY_ACCENTS,
  DOCUMENT_KINDS,
  INSIGHT_CONFIDENCE_LEVELS,
  INVENTORY_ITEM_STATUSES,
  MISSION_CONSTRAINT_UNITS,
  MISSION_STATUSES,
  NET_KINDS,
  POWER_RAILS,
  PROVENANCE_KINDS,
  SOURCE_RECORD_KINDS,
  TERMINAL_ROLES,
  UNIT_SHORTCUT_TYPES,
  UNIT_STATUSES,
  WISHLIST_STATUSES,
} from '@/data/types';

describe('hangar.ts data integrity', () => {
  const unitIds = new Set(hangarData.units.map((u) => u.id));
  const missionIds = new Set(hangarData.missions.map((m) => m.id));
  const wishlistIds = new Set(hangarData.wishlist.map((w) => w.id));
  const capabilityIds = new Set(hangarData.capabilities.map((c) => c.id));
  const insightIds = new Set(hangarData.insights.map((i) => i.id));

  function expectFiniteNonNegative(value: number | null | undefined, label: string) {
    if (value == null) return;
    expect(Number.isFinite(value), `${label} must be finite`).toBe(true);
    expect(value, `${label} must be non-negative`).toBeGreaterThanOrEqual(0);
  }

  function expectRequiredFiniteNonNegative(value: number | null | undefined, label: string) {
    expect(value, `${label} is required`).not.toBeNull();
    expect(value, `${label} is required`).not.toBeUndefined();
    expectFiniteNonNegative(value, label);
  }

  function expectValidTimestamp(value: string, label: string) {
    expect(isTrimmedTimestamp(value), `${label} must be a trimmed ISO date or timestamp`).toBe(true);
  }

  function expectValidHttpUrl(value: string, label: string) {
    expect(value.trim(), `${label} must not be blank`).not.toBe('');
    expect(value, `${label} must not have surrounding whitespace`).toBe(value.trim());
    const url = new URL(value);
    expect(['http:', 'https:'], `${label} must use http(s)`).toContain(url.protocol);
  }

  function normalizeLineEndings(value: string) {
    return value.replace(/\r\n/g, '\n');
  }

  it('committed Postgres seed SQL matches freshly generated hangar.ts output', () => {
    const committedSeedSql = readFileSync(resolve(process.cwd(), 'db/hangar/seed.sql'), 'utf8');
    const generatedSeedSql = normalizeLineEndings(seedSql);

    expect(
      normalizeLineEndings(committedSeedSql) === generatedSeedSql,
      'db/hangar/seed.sql is stale; regenerate it from db/hangar/gen-seed.ts.',
    ).toBe(true);
  });

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
      expect(HANGAR_BAY_IDS, `unit "${u.id}" has invalid bay "${u.bay}"`).toContain(u.bay);
    });
  });

  it('all bay.accent values are valid BayAccent values', () => {
    hangarData.bays.forEach((bay) => {
      expect(BAY_ACCENTS, `bay "${bay.id}" has invalid accent "${bay.accent}"`).toContain(bay.accent);
    });
  });

  it('all unit.status values are valid UnitStatus values', () => {
    hangarData.units.forEach((u) => {
      expect(UNIT_STATUSES, `unit "${u.id}" has invalid status "${u.status}"`).toContain(u.status);
    });
  });

  it('all unit provenance values are valid ProvenanceKind values', () => {
    hangarData.units.forEach((u) => {
      if (!u.provenance) return;
      expect(PROVENANCE_KINDS, `unit "${u.id}" has invalid provenance "${u.provenance}"`).toContain(u.provenance);
    });
  });

  it('all unit power rails are valid PowerRail values', () => {
    hangarData.units.forEach((u) => {
      if (!u.power?.rail) return;
      expect(POWER_RAILS, `unit "${u.id}" has invalid power rail "${u.power.rail}"`).toContain(u.power.rail);
    });
  });

  it('all unit shortcut types are valid UnitShortcutType values', () => {
    hangarData.units.forEach((u) => {
      (u.shortcuts ?? []).forEach((shortcut) => {
        expect(
          UNIT_SHORTCUT_TYPES,
          `unit "${u.id}" shortcut "${shortcut.id}" has invalid type "${shortcut.type}"`
        ).toContain(shortcut.type);
      });
    });
  });

  it('all unit specs, links, and shortcuts are usable display text', () => {
    hangarData.units.forEach((u) => {
      const specLabels = u.specs.map((spec) => spec.label);
      expect(specLabels.length, `unit "${u.id}" spec labels must be unique`).toBe(new Set(specLabels).size);
      u.specs.forEach((spec) => {
        expect(spec.label.trim(), `unit "${u.id}" spec label must not be blank`).not.toBe('');
        expect(spec.label, `unit "${u.id}" spec label must not have surrounding whitespace`).toBe(spec.label.trim());
        expect(spec.value.trim(), `unit "${u.id}" spec "${spec.label}" value must not be blank`).not.toBe('');
        expect(spec.value, `unit "${u.id}" spec "${spec.label}" value must not have surrounding whitespace`).toBe(spec.value.trim());
      });

      const linkUrls = (u.links ?? []).map((link) => link.url);
      expect(linkUrls.length, `unit "${u.id}" link URLs must be unique`).toBe(new Set(linkUrls).size);
      (u.links ?? []).forEach((link) => {
        expect(link.label.trim(), `unit "${u.id}" link label must not be blank`).not.toBe('');
        expect(link.label, `unit "${u.id}" link label must not have surrounding whitespace`).toBe(link.label.trim());
        expectValidHttpUrl(link.url, `unit "${u.id}" link "${link.label}" url`);
      });

      const shortcutIds = (u.shortcuts ?? []).map((shortcut) => shortcut.id);
      expect(shortcutIds.length, `unit "${u.id}" shortcut ids must be unique`).toBe(new Set(shortcutIds).size);
      (u.shortcuts ?? []).forEach((shortcut) => {
        expect(shortcut.id.trim(), `unit "${u.id}" shortcut id must not be blank`).not.toBe('');
        expect(shortcut.id, `unit "${u.id}" shortcut id must not have surrounding whitespace`).toBe(shortcut.id.trim());
        expect(shortcut.label.trim(), `unit "${u.id}" shortcut "${shortcut.id}" label must not be blank`).not.toBe('');
        expect(shortcut.label, `unit "${u.id}" shortcut "${shortcut.id}" label must not have surrounding whitespace`).toBe(shortcut.label.trim());
        if (shortcut.note !== undefined) {
          expect(shortcut.note.trim(), `unit "${u.id}" shortcut "${shortcut.id}" note must not be blank`).not.toBe('');
          expect(shortcut.note, `unit "${u.id}" shortcut "${shortcut.id}" note must not have surrounding whitespace`).toBe(shortcut.note.trim());
        }

        if (shortcut.type === 'url') {
          expectValidHttpUrl(shortcut.url, `unit "${u.id}" shortcut "${shortcut.id}" url`);
        } else {
          expect(shortcut.command.trim(), `unit "${u.id}" shortcut "${shortcut.id}" command must not be blank`).not.toBe('');
          expect(shortcut.command, `unit "${u.id}" shortcut "${shortcut.id}" command must not have surrounding whitespace`).toBe(shortcut.command.trim());
        }
      });
    });
  });

  it('all mission.status values are valid MissionStatus values', () => {
    hangarData.missions.forEach((m) => {
      expect(MISSION_STATUSES, `mission "${m.id}" has invalid status "${m.status}"`).toContain(m.status);
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

  it('all wishlist.status values are valid WishlistStatus values', () => {
    hangarData.wishlist.forEach((w) => {
      expect(WISHLIST_STATUSES, `wishlist item "${w.id}" has invalid status "${w.status}"`).toContain(w.status);
    });
  });

  it('all wishlist.unlocks IDs exist in capabilities', () => {
    hangarData.wishlist.forEach((w) => {
      if (w.unlocks !== undefined) {
        expect(
          capabilityIds.has(w.unlocks),
          `wishlist item "${w.id}" references unknown unlock capability "${w.unlocks}"`,
        ).toBe(true);
      }
    });
  });

  it('all wishlist power rails are valid PowerRail values', () => {
    hangarData.wishlist.forEach((w) => {
      if (!w.power?.rail) return;
      expect(POWER_RAILS, `wishlist item "${w.id}" has invalid power rail "${w.power.rail}"`).toContain(w.power.rail);
    });
  });

  it('all asset numerics that seed Postgres typed columns are finite and non-negative', () => {
    hangarData.units.forEach((u) => {
      expectFiniteNonNegative(u.price?.us, `unit "${u.id}" price.us`);
      expectFiniteNonNegative(u.price?.import, `unit "${u.id}" price.import`);
      expectFiniteNonNegative(u.power?.watts, `unit "${u.id}" power.watts`);
      expectFiniteNonNegative(u.power?.volts, `unit "${u.id}" power.volts`);
      expectFiniteNonNegative(u.massGrams, `unit "${u.id}" massGrams`);
    });

    hangarData.items.forEach((it) => {
      expectFiniteNonNegative(it.price?.us, `item "${it.id}" price.us`);
      expectFiniteNonNegative(it.price?.import, `item "${it.id}" price.import`);
      if (it.quantity !== undefined) {
        expect(Number.isInteger(it.quantity), `item "${it.id}" quantity must be an integer`).toBe(true);
        expect(it.quantity, `item "${it.id}" quantity must be positive`).toBeGreaterThan(0);
      }
    });

    hangarData.wishlist.forEach((w) => {
      expectFiniteNonNegative(w.price.us, `wishlist item "${w.id}" price.us`);
      expectFiniteNonNegative(w.price.import, `wishlist item "${w.id}" price.import`);
      expectFiniteNonNegative(w.power?.watts, `wishlist item "${w.id}" power.watts`);
      expectFiniteNonNegative(w.power?.volts, `wishlist item "${w.id}" power.volts`);
      expectFiniteNonNegative(w.massGrams, `wishlist item "${w.id}" massGrams`);
    });
  });

  it('all mission constraint numerics that seed Postgres typed columns are finite and non-negative', () => {
    hangarData.missions.forEach((m) => {
      m.constraints.forEach((constraint) => {
        expectRequiredFiniteNonNegative(
          constraint.value,
          `mission "${m.id}" constraint "${constraint.label}" value`,
        );
        expectRequiredFiniteNonNegative(
          constraint.budget,
          `mission "${m.id}" constraint "${constraint.label}" budget`,
        );
        expect(
          MISSION_CONSTRAINT_UNITS,
          `mission "${m.id}" constraint "${constraint.label}" has invalid unit "${constraint.unit}"`,
        ).toContain(constraint.unit);
      });
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

  it('all capability.bay values are valid BayIds', () => {
    hangarData.capabilities.forEach((cap) => {
      if (cap.bay === undefined) return;
      expect(HANGAR_BAY_IDS, `capability "${cap.id}" has invalid bay "${cap.bay}"`).toContain(cap.bay);
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

  it('all insight.confidence values are valid InsightConfidence values', () => {
    hangarData.insights.forEach((insight) => {
      expect(INSIGHT_CONFIDENCE_LEVELS, `insight "${insight.id}" has invalid confidence "${insight.confidence}"`).toContain(insight.confidence);
    });
  });

  it('all insight.units IDs exist in units', () => {
    hangarData.insights.forEach((insight) => {
      (insight.units ?? []).forEach((uid) => {
        expect(unitIds.has(uid), `insight "${insight.id}" references unknown unit "${uid}"`).toBe(true);
      });
    });
  });

  it('all insight.missions IDs exist in missions', () => {
    hangarData.insights.forEach((insight) => {
      (insight.missions ?? []).forEach((mid) => {
        expect(missionIds.has(mid), `insight "${insight.id}" references unknown mission "${mid}"`).toBe(true);
      });
    });
  });

  it('all insight timestamps that seed Postgres are parseable', () => {
    hangarData.insights.forEach((insight) => {
      expectValidTimestamp(insight.capturedAt, `insight "${insight.id}" capturedAt`);
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
      expect(HANGAR_BAY_IDS, `item "${it.id}" has invalid bay "${it.bay}"`).toContain(it.bay);
    });
  });

  it('all item.status values are valid InventoryItemStatus values', () => {
    hangarData.items.forEach((it) => {
      expect(INVENTORY_ITEM_STATUSES, `item "${it.id}" has invalid status "${it.status}"`).toContain(it.status);
    });
  });

  it('all item provenance values are valid ProvenanceKind values', () => {
    hangarData.items.forEach((it) => {
      if (!it.provenance) return;
      expect(PROVENANCE_KINDS, `item "${it.id}" has invalid provenance "${it.provenance}"`).toContain(it.provenance);
    });
  });

  it('all item source kinds are valid SourceRecordKind values', () => {
    hangarData.items.forEach((it) => {
      (it.sources ?? []).forEach((source) => {
        expect(SOURCE_RECORD_KINDS, `item "${it.id}" source "${source.label}" has invalid kind "${source.kind}"`).toContain(source.kind);
      });
    });
  });

  it('all item specs and limitations are usable display text', () => {
    hangarData.items.forEach((it) => {
      it.specs.forEach((spec) => {
        expect(spec.label.trim(), `item "${it.id}" spec label must not be blank`).not.toBe('');
        expect(spec.label, `item "${it.id}" spec label must not have surrounding whitespace`).toBe(spec.label.trim());
        expect(spec.value.trim(), `item "${it.id}" spec "${spec.label}" value must not be blank`).not.toBe('');
        expect(spec.value, `item "${it.id}" spec "${spec.label}" value must not have surrounding whitespace`).toBe(spec.value.trim());
      });

      (it.limitations ?? []).forEach((limitation, index) => {
        expect(limitation.trim(), `item "${it.id}" limitation ${index} must not be blank`).not.toBe('');
        expect(limitation, `item "${it.id}" limitation ${index} must not have surrounding whitespace`).toBe(limitation.trim());
      });
    });
  });

  it('all item source labels, URLs, and access dates are usable', () => {
    hangarData.items.forEach((it) => {
      (it.sources ?? []).forEach((source) => {
        expect(source.label.trim(), `item "${it.id}" source label must not be blank`).not.toBe('');
        expect(source.label, `item "${it.id}" source label must not have surrounding whitespace`).toBe(source.label.trim());
        expectValidHttpUrl(source.url, `item "${it.id}" source "${source.label}" url`);
        expectValidTimestamp(source.accessedAt, `item "${it.id}" source "${source.label}" accessedAt`);
      });
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

  it('all terminal.role values are valid TerminalRole values', () => {
    hangarData.terminals.forEach((t) => {
      if (!t.role) return;
      expect(TERMINAL_ROLES, `terminal "${t.id}" has invalid role "${t.role}"`).toContain(t.role);
    });
  });

  it('all net.kind values are valid NetKind values', () => {
    hangarData.nets.forEach((n) => {
      expect(NET_KINDS, `net "${n.id}" has invalid kind "${n.kind}"`).toContain(n.kind);
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

  it('all document.kind values are valid DocumentKind values', () => {
    hangarData.documents.forEach((d) => {
      expect(DOCUMENT_KINDS, `document "${d.id}" has invalid kind "${d.kind}"`).toContain(d.kind);
    });
  });

  it('all activity.kind values are valid ActivityKind values', () => {
    hangarData.activity.forEach((event) => {
      expect(ACTIVITY_KINDS, `activity "${event.id}" has invalid kind "${event.kind}"`).toContain(event.kind);
    });
  });

  it('all activity timestamps that seed Postgres are parseable', () => {
    hangarData.activity.forEach((event) => {
      expectValidTimestamp(event.at, `activity "${event.id}" at`);
    });
  });
});
