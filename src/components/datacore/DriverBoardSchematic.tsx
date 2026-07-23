'use client';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useHangar } from '@/lib/store';
import { HOTSPOT_STATUS_META } from '@/lib/schematic';

// ─────────────────────────────────────────────────────────────────────────────
// Driver-Board Pinout Explorer.
//
// An interactive, animated SVG of the Waveshare "General Driver for Robots"
// board — the sibling of RoverSchematic, but scoped to a single board's ports.
// Ports are the 11 "Driver Board Interfaces" loadout slots already modeled on
// the beast unit (src/data/hangar.ts). Each port is a clickable hotspot; fill
// state, the readout panel, and the [LOAD]/[CLR] actions all read/write the
// live beast loadout through the store, exactly like the rover schematic.
// Colors are CSS variables, so the blueprint/industrial/topology themes recolor
// it for free; `theme` additionally tunes the trace animation style.
// ─────────────────────────────────────────────────────────────────────────────

type Side = 'left' | 'right' | 'top' | 'bottom';

interface BoardPort {
  id: string;
  slot: string; // must match a beast loadout slot name exactly
  label: string; // short display label
  x: number; // pad position, % of 0-100 viewBox
  y: number;
  side: Side;
}

const HUB = { x: 50, y: 50 };

// Ports grouped by function around the board perimeter. `slot` matches the
// "Driver Board Interfaces" group in the beast loadout so store actions line up.
const BOARD_PORTS: BoardPort[] = [
  // Left edge — power domain
  { id: 'batt', slot: 'XH2.54 Battery Input', label: 'BATT IN', x: 32, y: 40, side: 'left' },
  { id: 'pwr-out', slot: 'Power Output Pins', label: '5V/3V3 OUT', x: 32, y: 50, side: 'left' },
  { id: 'aux', slot: 'Aux Interface (IO4/5)', label: 'AUX IO4/5', x: 32, y: 60, side: 'left' },
  // Right edge — host / data domain
  { id: 'usb', slot: 'USB HUB / Type-C', label: 'USB HUB', x: 68, y: 40, side: 'right' },
  { id: 'gpio', slot: '40-Pin GPIO Header', label: '40-PIN GPIO', x: 68, y: 50, side: 'right' },
  { id: 'lidar', slot: 'LiDAR UART Port', label: 'LiDAR UART', x: 68, y: 60, side: 'right' },
  // Top edge — motion domain
  { id: 'servo', slot: 'Serial Bus Servo', label: 'BUS SERVO', x: 42, y: 32, side: 'top' },
  { id: 'pwm', slot: 'PWM Output Pins', label: 'PWM', x: 50, y: 32, side: 'top' },
  { id: 'display', slot: 'Display Header', label: 'OLED', x: 58, y: 32, side: 'top' },
  // Bottom edge — peripheral io
  { id: 'audio', slot: 'Audio Expansion', label: 'AUDIO', x: 44, y: 68, side: 'bottom' },
  { id: 'tf', slot: 'TF (MicroSD) Slot', label: 'TF CARD', x: 56, y: 68, side: 'bottom' },
];

function labelAnchor(side: Side): 'start' | 'middle' | 'end' {
  if (side === 'left') return 'end';
  if (side === 'right') return 'start';
  return 'middle';
}

function labelPos(port: BoardPort): { x: number; y: number } {
  switch (port.side) {
    case 'left':
      return { x: port.x - 4, y: port.y + 0.8 };
    case 'right':
      return { x: port.x + 4, y: port.y + 0.8 };
    case 'top':
      return { x: port.x, y: port.y - 3 };
    case 'bottom':
      return { x: port.x, y: port.y + 5 };
  }
}

