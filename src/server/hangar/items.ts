import { hangarData } from '@/data/hangar';
import type {
  BayId,
  InventoryItem,
  InventoryItemStatus,
  SourceRecord,
  SpecRow,
} from '@/data/types';
import { getHangarPool, getHangarPoolConfig } from './db';

type Queryable = {
  query: <T>(sql: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};

type InventoryItemRow = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  bay: string;
  category: string | null;
  status: string;
  provenance: string | null;
  summary: string | null;
  description: string | null;
  planning_notes: string | null;
  acquired: string | null;
  horizon: string | null;
  quantity: number | null;
  price_us: string | number | null;
  price_import: string | number | null;
  specs: unknown;
  limitations: unknown;
  sources: unknown;
  tags: string[] | null;
};

export type HangarReadSource = 'postgres' | 'static';
export type HangarFallbackReason = 'not-configured' | 'postgres-error';

export interface InventoryItemsRead {
  source: HangarReadSource;
  fallbackReason?: HangarFallbackReason;
  items: InventoryItem[];
}

const BAY_IDS: BayId[] = ['robotics', 'compute', 'network', 'home', 'audio'];
const ITEM_STATUSES: InventoryItemStatus[] = [
  'owned',
  'on-order',
  'wishlist',
  'researching',
  'deployed',
  'retired',
  'rejected',
];

const INVENTORY_ITEMS_SQL = `
  SELECT
    a.id,
    a.name,
    a.manufacturer,
    a.model,
    ag.group_id AS bay,
    category.name AS category,
    a.status::text AS status,
    a.provenance,
    a.summary,
    a.description,
    a.planning_notes,
    a.acquired,
    a.horizon,
    a.quantity,
    a.price_us,
    a.price_import,
    a.specs,
    a.limitations,
    a.sources,
    COALESCE(
      array_remove(array_agg(DISTINCT tag.name) FILTER (WHERE tag.namespace = 'tag'), NULL),
      ARRAY[]::text[]
    ) AS tags
  FROM assets a
  JOIN asset_groups ag ON ag.asset_id = a.id
  JOIN groups bay_group ON bay_group.id = ag.group_id AND bay_group.kind = 'bay'
  LEFT JOIN LATERAL (
    SELECT t.name
    FROM asset_tags item_category
    JOIN tags t ON t.id = item_category.tag_id
    WHERE item_category.asset_id = a.id AND t.namespace = 'category'
    ORDER BY t.name
    LIMIT 1
  ) category ON true
  LEFT JOIN asset_tags item_tags ON item_tags.asset_id = a.id
  LEFT JOIN tags tag ON tag.id = item_tags.tag_id
  WHERE a.kind = 'peripheral'
    AND a.status::text = ANY($1)
  GROUP BY
    a.id,
    ag.group_id,
    category.name
  ORDER BY a.name;
`;

function isBayId(value: string): value is BayId {
  return BAY_IDS.includes(value as BayId);
}

function isInventoryItemStatus(value: string): value is InventoryItemStatus {
  return ITEM_STATUSES.includes(value as InventoryItemStatus);
}

function numberOrNull(value: string | number | null) {
  if (value === null) return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function specRows(value: unknown): SpecRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is SpecRow =>
      Boolean(row) &&
      typeof row === 'object' &&
      typeof (row as SpecRow).label === 'string' &&
      typeof (row as SpecRow).value === 'string',
  );
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length ? strings : undefined;
}

function sourceRecords(value: unknown): SourceRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const records = value.filter(
    (row): row is SourceRecord =>
      Boolean(row) &&
      typeof row === 'object' &&
      typeof (row as SourceRecord).label === 'string' &&
      typeof (row as SourceRecord).url === 'string' &&
      typeof (row as SourceRecord).accessedAt === 'string' &&
      ['official', 'certification', 'review', 'community', 'research'].includes(
        (row as SourceRecord).kind,
      ),
  );

  return records.length ? records : undefined;
}

export function mapInventoryItemRow(row: InventoryItemRow): InventoryItem {
  if (!isBayId(row.bay)) throw new Error(`Invalid bay id from hangar DB: ${row.bay}`);
  if (!isInventoryItemStatus(row.status)) {
    throw new Error(`Invalid inventory item status from hangar DB: ${row.status}`);
  }

  const priceUs = numberOrNull(row.price_us);
  const priceImport = numberOrNull(row.price_import);
  const price =
    priceUs !== null || priceImport !== null
      ? { us: priceUs, import: priceImport }
      : undefined;

  return {
    id: row.id,
    name: row.name,
    manufacturer: row.manufacturer ?? undefined,
    model: row.model ?? undefined,
    bay: row.bay,
    category: row.category ?? 'Uncategorized',
    status: row.status,
    summary: row.summary ?? '',
    description: row.description ?? '',
    planningNotes: row.planning_notes ?? undefined,
    specs: specRows(row.specs),
    price,
    quantity: row.quantity ?? undefined,
    tags: stringArray(row.tags),
    sources: sourceRecords(row.sources),
    limitations: stringArray(row.limitations),
    acquired: row.acquired ?? undefined,
    horizon: row.horizon ?? undefined,
    provenance:
      row.provenance === 'owner' || row.provenance === 'inferred' || row.provenance === 'open'
        ? row.provenance
        : undefined,
  };
}

export async function readInventoryItemsFromPostgres(client: Queryable) {
  const result = await client.query<InventoryItemRow>(INVENTORY_ITEMS_SQL, [ITEM_STATUSES]);
  return result.rows.map(mapInventoryItemRow);
}

export async function getInventoryItems(): Promise<InventoryItemsRead> {
  if (!getHangarPoolConfig()) {
    return {
      source: 'static',
      fallbackReason: 'not-configured',
      items: hangarData.items,
    };
  }

  try {
    const pool = await getHangarPool();
    if (!pool) {
      return {
        source: 'static',
        fallbackReason: 'not-configured',
        items: hangarData.items,
      };
    }

    return {
      source: 'postgres',
      items: await readInventoryItemsFromPostgres(pool),
    };
  } catch (error) {
    console.warn('Hangar Postgres read failed; falling back to static inventory spine.', error);
    return {
      source: 'static',
      fallbackReason: 'postgres-error',
      items: hangarData.items,
    };
  }
}
