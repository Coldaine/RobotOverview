'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  Copy,
  Cpu,
  ExternalLink,
  Gauge as GaugeIcon,
  Layers,
  Lightbulb,
  Monitor,
  Radio,
  Target,
  Terminal,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RoverSchematic } from '@/components/RoverSchematic';
import { ConnectedTwin } from '@/components/board/ConnectedTwin';
import { StatusBadge, Tag, ProvenanceTag } from '@/components/ui/Badges';
import { SectionTitle } from '@/components/ui/Primitives';
import { useHangar } from '@/lib/store';
import { LIFECYCLE_META, money } from '@/lib/format';
import type { UnitShortcut } from '@/data/types';
import clsx from 'clsx';

function ShortcutIcon({ shortcut }: { shortcut: UnitShortcut }) {
  if (shortcut.type === 'command') return <Terminal className="h-3.5 w-3.5" />;
  if (shortcut.id === 'jupyterlab') return <BookOpen className="h-3.5 w-3.5" />;
  if (shortcut.id === 'camera-stream') return <Camera className="h-3.5 w-3.5" />;
  return <Monitor className="h-3.5 w-3.5" />;
}

function shortcutValue(shortcut: UnitShortcut) {
  return shortcut.type === 'url' ? shortcut.url : shortcut.command;
}

