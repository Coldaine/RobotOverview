import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useState } from 'react';

export interface Hotspot {
  id: string;
  label: string;
  detail: string;
  x: number; // % of viewBox 0-100
  y: number;
  status: 'ok' | 'empty' | 'attention';
}

const HOTSPOTS: Hotspot[] = [
  { id: 'arm', label: 'RoArm-M2', detail: '4-DOF manipulator · integral', x: 70, y: 22, status: 'ok' },
  { id: 'sensor', label: 'Sensor Head', detail: 'Camera-only · depth cam candidate', x: 30, y: 24, status: 'attention' },
  { id: 'lighting', label: 'Lighting Mount', detail: 'EMPTY · offset flood needed', x: 18, y: 40, status: 'empty' },
  { id: 'compute', label: 'Compute Bay', detail: 'Raspberry Pi 5 · onboard I/O', x: 50, y: 46, status: 'ok' },
  { id: 'comms', label: 'Comms', detail: 'WiFi 6 link → CORE-PRIME', x: 50, y: 30, status: 'attention' },
  { id: 'power', label: 'Power Pack', detail: '3S Li-ion ~11.1V · battery rail', x: 50, y: 64, status: 'ok' },
  { id: 'chassis', label: 'Track Drive', detail: 'ESP32 PID · all-terrain tracks', x: 50, y: 82, status: 'ok' },
];

const DOT: Record<Hotspot['status'], string> = {
  ok: 'fill-signal-ok',
  empty: 'fill-signal-warn',
  attention: 'fill-amber',
};
const RING: Record<Hotspot['status'], string> = {
  ok: 'stroke-signal-ok',
  empty: 'stroke-signal-warn',
  attention: 'stroke-amber',
};

export function RoverSchematic() {
  const [active, setActive] = useState<string | null>('lighting');
  const sel = HOTSPOTS.find((h) => h.id === active) ?? null;

  return (
    <div className="relative overflow-hidden rounded-lg border border-rim bg-void/60 blueprint-grid corner-bracket">
      {/* scanning sweep */}
      <div className="pointer-events-none absolute inset-0 animate-sweep [mask:linear-gradient(180deg,transparent,transparent_70%,rgba(54,224,224,0.25))]" />

      <div className="relative grid gap-4 p-5 md:grid-cols-[1.4fr_1fr]">
        {/* SVG schematic */}
        <div className="relative">
          <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            {/* connecting comms arc to base station */}
            <defs>
              <linearGradient id="commsArc" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#36e0e0" stopOpacity="0" />
                <stop offset="100%" stopColor="#36e0e0" stopOpacity="0.9" />
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

            {/* chassis body */}
            <g stroke="#2a3550" strokeWidth="0.4" fill="#0e1422">
              {/* tracks */}
              <rect x="22" y="72" width="56" height="14" rx="3" fill="#0b1120" />
              <rect x="24" y="74" width="52" height="10" rx="2" fill="#10182b" stroke="#36e0e0" strokeOpacity="0.25" />
              {/* track wheels */}
              {[28, 38, 48, 58, 68].map((cx) => (
                <circle key={cx} cx={cx} cy="79" r="2.6" fill="#0b1120" stroke="#2a3550" />
              ))}
              {/* main hull */}
              <rect x="30" y="40" width="40" height="30" rx="2.5" fill="#0f1626" />
              <rect x="34" y="44" width="32" height="22" rx="1.5" fill="#0c1320" stroke="#36e0e0" strokeOpacity="0.2" />
              {/* compute board */}
              <rect x="40" y="48" width="20" height="12" rx="1" fill="#101a2e" stroke="#ffb020" strokeOpacity="0.3" />
              {/* sensor mast */}
              <rect x="27" y="20" width="6" height="20" rx="1" fill="#0f1626" />
              <rect x="25" y="16" width="10" height="6" rx="1" fill="#101a2e" stroke="#ffb020" strokeOpacity="0.3" />
              {/* arm base + segments */}
              <circle cx="64" cy="40" r="3" fill="#101a2e" stroke="#36e0e0" strokeOpacity="0.3" />
              <line x1="64" y1="40" x2="70" y2="28" stroke="#2a3550" strokeWidth="1.4" />
              <line x1="70" y1="28" x2="78" y2="24" stroke="#2a3550" strokeWidth="1.2" />
              <circle cx="70" cy="28" r="1.4" fill="#0b1120" stroke="#36e0e0" strokeOpacity="0.4" />
              <circle cx="78" cy="24" r="1.6" fill="#0b1120" stroke="#ffb020" strokeOpacity="0.4" />
            </g>

            {/* hotspots */}
            {HOTSPOTS.map((h) => {
              const isActive = h.id === active;
              return (
                <g
                  key={h.id}
                  className="cursor-pointer"
                  onClick={() => setActive(h.id)}
                  onMouseEnter={() => setActive(h.id)}
                >
                  {isActive && (
                    <circle cx={h.x} cy={h.y} r="4.5" className={clsx(RING[h.status], 'fill-none')} strokeWidth="0.4" strokeOpacity="0.6">
                      <animate attributeName="r" values="3.2;5;3.2" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle cx={h.x} cy={h.y} r={isActive ? 2 : 1.5} className={clsx(DOT[h.status])} />
                  <circle cx={h.x} cy={h.y} r="3" className={clsx(RING[h.status], 'fill-none')} strokeWidth="0.3" strokeOpacity="0.5" />
                </g>
              );
            })}
          </svg>
        </div>

        {/* readout panel */}
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan/70">Exploded View · Tap a subsystem</div>
          <div className="grid grid-cols-2 gap-1.5">
            {HOTSPOTS.map((h) => (
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
                    h.status === 'ok' && 'bg-signal-ok',
                    h.status === 'empty' && 'bg-signal-warn',
                    h.status === 'attention' && 'bg-amber',
                  )}
                />
                <span className="truncate">{h.label}</span>
              </button>
            ))}
          </div>

          {sel && (
            <motion.div
              key={sel.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="panel-inset mt-auto p-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm uppercase tracking-[0.12em] text-ink">{sel.label}</span>
                <span
                  className={clsx(
                    'chip',
                    sel.status === 'ok' && 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok',
                    sel.status === 'empty' && 'border-signal-warn/40 bg-signal-warn/10 text-signal-warn',
                    sel.status === 'attention' && 'border-amber/40 bg-amber/10 text-amber',
                  )}
                >
                  {sel.status === 'ok' ? 'NOMINAL' : sel.status === 'empty' ? 'UNFILLED' : 'REVIEW'}
                </span>
              </div>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-ink-dim">{sel.detail}</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