export function DriverBoardSchematic() {
  const { unit, theme, openDrawer, updateSlot } = useHangar();
  const beast = unit('beast');
  const loadout = useMemo(() => beast?.loadout ?? [], [beast?.loadout]);

  const filledBySlot = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const s of loadout) m.set(s.slot, s.filledBy);
    return m;
  }, [loadout]);

  const [active, setActive] = useState<string | null>('servo');
  const activePort = BOARD_PORTS.find((p) => p.id === active) ?? null;

  const portStatus = (port: BoardPort): 'ok' | 'empty' =>
    filledBySlot.get(port.slot) ? 'ok' : 'empty';

  const filledCount = BOARD_PORTS.filter((p) => portStatus(p) === 'ok').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={clsx(
        'relative max-w-full overflow-hidden rounded-lg border bg-void/60 blueprint-grid corner-bracket',
        theme === 'industrial' ? 'border-gray-300' : 'border-rim',
      )}
    >
      {/* scanning sweep */}
      <div className="pointer-events-none absolute inset-0 animate-sweep [mask:linear-gradient(180deg,transparent,transparent_70%,rgba(54,224,224,0.22))]" />

      <div className="relative grid min-w-0 gap-4 p-4 sm:p-5 md:grid-cols-[1.5fr_1fr]">
        {/* ── SVG board ─────────────────────────────────────────────────── */}
        <div className="relative min-w-0 aspect-square md:min-h-[340px]">
          <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <filter id="boardGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.1" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* board substrate */}
            <rect
              x="32"
              y="32"
              width="36"
              height="36"
              rx="2.5"
              fill="var(--color-panel)"
              stroke="var(--color-cyan)"
              strokeOpacity={theme === 'industrial' ? 0.15 : 0.3}
              strokeWidth="0.4"
            />
            <rect
              x="34.5"
              y="34.5"
              width="31"
              height="31"
              rx="1.5"
              fill="var(--color-hull)"
              stroke="var(--color-rim)"
              strokeWidth="0.25"
            />
            {/* silkscreen mounting holes */}
            {[
              [35.5, 35.5],
              [64.5, 35.5],
              [35.5, 64.5],
              [64.5, 64.5],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1" fill="var(--color-void)" stroke="var(--color-rim)" strokeWidth="0.2" />
            ))}

            {/* central host / ESP32 hub */}
            <g>
              <rect x="45" y="45" width="10" height="10" rx="0.8" fill="var(--color-void)" stroke="var(--color-cyan)" strokeOpacity="0.5" strokeWidth="0.3" />
              {/* chip pins */}
              {[46.5, 48.5, 50.5, 52.5].map((p) => (
                <g key={p}>
                  <line x1={p} y1="44.2" x2={p} y2="45" stroke="var(--color-rim)" strokeWidth="0.25" />
                  <line x1={p} y1="55" x2={p} y2="55.8" stroke="var(--color-rim)" strokeWidth="0.25" />
                  <line x1="44.2" y1={p} x2="45" y2={p} stroke="var(--color-rim)" strokeWidth="0.25" />
                  <line x1="55" y1={p} x2="55.8" y2={p} stroke="var(--color-rim)" strokeWidth="0.25" />
                </g>
              ))}
              <text x="50" y="50.9" textAnchor="middle" fontSize="2.1" className="fill-cyan font-mono" opacity="0.8">
                ESP32
              </text>
            </g>

            {/* traces + ports */}
            {BOARD_PORTS.map((port) => {
              const pad = { x: port.x, y: port.y };
              const status = portStatus(port);
              const isFilled = status === 'ok';
              const isActive = port.id === active;
              const statusMeta = HOTSPOT_STATUS_META[status];
              // trace from pad to hub edge
              const path = `M ${pad.x} ${pad.y} L ${HUB.x} ${HUB.y}`;

              return (
                <g key={port.id}>
                  {/* trace */}
                  {isFilled && (theme === 'blueprint' || theme === 'topology') && (
                    <path d={path} fill="none" stroke="var(--color-cyan)" strokeWidth="0.9" filter="url(#boardGlow)" opacity="0.35" />
                  )}
                  <path
                    d={path}
                    fill="none"
                    stroke={isFilled ? 'var(--color-cyan)' : 'var(--color-rim)'}
                    strokeWidth={isFilled ? (isActive ? 0.7 : 0.5) : 0.35}
                    strokeDasharray={theme === 'industrial' ? undefined : isFilled ? '2 2' : '1 3'}
                    className={isFilled && theme !== 'industrial' ? 'animate-dash' : undefined}
                    opacity={isFilled ? 1 : 0.35}
                  />
                  {/* topology traveling pulse */}
                  {isFilled && theme === 'topology' && (
                    <circle r="0.9" fill="var(--color-cyan)">
                      <animateMotion dur="2.4s" repeatCount="indefinite" path={path} />
                    </circle>
                  )}

                  {/* port hotspot */}
                  <g
                    className="cursor-pointer outline-none"
                    role="button"
                    tabIndex={0}
                    aria-label={`${port.label} — ${isFilled ? 'filled' : 'empty'}`}
                    aria-pressed={isActive}
                    onClick={() => setActive(port.id)}
                    onMouseEnter={() => setActive(port.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActive(port.id);
                      }
                    }}
                  >
                    {/* generous invisible hit target */}
                    <circle cx={pad.x} cy={pad.y} r="4" fill="transparent" />
                    {isActive && (
                      <circle cx={pad.x} cy={pad.y} r="3.2" className={clsx(statusMeta.ringClass, 'fill-none')} strokeWidth="0.4" strokeOpacity="0.6">
                        <animate attributeName="r" values="2.4;3.6;2.4" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {isFilled ? (
                      <>
                        <rect x={pad.x - 1.1} y={pad.y - 1.1} width="2.2" height="2.2" rx="0.3" className={statusMeta.dotClass} />
                        <circle cx={pad.x} cy={pad.y} r="2.4" className={clsx(statusMeta.ringClass, 'fill-none')} strokeWidth="0.3" strokeOpacity="0.5" />
                      </>
                    ) : (
                      <rect
                        x={pad.x - 1.1}
                        y={pad.y - 1.1}
                        width="2.2"
                        height="2.2"
                        rx="0.3"
                        fill="none"
                        stroke="var(--color-signal-warn)"
                        strokeWidth="0.3"
                        strokeDasharray="1 1"
                        className={theme === 'industrial' ? undefined : 'animate-pulse'}
                      />
                    )}
                    <text
                      x={labelPos(port).x}
                      y={labelPos(port).y}
                      textAnchor={labelAnchor(port.side)}
                      fontSize="2"
                      className={clsx('font-mono', isActive ? 'fill-cyan' : 'fill-ink-dim')}
                    >
                      {port.label}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* ── readout panel ─────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan/70">Board I/O Map</div>
            <span className="chip border-cyan/30 bg-cyan/5 text-cyan">{filledCount}/{BOARD_PORTS.length} wired</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {BOARD_PORTS.map((port) => {
              const statusMeta = HOTSPOT_STATUS_META[portStatus(port)];
              return (
                <button
                  key={port.id}
                  onClick={() => setActive(port.id)}
                  className={clsx(
                    'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left font-mono text-[10px] transition-all',
                    port.id === active
                      ? 'border-cyan/50 bg-cyan/10 text-ink'
                      : 'border-rim/60 bg-panel-2/30 text-ink-dim hover:border-rim hover:text-ink',
                  )}
                >
                  <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', statusMeta.listDotClass)} />
                  <span className="truncate">{port.label}</span>
                </button>
              );
            })}
          </div>

          {activePort && (
            <motion.div
              key={activePort.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="panel-inset mt-auto min-w-0 p-3"
            >
              {(() => {
                const status = portStatus(activePort);
                const statusMeta = HOTSPOT_STATUS_META[status];
                const slot = loadout.find((s) => s.slot === activePort.slot);
                const filledBy = slot?.filledBy ?? null;
                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 font-display text-sm uppercase tracking-[0.1em] text-ink">{activePort.slot}</span>
                      <span className={clsx('chip', statusMeta.chipClass)}>{statusMeta.label}</span>
                    </div>
                    {slot?.note && (
                      <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-dim">{slot.note}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between border-t border-rim/30 pt-2 font-mono text-[10px]">
                      <span className="text-ink-dim">{filledBy ? 'Occupied by' : 'Status'}</span>
                      {filledBy ? (
                        <div className="flex items-center gap-2">
                          <span className="truncate text-cyan">{unit(filledBy)?.name ?? filledBy}</span>
                          <button
                            onClick={() => updateSlot('beast', activePort.slot, null)}
                            className="text-[9px] uppercase text-signal-crit hover:underline cursor-pointer"
                          >
                            [CLR]
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openDrawer('beast', activePort.slot)}
                          className="text-[9px] uppercase text-signal-warn hover:underline cursor-pointer"
                        >
                          [LOAD]
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
