import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { newDb } from 'pg-mem';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DATACORE_BRIEFINGS,
  DATACORE_PACKS,
  type DatacorePack,
} from '@/data/datacore-briefings';
import {
  getBriefing,
  getBriefingBody,
  getBriefings,
  getPacks,
  type DatacoreBriefingRow,
} from '@/server/hangar/briefings';
import type { HangarDrizzle } from '@/server/hangar/drizzle';
import * as schema from '@/server/hangar/schema';
import { briefingPacks } from '@/server/hangar/schema';

/**
 * pg-mem rejects drizzle-orm/node-postgres query configs that set
 * `types.getTypeParser` and `rowMode: 'array'`. Patch the MemPg adapter
 * so Drizzle selects/inserts work without weakening parity assertions.
 */
function patchPgMemForDrizzle(PoolCtor: {
  prototype: {
    adaptQuery: (query: unknown, values: unknown) => unknown;
    adaptResults: (query: unknown, res: { rows: Record<string, unknown>[]; fields: { name: string }[] }) => unknown;
  };
}) {
  const origAdaptQuery = PoolCtor.prototype.adaptQuery;
  PoolCtor.prototype.adaptQuery = function (query: unknown, values: unknown) {
    if (query && typeof query === 'object') {
      const { types: _types, ...rest } = query as Record<string, unknown>;
      return origAdaptQuery.call(this, rest, values);
    }
    return origAdaptQuery.call(this, query, values);
  };

  const origAdaptResults = PoolCtor.prototype.adaptResults;
  PoolCtor.prototype.adaptResults = function (
    query: unknown,
    res: { rows: Record<string, unknown>[]; fields: { name: string }[] },
  ) {
    if (query && typeof query === 'object' && (query as { rowMode?: string }).rowMode === 'array') {
      return {
        ...res,
        rows: res.rows.map((row) => res.fields.map((f) => row[f.name])),
        fields: res.fields,
      };
    }
    return origAdaptResults.call(this, query, res);
  };
}

async function expectedBriefingRows(): Promise<DatacoreBriefingRow[]> {
  return Promise.all(
    DATACORE_BRIEFINGS.map(async (b) => {
      const bodyMarkdown =
        b.kind === 'research'
          ? await readFile(path.join(process.cwd(), b.source), 'utf8')
          : null;
      return {
        ...b,
        bodyMarkdown,
        // Always seed repo_path so domain `source` round-trips (no source column).
        repoPath: b.source,
      };
    }),
  );
}

function expectedPacks(): DatacorePack[] {
  return DATACORE_PACKS.map((p) => ({ ...p }));
}

describe('briefings Postgres read-model parity with TS registry', () => {
  let db: HangarDrizzle;
  let pool: Pool;
  let expectedBriefings: DatacoreBriefingRow[];
  let expectedPackList: DatacorePack[];

  beforeAll(async () => {
    const mem = newDb({ autoCreateForeignKeyIndices: true });
    const schemaSql = readFileSync(path.join(process.cwd(), 'db/hangar/schema.sql'), 'utf8');
    mem.public.none(schemaSql);

    const adapter = mem.adapters.createPg();
    patchPgMemForDrizzle(adapter.Pool);
    pool = new adapter.Pool() as Pool;
    db = drizzle(pool, { schema });

    expectedBriefings = await expectedBriefingRows();
    expectedPackList = expectedPacks();

    // Packs first (hub FK added after briefings exist — insert hub null, then patch).
    await db.insert(briefingPacks).values(
      DATACORE_PACKS.map((p) => ({
        id: p.id,
        title: p.title,
        code: p.code,
        summary: p.summary,
        hubBriefingId: null,
        topics: p.topics,
      })),
    );

    await db.insert(schema.briefings).values(
      await Promise.all(
        DATACORE_BRIEFINGS.map(async (b) => {
          const bodyMarkdown =
            b.kind === 'research'
              ? await readFile(path.join(process.cwd(), b.source), 'utf8')
              : null;
          return {
            id: b.id,
            title: b.title,
            kind: b.kind,
            summary: b.summary,
            tags: b.tags,
            aliases: b.aliases ?? [],
            packId: b.packId ?? null,
            capturedAt: b.capturedAt,
            href: b.href,
            bodyMarkdown,
            repoPath: b.source,
          };
        }),
      ),
    );

    for (const p of DATACORE_PACKS) {
      await db
        .update(briefingPacks)
        .set({ hubBriefingId: p.hubBriefingId })
        .where(eq(briefingPacks.id, p.id));
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('getBriefings matches registry ids, fields, and research markdown bodies', async () => {
    const result = await getBriefings(db);
    expect(result.source).toBe('postgres');
    const byId = new Map(result.briefings.map((r) => [r.id, r]));

    expect(result.briefings).toHaveLength(expectedBriefings.length);
    for (const expected of expectedBriefings) {
      expect(byId.get(expected.id)).toEqual(expected);
    }
  });

  it('getPacks matches registry packs', async () => {
    const result = await getPacks(db);
    expect(result.source).toBe('postgres');
    const byId = new Map(result.packs.map((p) => [p.id, p]));

    expect(result.packs).toHaveLength(expectedPackList.length);
    for (const expected of expectedPackList) {
      expect(byId.get(expected.id)).toEqual(expected);
    }
  });

  it('getBriefing returns each registry briefing by id', async () => {
    for (const expected of expectedBriefings) {
      const row = await getBriefing(expected.id, db);
      expect(row).toEqual(expected);
    }
    expect(await getBriefing('does-not-exist', db)).toBeNull();
  });

  it('getBriefingBody returns inlined markdown for research and repo file for plan', async () => {
    for (const expected of expectedBriefings) {
      if (expected.kind !== 'research') continue;
      const body = await getBriefingBody(expected);
      expect(body).toBe(expected.bodyMarkdown);
      expect(body).toEqual(await readFile(path.join(process.cwd(), expected.source), 'utf8'));
    }

    const plan = expectedBriefings.find((b) => b.id === 'wiring-model-completion');
    expect(plan).toBeDefined();
    expect(plan!.kind).toBe('plan');
    expect(plan!.source).toBe('docs/plans/2026-07-30-wiring-model-completion.md');

    const planBody = await getBriefingBody(plan!);
    const fromDisk = await readFile(path.join(process.cwd(), plan!.source), 'utf8');
    expect(planBody).toBe(fromDisk);
  });

  it('rejects plan repoPath values containing ".."', async () => {
    const sneaky: DatacoreBriefingRow = {
      id: 'sneaky',
      title: 'Sneaky',
      href: '/datacore/briefing/sneaky',
      source: '../etc/passwd',
      kind: 'plan',
      summary: 'nope',
      tags: [],
      capturedAt: '2026-07-30',
      bodyMarkdown: null,
      repoPath: '../etc/passwd',
    };
    expect(await getBriefingBody(sneaky)).toBeNull();
  });
});
