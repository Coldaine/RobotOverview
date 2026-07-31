import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import {
  DATACORE_BRIEFINGS,
  DATACORE_PACKS,
  type BriefingKind,
  type DatacoreBriefing,
  type DatacorePack,
} from '@/data/datacore-briefings';
import type { HangarReadStatus } from '@/lib/hangar-read-status';
import { getHangarDrizzle, type HangarDrizzle } from './drizzle';
import { briefingPacks, briefings } from './schema';

export type DatacoreBriefingRow = DatacoreBriefing & {
  bodyMarkdown: string | null;
  repoPath: string | null;
};

export type BriefingsRead = HangarReadStatus & {
  briefings: DatacoreBriefingRow[];
};

export type PacksRead = HangarReadStatus & {
  packs: DatacorePack[];
};

type BriefingTableRow = typeof briefings.$inferSelect;
type PackTableRow = typeof briefingPacks.$inferSelect;

function isBriefingKind(value: string): value is BriefingKind {
  return value === 'research' || value === 'plan';
}

function mapBriefingRow(row: BriefingTableRow): DatacoreBriefingRow | null {
  if (!isBriefingKind(row.kind)) {
    console.warn(`Skipping briefing ${row.id}: invalid kind "${row.kind}"`);
    return null;
  }

  const repoPath = row.repoPath ?? null;
  const aliases = row.aliases.length > 0 ? row.aliases : undefined;
  const packId = row.packId ?? undefined;

  return {
    id: row.id,
    title: row.title,
    href: row.href,
    // Domain `source` is the trusted repo-relative path (seeded into repo_path).
    source: repoPath ?? '',
    kind: row.kind,
    summary: row.summary,
    tags: row.tags ?? [],
    ...(aliases ? { aliases } : {}),
    ...(packId ? { packId } : {}),
    capturedAt: row.capturedAt ?? '',
    bodyMarkdown: row.bodyMarkdown ?? null,
    repoPath,
  };
}

function mapPackRow(row: PackTableRow): DatacorePack | null {
  if (!row.hubBriefingId) {
    console.warn(`Skipping pack ${row.id}: missing hubBriefingId`);
    return null;
  }
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    summary: row.summary,
    hubBriefingId: row.hubBriefingId,
    topics: row.topics ?? [],
  };
}

/**
 * WAVE 3 DELETE THIS FUNCTION (and call sites + `@/data/datacore-briefings` import).
 * Temporary static fallback while the TS registry still exists; Wave 3 swaps this
 * for an offline state when the registry is removed.
 */
export function staticRegistryFallback(): {
  briefings: DatacoreBriefingRow[];
  packs: DatacorePack[];
} {
  return {
    briefings: DATACORE_BRIEFINGS.map((b) => ({
      ...b,
      bodyMarkdown: null,
      repoPath: b.source,
    })),
    packs: DATACORE_PACKS.map((p) => ({ ...p })),
  };
}

/** DB-injectable: load all briefings from a Hangar Drizzle client. */
export async function loadBriefingsFromDb(db: HangarDrizzle): Promise<DatacoreBriefingRow[]> {
  const rows = await db.select().from(briefings);
  const mapped: DatacoreBriefingRow[] = [];
  for (const row of rows) {
    const briefing = mapBriefingRow(row);
    if (briefing) mapped.push(briefing);
  }
  return mapped;
}

/** DB-injectable: load all packs from a Hangar Drizzle client. */
export async function loadPacksFromDb(db: HangarDrizzle): Promise<DatacorePack[]> {
  const rows = await db.select().from(briefingPacks);
  const mapped: DatacorePack[] = [];
  for (const row of rows) {
    const pack = mapPackRow(row);
    if (pack) mapped.push(pack);
  }
  return mapped;
}

