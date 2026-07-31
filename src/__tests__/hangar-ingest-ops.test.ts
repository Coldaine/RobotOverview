import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { newDb } from 'pg-mem';
import pg from 'pg';
import * as schema from '@/server/hangar/schema';
import {
  briefings,
  insightAssets,
  insightMissions,
  insights,
  missionAfterActions,
  missionConstraints,
  missionObjectives,
  missionRequisitions,
  missions,
} from '@/server/hangar/schema';
import {
  executeIngestOp,
  opLandBriefing,
  opLandMission,
  opLinkInsight,
  type IngestDb,
} from '@/server/hangar/ingest';

const { Pool } = pg;

function splitSql(sql: string): string[] {
  const noComments: string[] = [];
  let inSingle = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      if (inSingle && sql[i + 1] === "'") {
        noComments.push("''");
        i++;
        continue;
      }
      inSingle = !inSingle;
      noComments.push(ch);
      continue;
    }
    if (!inSingle && ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      noComments.push('\n');
      continue;
    }
    noComments.push(ch);
  }
  const cleaned = noComments.join('');
  const stmts: string[] = [];
  let cur = '';
  inSingle = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "'") {
      if (inSingle && cleaned[i + 1] === "'") {
        cur += "''";
        i++;
        continue;
      }
      inSingle = !inSingle;
      cur += ch;
      continue;
    }
    if (ch === ';' && !inSingle) {
      const s = cur.trim();
      if (s) stmts.push(s);
      cur = '';
      continue;
    }
    cur += ch;
  }
  const tail = cur.trim();
  if (tail) stmts.push(tail);
  return stmts;
}

