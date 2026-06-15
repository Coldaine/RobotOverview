'use client';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Circle, Crosshair, Package } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Gauge } from '@/components/ui/Gauge';
import { SectionTitle } from '@/components/ui/Primitives';
import { UnitCard } from '@/components/UnitCard';
import { useHangar, useCalculatedConstraints } from '@/lib/store';
import { MISSION_STATUS_META, money } from '@/lib/format';
import clsx from 'clsx';
import type { WishlistItem } from '@/data/types';

const WSTATUS: Record<WishlistItem['status'], { label: string; cls: string }> = {
  watching: { label: 'Watching', cls: 'text-ink-dim border-rim bg-panel-2/40' },
  researching: { label: 'Researching', cls: 'text-cyan border-cyan/40 bg-cyan/10' },
  planned: { label: 'Planned', cls: 'text-cyan border-cyan/40 bg-cyan/10' },
  'buy-next': { label: 'Buy Next', cls: 'text-amber border-amber/40 bg-amber/10' },
  'on-order': { label: 'On Order', cls: 'text-amber border-amber/40 bg-amber/10' },
  received: { label: 'Received', cls: 'text-signal-ok border-signal-ok/40 bg-signal-ok/10' },
  rejected: { label: 'Rejected', cls: 'text-signal-crit border-signal-crit/40 bg-signal-crit/10' },
};

export default function MissionView() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const { mission, unit, wish, insight, setLensMissionId } = useHangar();
  const m = id ? mission(id) : undefined;

  const constraints = useCalculatedConstraints(id || '');

  if (!m) {
    return (
      <div className="panel p-8 text-center">
        <p className="font-mono text-sm text-ink-dim">Mission not found.</p>
        <Link href="/missions" className="btn btn-ghost mt-4 inline-flex"><ArrowLeft className="h-3 w-3" /> Missions</Link>
      </div>
    );
  }

  const units = m.requisitionedUnits.map(unit).filter(Boolean);
  const wishes = m.wishlist.map(wish).filter(Boolean);
  const insights = (m.insights ?? []).map(insight).filter(Boolean);
  const ms = MISSION_STATUS_META[m.status];

  return (
    <div className="space-y-6">
      <Link href="/missions" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim transition-colors hover:text-amber">
        <ArrowLeft className="h-3 w-3" /> Missions
      </Link>

      <header className="panel relative overflow-hidden p-5">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <Crosshair className="h-5 w-5 text-amber" />
              <span className="font-mono text-[11px] tracking-[0.3em] text-amber/70">{m.code}</span>
              <span className={clsx('chip', ms.cls)}>{ms.label}</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold uppercase tracking-[0.06em] text-glow-amber sm:text-3xl">{m.name}</h1>
            <p className="mt-2 font-mono text-xs leading-relaxed text-ink">{m.objective}</p>
            {m.environment && (
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-dim">
                <span className="text-cyan">ENV · </span>{m.environment}
              </p>
            )}
          </div>
          <button onClick={() => setLensMissionId(m.id)} className="btn btn-active text-[10px]">
            <Crosshair className="h-3 w-3" /> Engage Lens
          </button>
        </div>
      </header>

      {/* constraint gauges */}
      <section>
        <SectionTitle code="LIMITS">Live Constraint Gauges</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          {constraints.map((g, i) => (
            <Gauge key={g.label} gauge={g} delay={i * 0.1} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* objectives */}
          <section>
            <SectionTitle code="OBJ">Objectives</SectionTitle>
            <div className="space-y-2">
              {m.objectives.map((o, i) => (
                <motion.div
                  key={o.text}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-md border border-rim/60 bg-panel-2/30 px-3 py-2.5"
                >
                  {o.done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-signal-ok" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-ink-dim" />
                  )}
                  <span className={clsx('font-mono text-[11px]', o.done ? 'text-ink-dim line-through' : 'text-ink')}>{o.text}</span>
                </motion.div>
              ))}
            </div>
          </section>

          {/* required loadout */}
          <section>
            <SectionTitle code="LOAD">Required Loadout</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {m.requiredLoadout.map((l) => (
                <span key={l} className="chip border-cyan/30 bg-cyan/5 text-cyan">{l}</span>
              ))}
            </div>
          </section>

          {/* after action */}
          {m.afterAction && m.afterAction.length > 0 && (
            <section>
              <SectionTitle code="AAR">After-Action Log</SectionTitle>
              <div className="space-y-2">
                {m.afterAction.map((a, i) => (
                  <div key={i} className="panel-inset px-3 py-2 font-mono text-[11px] text-ink-dim">{a}</div>
                ))}
              </div>
            </section>
          )}

          {insights.length > 0 && (
            <section>
              <SectionTitle code="CODEX">Linked Insights</SectionTitle>
              <div className="space-y-2">
                {insights.map((ins) => (
                  <Link key={ins!.id} href="/codex" className="panel block p-3 transition-all hover:border-cyan/40">
                    <div className="font-display text-xs uppercase tracking-[0.08em] text-ink">{ins!.title}</div>
                    <p className="mt-1 font-mono text-[11px] leading-relaxed text-ink-dim">{ins!.body}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section>
            <SectionTitle code="UNITS">Requisitioned</SectionTitle>
            <div className="space-y-3">
              {units.map((u, i) => (
                <UnitCard key={u!.id} unit={u!} index={i} mission={m} />
              ))}
            </div>
          </section>

          {wishes.length > 0 && (
            <section>
              <SectionTitle code="REQ"><span className="inline-flex items-center gap-2"><Package className="h-3.5 w-3.5 text-amber" /> Requisitions</span></SectionTitle>
              <div className="space-y-2">
                {wishes.map((w) => (
                  <Link key={w!.id} href="/quartermaster" className="panel flex items-center justify-between p-3 transition-all hover:border-amber/40">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[11px] text-ink">{w!.name}</div>
                      <span className={clsx('chip mt-1', WSTATUS[w!.status].cls)}>{WSTATUS[w!.status].label}</span>
                    </div>
                    <span className="font-mono text-sm text-amber">{money(w!.price.us)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
