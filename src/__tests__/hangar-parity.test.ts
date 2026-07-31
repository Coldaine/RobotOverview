import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { newDb } from 'pg-mem';
import { describe, expect, it } from 'vitest';
import { hangarData } from '@/data/hangar';
import type { HangarData } from '@/data/types';
import * as schema from '@/server/hangar/schema';
import { buildHangarDataFromDb } from '@/server/hangar/spine';

const ROOT = resolve(__dirname, '../..');

/** pg-mem treats `NULL IN (...)` as CHECK failure; Postgres allows NULL. */
function prepareSqlForPgMem(sql: string, opts: { expectCheckRewrites?: boolean } = {}): string {
  const out = sql
    .replace(/BEGIN;\s*/gi, '')
    .replace(/COMMIT;\s*/gi, '')
    .replace(/SET client_min_messages\s*=\s*warning;\s*/gi, '')
    .replace(
      /power_rail\s+TEXT CHECK \(power_rail IN \('5V','12V','battery','mains'\)\)/g,
      "power_rail    TEXT CHECK (power_rail IS NULL OR power_rail IN ('5V','12V','battery','mains'))",
    )
    .replace(
      /provenance\s+TEXT CHECK \(provenance IN \('owner','inferred','open'\)\)/g,
      "provenance     TEXT CHECK (provenance IS NULL OR provenance IN ('owner','inferred','open'))",
    );
  // Fail closed for the schema file: if schema.sql is reformatted, these
  // rewrites must not no-op silently. The seed file legitimately has no CHECKs.
  if (opts.expectCheckRewrites) {
    if (!out.includes('power_rail IS NULL OR power_rail IN')) {
      throw new Error('prepareSqlForPgMem: power_rail CHECK rewrite did not apply');
    }
    if (!out.includes('provenance IS NULL OR provenance IN')) {
      throw new Error('prepareSqlForPgMem: provenance CHECK rewrite did not apply');
    }
  }
  return out;
}

function splitStatements(sql: string): string[] {
  const stmts: string[] = [];
  let buf = '';
  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') && buf.trim() === '') continue;
    buf += `${line}\n`;
    if (trimmed.endsWith(';')) {
      const s = buf.trim();
      if (s.length) stmts.push(s);
      buf = '';
    }
  }
  return stmts;
}

/**
 * Drizzle's node-postgres driver requests rowMode:'array'; pg-mem rejects that.
 * Strip rowMode, then convert object rows back to positional arrays for Drizzle.
 */
function shimPoolForDrizzle(pool: {
  query: (...args: unknown[]) => unknown;
  connect?: (...args: unknown[]) => unknown;
  _types?: unknown;
  getTypeParser?: unknown;
}) {
  const origQuery = pool.query.bind(pool) as (...args: unknown[]) => Promise<{
    rows: unknown[];
  }>;

  pool.query = async (queryTextOrConfig: unknown, values?: unknown, cb?: unknown) => {
    let wantArray = false;
    let config = queryTextOrConfig;
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      const cfg = { ...(config as Record<string, unknown>) };
      wantArray = cfg.rowMode === 'array';
      delete cfg.rowMode;
      delete cfg.types;
      config = cfg;
    }
    const result = await origQuery(config, values, cb);
    if (wantArray && Array.isArray(result?.rows)) {
      result.rows = result.rows.map((row) => {
        if (Array.isArray(row) || row == null || typeof row !== 'object') return row;
        return Object.values(row as Record<string, unknown>);
      });
    }
    return result;
  };

  pool._types ??= { getTypeParser: () => (v: unknown) => v };
  pool.getTypeParser ??= () => (v: unknown) => v;
}

function sortById<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

function sortStrings(values: string[] | undefined): string[] | undefined {
  if (!values || values.length === 0) return undefined;
  return [...values].sort((a, b) => a.localeCompare(b));
}

function addLink(map: Map<string, Set<string>>, from: string, to: string) {
  const set = map.get(from) ?? new Set<string>();
  set.add(to);
  map.set(from, set);
}

