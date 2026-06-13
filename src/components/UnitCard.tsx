import clsx from 'clsx';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Unit } from '../data/types';
import { money } from '../lib/format';
import { StatusBadge } from './ui/Badges';
import { useHangar } from '../lib/store';

export function UnitCard({ unit, dim = false, index = 0 }: { unit: Unit; dim?: boolean; index?: number }) {
  const { source } = useHangar();
  const highDraw = (unit.power?.watts ?? 0) >= 25 && unit.bay === 'robotics';
  const attention = unit.status === 'needs-attention' || unit.status === 'blocked';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: dim ? 0.35 : 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={`/unit/${unit.id}`}
        className={clsx(
          'panel group relative block overflow-hidden p-4 transition-all duration-300',
          'hover:border-cyan/40 hover:shadow-hud-cyan',
          unit.flagship && 'ring-1 ring-amber/20',
          attention && 'border-signal-warn/40',
        )}
      >
        {/* sheen on hover */}
        <div className="pointer-events-none absolute inset-0 -translate-x-full bg-panel-sheen opacity-0 transition-all duration-700 group-hover:translate-x-full group-hover:opacity-100" />

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {unit.flagship && <Star className="h-3.5 w-3.5 shrink-0 fill-amber text-amber" />}
              <span className="truncate font-display text-sm uppercase tracking-[0.1em] text-ink group-hover:text-glow-cyan">
                {unit.name}
              </span>
            </div>
            {unit.callsign && (
              <span className="font-mono text-[10px] tracking-[0.2em] text-cyan/60">{unit.callsign}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {highDraw && (
              <div className="group/warn relative">
                <AlertTriangle className="h-3.5 w-3.5 text-signal-warn animate-pulse-trace" />
                <div className="absolute bottom-full right-0 mb-2 hidden w-32 rounded bg-void p-1.5 font-mono text-[9px] text-ink ring-1 ring-rim group-hover/warn:block">
                  CRITICAL DRAW: {unit.power?.watts}W on {unit.power?.rail || 'rail'}
                </div>
              </div>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-dim transition-transform group-hover:translate-x-0.5 group-hover:text-cyan" />
          </div>
        </div>

        <p className="mt-2 line-clamp-2 font-mono text-[11px] leading-relaxed text-ink-dim">{unit.summary}</p>

        <div className="mt-3 flex items-center justify-between">
          <StatusBadge status={unit.status} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-dim">{unit.class}</span>
        </div>

        {(unit.power?.watts != null || unit.price) && (
          <div className="mt-3 flex items-center gap-3 border-t border-rim/50 pt-2 font-mono text-[10px] text-ink-dim">
            {unit.power?.watts != null && (
              <span>
                <span className="text-amber">{unit.power.watts}W</span>
                {unit.power.rail && ` · ${unit.power.rail}`}
              </span>
            )}
            {unit.price && (
              <span className="text-cyan">
                {money(source === 'us' ? unit.price.us : unit.price.import ?? unit.price.us)}
              </span>
            )}
          </div>
        )}
      </Link>
    </motion.div>
  );
}
