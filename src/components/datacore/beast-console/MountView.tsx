'use client';
/**
 * Mount Planner — pseudo-3D exploded stack (pure CSS 3D + framer-motion
 * springs). Records per-layer mounting hardware; checklist persists per project.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { MOUNT_LAYERS, MOUNT_CHECKS, type MountLayerDef } from './reference-data';
import { useConsoleStore, consoleActions, type MountRecord } from './console-store';
import { Segmented, SPRING, SPRING_SOFT } from './ConsoleUi';

interface LayerGeom { x: number; y: number; w: number; h: number; fill: string; border: string }

const FUTURE = '#c084fc';

/** Compact on-layer labels for the small mast-top boxes. */
const SHORT_NAME: Record<string, string> = {
  mast: 'Mast · rail',
  oakdpro: 'OAK-D Pro',
  mid360s: 'Mid-360S',
  pi5: 'Raspberry Pi 5',
  audiohat: 'RPI Audio HAT',
};

const GEOM: Record<string, LayerGeom> = {
  chassis: { x: 40, y: 40, w: 480, h: 320, fill: 'var(--color-panel-2)', border: 'var(--color-rim)' },
  ups: { x: 150, y: 260, w: 250, h: 150, fill: '#1a2330', border: 'var(--color-rim)' },
  pi5: { x: 90, y: 110, w: 190, h: 170, fill: 'transparent', border: 'var(--color-signal-crit)' },
  audiohat: { x: 95, y: 115, w: 180, h: 160, fill: '#1c1712', border: 'var(--color-amber)' },
  driverboard: { x: 100, y: 120, w: 170, h: 150, fill: '#0d1522', border: 'var(--color-cyan)' },
  jetson: { x: 330, y: 100, w: 180, h: 180, fill: '#101a2b', border: 'var(--color-signal-ok)' },
  mast: { x: 250, y: 34, w: 78, h: 66, fill: '#151d2c', border: 'var(--color-amber-soft)' },
  oakdpro: { x: 246, y: 36, w: 86, h: 52, fill: 'transparent', border: FUTURE },
  mid360s: { x: 252, y: 34, w: 74, h: 60, fill: 'transparent', border: FUTURE },
};
const LIFT: Record<string, number> = {
  chassis: 0, ups: -46, pi5: 36, audiohat: 76, driverboard: 116, jetson: 40, mast: 70, oakdpro: 92, mid360s: 116,
};
const EXPLODE_LIFT: Record<string, number> = {
  chassis: 0, ups: -80, pi5: 70, audiohat: 140, driverboard: 210, jetson: 90, mast: 140, oakdpro: 175, mid360s: 205,
};

function LayerFace({ layer, explode, selected, onSelect, record }: {
  layer: MountLayerDef;
  explode: number;
  selected: boolean;
  onSelect: (id: string) => void;
  record: MountRecord | undefined;
}) {
  const g = GEOM[layer.id];
  const z = LIFT[layer.id] + explode * EXPLODE_LIFT[layer.id];
  const ghost = layer.kind === 'ghost';
  const future = layer.kind === 'future';
  const removed = ghost && record?.status === 'removed';
  const mounted = record?.status === 'mounted';
  const isChassis = layer.id === 'chassis';
  return (
    <motion.div
      onClick={(e) => { e.stopPropagation(); onSelect(layer.id); }}
      initial={false}
      animate={{
        transform: `translate3d(${g.x}px, ${g.y}px, ${z}px)`,
        opacity: removed ? 0.18 : ghost ? 0.75 : future ? 0.88 : 1,
      }}
      transition={SPRING_SOFT}
      style={{
        position: 'absolute', left: 0, top: 0, width: g.w, height: g.h,
        borderRadius: 12, cursor: 'pointer',
        background: ghost
          ? 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(251,91,91,0.12) 8px, rgba(251,91,91,0.12) 12px)'
          : future
            ? 'color-mix(in srgb, #c084fc 8%, transparent)'
            : g.fill,
        border: `${selected ? 2.5 : 1.5}px ${ghost || future ? 'dashed' : 'solid'} ${selected ? 'var(--color-cyan)' : mounted ? 'var(--color-signal-ok)' : g.border}`,
        boxShadow: isChassis || future ? 'none' : `0 ${18 + z * 0.25}px ${26 + z * 0.4}px rgba(0,0,0,.38)`,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 12,
        transformStyle: 'preserve-3d', boxSizing: 'border-box',
      }}
    >
      {!isChassis && !ghost && !future && (
        <div style={{ position: 'absolute', inset: 10, pointerEvents: 'none' }}>
          {([['0%', '0%'], ['100%', '0%'], ['0%', '100%'], ['100%', '100%']] as const).map(([l, t], i) => (
            <span
              key={i}
              style={{
                position: 'absolute', left: l, top: t, width: 9, height: 9, margin: -4.5,
                borderRadius: 999, background: 'var(--color-void)', border: '1.5px solid var(--color-rim)',
              }}
            />
          ))}
        </div>
      )}
      <div
        className={isChassis ? 'font-display text-sm text-ink' : 'font-display text-xs'}
        style={{ color: ghost ? 'var(--color-signal-crit)' : future ? FUTURE : isChassis ? undefined : '#c7d3e3', fontWeight: 700 }}
      >
        {SHORT_NAME[layer.id] ?? layer.name}
        {removed ? ' — removed ✓' : ghost ? ' — REMOVE' : future && mounted ? ' ✓' : ''}
      </div>
      {!future && layer.id !== 'mast' && (
        <div className="font-mono text-[10px]" style={{ color: isChassis ? 'var(--color-ink-dim)' : '#7f8ea7' }}>
          {mounted ? (record?.hardware || layer.hardwareHint) : layer.hardwareHint}
          {mounted && ' · mounted ✓'}
        </div>
      )}
    </motion.div>
  );
}

