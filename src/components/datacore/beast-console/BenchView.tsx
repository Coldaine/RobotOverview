'use client';
/**
 * Live Plug — one SVG bench canvas. Every connector is a stateful hotspot;
 * recorded plugs materialize as animated cables in the loom.
 */
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import clsx from 'clsx';
import {
  BOARDS, PORTS, PERIPHERALS, EXPECTED_CABLES, NODE_INDEX, CAT, cableOwner, cableStatus,
  CONVERSION_STEPS, STEP_KIND_META,
  type Build, type BoardDef, type PortDef, type PeripheralDef, type CableDef, type PortSide,
} from './bench-data';
import { useConsoleStore, consoleActions, type PortRecord, type PortStatus } from './console-store';
import { Segmented, SPRING, SPRING_SOFT } from './ConsoleUi';

const SIDE_DIR: Record<PortSide, [number, number]> = {
  top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0],
};

const INK = 'var(--color-ink)';
const DIM = 'var(--color-ink-dim)';
const RIM = 'var(--color-rim)';

function anchorOf(id: string): { x: number; y: number; dx: number; dy: number } {
  const n = NODE_INDEX[id];
  if (!n) return { x: 0, y: 0, dx: 0, dy: 0 };
  if (n.kind === 'port') {
    const [dx, dy] = SIDE_DIR[n.side];
    return { x: n.x, y: n.y, dx, dy };
  }
  return { x: n.cx, y: n.cy, dx: 0, dy: 0 };
}

function cablePath(fromId: string, toId: string): string {
  const a = anchorOf(fromId);
  const b = anchorOf(toId);
  const k = Math.min(120, Math.hypot(b.x - a.x, b.y - a.y) * 0.45);
  const c1 = a.dx || a.dy
    ? { x: a.x + a.dx * k, y: a.y + a.dy * k }
    : { x: a.x + (b.x - a.x) * 0.3, y: a.y + (b.y - a.y) * 0.3 };
  const c2 = b.dx || b.dy
    ? { x: b.x + b.dx * k, y: b.y + b.dy * k }
    : { x: b.x + (a.x - b.x) * 0.3, y: b.y + (a.y - b.y) * 0.3 };
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
}

const FUTURE = '#c084fc';

function Cable({ cable, ports, dim, highlight }: {
  cable: CableDef;
  ports: Record<string, PortRecord>;
  dim: boolean;
  highlight: boolean;
}) {
  const st = cableStatus(cable, ports);
  const color = CAT[cable.cat].color;
  const d = useMemo(() => cablePath(cable.from, cable.to), [cable]);
  if (cable.era === 'future') {
    return (
      <g style={{ opacity: dim && !highlight ? 0.15 : 0.9, transition: 'opacity .25s' }}>
        <motion.path
          d={d} fill="none" stroke={FUTURE} strokeWidth={highlight ? 2.6 : 1.7}
          strokeDasharray="3 6" strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, strokeDashoffset: [0, -36] }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 0.5 },
            strokeDashoffset: { duration: 3.2, repeat: Infinity, ease: 'linear' },
          }}
        />
      </g>
    );
  }
  const stroke = st === 'plugged' ? color : st === 'planned' ? 'var(--color-amber)' : 'var(--color-ink-dim)';
  const width = st === 'plugged' ? 3 : 1.6;
  return (
    <g style={{ opacity: dim && !highlight ? 0.15 : 1, transition: 'opacity .25s' }}>
      <motion.path
        d={d} fill="none" stroke={stroke} strokeWidth={highlight ? width + 1.2 : width}
        strokeDasharray={st === 'plugged' ? 'none' : '5 7'} strokeLinecap="round"
        initial={false} animate={{ opacity: st === 'empty' ? 0.5 : 1 }}
      />
      {st === 'plugged' && (
        <motion.path
          d={d} fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round"
          strokeDasharray="2 14" initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: [0, -64] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
          style={{ opacity: 0.75 }}
        />
      )}
      {st === 'plugged' && (
        <motion.path
          d={d} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.32 }} animate={{ pathLength: 1, opacity: 0.14 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      )}
    </g>
  );
}

