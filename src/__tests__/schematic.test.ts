import { describe, it, expect } from 'vitest';
import { HOTSPOT_STATUSES, HOTSPOT_STATUS_META, hotspotStatus } from '@/lib/schematic';
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

describe('HOTSPOT_STATUS_META', () => {
  it('has presentation metadata for every hotspot status', () => {
    expect(Object.keys(HOTSPOT_STATUS_META).sort()).toEqual([...HOTSPOT_STATUSES].sort());

    HOTSPOT_STATUSES.forEach((status) => {
      const meta = HOTSPOT_STATUS_META[status];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.dotClass.length).toBeGreaterThan(0);
      expect(meta.ringClass.length).toBeGreaterThan(0);
      expect(meta.listDotClass.length).toBeGreaterThan(0);
      expect(meta.chipClass.length).toBeGreaterThan(0);
    });
  });

  it('preserves operator-facing status labels', () => {
    expect(HOTSPOT_STATUS_META.ok.label).toBe('NOMINAL');
    expect(HOTSPOT_STATUS_META.empty.label).toBe('UNFILLED');
    expect(HOTSPOT_STATUS_META.attention.label).toBe('REVIEW');
  });

  it('preserves the schematic status class mappings', () => {
    expect(HOTSPOT_STATUS_META.ok).toMatchObject({
      dotClass: 'fill-signal-ok',
      ringClass: 'stroke-signal-ok',
      listDotClass: 'bg-signal-ok',
      chipClass: 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok',
    });
    expect(HOTSPOT_STATUS_META.empty).toMatchObject({
      dotClass: 'fill-signal-warn',
      ringClass: 'stroke-signal-warn',
      listDotClass: 'bg-signal-warn',
      chipClass: 'border-signal-warn/40 bg-signal-warn/10 text-signal-warn',
    });
    expect(HOTSPOT_STATUS_META.attention).toMatchObject({
      dotClass: 'fill-amber',
      ringClass: 'stroke-amber',
      listDotClass: 'bg-amber',
      chipClass: 'border-amber/40 bg-amber/10 text-amber',
    });
  });
});