export default function UnitDetail() {
  const [copiedShortcutId, setCopiedShortcutId] = useState<string | null>(null);
  const copiedShortcutTimeoutRef = useRef<number | null>(null);
  const params = useParams();
  const id = params?.id as string | undefined;
  const { unit, mission, insight, capability, openDrawer, updateSlot, theme } = useHangar();
  const u = id ? unit(id) : undefined;
  const clearCopiedShortcutTimeout = () => {
    if (copiedShortcutTimeoutRef.current !== null) {
      clearTimeout(copiedShortcutTimeoutRef.current);
      copiedShortcutTimeoutRef.current = null;
    }
  };

  useEffect(() => clearCopiedShortcutTimeout, []);

  if (!u) {
    return (
      <div className="panel p-8 text-center">
        <p className="font-mono text-sm text-ink-dim">Unit not found.</p>
        <Link href="/" className="btn btn-ghost mt-4 inline-flex">
          <ArrowLeft className="h-3 w-3" /> Back to Hangar
        </Link>
      </div>
    );
  }

  const missions = (u.missions ?? []).map(mission).filter(Boolean);
  const insights = (u.insights ?? []).map(insight).filter(Boolean);
  const caps = (u.capabilities ?? []).map(capability).filter(Boolean);
  const isFlagship = Boolean(u.flagship);

  const handleCopyShortcut = async (shortcut: UnitShortcut) => {
    if (shortcut.type !== 'command' || typeof navigator === 'undefined' || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(shortcut.command);
      clearCopiedShortcutTimeout();
      setCopiedShortcutId(shortcut.id);
      copiedShortcutTimeoutRef.current = window.setTimeout(() => {
        setCopiedShortcutId((current) => (current === shortcut.id ? null : current));
        copiedShortcutTimeoutRef.current = null;
      }, 1600);
    } catch {
      setCopiedShortcutId(null);
      clearCopiedShortcutTimeout();
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim transition-colors hover:text-cyan">
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
            {u.monitoredVia && (
              <span
                className="chip border-cyan/30 bg-cyan/5 text-cyan"
                title="Catalog reference only — the Hangar does not control this system."
              >
                <Radio className="h-3 w-3" /> {u.monitoredVia} · ref
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          {/* schematic for the flagship rover */}
          {isFlagship && (
            <section>
              <SectionTitle code="EXPLODED">Subsystem Map</SectionTitle>
              <RoverSchematic />
            </section>
          )}

          {/* interactive wiring twin — the full board lives at /board */}
          {isFlagship && (
            <section>
              <SectionTitle code="WIRING">Connected Twin</SectionTitle>
              <Link href="/board" className="group block" aria-label="Open the full wiring board">
                <ConnectedTwin variant="preview" />
                <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-dim transition-colors group-hover:text-cyan">
                  <Layers className="h-3.5 w-3.5" /> Open the Board <ExternalLink className="h-3 w-3" />
                </div>
              </Link>
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
              
              {/* Theme: Blueprint — Raw Terminal / Hex Editor Grid */}
              {theme === 'blueprint' && (() => {
                const grouped = u.loadout.reduce((acc, slot) => {
                  const g = slot.group || 'Uncategorized';
                  if (!acc[g]) acc[g] = [];
                  acc[g].push(slot);
                  return acc;
                }, {} as Record<string, NonNullable<typeof u.loadout>>);
                let globalIdx = 0;
                return (
                  <div className="font-mono text-xs border border-rim/60 bg-void/50 p-4 rounded-md">
                    <div className="grid grid-cols-[60px_140px_1fr_100px] gap-2 border-b border-rim/70 pb-1.5 text-cyan/70 font-semibold uppercase text-[10px] tracking-wider mb-2">
                      <span>[ADDR]</span>
                      <span>SLOT INTERFACE</span>
                      <span>EQUIPPED MODULE</span>
                      <span className="text-right">[ACTION]</span>
                    </div>
                    <div className="space-y-1 divide-y divide-rim/20">
                      {Object.entries(grouped).map(([groupName, slots]) => (
                        <div key={groupName}>
                          {groupName !== 'Uncategorized' && (
                            <div className="col-span-4 font-mono text-[9px] uppercase tracking-widest text-cyan/50 pt-2 pb-1">
                              {`// ${groupName}`}
                            </div>
                          )}
                          {slots.map((slot) => {
                            const idx = globalIdx++;
                            const filledBy = slot.filledBy;
                            const filledUnit = filledBy ? unit(filledBy) : undefined;
                            return (
                              <div key={slot.slot} className="grid grid-cols-[60px_140px_1fr_100px] gap-2 py-2 items-center">
                                <span className="text-ink-dim font-mono">0x{idx.toString(16).toUpperCase().padStart(2, '0')}</span>
                                <span className="text-ink truncate font-bold uppercase text-[10px] tracking-wider">{slot.slot}</span>
                                <div className="min-w-0">
                                  {filledBy ? (
                                    <span className="text-cyan font-bold truncate block">{filledUnit?.name ?? filledBy}</span>
                                  ) : (
                                    <span className="text-signal-warn font-semibold block">UNFILLED</span>
                                  )}
                                  {slot.note && <span className="text-[10px] text-ink-dim block mt-0.5 truncate">{slot.note}</span>}
                                </div>
                                <div className="text-right">
                                  {filledBy ? (
                                    <button
                                      onClick={() => updateSlot(u.id, slot.slot, null)}
                                      className="px-2 py-0.5 rounded border border-signal-crit/45 bg-signal-crit/10 text-signal-crit hover:bg-signal-crit/20 text-[9px] uppercase font-mono cursor-pointer transition-all"
                                    >
                                      UNSLOT
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openDrawer(u.id, slot.slot)}
                                      className="px-2 py-0.5 rounded border border-cyan/45 bg-cyan/10 text-cyan hover:bg-cyan/20 text-[9px] uppercase font-mono cursor-pointer transition-all"
                                    >
                                      LOAD
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Theme: Industrial — Alternating Ledger Table */}
              {theme === 'industrial' && (() => {
                const grouped = u.loadout.reduce((acc, slot) => {
                  const g = slot.group || 'Uncategorized';
                  if (!acc[g]) acc[g] = [];
                  acc[g].push(slot);
                  return acc;
                }, {} as Record<string, NonNullable<typeof u.loadout>>);
                let rowIdx = 0;
                return (
                  <table className="w-full text-left font-mono text-xs border border-rim">
                    <thead>
                      <tr className="border-b border-rim text-ink bg-panel-2/50 text-[10px] uppercase tracking-wider">
                        <th className="py-2 px-3">Slot Details</th>
                        <th className="py-2 px-3">Equipped Unit</th>
                        <th className="py-2 px-3">Note / Constraints</th>
                        <th className="py-2 px-3 text-right">Operation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(grouped).map(([groupName, slots]) => (
                        <Fragment key={groupName}>
                          {groupName !== 'Uncategorized' && (
                            <tr className="bg-panel-2/60 border-b border-rim/40">
                              <td colSpan={4} className="px-3 py-1 font-mono text-[9px] uppercase tracking-widest text-cyan/60">
                                {groupName}
                              </td>
                            </tr>
                          )}
                          {slots.map((slot) => {
                            const i = rowIdx++;
                            const filledBy = slot.filledBy;
                            const filledUnit = filledBy ? unit(filledBy) : undefined;
                            return (
                              <tr
                                key={slot.slot}
                                className={clsx(
                                  'hover:bg-amber/10 border-b border-rim/30 transition-colors',
                                  i % 2 === 0 ? 'bg-panel/30' : 'bg-panel-2/40'
                                )}
                              >
                                <td className="py-2.5 px-3 font-semibold text-ink uppercase tracking-wider">{slot.slot}</td>
                                <td className="py-2.5 px-3">
                                  {filledBy ? (
                                    <span className="text-cyan font-bold">{filledUnit?.name ?? filledBy}</span>
                                  ) : (
                                    <span className="text-signal-warn font-semibold">UNFILLED</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-ink-dim truncate max-w-xs">{slot.note || '—'}</td>
                                <td className="py-2.5 px-3 text-right">
                                  {filledBy ? (
                                    <button
                                      onClick={() => updateSlot(u.id, slot.slot, null)}
                                      className="px-2 py-1 bg-signal-crit/15 hover:bg-signal-crit/30 text-signal-crit border border-signal-crit/30 rounded uppercase tracking-wider text-[9px] font-bold cursor-pointer transition-all"
                                    >
                                      Unequip
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openDrawer(u.id, slot.slot)}
                                      className="px-2 py-1 bg-amber/15 hover:bg-amber/30 text-amber border border-amber/30 rounded uppercase tracking-wider text-[9px] font-bold cursor-pointer transition-all"
                                    >
                                      Equip
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                );
              })()}

              {/* Theme: Topology — Floating Modern Card Grid */}
              {theme === 'topology' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {u.loadout.map((slot) => {
                    const filledBy = slot.filledBy;
                    const filledUnit = filledBy ? unit(filledBy) : undefined;
                    return (
                      <div
                        key={slot.slot}
                        className={clsx(
                          'panel p-4 flex flex-col justify-between transition-all border',
                          filledBy ? 'border-rim bg-panel-2/30 hover:border-cyan/40 hover:shadow-hud-cyan' : 'border-signal-warn/30 bg-signal-warn/5 hover:border-signal-warn/60'
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className={clsx('h-2 w-2 rounded-full', filledBy ? 'bg-signal-ok' : 'bg-signal-warn animate-pulse-trace')} />
                            <span className="font-mono text-[9px] uppercase tracking-wider text-ink-dim">{slot.group || 'System'}</span>
                          </div>
                          <h4 className="font-display text-sm font-bold uppercase tracking-wider text-ink">{slot.slot}</h4>
                          <p className="font-mono text-xs text-ink-dim mt-1">
                            {filledBy ? (
                              <span>Equipped: <span className="text-cyan font-semibold">{filledUnit?.name ?? filledBy}</span></span>
                            ) : (
                              <span className="text-signal-warn font-semibold">Empty Slot</span>
                            )}
                          </p>
                          {slot.note && <p className="font-mono text-[10px] text-ink-dim/80 mt-1.5 italic">Note: {slot.note}</p>}
                        </div>
                        <div className="mt-4 pt-3 border-t border-rim/40 flex justify-end">
                          {filledBy ? (
                            <button
                              onClick={() => updateSlot(u.id, slot.slot, null)}
                              className="text-xs font-mono font-bold text-signal-crit hover:underline cursor-pointer"
                            >
                              Unequip Module
                            </button>
                          ) : (
                            <button
                              onClick={() => openDrawer(u.id, slot.slot)}
                              className="text-xs font-mono font-bold text-cyan hover:underline cursor-pointer"
                            >
                              Equip Module &rarr;
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* insights */}
          {insights.length > 0 && (
            <section>
              <SectionTitle code="CODEX"><span className="inline-flex items-center gap-2"><Lightbulb className="h-3.5 w-3.5 text-amber" /> Field Insights</span></SectionTitle>
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

        {/* right rail */}
        <div className="min-w-0 space-y-4">
          {/* command shortcuts */}
          {u.shortcuts && u.shortcuts.length > 0 && (
            <div className="panel p-4">
              <SectionTitle code="CMD">
                <span className="inline-flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-amber" /> Command Shortcuts
                </span>
              </SectionTitle>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-2">
                {u.shortcuts.map((shortcut) => {
                  const copied = copiedShortcutId === shortcut.id;
                  return (
                    <div key={shortcut.id} className="panel-inset flex min-w-0 flex-col gap-3 p-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-cyan/30 bg-cyan/10 text-cyan">
                          <ShortcutIcon shortcut={shortcut} />
                        </span>
                        <div className="min-w-0">
                          <div className="font-display text-xs uppercase tracking-[0.08em] text-ink">{shortcut.label}</div>
                          {shortcut.note && <div className="mt-0.5 font-mono text-[10px] leading-snug text-ink-dim">{shortcut.note}</div>}
                        </div>
                      </div>

                      <code className="block min-h-8 break-all rounded border border-rim/50 bg-void/45 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-cyan/90">
                        {shortcutValue(shortcut)}
                      </code>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-dim">
                          {shortcut.type === 'url' ? 'External' : 'Command'}
                        </span>
                        {shortcut.type === 'url' ? (
                          <a
                            href={shortcut.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${shortcut.label}`}
                            className="btn btn-ghost h-8 shrink-0 px-2 text-[10px] tracking-[0.12em]"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Copy ${shortcut.label}`}
                            onClick={() => void handleCopyShortcut(shortcut)}
                            className={clsx(
                              'btn btn-ghost h-8 shrink-0 px-2 text-[10px] tracking-[0.12em]',
                              copied && 'border-signal-ok/40 text-signal-ok',
                            )}
                          >
                            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 border-t border-rim/50 pt-3 font-mono text-[10px] leading-relaxed text-ink-dim">
                Supervised launch/copy only. Hangar does not execute robot commands.
              </p>
            </div>
          )}

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
                  <Link key={c!.id} href="/tech-tree" className="flex items-center gap-2 rounded-md border border-rim/60 bg-panel-2/30 px-3 py-2 transition-colors hover:border-cyan/40">
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
                  <Link key={m!.id} href={`/mission/${m!.id}`} className="flex items-center justify-between rounded-md border border-rim/60 bg-panel-2/30 px-3 py-2 transition-colors hover:border-amber/40">
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
                    <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-mono text-[11px] text-cyan hover:underline">
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