function PortHotspot({ port, record, selected, onSelect, onHover, index }: {
  port: PortDef;
  record: PortRecord | undefined;
  selected: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  index: number;
}) {
  const st: PortStatus = record?.status ?? 'empty';
  const color = port.danger ? 'var(--color-signal-crit)' : CAT[port.cat].color;
  const r = 9;
  const [dx, dy] = SIDE_DIR[port.side];
  const tx = port.x + dx * 22;
  const ty = port.y + dy * 22;
  const textAnchor = dx === 0 ? 'middle' : dx > 0 ? 'start' : 'end';
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...SPRING_SOFT, delay: 0.05 + index * 0.03 }}
      style={{ cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); onSelect(port.id); }}
      onMouseEnter={() => onHover(port.id)}
      onMouseLeave={() => onHover(null)}
    >
      {st === 'planned' && (
        <motion.circle
          cx={port.x} cy={port.y} r={r} fill="none" stroke="var(--color-amber)"
          animate={{ r: [r, r + 8], opacity: [0.7, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      {selected && (
        <motion.circle
          cx={port.x} cy={port.y} r={r + 6} fill="none" stroke={color} strokeWidth={1.5}
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING}
        />
      )}
      <motion.circle
        cx={port.x} cy={port.y} r={r}
        fill={st === 'plugged' ? color : 'var(--color-panel-2)'}
        stroke={color} strokeWidth={st === 'empty' ? 1.6 : 2.2}
        strokeDasharray={st === 'planned' ? '3 3' : 'none'}
        whileHover={{ scale: 1.35 }} whileTap={{ scale: 0.9 }} transition={SPRING}
        style={{ filter: st === 'plugged' ? `drop-shadow(0 0 6px ${color})` : 'none' }}
      />
      {port.danger && (
        <text
          x={port.x} y={port.y + 3.5} textAnchor="middle" fontSize={11} fontWeight={800}
          fill={st === 'plugged' ? 'var(--color-void)' : 'var(--color-signal-crit)'}
          style={{ pointerEvents: 'none' }}
        >
          !
        </text>
      )}
      <text
        x={tx} y={ty + 3} textAnchor={textAnchor} fontSize={11.5}
        fontFamily="var(--font-mono)" fill={selected ? INK : DIM}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {port.label}
      </text>
    </motion.g>
  );
}

function BoardShape({ board, children }: { board: BoardDef; children: React.ReactNode }) {
  return (
    <motion.g
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 14 }} transition={SPRING_SOFT}
    >
      <rect
        x={board.x} y={board.y} width={board.w} height={board.h} rx={16}
        fill={board.fill} stroke={RIM} strokeWidth={1.4}
      />
      <rect
        x={board.x + 8} y={board.y + 8} width={board.w - 16} height={board.h - 16} rx={10}
        fill="none" stroke={RIM} strokeWidth={0.8} strokeDasharray="1 4" opacity={0.7}
      />
      {[
        [board.x + 20, board.y + 20], [board.x + board.w - 20, board.y + 20],
        [board.x + 20, board.y + board.h - 20], [board.x + board.w - 20, board.y + board.h - 20],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={5.5} fill="var(--color-void)" stroke={RIM} strokeWidth={1.2} />
      ))}
      <text
        x={board.x + 36} y={board.y + 44} fontSize={board.titleSize ?? 16.5} fontWeight={700} fill={INK}
        fontFamily="var(--font-display)" style={{ userSelect: 'none', letterSpacing: '0.04em' }}
      >
        {board.name}
      </text>
      <text
        x={board.x + 36} y={board.y + 63} fontSize={11} fill={DIM}
        fontFamily="var(--font-mono)" style={{ userSelect: 'none' }}
      >
        {board.subtitle}
      </text>
      {board.chips.map((c) => (
        <g key={c.label}>
          <rect
            x={c.x - c.w / 2} y={c.y - c.h / 2} width={c.w} height={c.h} rx={5}
            fill="var(--color-void)" stroke={RIM} strokeWidth={1} opacity={0.9}
          />
          <text
            x={c.x} y={c.y + 3.5} textAnchor="middle" fontSize={10}
            fontFamily="var(--font-mono)" fill={DIM} style={{ userSelect: 'none' }}
          >
            {c.label}
          </text>
        </g>
      ))}
      {children}
    </motion.g>
  );
}