/** DB-injectable: load one briefing by id. */
export async function loadBriefingFromDb(
  db: HangarDrizzle,
  id: string,
): Promise<DatacoreBriefingRow | null> {
  const rows = await db.select().from(briefings).where(eq(briefings.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return mapBriefingRow(row);
}

/** Optional `db` injects a Hangar Drizzle client (parity tests / Wave 3 wiring). */
export async function getBriefings(db?: HangarDrizzle): Promise<BriefingsRead> {
  try {
    const client = db ?? (await getHangarDrizzle());
    if (!client) {
      return {
        source: 'static',
        fallbackReason: 'not-configured',
        briefings: staticRegistryFallback().briefings,
      };
    }
    return {
      source: 'postgres',
      briefings: await loadBriefingsFromDb(client),
    };
  } catch (error) {
    console.warn('Hangar Postgres briefings read failed; falling back to static registry.', error);
    return {
      source: 'static',
      fallbackReason: 'postgres-error',
      briefings: staticRegistryFallback().briefings,
    };
  }
}

/** Optional `db` injects a Hangar Drizzle client (parity tests / Wave 3 wiring). */
export async function getPacks(db?: HangarDrizzle): Promise<PacksRead> {
  try {
    const client = db ?? (await getHangarDrizzle());
    if (!client) {
      return {
        source: 'static',
        fallbackReason: 'not-configured',
        packs: staticRegistryFallback().packs,
      };
    }
    return {
      source: 'postgres',
      packs: await loadPacksFromDb(client),
    };
  } catch (error) {
    console.warn('Hangar Postgres packs read failed; falling back to static registry.', error);
    return {
      source: 'static',
      fallbackReason: 'postgres-error',
      packs: staticRegistryFallback().packs,
    };
  }
}

/** Optional `db` injects a Hangar Drizzle client (parity tests / Wave 3 wiring). */
export async function getBriefing(
  id: string,
  db?: HangarDrizzle,
): Promise<DatacoreBriefingRow | null> {
  try {
    const client = db ?? (await getHangarDrizzle());
    if (!client) {
      return staticRegistryFallback().briefings.find((b) => b.id === id) ?? null;
    }
    return loadBriefingFromDb(client, id);
  } catch (error) {
    console.warn('Hangar Postgres briefing read failed; falling back to static registry.', error);
    return staticRegistryFallback().briefings.find((b) => b.id === id) ?? null;
  }
}

/**
 * Resolve briefing markdown body. Research uses inlined `bodyMarkdown`;
 * plan reads `repoPath` from the repo (never caller-supplied paths).
 */
export async function getBriefingBody(briefing: DatacoreBriefingRow): Promise<string | null> {
  if (briefing.kind === 'research') {
    return briefing.bodyMarkdown;
  }

  if (briefing.kind === 'plan') {
    const repoPath = briefing.repoPath;
    if (!repoPath || repoPath.includes('..')) return null;
    return readFile(path.join(process.cwd(), repoPath), 'utf8');
  }

  return null;
}

// ── Search helpers (mirror of @/data/datacore-briefings; operate on row type) ─

export function briefingById(
  allBriefings: DatacoreBriefingRow[],
  id: string,
): DatacoreBriefingRow | undefined {
  return allBriefings.find((b) => b.id === id);
}

export function packById(allPacks: DatacorePack[], id: string): DatacorePack | undefined {
  return allPacks.find((p) => p.id === id);
}

export function briefingsInPack(
  allBriefings: DatacoreBriefingRow[],
  packId: string,
): DatacoreBriefingRow[] {
  return allBriefings.filter((b) => b.packId === packId);
}

/** Lowercased haystack for Datacore Knowledge Core search. */
export function briefingSearchHaystack(b: DatacoreBriefingRow): string {
  return [
    b.id,
    b.title,
    b.summary,
    b.kind,
    b.tags.join(' '),
    (b.aliases ?? []).join(' '),
    b.packId ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

export function packSearchHaystack(p: DatacorePack): string {
  return [p.id, p.title, p.code, p.summary, p.topics.join(' ')].join(' ').toLowerCase();
}

export function briefingMatchesQuery(b: DatacoreBriefingRow, needle: string): boolean {
  if (!needle) return true;
  return briefingSearchHaystack(b).includes(needle);
}

export function packMatchesQuery(
  p: DatacorePack,
  needle: string,
  allBriefings: DatacoreBriefingRow[],
): boolean {
  if (!needle) return true;
  if (packSearchHaystack(p).includes(needle)) return true;
  return briefingsInPack(allBriefings, p.id).some((b) => briefingMatchesQuery(b, needle));
}
