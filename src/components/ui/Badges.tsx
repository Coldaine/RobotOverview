import clsx from 'clsx';
import type { ReactNode } from 'react';
import { PROVENANCE_META, STATUS_META, TONE_CLASSES } from '@/lib/format';
import type { ProvenanceKind, UnitStatus } from '@/data/types';

export function StatusBadge({ status }: { status: UnitStatus }) {
  const meta = STATUS_META[status];
  const tone = TONE_CLASSES[meta.tone];
  return (
    <span className={clsx('chip', tone.text, tone.border, tone.bg)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', tone.dot)} />
      {meta.label}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="chip border-rim/70 bg-panel-2/40 text-ink-dim">
      <span className="text-cyan/60">#</span>
      {children}
    </span>
  );
}

export function ProvenanceTag({ provenance }: { provenance?: ProvenanceKind }) {
  if (!provenance) return null;
  const m = PROVENANCE_META[provenance];
  return <span className={clsx('chip', m.cls)}>{m.label}</span>;
}
