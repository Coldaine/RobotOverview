import type { LoadoutSlot } from '@/data/types';

export const HOTSPOT_STATUSES = ['ok', 'empty', 'attention'] as const;
export type HotspotStatus = (typeof HOTSPOT_STATUSES)[number];

export const HOTSPOT_STATUS_META: Record<
  HotspotStatus,
  {
    label: string;
    dotClass: string;
    ringClass: string;
    listDotClass: string;
    chipClass: string;
  }
> = {
  ok: {
    label: 'NOMINAL',
    dotClass: 'fill-signal-ok',
    ringClass: 'stroke-signal-ok',
    listDotClass: 'bg-signal-ok',
    chipClass: 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok',
  },
  empty: {
    label: 'UNFILLED',
    dotClass: 'fill-signal-warn',
    ringClass: 'stroke-signal-warn',
    listDotClass: 'bg-signal-warn',
    chipClass: 'border-signal-warn/40 bg-signal-warn/10 text-signal-warn',
  },
  attention: {
    label: 'REVIEW',
    dotClass: 'fill-amber',
    ringClass: 'stroke-amber',
    listDotClass: 'bg-amber',
    chipClass: 'border-amber/40 bg-amber/10 text-amber',
  },
};

/**
 * Aggregate the fill state of every loadout slot mapped to a schematic hotspot.
 * - no slots mapped, or all empty → 'empty'
 * - all mapped slots filled → 'ok'
 * - some filled, some empty → 'attention'
 */
export function hotspotStatus(loadout: LoadoutSlot[], hotspotId: string): HotspotStatus {
  const mapped = loadout.filter((s) => s.hotspotId === hotspotId);
  if (mapped.length === 0) return 'empty';
  const allFilled = mapped.every((s) => s.filledBy !== null);
  const noneFilled = mapped.every((s) => s.filledBy === null);
  if (allFilled) return 'ok';
  if (noneFilled) return 'empty';
  return 'attention';
}
