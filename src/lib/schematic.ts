import type { LoadoutSlot } from '@/data/types';

export type HotspotStatus = 'ok' | 'empty' | 'attention';

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
