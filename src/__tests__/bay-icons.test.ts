import { describe, expect, it } from 'vitest';
import { Bot, Cpu, Headphones, Network, Radio } from 'lucide-react';
import { HANGAR_BAY_IDS } from '@/data/hangar';
import { BAY_ACCENT_CLASSES, BAY_ICONS } from '@/components/bay-icons';
import { BAY_ACCENTS } from '@/data/types';

describe('BAY_ICONS', () => {
  it('has an icon for every live bay', () => {
    expect(Object.keys(BAY_ICONS).sort()).toEqual([...HANGAR_BAY_IDS].sort());
  });

  it('preserves the intended icon identity for each bay', () => {
    expect(BAY_ICONS.robotics).toBe(Bot);
    expect(BAY_ICONS.compute).toBe(Cpu);
    expect(BAY_ICONS.network).toBe(Radio);
    expect(BAY_ICONS.home).toBe(Network);
    expect(BAY_ICONS.audio).toBe(Headphones);
  });
});

describe('BAY_ACCENT_CLASSES', () => {
  it('has class metadata for every bay accent', () => {
    expect(Object.keys(BAY_ACCENT_CLASSES).sort()).toEqual([...BAY_ACCENTS].sort());
  });

  it('preserves bay accent class choices used by navigation and chips', () => {
    expect(BAY_ACCENT_CLASSES).toEqual({
      cyan: {
        text: 'text-cyan',
        textMuted: 'text-cyan/70',
        chip: 'text-cyan border-cyan/30 bg-cyan/5',
        activeNav: 'border-cyan/40 bg-cyan/10 text-cyan shadow-hud-cyan',
      },
      amber: {
        text: 'text-amber',
        textMuted: 'text-amber/70',
        chip: 'text-amber border-amber/30 bg-amber/5',
        activeNav: 'border-amber/40 bg-amber/10 text-amber shadow-hud-amber',
      },
    });
  });
});
