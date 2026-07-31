import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { newDb } from 'pg-mem';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatacoreBriefingRow, DatacorePack } from '@/lib/datacore-model';
import {
  getBriefing,
  getBriefingBody,
  getBriefings,
  getPacks,
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

/** Inline fixtures — TS registry removed in Wave 3; corpus lives in Postgres. */
const FIXTURE_PACK: DatacorePack = {
  id: 'beast-vision',
  title: 'Beast Vision & Capture',
  code: 'RND-BEAST-VISION',
  summary: 'Fixture pack for read-model parity.',
  hubBriefingId: 'beast-vision',
  topics: ['vision', 'splat'],
};

const FIXTURE_RESEARCH: DatacoreBriefingRow = {
  id: 'beast-vision',
  title: 'Beast Vision and Capture — Research Index',
  href: '/datacore/briefing/beast-vision',
  source: '',
  kind: 'research',
  summary: 'Fixture research briefing with inlined body.',
  tags: ['vision', 'beast'],
  aliases: ['rnd-beast-vision'],
  packId: 'beast-vision',
  capturedAt: '2026-07-28',
  bodyMarkdown: '# Beast Vision\n\nFixture body.\n',
  repoPath: null,
};

const PLAN_REPO_PATH = 'docs/plans/2026-07-30-wiring-model-completion.md';

const FIXTURE_PLAN: DatacoreBriefingRow = {
  id: 'wiring-model-completion',
  title: 'Finish the Wiring Model — One Spine, Two Eyes',
  href: '/datacore/briefing/wiring-model-completion',
  source: PLAN_REPO_PATH,
  kind: 'plan',
  summary: 'Fixture plan briefing that reads from repo path.',
  tags: ['architecture', 'wiring'],
  aliases: ['wiring spine'],
  capturedAt: '2026-07-30',
  bodyMarkdown: null,
  repoPath: PLAN_REPO_PATH,
};

describe('briefings Postgres read-model', () => {
  let db: HangarDrizzle;
  let pool: Pool;

  beforeAll(async () => {
    const mem = newDb({ autoCreateForeignKeyIndices: true });
    const schemaSql = readFileSync(path.join(process.cwd(), 'db/hangar/schema.sql'), 'utf8');
    mem.public.none(schemaSql);

    const adapter = mem.adapters.createPg();
    patchPgMemForDrizzle(adapter.Pool);
    pool = new adapter.Pool() as Pool;
    db = drizzle(pool, { schema });

    // Packs first (hub FK added after briefings exist — insert hub null, then patch).
    await db.insert(briefingPacks).values({
      id: FIXTURE_PACK.id,
      title: FIXTURE_PACK.title,
      code: FIXTURE_PACK.code,
      summary: FIXTURE_PACK.summary,
      hubBriefingId: null,
      topics: FIXTURE_PACK.topics,
    });

    await db.insert(schema.briefings).values([
      {
        id: FIXTURE_RESEARCH.id,
        title: FIXTURE_RESEARCH.title,
        kind: FIXTURE_RESEARCH.kind,
        summary: FIXTURE_RESEARCH.summary,
        tags: FIXTURE_RESEARCH.tags,
        aliases: FIXTURE_RESEARCH.aliases ?? [],
        packId: FIXTURE_RESEARCH.packId ?? null,
        capturedAt: FIXTURE_RESEARCH.capturedAt,
        href: FIXTURE_RESEARCH.href,
        bodyMarkdown: FIXTURE_RESEARCH.bodyMarkdown,
        repoPath: FIXTURE_RESEARCH.repoPath,
      },
      {
        id: FIXTURE_PLAN.id,
        title: FIXTURE_PLAN.title,
        kind: FIXTURE_PLAN.kind,
        summary: FIXTURE_PLAN.summary,
        tags: FIXTURE_PLAN.tags,
        aliases: FIXTURE_PLAN.aliases ?? [],
        packId: null,
        capturedAt: FIXTURE_PLAN.capturedAt,
        href: FIXTURE_PLAN.href,
        bodyMarkdown: null,
        repoPath: FIXTURE_PLAN.repoPath,
      },
    ]);

    await db
      .update(briefingPacks)
      .set({ hubBriefingId: FIXTURE_PACK.hubBriefingId })
      .where(eq(briefingPacks.id, FIXTURE_PACK.id));
  });

  afterAll(async () => {
    await pool.end();
  });

  it('getBriefings returns seeded rows from Postgres', async () => {
    const result = await getBriefings(db);
    expect(result.source).toBe('postgres');
    const byId = new Map(result.briefings.map((r) => [r.id, r]));

    expect(result.briefings).toHaveLength(2);
    expect(byId.get(FIXTURE_RESEARCH.id)).toEqual(FIXTURE_RESEARCH);
    expect(byId.get(FIXTURE_PLAN.id)).toEqual(FIXTURE_PLAN);
  });

  it('getPacks returns seeded packs', async () => {
    const result = await getPacks(db);
    expect(result.source).toBe('postgres');
    expect(result.packs).toEqual([FIXTURE_PACK]);
  });

  it('getBriefing returns each seeded briefing by id', async () => {
    expect(await getBriefing(FIXTURE_RESEARCH.id, db)).toEqual(FIXTURE_RESEARCH);
    expect(await getBriefing(FIXTURE_PLAN.id, db)).toEqual(FIXTURE_PLAN);
    expect(await getBriefing('does-not-exist', db)).toBeNull();
  });

  it('getBriefingBody returns inlined markdown for research and repo file for plan', async () => {
    const body = await getBriefingBody(FIXTURE_RESEARCH);
    expect(body).toBe(FIXTURE_RESEARCH.bodyMarkdown);

    const planBody = await getBriefingBody(FIXTURE_PLAN);
    const fromDisk = await readFile(path.join(process.cwd(), PLAN_REPO_PATH), 'utf8');
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
