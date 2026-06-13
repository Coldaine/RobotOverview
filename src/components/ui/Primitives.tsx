import clsx from 'clsx';
import type { ReactNode } from 'react';

export function SectionTitle({
  children,
  code,
  className,
}: {
  children: ReactNode;
  code?: string;
  className?: string;
}) {
  return (
    <div className={clsx('mb-3 flex min-w-0 flex-wrap items-center gap-2 sm:gap-3', className)}>
      {code && (
        <span className="shrink-0 font-mono text-[10px] tracking-[0.3em] text-cyan/70">{code}</span>
      )}
      <h2 className="min-w-0 flex-1 break-words font-display text-sm uppercase leading-6 tracking-[0.2em] text-ink">{children}</h2>
      <div className="hidden h-px min-w-8 flex-1 bg-gradient-to-r from-rim to-transparent sm:block" />
    </div>
  );
}

export function StatReadout({ label, value, accent }: { label: string; value: ReactNode; accent?: 'cyan' | 'amber' }) {
  return (
    <div className="panel-inset px-3 py-2">
      <div className="hud-label">{label}</div>
      <div
        className={clsx(
          'mt-0.5 font-mono text-lg tabular-nums',
          accent === 'amber' ? 'text-amber text-glow-amber' : accent === 'cyan' ? 'text-cyan text-glow-cyan' : 'text-ink',
        )}
      >
        {value}
      </div>
    </div>
  );
}
