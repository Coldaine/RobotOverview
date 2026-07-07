import { describe, expect, it } from 'vitest';
import { Bot, Cpu, Headphones, Network, Radio } from 'lucide-react';
import { HANGAR_BAY_IDS } from '@/data/hangar';
import { BAY_ICONS } from '@/components/bay-icons';

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
