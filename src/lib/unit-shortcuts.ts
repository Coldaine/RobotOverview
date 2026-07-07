import type { UnitShortcut } from '../data/types';

export const UNIT_SHORTCUT_ICON_KINDS = ['terminal', 'book', 'camera', 'monitor'] as const;
export type UnitShortcutIconKind = (typeof UNIT_SHORTCUT_ICON_KINDS)[number];

export function unitShortcutValue(shortcut: UnitShortcut): string {
  return shortcut.type === 'url' ? shortcut.url : shortcut.command;
}

export function unitShortcutKindLabel(shortcut: UnitShortcut): 'External' | 'Command' {
  return shortcut.type === 'url' ? 'External' : 'Command';
}

export function unitShortcutIconKind(shortcut: UnitShortcut): UnitShortcutIconKind {
  if (shortcut.type === 'command') return 'terminal';
  if (shortcut.id === 'jupyterlab') return 'book';
  if (shortcut.id === 'camera-stream') return 'camera';
  return 'monitor';
}
