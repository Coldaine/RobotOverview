import { describe, expect, it } from 'vitest';
import {
  isSourcePreference,
  isThemeMode,
  SOURCE_LABELS,
  SOURCE_META,
  SOURCE_PREFERENCES,
  sourcePrice,
  sourcePriceOrZero,
  THEME_LABELS,
  THEME_MODES,
} from '@/lib/hangar-preferences';

describe('hangar preference vocabularies', () => {
  it('accepts only supported price source preferences', () => {
    expect(SOURCE_PREFERENCES).toEqual(['us', 'import']);
    expect(isSourcePreference('us')).toBe(true);
    expect(isSourcePreference('import')).toBe(true);
    expect(isSourcePreference('warehouse')).toBe(false);
    expect(isSourcePreference(null)).toBe(false);
    expect(SOURCE_PREFERENCES.map((source) => SOURCE_LABELS[source])).toEqual(['US Distributor', 'Import']);
    expect(SOURCE_META).toEqual({
      us: { label: 'US Distributor', shortLabel: 'US', accent: 'cyan' },
      import: { label: 'Import', shortLabel: 'IMP', accent: 'amber' },
    });
  });

  it('selects effective prices for the preferred source', () => {
    expect(sourcePrice({ us: 120, import: 80 }, 'us')).toBe(120);
    expect(sourcePrice({ us: 120, import: 80 }, 'import')).toBe(80);
    expect(sourcePrice({ us: 120, import: null }, 'import')).toBe(120);
    expect(sourcePrice({ us: null, import: null }, 'us')).toBeNull();
    expect(sourcePriceOrZero({ us: null, import: null }, 'import')).toBe(0);
  });

  it('accepts only supported theme modes and labels every mode', () => {
    expect(THEME_MODES).toEqual(['blueprint', 'industrial', 'topology']);
    expect(isThemeMode('blueprint')).toBe(true);
    expect(isThemeMode('industrial')).toBe(true);
    expect(isThemeMode('topology')).toBe(true);
    expect(isThemeMode('sepia')).toBe(false);
    expect(isThemeMode(undefined)).toBe(false);
    expect(THEME_MODES.map((theme) => THEME_LABELS[theme])).toEqual(['BLU', 'IND', 'TOP']);
  });
});
