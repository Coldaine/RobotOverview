'use client';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import type { ConstraintGauge } from '@/data/types';

/**
 * Live constraint gauge — value vs budget. Goes critical (red) when busted.
 * Used in the mission lens and mission view.
 */
export function Gauge({ gauge, delay = 0 }: { gauge: ConstraintGauge; delay?: number }) {
  const pct = gauge.budget > 0 ? Math.min(120, (gauge.value / gauge.budget) * 100) : 0;
  const over = gauge.value > gauge.budget;
  const near = !over && pct > 80;
  const tone = over ? 'crit' : near ? 'warn' : 'ok';
  const toneBar =
    tone === 'crit' ? 'from-signal-crit to-signal-crit/60' : tone === 'warn' ? 'from-signal-warn to-amber' : 'from-cyan to-signal-ok';
  const toneText = tone === 'crit' ? 'text-signal-crit' : tone === 'warn' ? 'text-signal-warn' : 'text-cyan';

  return (
    <div className="panel-inset min-w-0 px-3 py-2.5">
      <div className="mb-1.5 flex min-w-0 items-baseline justify-between gap-2">
        <span className="hud-label min-w-0 truncate">{gauge.label}</span>
        <span className={clsx('shrink-0 font-mono text-xs tabular-nums', toneText)}>
          {gauge.value}
          <span className="text-ink-dim">/{gauge.budget}{gauge.unit}</span>
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-void/80 ring-1 ring-inset ring-rim/60">
        {/* budget tick at 100% reference is the full bar; we clamp to 120% scale */}
        <motion.div
          className={clsx('absolute inset-y-0 left-0 rounded-full bg-gradient-to-r', toneBar)}
          initial={{ width: 0 }}
          animate={{ width: `${(pct / 120) * 100}%` }}
          transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
        {/* budget marker */}
        <div className="absolute inset-y-0" style={{ left: `${(100 / 120) * 100}%` }}>
          <div className="h-full w-px bg-ink/40" />
        </div>
      </div>
      {over && (
        <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-signal-crit">
          ▲ over budget by {gauge.value - gauge.budget}
          {gauge.unit}
        </div>
      )}
    </div>
  );
}
