'use client';
import { motion } from 'framer-motion';
import { ArrowUpRight, Crosshair, Target, Zap } from 'lucide-react';
import Link from 'next/link';
import { RoverSchematic } from '@/components/RoverSchematic';
import { UnitCard } from '@/components/UnitCard';
import { Gauge } from '@/components/ui/Gauge';
import { SectionTitle, StatReadout } from '@/components/ui/Primitives';
import { useHangar, useCalculatedConstraints } from '@/lib/store';
import { money } from '@/lib/format';
import clsx from 'clsx';

export default function HangarHub() {
  const { data, unit, mission, setLensMissionId, lensMissionId } = useHangar();

  const flagship = data.units.find((u) => u.flagship && u.bay === 'robotics');
  const primaryMissionId = 'undercroft';
  const primaryMission = mission(primaryMissionId) ?? data.missions[0];
  const lensedMission = lensMissionId ? mission(lensMissionId) : undefined;
  const activeMission = lensedMission ?? primaryMission;
  const activeMissionId = activeMission?.id ?? '';

  const lens = lensedMission ?? null;
  const spotlightUnits = new Set(lens?.requisitionedUnits ?? []);

  const buyNext = data.wishlist.filter((w) => w.status === 'buy-next' || w.status === 'planned');
  const operational = data.units.filter((u) => u.status === 'operational').length;
  const needsAttention = data.units.filter((u) => u.status === 'needs-attention' || u.status === 'blocked').length;

  const constraints = useCalculatedConstraints(activeMissionId);

  return (
    <div className="space-y-8">
      {/* ── HERO ─────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan/70">{data.meta.codename}</div>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-[0.08em] text-ink sm:text-4xl">
            The <span className="text-glow-amber text-amber">Hangar</span>
          </h1>
          <p className="mt-2 max-w-xl font-mono text-xs leading-relaxed text-ink-dim">
            Fleet command for {data.meta.operator}. Every rig, radio, and acquisition — racked, statused, and mission-assigned.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatReadout label="Units" value={data.units.length} accent="cyan" />
          <StatReadout label="Operational" value={operational} />
          <StatReadout label="Flags" value={needsAttention} accent="amber" />
        </div>
      </header>

      {/* ── THE ROBOT IS THE INTERFACE ──────────────────── */}
      {flagship && (
        <section>
          <SectionTitle code="BEAST-01">Flagship · Live Schematic</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <RoverSchematic />
            <div className="flex flex-col gap-3">
              <div className="panel p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm uppercase tracking-[0.1em] text-ink">{flagship.name}</span>
                  <Link href={`/unit/${flagship.id}`} className="btn btn-ghost text-[10px]">
                    Open <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-dim">{flagship.summary}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {flagship.specs.slice(0, 4).map((s) => (
                    <div key={s.label} className="panel-inset px-2.5 py-1.5">
                      <div className="hud-label">{s.label}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-ink">{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              {activeMission && (
                <Link
                  href={`/mission/${activeMission.id}`}
                  className="panel group flex items-center gap-3 p-4 transition-all hover:border-amber/40 hover:shadow-hud-amber"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-lg border border-amber/40 bg-amber/5">
                    <Crosshair className="h-5 w-5 text-amber" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber">{activeMission.code} · {lens ? 'Lensed Objective' : 'Active Objective'}</div>
                    <div className="truncate font-display text-sm uppercase tracking-[0.06em] text-ink">{activeMission.name}</div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-ink-dim transition-transform group-hover:translate-x-0.5 group-hover:text-amber" />
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── MISSION LENS BANNER ─────────────────────────── */}
      {lens && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="panel flex flex-wrap items-center gap-3 border-amber/40 bg-amber/5 p-3 shadow-hud-amber"
        >
          <Target className="h-4 w-4 text-amber" />
          <span className="font-mono text-xs text-ink">
            Mission lens active — spotlighting units for <span className="text-amber">{lens.name}</span>
          </span>
          <button onClick={() => setLensMissionId(null)} className="btn btn-ghost ml-auto text-[10px]">
            Clear lens
          </button>
        </motion.div>
      )}

      {/* ── BAYS + UNITS ─────────────────────────────────── */}
      {data.bays.map((bay) => {
        const units = data.units.filter((u) => u.bay === bay.id);
        if (!units.length) return null;
        return (
          <section key={bay.id}>
            <div className="mb-3 flex items-center gap-3">
              <Link href={`/bay/${bay.id}`} className="group flex items-center gap-3">
                <span className={clsx('font-mono text-[10px] tracking-[0.3em]', bay.accent === 'amber' ? 'text-amber/70' : 'text-cyan/70')}>
                  {bay.code}
                </span>
                <h2 className="font-display text-sm uppercase tracking-[0.2em] text-ink group-hover:text-glow-cyan">{bay.name}</h2>
                <span className="font-mono text-[10px] text-ink-dim">{bay.tagline}</span>
              </Link>
              <div className="h-px flex-1 bg-gradient-to-r from-rim to-transparent" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {units.map((u, i) => (
                <UnitCard key={u.id} unit={u} index={i} dim={spotlightUnits.size > 0 && !spotlightUnits.has(u.id)} />
              ))}
            </div>
          </section>
        );
      })}

      {/* ── NEXT UPGRADES ────────────────────────────────── */}
      {buyNext.length > 0 && (
        <section>
          <SectionTitle code="QM">Next Upgrade Candidates</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {buyNext.map((w) => {
              const cap = w.unlocks;
              const fu = w.forUnit ? unit(w.forUnit) : undefined;
              return (
                <Link
                  key={w.id}
                  href="/quartermaster"
                  className="panel group flex items-center gap-4 p-4 transition-all hover:border-cyan/40 hover:shadow-hud-cyan"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-lg border border-cyan/40 bg-cyan/5">
                    <Zap className="h-5 w-5 text-cyan" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm uppercase tracking-[0.06em] text-ink">{w.name}</div>
                    <div className="font-mono text-[10px] text-ink-dim">
                      {fu ? `for ${fu.name}` : w.category}
                      {cap && <span className="text-cyan"> · unlocks {cap.replace(/-/g, ' ')}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm tabular-nums text-amber">{money(w.price.us)}</div>
                    {w.price.import != null && <div className="font-mono text-[10px] text-ink-dim">imp {money(w.price.import)}</div>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── CONSTRAINTS GAUGES ───────────────────────── */}
      {activeMission && (
        <section>
          <SectionTitle code={activeMission.code}>{activeMission.name} · Constraints</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            {constraints.map((g, i) => (
              <Gauge key={g.label} gauge={g} delay={i * 0.1} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
