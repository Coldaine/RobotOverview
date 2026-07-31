/**
 * Replayable corpus land into Postgres via ingest op verbs, then write
 * research-corpus-manifest.json. Prefer seed.sql for fresh DBs — this script
 * is for repair / re-land on a live database that already has the spine.
 *
 *   npx tsx db/hangar/ingest-research-corpus.ts [--dry-run]
 *
 * Bodies come from `src/data/datacore-corpus.ts` (generated). Live run expects
 * HANGAR_DB_* (or HANGAR_DATABASE_URL). --dry-run prints the plan; no DB.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DATACORE_CORPUS_BRIEFINGS,
  DATACORE_CORPUS_PACKS,
} from '../../src/data/datacore-corpus';
import { closeHangarPoolForTests } from '../../src/server/hangar/db';
import { getHangarDrizzle, type HangarDrizzle } from '../../src/server/hangar/drizzle';
import { opLandBriefing, opLandPack } from '../../src/server/hangar/ingest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST_PATH = path.join(ROOT, 'db/hangar/research-corpus-manifest.json');

type ManifestBriefing = {
  id: string;
  kind: 'research' | 'plan';
  href: string;
  repoPath: string | null;
};

type Manifest = {
  briefings: ManifestBriefing[];
  packs: { id: string }[];
};

function writeManifest(): Manifest {
  const manifest: Manifest = {
    briefings: DATACORE_CORPUS_BRIEFINGS.map((b) => ({
      id: b.id,
      kind: b.kind,
      href: b.href,
      repoPath: b.repoPath,
    })),
    packs: DATACORE_CORPUS_PACKS.map((p) => ({ id: p.id })),
  };
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

async function landAll(db: HangarDrizzle): Promise<void> {
  for (const pack of DATACORE_CORPUS_PACKS) {
    await opLandPack(db, {
      id: pack.id,
      title: pack.title,
      code: pack.code,
      summary: pack.summary,
      topics: pack.topics,
    });
  }

  for (const b of DATACORE_CORPUS_BRIEFINGS) {
    if (!b.bodyMarkdown) {
      throw new Error(`Corpus briefing '${b.id}' missing bodyMarkdown — run gen-datacore-corpus.ts`);
    }
    await opLandBriefing(db, {
      id: b.id,
      title: b.title,
      kind: b.kind,
      summary: b.summary,
      tags: b.tags,
      aliases: b.aliases,
      packId: b.packId,
      capturedAt: b.capturedAt,
      href: b.href,
      bodyMarkdown: b.bodyMarkdown,
      ...(b.repoPath ? { repoPath: b.repoPath } : {}),
    });
  }

  for (const pack of DATACORE_CORPUS_PACKS) {
    await opLandPack(db, {
      id: pack.id,
      title: pack.title,
      code: pack.code,
      summary: pack.summary,
      topics: pack.topics,
      hubBriefingId: pack.hubBriefingId,
    });
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const bytes = DATACORE_CORPUS_BRIEFINGS.reduce(
    (n, b) => n + Buffer.byteLength(b.bodyMarkdown ?? '', 'utf8'),
    0,
  );

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          packs: DATACORE_CORPUS_PACKS.length,
          briefings: DATACORE_CORPUS_BRIEFINGS.length,
          bytes,
          dryRun: true,
          briefingsDetail: DATACORE_CORPUS_BRIEFINGS.map((b) => ({
            id: b.id,
            kind: b.kind,
            repoPath: b.repoPath,
            bytes: Buffer.byteLength(b.bodyMarkdown ?? '', 'utf8'),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const db = await getHangarDrizzle();
  if (!db) {
    throw new Error(
      'Hangar database is not configured (set HANGAR_DB_HOST… or HANGAR_DATABASE_URL)',
    );
  }

  try {
    await db.transaction(async (tx) => {
      await landAll(tx as unknown as HangarDrizzle);
    });
  } finally {
    await closeHangarPoolForTests();
  }

  writeManifest();

  console.log(
    JSON.stringify({
      packs: DATACORE_CORPUS_PACKS.length,
      briefings: DATACORE_CORPUS_BRIEFINGS.length,
      bytes,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
