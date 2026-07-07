export const HANGAR_READ_SOURCES = ['postgres', 'static'] as const;
export type HangarReadSource = (typeof HANGAR_READ_SOURCES)[number];

export const HANGAR_FALLBACK_REASONS = ['not-configured', 'postgres-error'] as const;
export type HangarFallbackReason = (typeof HANGAR_FALLBACK_REASONS)[number];

export interface HangarReadStatus {
  source: HangarReadSource;
  fallbackReason?: HangarFallbackReason;
}
