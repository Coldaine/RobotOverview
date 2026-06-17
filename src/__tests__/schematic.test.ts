import { describe, it, expect } from 'vitest';
import { hotspotStatus } from '@/lib/schematic';
import type { LoadoutSlot } from '@/data/types';

function slot(hotspotId: string, filledBy: string | null): LoadoutSlot {
  return { slot: `${hotspotId}-slot`, hotspotId, filledBy };
}

describe('hotspotStatus()', () => {
  it('returns "empty" when no slots map to the hotspot', () => {
    expect(hotspotStatus([slot('power', 'x')], 'lighting')).toBe('empty');
    expect(hotspotStatus([], 'lighting')).toBe('empty');
  });

  it('returns "ok" when every mapped slot is filled', () => {
    const loadout = [slot('arm', 'roarm'), slot('arm', 'servo')];
    expect(hotspotStatus(loadout, 'arm')).toBe('ok');
  });

  it('returns "empty" when all mapped slots are unfilled', () => {
    const loadout = [slot('lighting', null), slot('lighting', null)];
    expect(hotspotStatus(loadout, 'lighting')).toBe('empty');
  });

  it('returns "attention" when some mapped slots are filled and some are not', () => {
    const loadout = [slot('compute', 'pi5'), slot('compute', null)];
    expect(hotspotStatus(loadout, 'compute')).toBe('attention');
  });

  it('only considers slots mapped to the requested hotspot', () => {
    const loadout = [slot('power', 'ups'), slot('lighting', null)];
    expect(hotspotStatus(loadout, 'power')).toBe('ok');
    expect(hotspotStatus(loadout, 'lighting')).toBe('empty');
  });
});
