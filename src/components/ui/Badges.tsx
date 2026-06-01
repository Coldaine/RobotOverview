import clsx from 'clsx';
import type { ReactNode } from 'react';
import { STATUS_META, TONE_CLASSES } from '../../lib/format';
import type { UnitStatus } from '../../data/types';

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

export function ProvenanceTag({ provenance }: { provenance?: 'owner' | 'inferred' | 'open' }) {
  if (!provenance) return null;
  const map = {
    owner: { label: 'OWNER', cls: 'text-signal-ok border-signal-ok/30 bg-signal-ok/5' },
    inferred: { label: 'INFERRED', cls: 'text-cyan border-cyan/30 bg-cyan/5' },
    open: { label: 'OPEN', cls: 'text-signal-warn border-signal-warn/30 bg-signal-warn/5' },
  } as const;
  const m = map[provenance];
  return <span className={clsx('chip', m.cls)}>{m.label}</span>;
}