function dropNullableCheckConstraints(mem: ReturnType<typeof newDb>) {
  for (const table of ['assets', 'wishlist_meta', 'asset_shortcuts', 'hangar_meta', 'briefings']) {
    for (let i = 1; i <= 30; i++) {
      try {
        mem.public.none(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_constraint_${i}`);
      } catch {
        /* ignore */
      }
    }
  }
}

/** drizzle-orm/node-postgres passes types.getTypeParser + rowMode:'array'; neither works in pg-mem. */
function patchPgMemClient(Client: { prototype: { query: (...args: never[]) => unknown } }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proto = Client.prototype as { query: (...args: any[]) => any };
  const origQuery = proto.query;
  proto.query = function (this: unknown, query: unknown, values?: unknown, cb?: unknown) {
    const wantsArray =
      Boolean(query) && typeof query === 'object' && (query as { rowMode?: string }).rowMode === 'array';
    let cleaned = query;
    if (query && typeof query === 'object') {
      cleaned = { ...(query as object) };
      delete (cleaned as { types?: unknown }).types;
      delete (cleaned as { rowMode?: unknown }).rowMode;
    }
    const adapt = (result: pg.QueryResult) => {
      if (wantsArray && result?.rows) {
        result.rows = result.rows.map((row) =>
          Array.isArray(row) ? row : Object.values(row as Record<string, unknown>),
        ) as typeof result.rows;
      }
      return result;
    };
    if (typeof cb === 'function') {
      return origQuery.call(this, cleaned, values, (err: Error, result: pg.QueryResult) =>
        (cb as (e: Error, r: pg.QueryResult) => void)(err, err ? result : adapt(result)),
      );
    }
    const run = origQuery.call(this, cleaned, values);
    if (run && typeof run.then === 'function') {
      return (run as Promise<pg.QueryResult>).then(adapt);
    }
    return adapt(run as pg.QueryResult);
  };
}

async function createTestDb(): Promise<{ db: IngestDb; close: () => Promise<void> }> {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const root = resolve(process.cwd());
  mem.public.none(readFileSync(resolve(root, 'db/hangar/schema.sql'), 'utf8'));
  dropNullableCheckConstraints(mem);
  const seed = readFileSync(resolve(root, 'db/hangar/seed.sql'), 'utf8').replace(
    /-- >>> DATACORE_CORPUS_BEGIN[\s\S]*?-- <<< DATACORE_CORPUS_END\s*/m,
    '-- (datacore corpus stripped for pg-mem)\n',
  );
  for (const stmt of splitSql(seed)) {
    if (/^(BEGIN|COMMIT|SET)\b/i.test(stmt)) continue;
    mem.public.none(stmt.endsWith(';') ? stmt : `${stmt};`);
  }
  const { Client } = mem.adapters.createPg();
  patchPgMemClient(Client);
  const pool = new Pool({ Client });
  const db = drizzle(pool, { schema }) as unknown as IngestDb;
  return {
    db,
    close: async () => {
      await pool.end();
    },
  };
}

describe('hangar ingest land/link ops (pg-mem)', () => {
  let db: IngestDb;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const ctx = await createTestDb();
    db = ctx.db;
    close = ctx.close;
  }, 60_000);

  afterAll(async () => {
    await close();
  });

  it('link_insight upserts junctions', async () => {
    await executeIngestOp(db, {
      op: 'append_insight',
      input: {
        id: 'insight-link-target',
        title: 'Link me',
        body: 'body',
        confidence: 'medium',
      },
    });
    await opLinkInsight(db, {
      insightId: 'insight-link-target',
      units: ['beast'],
      missions: ['perimeter-mapping'],
    });
    const ia = await db
      .select()
      .from(insightAssets)
      .where(eq(insightAssets.insightId, 'insight-link-target'));
    const im = await db
      .select()
      .from(insightMissions)
      .where(eq(insightMissions.insightId, 'insight-link-target'));
    expect(ia.map((r) => r.assetId)).toEqual(['beast']);
    expect(im.map((r) => r.missionId)).toEqual(['perimeter-mapping']);
    // insight row still exists
    const ins = await db.select().from(insights).where(eq(insights.id, 'insight-link-target'));
    expect(ins).toHaveLength(1);
  });

  it('land_mission writes parent + objectives + constraints + requisitions', async () => {
    const id = 'mission-ingest-land';
    await opLandMission(db, {
      id,
      code: 'MSN-TEST',
      name: 'Ingest Land Mission',
      status: 'planning',
      objective: 'Prove land_mission writes children',
      environment: 'pg-mem',
      requisitionedUnits: ['beast', 'workstation'],
      requiredLoadout: ['Lighting'],
      wishlist: [],
      objectives: [
        { text: 'Step one', done: false },
        { text: 'Step two', done: true },
      ],
      constraints: [
        { label: 'Power', value: 10, budget: 25, unit: 'W' },
        { label: 'Mass', value: 100, budget: 500, unit: 'g' },
      ],
      afterAction: ['note one'],
    });

    const parent = await db.select().from(missions).where(eq(missions.id, id));
    expect(parent).toHaveLength(1);
    expect(parent[0]?.code).toBe('MSN-TEST');

    const reqs = await db
      .select()
      .from(missionRequisitions)
      .where(eq(missionRequisitions.missionId, id));
    expect(reqs.map((r) => r.assetId).sort()).toEqual(['beast', 'workstation']);

    const objs = await db
      .select()
      .from(missionObjectives)
      .where(eq(missionObjectives.missionId, id));
    expect(objs).toHaveLength(2);
    expect(objs.some((o) => o.text === 'Step two' && o.done)).toBe(true);

    const cons = await db
      .select()
      .from(missionConstraints)
      .where(eq(missionConstraints.missionId, id));
    expect(cons).toHaveLength(2);

    const after = await db
      .select()
      .from(missionAfterActions)
      .where(eq(missionAfterActions.missionId, id));
    expect(after).toHaveLength(1);
    expect(after[0]?.position).toBe(0);
    expect(after[0]?.text).toBe('note one');
  });

  it('land_briefing upserts research row with body', async () => {
    const id = 'briefing-ingest-1';
    await opLandBriefing(db, {
      id,
      title: 'Ingest Briefing',
      kind: 'research',
      summary: 'Summary line',
      bodyMarkdown: '# Heading\n\nBody.',
      tags: ['test'],
    });
    const rows = await db.select().from(briefings).where(eq(briefings.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.bodyMarkdown).toContain('# Heading');
    expect(rows[0]?.href).toBe(`/datacore/briefing/${id}`);
    expect(rows[0]?.kind).toBe('research');
  });
});
