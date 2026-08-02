'use client';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { useHangar } from '@/lib/store';
import { MISSION_STATUS_META } from '@/lib/format';
import clsx from 'clsx';

export default function MissionsList() {
  const { data } = useHangar();
  return (
    <div className="space-y-6">
      <header>
        <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan/70">Operations Board</div>
        <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.06em] text-ink">Missions</h1>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.missions.map((m, i) => {
          const ms = MISSION_STATUS_META[m.status];
          const done = m.objectives.filter((o) => o.done).length;
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link href={`/mission/${m.id}`} className="panel group block p-4 transition-all hover:border-amber/40 hover:shadow-hud-amber">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-[0.3em] text-amber/70">{m.code}</span>
                  <span className={clsx('chip', ms.cls)}>{ms.label}</span>
                </div>
                <h2 className="mt-2 font-display text-base uppercase tracking-[0.06em] text-ink group-hover:text-glow-amber">{m.name}</h2>
                <p className="mt-1 line-clamp-2 font-mono text-[11px] leading-relaxed text-ink-dim">{m.objective}</p>
                <div className="mt-4 flex items-center justify-between font-mono text-[10px] text-ink-dim">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>{m.requisitionedUnits.length} units</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-sm border border-cyan/20 bg-cyan/5 px-2 py-0.5 text-cyan transition-colors group-hover:border-amber/30 group-hover:bg-amber/5 group-hover:text-amber">
                    <svg width="10" height="10" viewBox="0 0 12 12" className="-rotate-90">
                      <circle cx="6" cy="6" r="5" fill="none" className="stroke-current opacity-20" strokeWidth="2" />
                      <motion.circle
                        cx="6" cy="6" r="5"
                        fill="none"
                        className="stroke-current"
                        strokeWidth="2"
                        strokeDasharray={31.415}
                        strokeDashoffset={31.415}
                        animate={{ strokeDashoffset: 31.415 * (1 - (m.objectives.length ? done / m.objectives.length : 0)) }}
                        transition={{ duration: 1, ease: 'easeOut', delay: i * 0.05 + 0.2 }}
                      />
                    </svg>
                    <span>{done}/{m.objectives.length} <span className="opacity-70">OBJ</span></span>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