function setToOptionalArray(set: Set<string> | undefined): string[] | undefined {
  if (!set || set.size === 0) return undefined;
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * gen-seed unions both directions of dual arrays into junctions. Closing those
 * duals on the fixture makes deep-equal compare the junction closure (what
 * reconstruction emits) rather than the fixture's asymmetric authoring view.
 */
function closeReferentialDuals(data: HangarData): HangarData {
  const unitIds = new Set(data.units.map((u) => u.id));
  const missionIds = new Set(data.missions.map((m) => m.id));
  const insightIds = new Set(data.insights.map((i) => i.id));
  const capIds = new Set(data.capabilities.map((c) => c.id));

  const unitCaps = new Map<string, Set<string>>();
  const capUnlockers = new Map<string, Set<string>>();
  for (const cap of data.capabilities) {
    for (const aid of cap.unlockedBy) {
      addLink(capUnlockers, cap.id, aid);
      if (unitIds.has(aid)) addLink(unitCaps, aid, cap.id);
    }
  }
  for (const unit of data.units) {
    for (const cid of unit.capabilities ?? []) {
      if (!capIds.has(cid)) continue;
      addLink(unitCaps, unit.id, cid);
      addLink(capUnlockers, cid, unit.id);
    }
  }

  const unitMissions = new Map<string, Set<string>>();
  const missionUnits = new Map<string, Set<string>>();
  for (const mission of data.missions) {
    for (const aid of mission.requisitionedUnits) {
      addLink(missionUnits, mission.id, aid);
      if (unitIds.has(aid)) addLink(unitMissions, aid, mission.id);
    }
  }
  for (const unit of data.units) {
    for (const mid of unit.missions ?? []) {
      if (!missionIds.has(mid)) continue;
      addLink(unitMissions, unit.id, mid);
      addLink(missionUnits, mid, unit.id);
    }
  }

  const unitInsights = new Map<string, Set<string>>();
  const insightUnits = new Map<string, Set<string>>();
  const missionInsights = new Map<string, Set<string>>();
  const insightMissions = new Map<string, Set<string>>();
  for (const insight of data.insights) {
    for (const aid of insight.units ?? []) {
      addLink(insightUnits, insight.id, aid);
      if (unitIds.has(aid)) addLink(unitInsights, aid, insight.id);
    }
    for (const mid of insight.missions ?? []) {
      addLink(insightMissions, insight.id, mid);
      if (missionIds.has(mid)) addLink(missionInsights, mid, insight.id);
    }
  }
  for (const unit of data.units) {
    for (const iid of unit.insights ?? []) {
      if (!insightIds.has(iid)) continue;
      addLink(unitInsights, unit.id, iid);
      addLink(insightUnits, iid, unit.id);
    }
  }
  for (const mission of data.missions) {
    for (const iid of mission.insights ?? []) {
      if (!insightIds.has(iid)) continue;
      addLink(missionInsights, mission.id, iid);
      addLink(insightMissions, iid, mission.id);
    }
  }

  return {
    ...data,
    units: data.units.map((unit) => {
      const next = { ...unit };
      const capabilities = setToOptionalArray(unitCaps.get(unit.id));
      const missions = setToOptionalArray(unitMissions.get(unit.id));
      const insights = setToOptionalArray(unitInsights.get(unit.id));
      if (capabilities) next.capabilities = capabilities;
      else delete next.capabilities;
      if (missions) next.missions = missions;
      else delete next.missions;
      if (insights) next.insights = insights;
      else delete next.insights;
      return next;
    }),
    missions: data.missions.map((mission) => ({
      ...mission,
      requisitionedUnits: [...(missionUnits.get(mission.id) ?? new Set())].sort((a, b) =>
        a.localeCompare(b),
      ),
      insights: setToOptionalArray(missionInsights.get(mission.id)),
    })),
    capabilities: data.capabilities.map((cap) => ({
      ...cap,
      unlockedBy: [...(capUnlockers.get(cap.id) ?? new Set())].sort((a, b) => a.localeCompare(b)),
    })),
    insights: data.insights.map((insight) => ({
      ...insight,
      units: setToOptionalArray(insightUnits.get(insight.id)),
      missions: setToOptionalArray(insightMissions.get(insight.id)),
    })),
  };
}

/**
 * Normalize fields where DB order is not guaranteed, and collapse empty optional
 * arrays (junction-derived) so `[]` vs omitted does not fail semantic parity.
 * Position-ordered arrays (loadout, objectives, shortcuts, afterAction, constraints,
 * specs, links, hotspots, requiredLoadout) are left intact.
 */
function canonicalize(data: HangarData): HangarData {
  const closed = closeReferentialDuals(data);
  return {
    meta: closed.meta,
    bays: sortById(closed.bays),
    items: sortById(closed.items).map((item) => ({
      ...item,
      tags: sortStrings(item.tags),
      relatedUnits: sortStrings(item.relatedUnits),
      relatedMissions: sortStrings(item.relatedMissions),
      relatedCapabilities: sortStrings(item.relatedCapabilities),
      relatedInsights: sortStrings(item.relatedInsights),
      limitations: item.limitations ? [...item.limitations] : undefined,
      sources: item.sources ? [...item.sources] : undefined,
    })),
    units: sortById(closed.units).map((unit) => {
      const next = { ...unit };
      const tags = sortStrings(unit.tags);
      if (tags) next.tags = tags;
      else delete next.tags;
      // capabilities / missions / insights already closed + sorted
      return next;
    }),
    missions: sortById(closed.missions).map((mission) => ({
      ...mission,
      wishlist: [...mission.wishlist].sort((a, b) => a.localeCompare(b)),
      // objectives / constraints / afterAction / requiredLoadout: position-ordered
    })),
    wishlist: sortById(closed.wishlist),
    capabilities: sortById(closed.capabilities).map((cap) => ({
      ...cap,
      dependsOn: sortStrings(cap.dependsOn),
    })),
    insights: sortById(closed.insights).map((insight) => ({
      ...insight,
      tags: [...insight.tags].sort((a, b) => a.localeCompare(b)),
    })),
    activity: sortById(closed.activity),
    terminals: sortById(closed.terminals),
    nets: sortById(closed.nets).map((net) => ({
      ...net,
      terminals: [...net.terminals].sort((a, b) => a.localeCompare(b)),
      documents: sortStrings(net.documents),
    })),
    documents: sortById(closed.documents).map((doc) => ({
      ...doc,
      units: sortStrings(doc.units),
    })),
  };
}

describe('hangar spine Postgres reconstruction parity', () => {
  it('rebuilds HangarData from normalized tables to match the static fixture', async () => {
    const mem = newDb({ autoCreateForeignKeyIndices: true });
    const schemaSql = prepareSqlForPgMem(
      readFileSync(resolve(ROOT, 'db/hangar/schema.sql'), 'utf8'),
      { expectCheckRewrites: true },
    );
    const seedSql = prepareSqlForPgMem(readFileSync(resolve(ROOT, 'db/hangar/seed.sql'), 'utf8')).replace(
      /-- >>> DATACORE_CORPUS_BEGIN[\s\S]*?-- <<< DATACORE_CORPUS_END\s*/m,
      '-- (datacore corpus stripped for spine pg-mem parity)\n',
    );

    for (const stmt of splitStatements(schemaSql)) mem.public.none(stmt);
    for (const stmt of splitStatements(seedSql)) mem.public.none(stmt);

    const pg = mem.adapters.createPg();
    const pool = new pg.Pool();
    shimPoolForDrizzle(pool);

    try {
      const db = drizzle(pool, { schema });
      const reconstructed = await buildHangarDataFromDb(db);

      expect(canonicalize(reconstructed)).toEqual(canonicalize(hangarData));
    } finally {
      await pool.end();
    }
  });
});
