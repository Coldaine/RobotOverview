import { Bot, Cpu, Headphones, Network, Radio, type LucideIcon } from 'lucide-react';
import type { BayId } from '@/data/types';

export const BAY_ICONS: Record<BayId, LucideIcon> = {
  robotics: Bot,
  compute: Cpu,
  network: Radio,
  home: Network,
  audio: Headphones,
};
