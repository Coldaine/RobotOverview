import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, Cpu, Gauge as GaugeIcon, Layers, Lightbulb, Target } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { RoverSchematic } from '../components/RoverSchematic';
import { StatusBadge, Tag, ProvenanceTag } from '../components/ui/Badges';
import { SectionTitle } from '../components/ui/Primitives';
import { useHangar } from '../lib/store';
import { LIFECYCLE_META, money } from '../lib/format';
import clsx from 'clsx';

export function UnitDetail() {
  const { id } = useParams();
  const { unit, mission, insight, capability } = useHangar();
  const u = id ? unit(id) : undefined;

  if (!u) {
    return (
      <div className="panel p-8 text-center">
        <p className="font-mono text-sm text-ink-dim">Unit not found.</p>
        <Link to="/" className="btn btn-ghost mt-4 inline-flex">
          <ArrowLeft className="h-3 w-3" /> Back to Hangar
        </Link>
      </div>
    );
  }

  const missions = (u.missions ?? []).map(mission).filter(Boolean);
  const insights = (u.insights ?? []).map(insight).filter(Boolean);
  const caps = (u.capabilities ?? []).map(capability).filter(Boolean);

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim transition-colors hover:text-cyan">
        <ArrowLeft className="h-3 w-3" /> Hangar
      </Link>

      {/* header */}
      <header className="panel relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-radial-glow opacity-40" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] tracking-[0.3em] text-cyan/70">{u.callsign ?? u.class}</div>
            <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.06em] text-glow-cyan sm:text-3xl">{u.name}</h1>
            <p className="mt-2 max-w-2xl font-mono text-xs leading-relaxed text-ink-dim">{u.summary}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={u.status} />
            <ProvenanceTag provenance={u.provenance} />
            <span className="chip border-rim bg-panel-2/40 text-ink-dim">{LIFECYCLE_META[u.lifecycle].label}</span>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* schematic for the flagship rover */}
          {u.id === 'beast' && (
            <section>
              <SectionTitle code="EXPLODED">Subsystem Map</SectionTitle>
              <RoverSchematic />
            </section>
          )}

          {/* specs */}
          <section>
            <SectionTitle code="SPEC"><span className="inline-flex items-center gap-2"><Cpu className="h-3.5 w-3.5 text-cyan" /> Specifications</span></SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              {u.specs.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="panel-inset flex items-center justify-between px-3 py-2"
                >
                  <span className="hud-label">{s.label}</span>
                  <span className="font-mono text-xs text-ink">{s.value}</span>
                </motion.div>
              ))}
            </div>
          </section>

          {/* loadout */}
          {u.loadout && u.loadout.length > 0 && (
            <section>
              <SectionTitle code="SLOTS"><span className="inline-flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-amber" /> Loadout Configuration</span></SectionTitle>
              <div className="space-y-4">
                {(() => {
                  const grouped = u.loadout.reduce((acc, slot) => {
                    const g = slot.group || 'Uncategorized';
                    if (!acc[g]) acc[g] = [];
                    acc[g].push(slot);
                    return acc;
                  }, {} as Record<string, typeof u.loadout>);

                  return Object.entries(grouped).map(([groupName, slots]) => (
                    <div key={groupName} className="space-y-2">
                      {groupName !== 'Uncategorized' && (
                        <div className="font-mono text-[10px] uppercase tracking-widest text-cyan/70 border-b border-rim/50 pb-1 mb-2">{groupName}</div>
                      )}
                      <div className="space-y-2">
                        {slots.map((slot) => {
                          const filled = !!slot.filledBy;
                          return (
                            <div
                              key={slot.slot}
                              className={clsx(
                                'flex items-center gap-3 rounded-md border px-3 py-2.5',
                                filled ? 'border-rim bg-panel-2/30' : 'border-signal-warn/30 bg-signal-warn/5',
                              )}
                            >
                              <span className={clsx('h-2 w-2 shrink-0 rounded-full', filled ? 'bg-signal-ok' : 'bg-signal-warn animate-pulse-trace')} />
                              <div className="w-32 shrink-0 font-mono text-[11px] uppercase tracking-wider text-ink truncate">{slot.slot}</div>
                              <div className="min-w-0 flex-1 font-mono text-[11px] text-ink-dim truncate">
                                {filled ? (
                                  <span className="text-cyan">{unit(slot.filledBy!)?.name ?? slot.filledBy}</span>
                                ) : (
                                  <span className="text-signal-warn">UNFILLED</span>
                                )}
                                {slot.note && <span className="text-ink-dim hidden sm:inline"> — {slot.note}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </section>
          )}

          {/* insights */}
          {insights.length > 0 && (
            <section>
              <SectionTitle code="CODEX"><span className="inline-flex items-center gap-2"><Lightbulb className="h-3.5 w-3.5 text-amber" /> Field Insights</span></SectionTitle>
              <div className="space-y-2">
                {insights.map((ins) => (
                  <Link key={ins!.id} to="/codex" className="panel block p-3 transition-all hover:border-cyan/40">
                    <div className="font-display text-xs uppercase tracking-[0.08em] text-ink">{ins!.title}</div>
                    <p className="mt-1 font-mono text-[11px] leading-relaxed text-ink-dim">{ins!.body}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* right rail */}
        <div className="space-y-4">
          {/* vitals */}
          <div className="panel p-4">
            <SectionTitle code="VITALS"><span className="inline-flex items-center gap-2"><GaugeIcon className="h-3.5 w-3.5 text-cyan" /> Vitals</span></SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {u.power?.watts != null && (
                <div className="panel-inset px-3 py-2">
                  <div className="hud-label">Power</div>
                  <div className="mt-0.5 font-mono text-sm text-amber">{u.power.watts}W</div>
                  {u.power.rail && <div className="font-mono text-[10px] text-ink-dim">{u.power.rail}</div>}
                </div>
              )}
              {u.massGrams != null && (
                <div className="panel-inset px-3 py-2">
                  <div className="hud-label">Mass</div>
                  <div className="mt-0.5 font-mono text-sm text-ink">{u.massGrams}g</div>
                </div>
              )}
              {u.price?.us != null && (
                <div className="panel-inset px-3 py-2">
                  <div className="hud-label">US Price</div>
                  <div className="mt-0.5 font-mono text-sm text-cyan">{money(u.price.us)}</div>
                </div>
              )}
              {u.price?.import != null && (
                <div className="panel-inset px-3 py-2">
                  <div className="hud-label">Import</div>
                  <div className="mt-0.5 font-mono text-sm text-ink">{money(u.price.import)}</div>
                </div>
              )}
              {u.acquired && (
                <div className="panel-inset px-3 py-2">
                  <div className="hud-label">Acquired</div>
                  <div className="mt-0.5 font-mono text-sm text-ink">{u.acquired}</div>
                </div>
              )}
              {u.horizon && (
                <div className="panel-inset px-3 py-2">
                  <div className="hud-label">Horizon</div>
                  <div className="mt-0.5 font-mono text-[11px] text-amber">{u.horizon}</div>
                </div>
              )}
            </div>
          </div>

          {/* capabilities */}
          {caps.length > 0 && (
            <div className="panel p-4">
              <SectionTitle code="CAP">Grants</SectionTitle>
              <div className="space-y-1.5">
                {caps.map((c) => (
                  <Link key={c!.id} to="/tech-tree" className="flex items-center gap-2 rounded-md border border-rim/60 bg-panel-2/30 px-3 py-2 transition-colors hover:border-cyan/40">
                    <span className={clsx('h-1.5 w-1.5 rounded-full', c!.unlocked ? 'bg-signal-ok' : 'bg-ink-dim')} />
                    <span className="font-mono text-[11px] text-ink">{c!.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* missions */}
          {missions.length > 0 && (
            <div className="panel p-4">
              <SectionTitle code="MSN"><span className="inline-flex items-center gap-2"><Target className="h-3.5 w-3.5 text-amber" /> Assigned</span></SectionTitle>
              <div className="space-y-1.5">
                {missions.map((m) => (
                  <Link key={m!.id} to={`/mission/${m!.id}`} className="flex items-center justify-between rounded-md border border-rim/60 bg-panel-2/30 px-3 py-2 transition-colors hover:border-amber/40">
                    <span className="font-mono text-[11px] text-ink">{m!.name}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-amber">{m!.status}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* tags + links */}
          {(u.tags?.length || u.links?.length) && (
            <div className="panel p-4">
              {u.tags && u.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {u.tags.map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              )}
              {u.links && u.links.length > 0 && (
                <div className="mt-3 space-y-1">
                  {u.links.map((l) => (
                    <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-mono text-[11px] text-cyan hover:underline">
                      <ExternalLink className="h-3 w-3" /> {l.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
