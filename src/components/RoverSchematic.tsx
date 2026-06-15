'use client';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useHangar } from '@/lib/store';

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

export function RoverSchematic() {
  const { unit } = useHangar();
  const beast = unit('beast');
  const hotspots = beast?.hotspots ?? [];

  const loadout = beast?.loadout ?? [];

  const [active, setActive] = useState<string | null>('lighting');
  const [flavor, setFlavor] = useState<'blueprint' | 'solid' | 'abstract'>('blueprint');
  const sel = hotspots.find((h) => h.id === active) ?? null;

  const getStatus = (hid: string): 'ok' | 'empty' | 'attention' => {
    const mapped = loadout.filter(s => s.hotspotId === hid);
    if (mapped.length === 0) return 'empty';
    const allFilled = mapped.every(s => s.filledBy !== null);
    const noneFilled = mapped.every(s => s.filledBy === null);
    if (allFilled) return 'ok';
    if (noneFilled) return 'empty';
    return 'attention';
  };
  const selectedStatus = sel ? getStatus(sel.id) : null;
  const selectedSlots = sel ? loadout.filter((s) => s.hotspotId === sel.id) : [];

  return (
    <div className="relative max-w-full overflow-hidden rounded-lg border border-rim bg-void/60 blueprint-grid corner-bracket">
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

            {/* chassis body flavors */}
            {flavor === 'blueprint' && (
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

            {flavor === 'solid' && (
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

            {flavor === 'abstract' && (
              <g stroke="var(--color-cyan)" strokeWidth="0.2" fill="none" opacity="0.6">
                {/* Structural connection lines between hotspots */}
                <path d="M 30 19 L 50 54 L 50 79 M 50 54 L 40 48 M 50 54 L 64 40" strokeDasharray="1 1.5" />
                {/* Abstract radar/topology rings */}
                <circle cx="50" cy="50" r="30" stroke="var(--color-rim)" strokeWidth="0.1" strokeDasharray="0.5 2" />
                <circle cx="50" cy="50" r="20" stroke="var(--color-rim)" strokeWidth="0.1" strokeDasharray="0.5 2" />
                <circle cx="50" cy="50" r="10" stroke="var(--color-rim)" strokeWidth="0.1" strokeDasharray="0.5 2" />
              </g>
            )}

            {/* hotspots */}
            {hotspots.map((h) => {
              const isActive = h.id === active;
              const status = getStatus(h.id);
              return (
                <g
                  key={h.id}
                  className="cursor-pointer"
                  onClick={() => setActive(h.id)}
                  onMouseEnter={() => setActive(h.id)}
                >
                  {isActive && (
                    <circle cx={h.x} cy={h.y} r="4.5" className={clsx(RING[status], 'fill-none')} strokeWidth="0.4" strokeOpacity="0.6">
                      <animate attributeName="r" values="3.2;5;3.2" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle cx={h.x} cy={h.y} r={isActive ? 2 : 1.5} className={clsx(DOT[status])} />
                  <circle cx={h.x} cy={h.y} r="3" className={clsx(RING[status], 'fill-none')} strokeWidth="0.3" strokeOpacity="0.5" />
                </g>
              );
            })}
          </svg>
        </div>

        {/* readout panel */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan/70">Exploded View</div>
            <div className="flex gap-1.5">
              {(['blueprint', 'solid', 'abstract'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFlavor(f)}
                  className={clsx(
                    "px-1.5 py-0.5 font-mono text-[9px] uppercase border rounded transition-colors",
                    flavor === f ? "border-cyan/50 text-cyan bg-cyan/10" : "border-rim/50 text-ink-dim hover:text-ink hover:border-rim"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
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
            )})}
          </div>

          {sel && selectedStatus && (
            <motion.div
              key={sel.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="panel-inset mt-auto min-w-0 p-3"
            >
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
              <div className="mt-3 space-y-2">
                {selectedSlots.length > 0 ? selectedSlots.map(s => (
                  <div key={s.slot} className="flex justify-between font-mono text-[11px] leading-tight">
                    <span className="text-ink-dim truncate pr-2">{s.slot}</span>
                    <span className={clsx("shrink-0", s.filledBy ? "text-cyan" : "text-signal-warn")}>
                      {s.filledBy ? (unit(s.filledBy)?.name ?? s.filledBy) : 'UNFILLED'}
                    </span>
                  </div>
                )) : (
                  <p className="font-mono text-[11px] leading-relaxed text-ink-dim">No slots mapped to this region.</p>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
