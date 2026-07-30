import type {
  ActivityEvent,
  Capability,
  DocumentRef,
  HangarData,
  Insight,
  InventoryItem,
  Mission,
  Net,
  Terminal,
  Unit,
  WishlistItem,
} from '@/data/types';
import { z } from 'zod';
import { putHangarSpine, getHangarSpine, isHangarDataPayload } from './spine';

const entityKinds = [
  'unit',
  'item',
  'mission',
  'wishlist',
  'capability',
  'insight',
  'activity',
  'terminal',
  'net',
  'document',
] as const;

export type IngestEntityKind = (typeof entityKinds)[number];

const ingestBodySchema = z.object({
  entity: z.enum(entityKinds),
  record: z.record(z.string(), z.unknown()),
});

export type IngestBody = z.infer<typeof ingestBodySchema>;

export function parseIngestBody(raw: unknown): IngestBody {
  return ingestBodySchema.parse(raw);
}

function requireId(record: Record<string, unknown>): string {
  const id = record.id;
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('record.id must be a non-empty string');
  }
  return id.trim();
}

function upsertById<T extends { id: string }>(list: T[], record: T): T[] {
  const idx = list.findIndex((row) => row.id === record.id);
  if (idx === -1) return [...list, record];
  const next = list.slice();
  next[idx] = record;
  return next;
}

export function applyEntity(
  data: HangarData,
  entity: IngestEntityKind,
  record: Record<string, unknown>,
): HangarData {
  const id = requireId(record);
  const withId = { ...record, id };

  switch (entity) {
    case 'unit':
      return { ...data, units: upsertById(data.units, withId as unknown as Unit) };
    case 'item':
      return { ...data, items: upsertById(data.items, withId as unknown as InventoryItem) };
    case 'mission':
      return { ...data, missions: upsertById(data.missions, withId as unknown as Mission) };
    case 'wishlist':
      return { ...data, wishlist: upsertById(data.wishlist, withId as unknown as WishlistItem) };
    case 'capability':
      return { ...data, capabilities: upsertById(data.capabilities, withId as unknown as Capability) };
    case 'insight':
      return { ...data, insights: upsertById(data.insights, withId as unknown as Insight) };
    case 'activity':
      return { ...data, activity: upsertById(data.activity, withId as unknown as ActivityEvent) };
    case 'terminal':
      return { ...data, terminals: upsertById(data.terminals, withId as unknown as Terminal) };
    case 'net':
      return { ...data, nets: upsertById(data.nets, withId as unknown as Net) };
    case 'document':
      return { ...data, documents: upsertById(data.documents, withId as unknown as DocumentRef) };
    default: {
      const _exhaustive: never = entity;
      throw new Error(`Unsupported entity: ${_exhaustive}`);
    }
  }
}

export type IngestResult = {
  ok: true;
  entity: IngestEntityKind;
  id: string;
  source: 'postgres';
};

/** Authenticated ingest: merge one entity into the Postgres spine snapshot. */
export async function ingestHangarEntity(body: IngestBody): Promise<IngestResult> {
  const current = await getHangarSpine();
  const base =
    current.source === 'postgres' && isHangarDataPayload(current.data)
      ? current.data
      : current.data;

  const next = applyEntity(base, body.entity, body.record);
  next.meta = {
    ...next.meta,
    updated: new Date().toISOString().slice(0, 10),
  };

  await putHangarSpine(next);

  return {
    ok: true,
    entity: body.entity,
    id: requireId(body.record),
    source: 'postgres',
  };
}

export function assertIngestAuthorized(header: string | null): void {
  const expected = process.env.HANGAR_INGEST_TOKEN?.trim();
  if (!expected) {
    throw new IngestAuthError('HANGAR_INGEST_TOKEN is not configured', 503);
  }
  if (!header || header !== `Bearer ${expected}`) {
    throw new IngestAuthError('Unauthorized', 401);
  }
}

export class IngestAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
