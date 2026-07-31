import { describe, expect, it } from 'vitest';
import {
  unitShortcutIconKind,
  unitShortcutKindLabel,
  unitShortcutValue,
} from '@/lib/unit-shortcuts';
import type { UnitShortcut } from '@/data/types';

describe('unit shortcut presentation semantics', () => {
  const commandShortcut: UnitShortcut = {
    id: 'ssh',
    label: 'SSH',
    type: 'command',
    command: 'ssh beast-01',
  };

  it('returns the executable value and label for command shortcuts', () => {
    expect(unitShortcutValue(commandShortcut)).toBe('ssh beast-01');
    expect(unitShortcutKindLabel(commandShortcut)).toBe('Command');
    expect(unitShortcutIconKind(commandShortcut)).toBe('terminal');
  });

  it('returns the URL value and label for URL shortcuts', () => {
    const shortcut: UnitShortcut = {
      id: 'control-ui',
      label: 'Control UI',
      type: 'url',
      url: 'http://example.test:5000',
    };

    expect(unitShortcutValue(shortcut)).toBe('http://example.test:5000');
    expect(unitShortcutKindLabel(shortcut)).toBe('External');
    expect(unitShortcutIconKind(shortcut)).toBe('monitor');
  });

  it('assigns specific icon kinds for known Beast URL shortcuts', () => {
    expect(
      unitShortcutIconKind({
        id: 'jupyterlab',
        label: 'JupyterLab',
        type: 'url',
        url: 'http://example.test:8888',
      }),
    ).toBe('book');

    expect(
      unitShortcutIconKind({
        id: 'camera-stream',
        label: 'Camera stream',
        type: 'url',
        url: 'http://example.test:5000/video_feed',
      }),
    ).toBe('camera');
  });
});
