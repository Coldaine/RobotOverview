export const SOURCE_PREFERENCES = ['us', 'import'] as const;
export type SourcePreference = (typeof SOURCE_PREFERENCES)[number];

export const SOURCE_LABELS: Record<SourcePreference, string> = {
  us: 'US Distributor',
  import: 'Import',
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

export function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODES.some((theme) => theme === value);
}
