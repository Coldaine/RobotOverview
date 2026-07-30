'use client';
/**
 * Power Planner — interactive load-budget calculator for the two candidate
 * topologies (single pack bus vs split rails), plus the expansion playbook.
 * Session-local what-if state; the persisted truth stays in the plug records.
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import {
  LOADS, PRESETS, PACKS, VMOUNT, NOMINAL_V, STRATEGIES,
  type LoadDef, type PackDef, type Rail,
} from './power-data';
import { Segmented, SPRING, SPRING_SOFT } from './ConsoleUi';

const FUTURE = '#c084fc';

type Topology = 'single' | 'split';

const defaultModes = () => Object.fromEntries(LOADS.map((l) => [l.id, l.defaultMode]));

function fmtRuntime(hours: number): string {
  if (!isFinite(hours)) return '∞';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h} h ${m.toString().padStart(2, '0')} m` : `${m} min`;
}

function LoadRow({ load, mode, onMode }: {
  load: LoadDef;
  mode: string;
  onMode: (loadId: string, modeId: string) => void;
}) {
  const active = load.modes.find((m) => m.id === mode) ?? load.modes[0];
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5">
      <div className="min-w-0">
        <span className="font-mono text-[11px] text-ink">
          {load.name}
          {load.future && (
            <span className="ml-1.5 font-bold uppercase tracking-[0.1em] text-[8px]" style={{ color: FUTURE }}>future</span>
          )}
        </span>
        {load.note && <div className="font-mono text-[9px] text-ink-dim/70">{load.note}</div>}
      </div>
      <div className="flex items-center gap-2">
        <div className="inline-flex gap-0.5 rounded-md border border-rim/60 bg-panel-2/30 p-0.5">
          {load.modes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onMode(load.id, m.id)}
              className={clsx(
                'rounded px-1.5 py-0.5 font-mono text-[9px]',
                m.id === mode ? 'bg-cyan font-bold text-void' : 'text-ink-dim hover:text-ink',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <span className="w-12 text-right font-mono text-[10px] tabular-nums text-ink-dim">
          {`${active.watts} W`}
        </span>
      </div>
    </div>
  );
}

function RailGauge({ title, watts, amps, maxAmps, maxWatts, wh, accent }: {
  title: string;
  watts: number;
  amps?: number;
  maxAmps?: number;
  maxWatts?: number;
  wh: number;
  accent: string;
}) {
  const frac = maxAmps ? (amps ?? 0) / maxAmps : maxWatts ? watts / maxWatts : 0;
  const over = frac > 1;
  const warn = !over && frac > 0.75;
  const barColor = over ? 'var(--color-signal-crit)' : warn ? 'var(--color-amber)' : 'var(--color-signal-ok)';
  const runtime = watts > 0 ? wh / watts : Infinity;
  return (
    <div className="panel-inset p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="hud-label" style={{ color: accent }}>{title}</span>
        <span className="font-mono text-[10px] tabular-nums text-ink-dim">{wh} Wh</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-3 font-mono tabular-nums">
        <span className="text-lg font-bold text-ink">{watts.toFixed(1)} W</span>
        {maxAmps != null && (
          <span className="text-[11px] text-ink-dim">{(amps ?? 0).toFixed(1)} / {maxAmps} A</span>
        )}
        {maxWatts != null && <span className="text-[11px] text-ink-dim">cap {maxWatts} W</span>}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel-2">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${Math.min(100, frac * 100)}%`, background: barColor }}
          transition={SPRING_SOFT}
          style={{ boxShadow: `0 0 8px ${barColor}` }}
        />
      </div>
      <div className="mt-1.5 flex items-baseline justify-between font-mono text-[10px]">
        <span className={clsx(over ? 'font-bold text-signal-crit' : warn ? 'text-amber' : 'text-signal-ok')}>
          {over ? 'OVERLOAD — this load set exceeds the rail' : warn ? 'thin headroom' : 'headroom ok'}
        </span>
        <span className="tabular-nums text-ink-dim">≈ {fmtRuntime(runtime)} runtime</span>
      </div>
    </div>
  );
}

function PackPicker({ pack, onPack }: { pack: string; onPack: (id: string) => void }) {
  const p: PackDef = PACKS.find((x) => x.id === pack) ?? PACKS[0];
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {PACKS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => onPack(x.id)}
            className={clsx('chip transition', x.id === pack ? 'border-cyan text-cyan' : 'border-rim text-ink-dim hover:text-ink')}
          >
            {x.name}
          </button>
        ))}
      </div>
      <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-ink-dim/80">{p.note}</p>
    </div>
  );
}

export function PowerView() {
  const [topology, setTopology] = useState<Topology>('split');
  const [pack, setPack] = useState('p30b');
  const [modes, setModes] = useState<Record<string, string>>(defaultModes);

  const packDef = PACKS.find((p) => p.id === pack) ?? PACKS[0];

  const railWatts = useMemo(() => {
    const sum = (rail: Rail) =>
      LOADS.filter((l) => l.rail === rail).reduce((acc, l) => {
        const m = l.modes.find((x) => x.id === modes[l.id]) ?? l.modes[0];
        return acc + m.watts;
      }, 0);
    return { drive: sum('drive'), compute: sum('compute') };
  }, [modes]);

  const setLoadMode = (loadId: string, modeId: string) =>
    setModes((m) => ({ ...m, [loadId]: modeId }));
  const applyPreset = (presetModes: Record<string, string>) =>
    setModes((m) => ({ ...m, ...presetModes }));

  const single = topology === 'single';
  const packWatts = single ? railWatts.drive + railWatts.compute : railWatts.drive;
  const packAmps = packWatts / NOMINAL_V;

  const drive = LOADS.filter((l) => l.rail === 'drive');
  const compute = LOADS.filter((l) => l.rail === 'compute');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={topology}
          onChange={(v) => setTopology(v as Topology)}
          options={[
            { value: 'single', label: 'Single pack bus (today)' },
            { value: 'split', label: 'Split rails (recommended)', color: 'var(--color-signal-ok)' },
          ]}
        />
        <div className="flex items-center gap-1.5">
          <span className="mr-1 hud-label">scenario</span>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => applyPreset(p.modes)} className="btn btn-ghost text-[10px]">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-4">
        <div className="panel flex-[1_1_420px] p-4">
          <div className="hud-label">Load switchboard</div>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-dim/80">
            Flip loads to what the robot is doing and watch the rails. Watts modeled at the
            {' '}{NOMINAL_V} V nominal pack bus.
          </p>
          <div className="mt-2 divide-y divide-rim/40">
            <div>
              <div className="pt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-dim/70">
                Drive rail — UPS pack via driver board
              </div>
              {drive.map((l) => <LoadRow key={l.id} load={l} mode={modes[l.id]} onMode={setLoadMode} />)}
            </div>
            <div>
              <div className="pt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-dim/70">
                Compute rail — Jetson barrel {single ? '(same pack today)' : '(V-mount in split mode)'}
              </div>
              {compute.map((l) => <LoadRow key={l.id} load={l} mode={modes[l.id]} onMode={setLoadMode} />)}
            </div>
          </div>
        </div>

        <div className="grid flex-[1_1_320px] content-start gap-3">
          <div className="panel space-y-3 p-4">
            <div className="hud-label">UPS pack — 3S1P (ceiling = one cell)</div>
            <PackPicker pack={pack} onPack={setPack} />
            <RailGauge
              title={single ? 'Everything on the pack' : 'Drive rail'}
              watts={packWatts}
              amps={packAmps}
              maxAmps={packDef.maxAmps}
              wh={packDef.wh}
              accent="var(--color-amber)"
            />
            {!single && (
              <>
                <div className="hud-label">Compute rail — {VMOUNT.name}</div>
                <RailGauge
                  title="Jetson + cameras"
                  watts={railWatts.compute}
                  maxWatts={VMOUNT.maxWatts}
                  wh={VMOUNT.wh}
                  accent="var(--color-cyan)"
                />
                <p className="font-mono text-[10px] leading-relaxed text-ink-dim/80">{VMOUNT.note}</p>
              </>
            )}
            {single && (
              <p className="font-mono text-[10px] leading-relaxed text-ink-dim/80">
                One 3S1P pack carries every load. The installed P30B cells give ~30 A of
                headroom — fine today. Split rails is about the future: adding the Jetson and
                new sensors without spending drive-side headroom or runtime.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {STRATEGIES.map((s, i) => {
          const color =
            s.tag === 'USE' ? 'var(--color-signal-ok)' : s.tag === 'FALLBACK' ? 'var(--color-amber)' : 'var(--color-signal-idle)';
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: i * 0.05 }}
              className="panel flex-[1_1_280px] p-4"
              style={{ borderTop: `2px solid ${color}` }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="rounded border px-1.5 py-0.5 font-mono text-[9px] font-extrabold"
                  style={{ color, borderColor: color }}
                >
                  {s.tag}
                </span>
                <span className="text-[13px] font-semibold text-ink">{s.title}</span>
              </div>
              <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-ink-dim">{s.body}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