function PeripheralNode({ p, engaged, onClick, index }: {
  p: PeripheralDef;
  engaged: boolean;
  onClick: (id: string) => void;
  index: number;
}) {
  const future = p.era === 'future';
  const color = future ? FUTURE : CAT[p.cat].color;
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ ...SPRING_SOFT, delay: 0.15 + index * 0.04 }}
      style={{ cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); onClick(p.id); }}
    >
      <motion.rect
        x={p.x} y={p.y} width={p.w} height={p.h} rx={12}
        fill={future ? 'transparent' : 'var(--color-panel)'}
        stroke={engaged ? color : future ? color : RIM}
        strokeWidth={engaged ? 2 : 1.2}
        strokeDasharray={future ? '5 4' : 'none'}
        whileHover={{ scale: 1.04 }} transition={SPRING}
        style={{
          filter: engaged ? `drop-shadow(0 0 8px ${color})` : 'none',
          transformOrigin: `${p.x + p.w / 2}px ${p.y + p.h / 2}px`,
        }}
      />
      {future && (
        <text
          x={p.x + p.w - 8} y={p.y + 14} textAnchor="end" fontSize={8} fontWeight={800}
          fontFamily="var(--font-mono)" fill={FUTURE} letterSpacing="0.12em"
          style={{ userSelect: 'none' }}
        >
          FUTURE
        </text>
      )}
      <circle cx={p.x + 16} cy={p.y + 18} r={4.5} fill={color} />
      <text
        x={p.x + 28} y={p.y + 22} fontSize={12} fontWeight={650} fill={INK}
        fontFamily="var(--font-sans)" style={{ userSelect: 'none' }}
      >
        {p.name}
      </text>
      <text
        x={p.x + 28} y={p.y + 38} fontSize={10} fill={DIM}
        fontFamily="var(--font-mono)" style={{ userSelect: 'none' }}
      >
        {p.sub}
      </text>
    </motion.g>
  );
}

