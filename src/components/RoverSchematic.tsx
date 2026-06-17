'use client';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useHangar, useCalculatedConstraints } from '@/lib/store';
import { hotspotStatus } from '@/lib/schematic';
import { WiringDiagram } from './WiringDiagram';

const DOT: Record<'ok' | 'empty' | 'attention', string> = {
  ok: 'fill-signal-ok',
  empty: 'fill-signal-warn',
  attention: 'fill-amber',
};
const RING: Record<'ok' | 'empty' | 'attention', string> = {
  ok: 'stroke-signal-ok',
  empty: 'stroke-signal-warn',
  attention: 'stroke-amber',
};

// Monospaced Hex code cascade overlay component
function HexCascade() {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    const interval = setInterval(() => {
      const chars = '0123456789ABCDEF';
      let line = '';
      for (let i = 0; i < 5; i++) {
        line += chars[Math.floor(Math.random() * 16)] + chars[Math.floor(Math.random() * 16)] + ' ';
      }
      setLines((prev) => [...prev.slice(-9), line]);
    }, 60);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 bg-void/90 flex flex-col justify-end p-3 font-mono text-[9px] text-cyan overflow-hidden z-20 rounded-md">
      <div className="space-y-0.5">
        {lines.map((l, i) => (
          <div key={i} className="opacity-80">{l}</div>
        ))}
        <div className="text-signal-ok font-bold border-t border-cyan/30 pt-1 mt-1">
          [SYS_SLOT_OK]
        </div>
      </div>
    </div>
  );
}

