import { hangarData as staticHangarData } from '@/data/hangar';
import type { HangarData } from '@/data/types';
import type { HangarFallbackReason, HangarReadStatus } from '@/lib/hangar-read-status';
import { eq } from 'drizzle-orm';
import { getHangarDrizzle } from './drizzle';
import { contentSnapshots, HANGAR_SPINE_SNAPSHOT_ID } from './schema';

export type HangarSpineRead = HangarReadStatus & {
  data: HangarData;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Minimal structural check — full integrity stays in hangar-integrity / ingest Zod. */
export function isHangarDataPayload(value: unknown): value is HangarData {
  if (!isRecord(value)) return false;
  return (
    isRecord(value.meta) &&
    Array.isArray(value.bays) &&
    Array.isArray(value.items) &&
    Array.isArray(value.units) &&
    Array.isArray(value.missions) &&
    Array.isArray(value.wishlist) &&
    Array.isArray(value.capabilities) &&
    Array.isArray(value.insights) &&
    Array.isArray(value.activity) &&
    Array.isArray(value.terminals) &&
    Array.isArray(value.nets) &&
    Array.isArray(value.documents)
  );
}

function staticFallback(reason: HangarFallbackReason): HangarSpineRead {
  return {
    source: 'static',
    fallbackReason: reason,
    data: staticHangarData,
  };
}

/** Load the Hangar UI spine from Postgres content_snapshots, or static fallback. */
export async function getHangarSpine(): Promise<HangarSpineRead> {
  try {
    const db = await getHangarDrizzle();
    if (!db) return staticFallback('not-configured');

    const rows = await db
      .select()
      .from(contentSnapshots)
      .where(eq(contentSnapshots.id, HANGAR_SPINE_SNAPSHOT_ID))
      .limit(1);

    const row = rows[0];
    if (!row || !isHangarDataPayload(row.payload)) {
      return staticFallback('postgres-error');
    }

    return { source: 'postgres', data: row.payload };
  } catch {
    return staticFallback('postgres-error');
  }
}

/** Replace the hangar spine snapshot (used by seed + ingest). */
export async function putHangarSpine(data: HangarData): Promise<void> {
  if (!isHangarDataPayload(data)) {
    throw new Error('putHangarSpine: payload failed HangarData structural check');
  }
  const db = await getHangarDrizzle();
  if (!db) throw new Error('putHangarSpine: database not configured');

  const updated = data.meta?.updated
    ? data
    : {
        ...data,
        meta: {
          ...data.meta,
          updated: new Date().toISOString().slice(0, 10),
        },
      };

  await db
    .insert(contentSnapshots)
    .values({
      id: HANGAR_SPINE_SNAPSHOT_ID,
      payload: updated,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: contentSnapshots.id,
      set: {
        payload: updated,
        updatedAt: new Date(),
      },
    });
}