/** Read-only drawer for peripherals (incl. future hardware) — records live on ports. */
function PeripheralDrawer({ pid, build, onClose }: { pid: string; build: Build; onClose: () => void }) {
  const node = NODE_INDEX[pid];
  if (!node || node.kind !== 'peripheral') return null;
  const future = node.era === 'future';
  const color = future ? FUTURE : CAT[node.cat].color;
  const cables = EXPECTED_CABLES.filter(
    (c) => (c.from === pid || c.to === pid) && (!c.build || c.build === build),
  );
  return (
    <motion.div
      key={pid}
      initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }}
      transition={SPRING}
      className="w-[320px] shrink-0"
    >
      <div className="panel sticky top-4 space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="hud-label">{future ? 'Future hardware' : 'Peripheral'}</div>
            <div className="mt-0.5 font-display text-base uppercase tracking-[0.06em] text-ink">{node.name}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="chip" style={{ borderColor: color, color }}>{future ? 'PLANNED' : CAT[node.cat].label}</span>
              <span className="chip border-rim text-ink-dim">{node.sub}</span>
            </div>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close"
            className="grid h-6 w-6 shrink-0 place-items-center rounded border border-rim/60 text-ink-dim hover:text-ink"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <p className="font-mono text-[11px] leading-relaxed text-ink-dim">{node.detail}</p>
        {cables.length > 0 && (
          <div>
            <div className="hud-label mb-1.5">{future ? 'Proposed wiring' : 'Wiring'}</div>
            <div className="grid gap-1.5">
              {cables.map((c) => {
                const other = c.from === pid ? c.to : c.from;
                const otherNode = NODE_INDEX[other];
                return (
                  <div key={`${c.from}-${c.to}`} className="panel-inset p-2 font-mono text-[10px] leading-relaxed text-ink-dim">
                    <span className="text-ink">{otherNode?.kind === 'port' ? otherNode.label : otherNode?.name ?? other}</span>
                    {' · '}{c.label}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {future && (
          <div className="rounded-md border p-2.5 font-mono text-[10px] leading-relaxed text-ink" style={{ borderColor: `color-mix(in srgb, ${FUTURE} 55%, transparent)`, background: `color-mix(in srgb, ${FUTURE} 10%, transparent)` }}>
            Not on the robot yet — dashed cables are the integration proposal. When it arrives, record
            the real plugs on the ports it lands on.
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PortDrawer({ portId, onClose }: { portId: string; onClose: () => void }) {
  const node = NODE_INDEX[portId];
  const record = useConsoleStore((s) => s.projects[s.activeProject]?.ports[portId]);
  if (!node || node.kind !== 'port') return null;
  const port = node;
  const st: PortStatus = record?.status ?? 'empty';
  const color = port.danger ? 'var(--color-signal-crit)' : CAT[port.cat].color;
  const board = BOARDS.find((b) => b.id === port.board);
  const inputCls =
    'w-full rounded-md border border-rim bg-panel-2/40 px-3 py-2 font-mono text-xs text-ink outline-none ring-cyan/40 transition focus:ring';
  return (
    <motion.div
      key={portId}
      initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }}
      transition={SPRING}
      className="w-[320px] shrink-0"
    >
      <div className="panel sticky top-4 space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="hud-label">{board?.name ?? 'Peripheral'}</div>
            <div className="mt-0.5 font-display text-base uppercase tracking-[0.06em] text-ink">{port.label}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="chip" style={{ borderColor: color, color }}>{CAT[port.cat].label}</span>
              <span className="chip border-rim text-ink-dim">{port.conn}</span>
            </div>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close"
            className="grid h-6 w-6 shrink-0 place-items-center rounded border border-rim/60 text-ink-dim hover:text-ink"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <p className="font-mono text-[11px] leading-relaxed text-ink-dim">{port.detail}</p>

        {port.danger && (
          <div className="rounded-md border border-signal-crit/60 bg-signal-crit/10 p-2.5 font-mono text-[11px] leading-relaxed text-ink">
            <strong>Do not use for the Orin.</strong> This 5 V rail fed the Pi 5. The Orin needs
            9–19 V into its own barrel jack.
          </div>
        )}

        <div>
          <div className="hud-label mb-1.5">Recorded state</div>
          <Segmented
            value={st}
            onChange={(v) => {
              if (v === 'empty') consoleActions.clearPort(portId);
              else {
                consoleActions.setPort(portId, {
                  status: v as PortStatus,
                  connectedTo:
                    record?.connectedTo ||
                    (v === 'plugged' && port.expect && !port.expect.startsWith('(') && !port.expect.startsWith('—')
                      ? port.expect
                      : record?.connectedTo ?? ''),
                });
              }
            }}
            options={[
              { value: 'empty', label: 'Empty', color: 'var(--color-signal-idle)' },
              { value: 'planned', label: 'Planned', color: 'var(--color-amber)' },
              { value: 'plugged', label: 'Plugged', color: port.danger ? 'var(--color-signal-crit)' : 'var(--color-signal-ok)' },
            ]}
          />
        </div>

        <label className="block">
          <div className="mb-1 font-mono text-[10px] text-ink-dim">What&apos;s actually plugged in</div>
          <input
            className={inputCls} value={record?.connectedTo ?? ''} placeholder={port.expect || 'nothing yet'}
            onChange={(e) => consoleActions.setPort(portId, { connectedTo: e.target.value })}
          />
        </label>
        <label className="block">
          <div className="mb-1 font-mono text-[10px] text-ink-dim">Cable / adapter used</div>
          <input
            className={inputCls} value={record?.cable ?? ''} placeholder="e.g. 30 cm USB-C→A, 3× F-F DuPont…"
            onChange={(e) => consoleActions.setPort(portId, { cable: e.target.value })}
          />
        </label>
        <label className="block">
          <div className="mb-1 font-mono text-[10px] text-ink-dim">Notes</div>
          <textarea
            className={clsx(inputCls, 'min-h-16 resize-y')} value={record?.notes ?? ''}
            placeholder="strain relief, routing, gotchas…"
            onChange={(e) => consoleActions.setPort(portId, { notes: e.target.value })}
          />
        </label>

        {port.expect && (
          <div className="border-t border-rim/50 pt-2 font-mono text-[10px] text-ink-dim">
            Expected: <span className="text-ink">{port.expect}</span>
          </div>
        )}
        {record?.updatedAt && (
          <div className="font-mono text-[10px] text-ink-dim/70">
            updated {new Date(record.updatedAt).toLocaleString()}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function BenchView() {
  const ports = useConsoleStore((s) => s.projects[s.activeProject]?.ports ?? {});
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [build, setBuild] = useState<Build>('orin');
  const [showFuture, setShowFuture] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const stepsActive = showSteps && build === 'orin';
  const stepCableKeys = new Set(
    CONVERSION_STEPS.filter((s) => s.cable).map((s) => s.cable as string),
  );
  const futureVisible = showFuture && build === 'orin';
  const buildCables = EXPECTED_CABLES.filter((c) => !c.build || c.build === build);
  const currentCables = buildCables.filter((c) => !c.era);
  const shownCables = futureVisible ? buildCables : currentCables;
  const shownBoards = BOARDS.filter((b) => !b.build || b.build === build);
  const shownPeripherals = PERIPHERALS.filter(
    (p) => (!p.build || p.build === build) && (!p.era || futureVisible),
  );

  const pluggedCount = currentCables.filter((c) => cableStatus(c, ports) === 'plugged').length;

  const engagedPeripherals = new Set(
    currentCables
      .filter((c) => cableStatus(c, ports) !== 'empty')
      .flatMap((c) => [c.from, c.to]),
  );

  const focusId = hover ?? selected;
  const focusCables = focusId
    ? shownCables.filter((c) => c.from === focusId || c.to === focusId)
    : null;

  const selectPeripheral = (pid: string) => {
    const node = NODE_INDEX[pid];
    if (node?.kind === 'peripheral' && node.era === 'future') {
      setSelected(pid);
      return;
    }
    const cable = buildCables.find((c) => c.from === pid || c.to === pid);
    const owner = cable ? cableOwner(cable) : null;
    setSelected(owner ?? pid);
  };

  const hoverNode = hover ? NODE_INDEX[hover] : undefined;
  const selectedNode = selected ? NODE_INDEX[selected] : undefined;

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-[1_1_620px]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2.5">
            {(Object.keys(CAT) as (keyof typeof CAT)[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-dim">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: CAT[k].color }} />
                {CAT[k].label}
              </span>
            ))}
            {showFuture && (
              <motion.span
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em]"
                style={{ color: FUTURE }}
              >
                <span className="inline-block h-2 w-2 rounded-sm border border-dashed" style={{ borderColor: FUTURE }} />
                Future
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Segmented
              value={build}
              onChange={(v) => { setBuild(v as Build); setSelected(null); setHover(null); }}
              options={[
                { value: 'pi5', label: 'Pi 5 · original' },
                { value: 'orin', label: 'Jetson Orin · target', color: 'var(--color-signal-ok)' },
              ]}
            />
            {build === 'orin' && (
              <Segmented
                value={showFuture ? 'future' : 'now'}
                onChange={(v) => setShowFuture(v === 'future')}
                options={[
                  { value: 'now', label: 'Current' },
                  { value: 'future', label: '+ Future', color: FUTURE },
                ]}
              />
            )}
            {build === 'orin' && (
              <button
                type="button"
                onClick={() => setShowSteps((v) => !v)}
                className={clsx(
                  'chip cursor-pointer transition',
                  showSteps ? 'border-signal-ok/60 text-signal-ok' : 'border-rim text-ink-dim hover:text-ink',
                )}
              >
                {showSteps ? '✓ ' : ''}Conversion steps
              </button>
            )}
            <div className={clsx('font-mono text-xs', pluggedCount === currentCables.length ? 'text-signal-ok' : 'text-ink-dim')}>
              loom {pluggedCount}/{currentCables.length} plugged
            </div>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <svg viewBox="0 0 1440 916" className="block h-auto w-full" onClick={() => setSelected(null)}>
            <defs>
              <pattern id="bench-grid" width="36" height="36" patternUnits="userSpaceOnUse">
                <path d="M 36 0 L 0 0 0 36" fill="none" stroke="rgba(54,224,224,0.06)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="1440" height="916" fill="url(#bench-grid)" />

            {shownCables.map((c) => (
              <Cable
                key={`${c.from}-${c.to}`} cable={c} ports={ports}
                dim={!!focusCables || (stepsActive && !stepCableKeys.has(`${c.from}->${c.to}`))}
                highlight={
                  focusCables
                    ? focusCables.includes(c)
                    : stepsActive && stepCableKeys.has(`${c.from}->${c.to}`)
                }
              />
            ))}

            <AnimatePresence>
              {shownBoards.map((b) => (
                <BoardShape key={b.id} board={b}>
                  {PORTS.filter((p) => p.board === b.id).map((p, i) => (
                    <PortHotspot
                      key={p.id} port={p} record={ports[p.id]} index={i}
                      selected={selected === p.id} onSelect={setSelected} onHover={setHover}
                    />
                  ))}
                </BoardShape>
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {shownPeripherals.map((p, i) => (
                <PeripheralNode
                  key={p.id} p={p} index={i}
                  engaged={engagedPeripherals.has(p.id)} onClick={selectPeripheral}
                />
              ))}
            </AnimatePresence>

            {stepsActive && CONVERSION_STEPS.filter((s) => s.anchor).map((s) => {
              const node = NODE_INDEX[s.anchor as string];
              if (!node) return null;
              const base = node.kind === 'port' ? { x: node.x, y: node.y } : { x: node.cx, y: node.cy };
              const [dx, dy] = node.kind === 'port' ? SIDE_DIR[node.side] : [0, 0];
              const bx = base.x - dx * 22 - (dx === 0 ? 18 : 0);
              const by = base.y - dy * 22 - (dy === 0 ? 18 : 0);
              const color = STEP_KIND_META[s.kind].color;
              return (
                <motion.g
                  key={`step-${s.n}`}
                  initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ ...SPRING, delay: s.n * 0.05 }}
                  style={{ pointerEvents: 'none' }}
                >
                  <circle cx={bx} cy={by} r={11} fill={color} stroke="var(--color-void)" strokeWidth={2} />
                  <text
                    x={bx} y={by + 4} textAnchor="middle" fontSize={12} fontWeight={800}
                    fill="var(--color-void)" fontFamily="var(--font-mono)"
                  >
                    {s.n}
                  </text>
                </motion.g>
              );
            })}

            {hoverNode && hoverNode.kind === 'port' && (
              <text
                x={hoverNode.x} y={hoverNode.y - 18} textAnchor="middle" fontSize={12}
                fontFamily="var(--font-mono)" fill={INK} fontWeight={700}
                style={{ pointerEvents: 'none' }}
              >
                {hoverNode.conn}
              </text>
            )}
          </svg>
        </div>

        <AnimatePresence>
          {stepsActive && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              transition={SPRING_SOFT}
              className="panel mt-3 p-4"
            >
              <div className="mb-2 flex items-baseline justify-between">
                <div className="hud-label">Pi 5 → Orin conversion — in this order</div>
                <div className="flex gap-2">
                  {(Object.keys(STEP_KIND_META) as (keyof typeof STEP_KIND_META)[]).map((k) => (
                    <span key={k} className="chip" style={{ borderColor: STEP_KIND_META[k].color, color: STEP_KIND_META[k].color }}>
                      {STEP_KIND_META[k].label}
                    </span>
                  ))}
                </div>
              </div>
              <ol className="grid gap-2 lg:grid-cols-2">
                {CONVERSION_STEPS.map((s) => (
                  <li key={s.n} className="panel-inset flex items-start gap-2.5 p-2.5">
                    <span
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[11px] font-extrabold text-void"
                      style={{ background: STEP_KIND_META[s.kind].color }}
                    >
                      {s.n}
                    </span>
                    <span>
                      <span className="block text-xs font-semibold text-ink">{s.title}</span>
                      <span className="mt-0.5 block font-mono text-[10px] leading-relaxed text-ink-dim">{s.how}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-dim/80">
          {build === 'pi5'
            ? 'Original build: stack (bottom→top) = Pi 5 inverted → Audio HAT → ROS Driver; the Pi is powered and wired entirely through the stack. '
            : 'Target build: the Pi leaves the bottom of the stack; the HAT + driver pair stays mated; the Jetson sits beside on its own standoffs (it must never dock into the stack). '}
          Click any connector to record what&apos;s actually plugged into it — recorded plugs draw
          themselves into the loom. Dashed grey = expected · amber pulse = planned ·
          solid glow = plugged{futureVisible && <> · <span style={{ color: FUTURE }}>dashed violet = future proposal</span></>}.
          State saves to this browser; use Export for a portable copy.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {selected && selectedNode?.kind === 'peripheral' && (
          <PeripheralDrawer key={selected} pid={selected} build={build} onClose={() => setSelected(null)} />
        )}
        {selected && selectedNode?.kind === 'port' && (
          <PortDrawer key={selected} portId={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