function Shadow({ layer, explode }: { layer: MountLayerDef; explode: number }) {
  const g = GEOM[layer.id];
  if (layer.id === 'chassis' || layer.kind === 'future' || LIFT[layer.id] < 0) return null;
  const z = LIFT[layer.id] + explode * EXPLODE_LIFT[layer.id];
  return (
    <motion.div
      initial={false}
      animate={{ transform: `translate3d(${g.x + 6}px, ${g.y + 6}px, 1px)`, opacity: 0.25 - z * 0.0006 }}
      transition={SPRING_SOFT}
      style={{
        position: 'absolute', left: 0, top: 0, width: g.w, height: g.h, borderRadius: 16,
        background: 'black', filter: `blur(${8 + z * 0.12}px)`, pointerEvents: 'none',
      }}
    />
  );
}

function LayerPanel({ layerId, onClose }: { layerId: string; onClose: () => void }) {
  const layer = MOUNT_LAYERS.find((l) => l.id === layerId);
  const record = useConsoleStore((s) => s.projects[s.activeProject]?.mounts[layerId]);
  if (!layer) return null;
  const ghost = layer.kind === 'ghost';
  const st = record?.status ?? 'planned';
  const inputCls =
    'w-full rounded-md border border-rim bg-panel-2/40 px-3 py-2 font-mono text-xs text-ink outline-none ring-cyan/40 transition focus:ring';
  return (
    <motion.div
      key={layerId}
      initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }}
      transition={SPRING}
      className="w-[320px] shrink-0"
    >
      <div className="panel sticky top-4 space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="font-display text-base uppercase tracking-[0.06em] text-ink">{layer.name}</div>
          <button
            type="button" onClick={onClose} aria-label="Close"
            className="grid h-6 w-6 shrink-0 place-items-center rounded border border-rim/60 text-ink-dim hover:text-ink"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <p className="font-mono text-[11px] leading-relaxed text-ink-dim">{layer.detail}</p>

        <div>
          <div className="hud-label mb-1.5">{ghost ? 'Is it still in the stack?' : 'Mount state'}</div>
          <Segmented
            value={st}
            onChange={(v) => consoleActions.setMount(layerId, { status: v as MountRecord['status'] })}
            options={ghost
              ? [
                  { value: 'planned', label: 'Still fitted', color: 'var(--color-signal-crit)' },
                  { value: 'removed', label: 'Removed', color: 'var(--color-signal-ok)' },
                ]
              : [
                  { value: 'planned', label: 'Planned', color: 'var(--color-amber)' },
                  { value: 'mounted', label: 'Mounted', color: 'var(--color-signal-ok)' },
                ]}
          />
        </div>

        {!ghost && (
          <label className="block">
            <div className="mb-1 font-mono text-[10px] text-ink-dim">Standoffs / hardware used</div>
            <input
              className={inputCls} value={record?.hardware ?? ''} placeholder={layer.hardwareHint}
              onChange={(e) => consoleActions.setMount(layerId, { hardware: e.target.value })}
            />
          </label>
        )}
        <label className="block">
          <div className="mb-1 font-mono text-[10px] text-ink-dim">Notes</div>
          <textarea
            className={clsx(inputCls, 'min-h-16 resize-y')} value={record?.notes ?? ''}
            placeholder="hole pattern, spacing, what worked…"
            onChange={(e) => consoleActions.setMount(layerId, { notes: e.target.value })}
          />
        </label>
        {record?.updatedAt && (
          <div className="font-mono text-[10px] text-ink-dim/70">
            updated {new Date(record.updatedAt).toLocaleString()}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function MountView() {
  const [exploded, setExploded] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const checks = useConsoleStore((s) => s.projects[s.activeProject]?.checks ?? {});
  const mounts = useConsoleStore((s) => s.projects[s.activeProject]?.mounts ?? {});
  const explode = exploded ? 1 : 0;
  const done = MOUNT_CHECKS.filter((c) => checks[c.id]).length;

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-[1_1_620px]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Segmented
            value={exploded ? 'x' : 'a'}
            onChange={(v) => setExploded(v === 'x')}
            options={[{ value: 'a', label: 'Assembled' }, { value: 'x', label: 'Exploded' }]}
          />
          <div className="font-mono text-[10px] text-ink-dim">
            Click a layer to record how it mounts. The Jetson never joins the stack.
          </div>
        </div>

        <div className="panel overflow-hidden pb-7 pt-2" onClick={() => setSelected(null)}>
          <div style={{ perspective: 1400 }} className="flex w-full justify-center">
            <div
              style={{
                position: 'relative', width: 560, height: 400,
                transform: 'translateX(70px) rotateX(56deg) rotateZ(-38deg)',
                transformStyle: 'preserve-3d',
                margin: '70px 0 10px',
              }}
            >
              {MOUNT_LAYERS.map((l) => <Shadow key={`s-${l.id}`} layer={l} explode={explode} />)}
              {MOUNT_LAYERS.map((l) => (
                <LayerFace
                  key={l.id} layer={l} explode={explode}
                  selected={selected === l.id} onSelect={setSelected}
                  record={mounts[l.id]}
                />
              ))}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <span className="chip border-cyan/40 text-cyan">stack (bottom→top): Pi 5 → Audio HAT → ROS Driver</span>
            <span className="chip border-signal-crit/40 text-signal-crit">Pi 5: comes off — Jetson must NOT dock there</span>
            <span className="chip border-amber/40 text-amber">Audio HAT: stays · integral fan · USB → Jetson</span>
            <span className="chip border-signal-ok/40 text-signal-ok">Jetson: own standoffs beside — jumpers + USB + barrel</span>
            <span className="chip border-rim text-ink-dim">UPS: undercarriage bay below deck</span>
            <span className="chip" style={{ borderColor: 'color-mix(in srgb, #c084fc 40%, transparent)', color: FUTURE }}>
              mast top: Mid-360S + OAK-D Pro (future)
            </span>
          </div>
        </div>

        <div className="panel mt-4 p-4">
          <div className="flex items-baseline justify-between">
            <div className="hud-label">Bring-up checklist</div>
            <span className={clsx('font-mono text-xs', done === MOUNT_CHECKS.length ? 'text-signal-ok' : 'text-ink-dim')}>
              {done}/{MOUNT_CHECKS.length}
            </span>
          </div>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {MOUNT_CHECKS.map((c, i) => {
              const on = !!checks[c.id];
              return (
                <motion.button
                  key={c.id} type="button" onClick={() => consoleActions.toggleCheck(c.id)}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING_SOFT, delay: i * 0.03 }}
                  className={clsx(
                    'flex items-start gap-2.5 rounded-md px-1.5 py-1.5 text-left font-mono text-[11px] leading-relaxed',
                    on ? 'text-ink-dim/70' : 'text-ink',
                  )}
                >
                  <motion.span
                    animate={{
                      background: on ? 'var(--color-signal-ok)' : 'rgba(0,0,0,0)',
                      borderColor: on ? 'var(--color-signal-ok)' : 'var(--color-rim)',
                    }}
                    transition={SPRING}
                    className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-black text-void"
                    style={{ borderWidth: 1.6 }}
                  >
                    {on ? '✓' : ''}
                  </motion.span>
                  <span className={on ? 'line-through' : undefined}>{c.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selected && <LayerPanel key={selected} layerId={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
