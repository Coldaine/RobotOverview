// ─────────────────────────────────────────────────────────────────────────────
// Board visual language — the single place design mode tunes.
// Colors read from globals.css @theme tokens so a re-skin (or a new paradigm)
// is a token change, not a component edit. Wire/glow/flow treatments are named
// constants so tuning is a one-line edit.
// ─────────────────────────────────────────────────────────────────────────────
import { FileText, Cpu, Box, CircuitBoard, ScrollText, Image, FileCode, type LucideIcon } from 'lucide-react';
import type { DocumentRef, NetKind } from '@/data/types';
import type { NetColorKey } from '@/lib/twin';
import { netKindColor } from '@/lib/twin';

export interface NetStroke {
  primary: string;
  /** Second strand, drawn dashed over the primary — used for 'mixed' rails. */
  secondary?: string;
}

export const NET_STROKE: Record<NetColorKey, NetStroke> = {
  amber: { primary: 'var(--color-amber)' },
  cyan: { primary: 'var(--color-cyan)' },
  mixed: { primary: 'var(--color-cyan)', secondary: 'var(--color-amber)' },
  idle: { primary: 'var(--color-ink-dim)' },
};

export function strokeForKind(kind: NetKind): NetStroke {
  return NET_STROKE[netKindColor(kind)];
}

// ── Layer filter — the net kinds actually present in the twin ────────────────
export const LAYERS: { kind: NetKind; label: string; color: NetColorKey }[] = [
  { kind: 'power', label: 'Power', color: 'amber' },
  { kind: 'data', label: 'Data', color: 'cyan' },
  { kind: 'mixed', label: 'Mixed', color: 'mixed' },
];

// ── Wire / glow / flow treatment (design-mode tuning surface) ────────────────
export const WIRE = {
  coreWidth: 2.2,
  glowWidth: 7,
  dimOpacity: 0.14,
  idleOpacity: 0.5,
  activeOpacity: 1,
  glowOpacity: 0.45,
  pulseRadius: 3.4,
  pulseDuration: 2.6, // seconds along the path
  dashArray: '7 6',
} as const;

export const PORT = {
  radius: 5.5,
  hitRadius: 12,
  ringRadius: 9,
} as const;

// ── Document kind → icon (proving-document rows in the inspector) ────────────
const DOC_ICON: Record<DocumentRef['kind'], LucideIcon> = {
  schematic: CircuitBoard,
  manual: ScrollText,
  cad: Box,
  firmware: FileCode,
  wiki: FileText,
  datasheet: FileText,
  image: Image,
};

export function docIcon(kind: DocumentRef['kind']): LucideIcon {
  return DOC_ICON[kind] ?? FileText;
}

export { Cpu };
