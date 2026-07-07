export const HANGAR_READ_SOURCES = ['postgres', 'static'] as const;
export type HangarReadSource = (typeof HANGAR_READ_SOURCES)[number];

export const HANGAR_FALLBACK_REASONS = ['not-configured', 'postgres-error'] as const;
export type HangarFallbackReason = (typeof HANGAR_FALLBACK_REASONS)[number];

export const HANGAR_READ_LANES = ['inventory'] as const;
export type HangarReadLane = (typeof HANGAR_READ_LANES)[number];

export interface HangarReadStatus {
  source: HangarReadSource;
  fallbackReason?: HangarFallbackReason;
}

export const HANGAR_READ_SOURCE_META: Record<
  HangarReadSource,
  {
    label: string;
    dotClass: string;
  }
> = {
  postgres: {
    label: 'PG',
    dotClass: 'bg-signal-ok',
  },
  static: {
    label: 'STATIC',
    dotClass: 'bg-amber',
  },
};

export const HANGAR_FALLBACK_REASON_META: Record<
  HangarFallbackReason,
  {
    label: string;
  }
> = {
  'not-configured': {
    label: 'NOT CFG',
  },
  'postgres-error': {
    label: 'PG ERR',
  },
};

export const HANGAR_READ_LANE_META: Record<
  HangarReadLane,
  {
    fallbackDetail: string;
    fallbackReasonDetails: Record<HangarFallbackReason, string>;
  }
> = {
  inventory: {
    fallbackDetail: 'Serving inventory items from the static hangar.ts spine.',
    fallbackReasonDetails: {
      'not-configured':
        'Inventory Postgres is not configured — items are coming from the hangar.ts spine.',
      'postgres-error':
        'Inventory Postgres read FAILED — serving items from the hangar.ts spine.',
    },
  },
};

export function hangarReadStatusLabel(status: HangarReadStatus): string {
  const sourceLabel = HANGAR_READ_SOURCE_META[status.source].label;
  if (status.source === 'postgres') return sourceLabel;

  const fallbackLabel = status.fallbackReason
    ? HANGAR_FALLBACK_REASON_META[status.fallbackReason].label
    : null;

  return fallbackLabel ? `${sourceLabel} · ${fallbackLabel}` : sourceLabel;
}

export function hangarFallbackDetail(
  lane: HangarReadLane,
  fallbackReason?: HangarFallbackReason,
): string {
  const laneMeta = HANGAR_READ_LANE_META[lane];
  return fallbackReason
    ? laneMeta.fallbackReasonDetails[fallbackReason]
    : laneMeta.fallbackDetail;
}
