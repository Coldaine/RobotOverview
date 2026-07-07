import { Bot, Cpu, Headphones, Network, Radio, type LucideIcon } from 'lucide-react';
import type { BayAccent, BayId } from '@/data/types';

export const BAY_ICONS: Record<BayId, LucideIcon> = {
  robotics: Bot,
  compute: Cpu,
  network: Radio,
  home: Network,
  audio: Headphones,
};

export const BAY_ACCENT_CLASSES: Record<
  BayAccent,
  {
    text: string;
    textMuted: string;
    chip: string;
    activeNav: string;
  }
> = {
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
};