export function RoverSchematic() {
  const { unit, theme, openDrawer, updateSlot, data, lensMissionId } = useHangar();
  const beast = unit('beast');
  const hotspots = useMemo(() => beast?.hotspots ?? [], [beast?.hotspots]);
  const loadout = useMemo(() => beast?.loadout ?? [], [beast?.loadout]);

  const [active, setActive] = useState<string | null>('lighting');
  const sel = hotspots.find((h) => h.id === active) ?? null;

  // Equip animations states
  const [showEquipAnimation, setShowEquipAnimation] = useState(false);
  const prevLoadoutRef = useRef<Record<string, string | null>>({});

  useEffect(() => {
    const prev = prevLoadoutRef.current;
    let newlySlotted = false;

    loadout.forEach((s) => {
      if (s.filledBy && prev[s.slot] == null) {
        newlySlotted = true;
      }
      prev[s.slot] = s.filledBy;
    });

    if (newlySlotted) {
      setShowEquipAnimation(true);
      const timer = setTimeout(() => setShowEquipAnimation(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [loadout]);

  const getStatus = (hid: string) => hotspotStatus(loadout, hid);
  const selectedStatus = sel ? getStatus(sel.id) : null;
  const selectedSlots = sel ? loadout.filter((s) => s.hotspotId === sel.id) : [];

  // Determine overload states
  const primaryMission = data.missions.find((m) => m.status === 'active') ?? data.missions[0];
  const activeMissionId = lensMissionId ?? primaryMission?.id ?? '';
  const constraints = useCalculatedConstraints(activeMissionId);
  const isOverloaded = constraints.some(c => c.value > c.budget);

  return (
    <motion.div
      className={clsx(
        "relative max-w-full overflow-hidden rounded-lg border bg-void/60 blueprint-grid corner-bracket",
        theme === 'industrial' ? 'border-gray-300' : 'border-rim',
        theme === 'blueprint' && isOverloaded && 'voltage-drop-active'
      )}
      animate={theme === 'industrial' && showEquipAnimation ? {
        scale: [1, 0.96, 1.04, 1],
        rotate: [0, -0.4, 0.4, 0]
      } : {}}
      transition={{ duration: 0.22, ease: "easeInOut" }}
    >
      {/* scanning sweep */}
      <div className="pointer-events-none absolute inset-0 animate-sweep [mask:linear-gradient(180deg,transparent,transparent_70%,rgba(54,224,224,0.25))]" />

      <div className="relative grid min-w-0 gap-4 p-4 sm:p-5 md:grid-cols-[1.4fr_1fr]">
        {/* SVG schematic */}
        <div className="relative min-w-0 aspect-[4/3] md:min-h-[320px]">
          <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            {/* connecting comms arc to base station */}
            <defs>
              <linearGradient id="commsArc" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--color-cyan)" stopOpacity="0" />
                <stop offset="100%" stopColor="var(--color-cyan)" stopOpacity="0.9" />
              </linearGradient>
            </defs>
            <path
              d="M 50 30 Q 80 6 96 14"
              fill="none"
              stroke="url(#commsArc)"
              strokeWidth="0.5"
              strokeDasharray="2 2"
              className="animate-dash"
            />
            <circle cx="96" cy="14" r="1.6" className="fill-cyan animate-pulse-trace" />
            <text x="92" y="10" className="fill-cyan font-mono" fontSize="2.4" textAnchor="end">
              CORE-PRIME
            </text>

            {/* chassis body — rendered per active theme */}
            {theme === 'blueprint' && (
              <g stroke="var(--color-rim)" strokeWidth="0.4" fill="var(--color-panel)">
                <rect x="22" y="72" width="56" height="14" rx="3" fill="var(--color-void)" />
                <rect x="24" y="74" width="52" height="10" rx="2" fill="var(--color-hull)" stroke="var(--color-cyan)" strokeOpacity="0.25" />
                {[28, 38, 48, 58, 68].map((cx) => (
                  <circle key={cx} cx={cx} cy="79" r="2.6" fill="var(--color-void)" stroke="var(--color-rim)" />
                ))}
                <rect x="30" y="40" width="40" height="30" rx="2.5" fill="var(--color-panel)" />
                <rect x="34" y="44" width="32" height="22" rx="1.5" fill="var(--color-hull)" stroke="var(--color-cyan)" strokeOpacity="0.2" />
                <rect x="40" y="48" width="20" height="12" rx="1" fill="var(--color-panel)" stroke="var(--color-amber)" strokeOpacity="0.3" />
                <rect x="27" y="20" width="6" height="20" rx="1" fill="var(--color-panel)" />
                <rect x="25" y="16" width="10" height="6" rx="1" fill="var(--color-panel)" stroke="var(--color-amber)" strokeOpacity="0.3" />
                <circle cx="64" cy="40" r="3" fill="var(--color-panel)" stroke="var(--color-cyan)" strokeOpacity="0.3" />
                <line x1="64" y1="40" x2="70" y2="28" stroke="var(--color-rim)" strokeWidth="1.4" />
                <line x1="70" y1="28" x2="78" y2="24" stroke="var(--color-rim)" strokeWidth="1.2" />
                <circle cx="70" cy="28" r="1.4" fill="var(--color-void)" stroke="var(--color-cyan)" strokeOpacity="0.4" />
                <circle cx="78" cy="24" r="1.6" fill="var(--color-void)" stroke="var(--color-amber)" strokeOpacity="0.4" />
              </g>
            )}

            {theme === 'industrial' && (
              <g stroke="none" fill="var(--color-panel)">
                <rect x="22" y="72" width="56" height="14" rx="3" fill="#111" />
                <rect x="24" y="74" width="52" height="10" rx="2" fill="#222" />
                {[28, 38, 48, 58, 68].map((cx) => (
                  <circle key={cx} cx={cx} cy="79" r="2.6" fill="#000" />
                ))}
                <rect x="30" y="40" width="40" height="30" rx="2.5" fill="#333" />
                <rect x="34" y="44" width="32" height="22" rx="1.5" fill="#1f2937" />
                <rect x="40" y="48" width="20" height="12" rx="1" fill="#4b5563" />
                <rect x="27" y="20" width="6" height="20" rx="1" fill="#333" />
                <rect x="25" y="16" width="10" height="6" rx="1" fill="#1f2937" />
                <circle cx="64" cy="40" r="3" fill="#333" />
                <line x1="64" y1="40" x2="70" y2="28" stroke="#555" strokeWidth="1.8" />
                <line x1="70" y1="28" x2="78" y2="24" stroke="#555" strokeWidth="1.4" />
                <circle cx="70" cy="28" r="1.4" fill="#222" />
                <circle cx="78" cy="24" r="1.6" fill="#111" />
              </g>
            )}

            {theme === 'topology' && (
              <g stroke="var(--color-cyan)" strokeWidth="0.2" fill="none" opacity="0.6">
                {/* Abstract radar/topology rings */}
                <circle cx="50" cy="50" r="30" stroke="var(--color-rim)" strokeWidth="0.1" strokeDasharray="0.5 2" />
                <circle cx="50" cy="50" r="20" stroke="var(--color-rim)" strokeWidth="0.1" strokeDasharray="0.5 2" />
                <circle cx="50" cy="50" r="10" stroke="var(--color-rim)" strokeWidth="0.1" strokeDasharray="0.5 2" />
              </g>
            )}

            {/* Programmatically drawn splines connecting the modules */}
            <WiringDiagram />

            {/* Bleeding concentric wave rings on topology overloaded central node */}
            {theme === 'topology' && isOverloaded && (
              <g>
                <circle cx="50" cy="54" r="3" fill="none" stroke="var(--color-amber)" strokeWidth="0.3">
                  <animate attributeName="r" values="3;16;3" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="50" cy="54" r="3" fill="none" stroke="var(--color-amber)" strokeWidth="0.2">
                  <animate attributeName="r" values="3;26;3" dur="2s" begin="0.67s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" begin="0.67s" repeatCount="indefinite" />
                </circle>
              </g>
            )}

            {/* hotspots */}
            {hotspots.map((h) => {
              const isActive = h.id === active;
              const status = getStatus(h.id);
              const isEmpty = status === 'empty';

              return (
                <g
                  key={h.id}
                  className="cursor-pointer"
                  onClick={() => setActive(h.id)}
                  onMouseEnter={() => setActive(h.id)}
                >
                  {isEmpty ? (
                    <>
                      {theme === 'blueprint' && (
                        // Blinking wireframe box
                        <rect
                          x={h.x - 3}
                          y={h.y - 3}
                          width="6"
                          height="6"
                          fill="none"
                          stroke="var(--color-cyan)"
                          strokeWidth="0.3"
                          strokeDasharray="1.5 1.5"
                          className="animate-pulse"
                        />
                      )}
                      {theme === 'industrial' && (
                        // Exposed mounting rails
                        <g>
                          <line x1={h.x - 4} y1={h.y - 1.2} x2={h.x + 4} y2={h.y - 1.2} stroke="var(--color-rim)" strokeWidth="0.6" />
                          <line x1={h.x - 4} y1={h.y + 1.2} x2={h.x + 4} y2={h.y + 1.2} stroke="var(--color-rim)" strokeWidth="0.6" />
                          <rect x={h.x - 3} y={h.y - 3} width="6" height="6" fill="none" stroke="var(--color-rim)" strokeWidth="0.3" opacity="0.4" />
                        </g>
                      )}
                      {theme === 'topology' && (
                        // Orbiting disconnected sockets
                        <g>
                          <circle cx={h.x} cy={h.y} r="1.5" stroke="var(--color-cyan)" strokeWidth="0.4" fill="none" />
                          <circle cx={h.x} cy={h.y} r="3.5" stroke="var(--color-cyan)" strokeWidth="0.2" strokeDasharray="1 3.5" fill="none">
                            <animateTransform
                              attributeName="transform"
                              type="rotate"
                              from={`0 ${h.x} ${h.y}`}
                              to={`360 ${h.x} ${h.y}`}
                              dur="5s"
                              repeatCount="indefinite"
                            />
                          </circle>
                        </g>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Active hotspot ripple */}
                      {isActive && (
                        <circle cx={h.x} cy={h.y} r="4.5" className={clsx(RING[status], 'fill-none')} strokeWidth="0.4" strokeOpacity="0.6">
                          <animate attributeName="r" values="3.2;5;3.2" dur="2s" repeatCount="indefinite" />
                        </circle>
                      )}
                      {/* Topology special connecting lines seeking spline pulses */}
                      {theme === 'topology' && showEquipAnimation && h.id === sel?.id && (
                        <circle cx={h.x} cy={h.y} r="5.5" stroke="var(--color-cyan)" strokeWidth="0.4" fill="none">
                          <animate attributeName="r" values="1.5;8;1.5" dur="1.2s" repeatCount="1" />
                          <animate attributeName="opacity" values="1;0;1" dur="1.2s" repeatCount="1" />
                        </circle>
                      )}
                      <circle cx={h.x} cy={h.y} r={isActive ? 2 : 1.5} className={clsx(DOT[status])} />
                      <circle cx={h.x} cy={h.y} r="3" className={clsx(RING[status], 'fill-none')} strokeWidth="0.3" strokeOpacity="0.5" />
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* readout panel */}
        <div className="flex min-w-0 flex-col gap-3 relative">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan/70">Exploded View</div>
          <div className="grid grid-cols-2 gap-1.5">
            {hotspots.map((h) => {
              const status = getStatus(h.id);
              return (
                <button
                  key={h.id}
                  onClick={() => setActive(h.id)}
                  className={clsx(
                    'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left font-mono text-[10px] transition-all',
                    h.id === active
                      ? 'border-cyan/50 bg-cyan/10 text-ink'
                      : 'border-rim/60 bg-panel-2/30 text-ink-dim hover:border-rim hover:text-ink',
                  )}
                >
                  <span
                    className={clsx(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      status === 'ok' && 'bg-signal-ok',
                      status === 'empty' && 'bg-signal-warn',
                      status === 'attention' && 'bg-amber',
                    )}
                  />
                  <span className="truncate">{h.label}</span>
                </button>
              )
            })}
          </div>

          {sel && selectedStatus && (
            <motion.div
              key={sel.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="panel-inset mt-auto min-w-0 p-3 relative"
            >
              {/* Hex cascade overlay when socketing on Blueprint theme */}
              {theme === 'blueprint' && showEquipAnimation && <HexCascade />}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 font-display text-sm uppercase tracking-[0.12em] text-ink">{sel.label}</span>
                <span
                  className={clsx(
                    'chip',
                    selectedStatus === 'ok' && 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok',
                    selectedStatus === 'empty' && 'border-signal-warn/40 bg-signal-warn/10 text-signal-warn',
                    selectedStatus === 'attention' && 'border-amber/40 bg-amber/10 text-amber',
                  )}
                >
                  {selectedStatus === 'ok' ? 'NOMINAL' : selectedStatus === 'empty' ? 'UNFILLED' : 'REVIEW'}
                </span>
              </div>
              <div className="mt-3">
                {selectedSlots.length > 0 ? (
                  <>
                    {theme === 'blueprint' && (
                      <div className="space-y-2 font-mono text-[10px]">
                        {selectedSlots.map((s, idx) => (
                          <div key={s.slot} className="flex items-center justify-between border-b border-rim/20 pb-1">
                            <span className="text-ink-dim">0x{idx.toString(16).toUpperCase().padStart(2, '0')}</span>
                            <span className="text-ink truncate max-w-[120px] font-semibold ml-1">{s.slot}</span>
                            {s.filledBy ? (
                              <div className="flex items-center gap-1">
                                <span className="text-cyan truncate max-w-[80px]">{unit(s.filledBy)?.name ?? s.filledBy}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); updateSlot('beast', s.slot, null); }}
                                  className="text-signal-crit hover:underline text-[9px] uppercase cursor-pointer"
                                >
                                  [CLR]
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); openDrawer('beast', s.slot); }}
                                className="text-signal-warn hover:underline text-[9px] uppercase cursor-pointer"
                              >
                                [LOAD]
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {theme === 'industrial' && (
                      <div className="space-y-1 font-mono text-[11px] border border-rim/40 rounded-sm overflow-hidden">
                        {selectedSlots.map((s, idx) => (
                          <div
                            key={s.slot}
                            className={clsx(
                              "flex items-center justify-between px-2 py-1.5",
                              idx % 2 === 0 ? "bg-panel/30" : "bg-panel-2/40"
                            )}
                          >
                            <span className="text-ink truncate max-w-[140px]">{s.slot}</span>
                            {s.filledBy ? (
                              <div className="flex items-center gap-2">
                                <span className="text-cyan font-bold">{unit(s.filledBy)?.name ?? s.filledBy}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); updateSlot('beast', s.slot, null); }}
                                  className="px-1.5 py-0.5 text-[9px] border border-signal-crit/30 bg-signal-crit/5 text-signal-crit hover:bg-signal-crit/20 rounded-sm cursor-pointer"
                                >
                                  Unslot
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); openDrawer('beast', s.slot); }}
                                className="px-1.5 py-0.5 text-[9px] border border-amber/30 bg-amber/5 text-amber hover:bg-amber/20 rounded-sm cursor-pointer"
                              >
                                Equip
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {theme === 'topology' && (
                      <div className="space-y-2">
                        {selectedSlots.map((s) => (
                          <div
                            key={s.slot}
                            className="flex items-center justify-between p-2.5 rounded-lg border border-rim/45 bg-panel-2/20 hover:border-cyan/35 transition-colors"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="font-mono text-[10px] text-ink-dim uppercase tracking-wider">{s.slot}</div>
                              <div className="font-display text-xs font-bold text-ink truncate mt-0.5">
                                {s.filledBy ? (unit(s.filledBy)?.name ?? s.filledBy) : 'UNFILLED'}
                              </div>
                            </div>
                            {s.filledBy ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); updateSlot('beast', s.slot, null); }}
                                className="text-[10px] font-mono font-bold text-signal-crit hover:underline cursor-pointer"
                              >
                                Unequip
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); openDrawer('beast', s.slot); }}
                                className="text-[10px] font-mono font-bold text-cyan hover:underline cursor-pointer"
                              >
                                Equip
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="font-mono text-[11px] leading-relaxed text-ink-dim">No slots mapped to this region.</p>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
