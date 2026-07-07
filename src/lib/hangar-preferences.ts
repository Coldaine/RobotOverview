import type { Price } from '../data/types';

export const SOURCE_PREFERENCES = ['us', 'import'] as const;
export type SourcePreference = (typeof SOURCE_PREFERENCES)[number];

export const SOURCE_META: Record<
  SourcePreference,
  {
    label: string;
    shortLabel: string;
    accent: 'cyan' | 'amber';
    activeClass: string;
    textClass: string;
  }
> = {
  us: {
    label: 'US Distributor',
    shortLabel: 'US',
    accent: 'cyan',
    activeClass: 'bg-cyan/15 text-cyan shadow-hud-cyan',
    textClass: 'text-cyan',
  },
  import: {
    label: 'Import',
    shortLabel: 'IMP',
    accent: 'amber',
    activeClass: 'bg-amber/15 text-amber shadow-hud-amber',
    textClass: 'text-amber',
  },
};

export const SOURCE_LABELS: Record<SourcePreference, string> = {
  us: SOURCE_META.us.label,
  import: SOURCE_META.import.label,
};

export const THEME_MODES = ['blueprint', 'industrial', 'topology'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const THEME_LABELS: Record<ThemeMode, string> = {
  blueprint: 'BLU',
  industrial: 'IND',
  topology: 'TOP',
};

export function isSourcePreference(value: unknown): value is SourcePreference {
  return SOURCE_PREFERENCES.some((source) => source === value);
}

export function sourcePrice(price: Price, source: SourcePreference): number | null {
  return source === 'us' ? price.us : price.import ?? price.us;
}

export function sourcePriceOrZero(price: Price, source: SourcePreference): number {
  return sourcePrice(price, source) ?? 0;
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODES.some((theme) => theme === value);
}
