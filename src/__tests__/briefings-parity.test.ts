import { readFileSync } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { newDb } from 'pg-mem';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DATACORE_CORPUS_BRIEFINGS,
  DATACORE_CORPUS_PACKS,
} from '@/data/datacore-corpus';
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

/** Inline fixtures for focused unit inserts (not the full corpus). */
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
  source: 'artifactIntake/00-MASTER-beast-vision.md',
  kind: 'research',
  summary: 'Fixture research briefing with inlined body.',
  tags: ['vision', 'beast'],
  aliases: ['rnd-beast-vision'],
  packId: 'beast-vision',
  capturedAt: '2026-07-28',
  bodyMarkdown: '# Beast Vision\n\nFixture body.\n',
  repoPath: 'artifactIntake/00-MASTER-beast-vision.md',
};

const PLAN_REPO_PATH = 'docs/plans/archived/2026-07-30-wiring-model-completion.md';

const FIXTURE_PLAN: DatacoreBriefingRow = {
  id: 'wiring-model-completion',
  title: 'Finish the Wiring Model — One Spine, Two Eyes',
  href: '/datacore/briefing/wiring-model-completion',
  source: PLAN_REPO_PATH,
  kind: 'plan',
  summary: 'Fixture plan briefing with body stored in Postgres.',
  tags: ['architecture', 'wiring'],
  aliases: ['wiring spine'],
  capturedAt: '2026-07-30',
  bodyMarkdown: '# Wiring Model\n\nPlan body in DB.\n',
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
        bodyMarkdown: FIXTURE_RESEARCH.bodyMarkdown!,
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
        bodyMarkdown: FIXTURE_PLAN.bodyMarkdown!,
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

  it('getBriefingBody prefers bodyMarkdown for research and plan', async () => {
    expect(await getBriefingBody(FIXTURE_RESEARCH)).toBe(FIXTURE_RESEARCH.bodyMarkdown);
    expect(await getBriefingBody(FIXTURE_PLAN)).toBe(FIXTURE_PLAN.bodyMarkdown);
  });

  it('getBriefingBody returns null when body is missing — never reads repoPath', async () => {
    const emptyBody: DatacoreBriefingRow = {
      id: 'empty-body',
      title: 'Empty',
      href: '/datacore/briefing/empty-body',
      source: PLAN_REPO_PATH,
      kind: 'plan',
      summary: 'nope',
      tags: [],
      capturedAt: '2026-07-30',
      bodyMarkdown: '',
      repoPath: PLAN_REPO_PATH,
    };
    expect(await getBriefingBody(emptyBody)).toBeNull();

    const nullBody: DatacoreBriefingRow = {
      ...emptyBody,
      id: 'null-body',
      bodyMarkdown: null,
      repoPath: '../etc/passwd',
    };
    expect(await getBriefingBody(nullBody)).toBeNull();
  });
});

describe('briefings corpus fixture + seed', () => {
  it('static corpus has the full research wall (≥12 briefings with bodies)', () => {
    expect(DATACORE_CORPUS_PACKS.length).toBeGreaterThanOrEqual(1);
    expect(DATACORE_CORPUS_BRIEFINGS.length).toBe(12);
    for (const b of DATACORE_CORPUS_BRIEFINGS) {
      expect(b.bodyMarkdown?.trim().length, b.id).toBeGreaterThan(20);
    }
  });

  it('seed.sql includes briefings with body_markdown (fresh DB paints Datacore)', () => {
    const seed = readFileSync(path.join(process.cwd(), 'db/hangar/seed.sql'), 'utf8');
    expect(seed).toContain('INSERT INTO briefing_packs');
    expect(seed).toContain('INSERT INTO briefings');
    expect(seed).toContain('robot-control-llms');
    expect(seed).toContain('compute-workload');
    expect(seed).toContain('body_markdown');
    // Count only the fenced corpus section so markdown bodies cannot inflate the tally.
    const begin = seed.indexOf('-- >>> DATACORE_CORPUS_BEGIN');
    const end = seed.indexOf('-- <<< DATACORE_CORPUS_END');
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(begin);
    const corpus = seed.slice(begin, end);
    const inserts = corpus.match(/^INSERT INTO briefings\(/gm) ?? [];
    expect(inserts.length).toBe(DATACORE_CORPUS_BRIEFINGS.length);
  });
});
