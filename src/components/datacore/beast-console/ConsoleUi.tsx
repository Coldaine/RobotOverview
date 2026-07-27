'use client';
/** Shared primitives for the BEAST Console views. */
import { motion } from 'framer-motion';
import clsx from 'clsx';

export const SPRING = { type: 'spring', stiffness: 320, damping: 30 } as const;
export const SPRING_SOFT = { type: 'spring', stiffness: 170, damping: 24 } as const;

export interface SegmentedOption {
  value: string;
  label: string;
  color?: string;
}

export function Segmented({ value, options, onChange }: {
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
}) {
  const groupId = options.map((o) => o.value).join('-');
  return (
    <div className="inline-flex gap-0.5 rounded-lg border border-rim bg-panel-2/40 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={clsx(
              'relative rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em]',
              active ? 'font-semibold text-void' : 'text-ink-dim hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={`beast-seg-${groupId}`}
                transition={SPRING}
                className="absolute inset-0 -z-10 rounded-md"
                style={{ background: o.color ?? 'var(--color-cyan)' }}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
