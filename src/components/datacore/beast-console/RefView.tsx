'use client';
/**
 * Reference — interactive 40-pin map, power-rail rules, the labeled board
 * diagram, marked-up schematic, provenance & open items.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import Link from 'next/link';
import { FileText, Camera } from 'lucide-react';
import {
  PINS40, PROVENANCE, DOCUMENTS, CAMERA_SHORTLIST_SUPERSEDED, OPEN_ITEMS, INTEGRITY_NOTE,
  DRIVER_CALLOUTS, DRIVER_CALLOUT_IMAGE,
  type PinDef, type PinRole, type CalloutDef,
} from './reference-data';
import { NODE_INDEX } from './bench-data';
import { SPRING_SOFT } from './ConsoleUi';

const SCHEMATIC_SRC = '/datacore/beast-schematic-annotated.png';

const ROLE: Record<PinRole, { color: string; label: string }> = {
  pwr5: { color: 'var(--color-signal-crit)', label: '5V' },
  pwr3: { color: 'var(--color-amber-soft)', label: '3V3' },
  gnd: { color: 'var(--color-signal-idle)', label: 'GND' },
  uart: { color: 'var(--color-amber)', label: 'UART' },
  i2c: { color: '#a78bfa', label: 'I2C' },
  nc: { color: 'var(--color-rim)', label: '—' },
};

function Pin({ p, selected, onSelect, index }: {
  p: PinDef;
  selected: boolean;
  onSelect: (pin: number) => void;
  index: number;
}) {
  const role = ROLE[p.role];
  const hot = !!p.used;
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(p.pin)}
      initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ ...SPRING_SOFT, delay: index * 0.012 }}
      whileHover={{ scale: 1.25 }}
      title={`pin ${p.pin} — ${p.name}`}
      className="h-[26px] w-[26px] rounded-md p-0 font-mono text-[9px] font-bold"
      style={{
        background: p.role === 'nc'
          ? 'transparent'
          : hot || selected
            ? role.color
            : `color-mix(in srgb, ${role.color} 28%, transparent)`,
        border: `1.6px solid ${selected ? 'var(--color-ink)' : role.color}`,
        color: hot || selected ? 'var(--color-void)' : 'var(--color-ink-dim)',
        boxShadow: hot ? `0 0 10px ${role.color}` : 'none',
      }}
    >
      {p.pin}
    </motion.button>
  );
}

function Pinout() {
  const [sel, setSel] = useState(8);
  const selPin = PINS40.find((p) => p.pin === sel) ?? PINS40[7];
  const odd = PINS40.filter((p) => p.pin % 2 === 1);
  const even = PINS40.filter((p) => p.pin % 2 === 0);
  return (
    <div className="panel flex-[1_1_380px] p-4">
      <div className="hud-label">40-pin host header — both boards, same map</div>
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-ink-dim">
        Driver board and Jetson both follow the Raspberry-Pi header convention, which is why the
        3-wire link is same-pin on both ends. Net names extracted from the schematic&apos;s vector layer.
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-5">
        <div className="panel-inset grid grid-cols-[26px_26px] gap-1 p-3">
          {Array.from({ length: 20 }, (_, r) => [odd[r], even[r]]).flat().map((p, i) => (
            <Pin key={p.pin} p={p} selected={sel === p.pin} onSelect={setSel} index={i} />
          ))}
        </div>
        <div className="min-w-[200px] flex-[1_1_200px]">
          <div className="font-mono text-sm font-bold text-ink">pin {selPin.pin} · {selPin.name}</div>
          <span className="chip mt-1.5" style={{ borderColor: ROLE[selPin.role].color, color: ROLE[selPin.role].color }}>
            {ROLE[selPin.role].label}
          </span>
          {selPin.used && (
            <p className="mt-2.5 font-mono text-[11px] leading-relaxed text-ink">
              <strong>Used in the Orin link:</strong> {selPin.used}
            </p>
          )}
          <div className="mt-4 grid gap-1.5 font-mono text-[11px] text-ink-dim">
            <div>8 <span className="text-amber">P_TX</span> → Jetson 10 RXD</div>
            <div>10 <span className="text-amber">P_RX</span> ← Jetson 8 TXD</div>
            <div>6 <span className="text-signal-idle">GND</span> → Jetson 6 GND</div>
            <div className="text-ink-dim/70">115200 baud · 3.3 V · /dev/ttyTHS1</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const RAILS = [
  { rail: 'UPS → driver DC-IN', spec: 'XH2.54 · 7–13 V', verdict: 'ok', note: 'powers ESP32, motors, servos, spotlight' },
  { rail: 'UPS pigtail → Orin barrel', spec: '5.5×2.5 mm · 9–20 V · 45 W', verdict: 'ok', note: "the Orin's rail in this build" },
  { rail: 'Driver 5 V buck → 40-pin', spec: 'MP8759GD · 5 V / 5 A', verdict: 'no', note: 'fed the Pi 5. Orin needs 9–20 V — never this' },
  { rail: '12.6 V 2 A charger → UPS', spec: 'one-time + charging', verdict: 'warn', note: 'required once to wake the UPS protection circuit' },
  { rail: 'Driver 5 V buck → OAK-D Pro Y-adapter', spec: '5 V / 5 A · future', verdict: 'ok', note: 'the idle Pi rail finds a job — covers the 15 W IR peak' },
  { rail: 'Pack tap (add XT30) → Mid-360S', spec: '9–27 V in · ~6.5 W · future', verdict: 'ok', note: 'new spliced tap — NOT the CH343P LiDAR bridge' },
  { rail: 'V-mount 15 V PD trigger → Orin barrel', spec: '99 Wh · 45 W · future', verdict: 'ok', note: 'split-rail plan — see the Power Planner tab' },
] as const;

const VERDICT = {
  ok: { color: 'var(--color-signal-ok)', tag: 'USE' },
  no: { color: 'var(--color-signal-crit)', tag: 'NEVER' },
  warn: { color: 'var(--color-amber)', tag: 'ONCE' },
} as const;

function PowerRules() {
  return (
    <div className="panel flex-[1_1_380px] p-4">
      <div className="hud-label">Power rails — who feeds whom</div>
      <div className="mt-2.5 grid gap-2">
        {RAILS.map((r, i) => {
          const v = VERDICT[r.verdict];
          return (
            <motion.div
              key={r.rail}
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING_SOFT, delay: i * 0.06 }}
              className="panel-inset flex items-center gap-3 p-2.5"
              style={{ borderLeft: `3px solid ${v.color}` }}
            >
              <span
                className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-extrabold"
                style={{ color: v.color, borderColor: v.color }}
              >
                {v.tag}
              </span>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-ink">{r.rail}</div>
                <div className="font-mono text-[10px] text-ink-dim">{r.spec} · {r.note}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink-dim/80">
        Your pigtail&apos;s job: UPS output → the Orin&apos;s barrel jack. Check polarity — center is positive.
      </p>
    </div>
  );
}

function CalloutRow({ c, index }: { c: CalloutDef; index: number }) {
  const node = c.port ? NODE_INDEX[c.port] : undefined;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING_SOFT, delay: index * 0.02 }}
      className="panel-inset flex items-start gap-2 p-2"
    >
      <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full border border-cyan/60 font-mono text-[9px] font-extrabold text-cyan">
        {c.n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-semibold text-ink">{c.label}</div>
        {c.tell && <div className="font-mono text-[10px] leading-relaxed text-ink-dim">{c.tell}</div>}
      </div>
      {node?.kind === 'port' && (
        <span className="chip shrink-0 border-cyan/40 text-cyan">{node.label}</span>
      )}
    </motion.div>
  );
}

function CalloutDiagram() {
  const [zoom, setZoom] = useState(false);
  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="hud-label">Labeled board diagram — ROS Driver for Robots</div>
        <span className="font-mono text-[10px] text-ink-dim/70">click image to {zoom ? 'fit' : 'zoom'}</span>
      </div>
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-ink-dim">
        Waveshare&apos;s own callout diagram — the best physical-ID reference this project has for the
        board. It settles the two USB-C ports:{' '}
        <span className="text-ink">6 is the ESP32 / host link</span> (left of the pair, silkscreen
        USB, beside the DC jack) and <span className="text-ink">7 is the LiDAR bridge</span>
        {' '}(silkscreen LIDAR), which sits unused on BEAST because the D500 rides the Audio HAT.
        Chips tag the connector the Live Plug view tracks.
      </p>
      <div className="mt-2.5 max-h-[600px] overflow-auto rounded-md border border-rim bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- large pan/zoom board photo; next/image adds nothing here */}
        <img
          src={DRIVER_CALLOUT_IMAGE}
          alt="Waveshare labeled callout diagram of the ROS Driver for Robots board, front and back views with callouts 1 to 19"
          loading="lazy"
          onClick={() => setZoom((z) => !z)}
          className="block"
          style={{ width: zoom ? '1400px' : '100%', maxWidth: zoom ? 'none' : '100%', cursor: zoom ? 'zoom-out' : 'zoom-in' }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-4">
        {(['front', 'back'] as const).map((face) => (
          <div key={face} className="min-w-[280px] flex-[1_1_300px]">
            <div className="hud-label mb-1.5">
              {face === 'front' ? 'Front view · callouts 1–10' : 'Back view · callouts 11–19'}
            </div>
            <div className="grid gap-1">
              {DRIVER_CALLOUTS.filter((c) => c.face === face).map((c, i) => (
                <CalloutRow key={c.n} c={c} index={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Schematic() {
  const [zoom, setZoom] = useState(false);
  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="hud-label">Marked-up schematic — ROS Driver for Robots</div>
        <span className="font-mono text-[10px] text-ink-dim/70">click image to {zoom ? 'fit' : 'zoom'}</span>
      </div>
      <div className="mb-2 mt-2 flex flex-wrap gap-3.5 font-mono text-[10px]">
        <span className="text-cyan">① LiDAR UART→USB bridge</span>
        <span className="text-signal-crit">② power in + 5 V buck</span>
        <span className="text-signal-ok">③ 40-pin host header</span>
        <span style={{ color: '#a78bfa' }}>④ ESP32 core</span>
      </div>
      <div className="max-h-[640px] overflow-auto rounded-md border border-rim bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- large pan/zoom schematic; next/image adds nothing here */}
        <img
          src={SCHEMATIC_SRC}
          alt="Annotated schematic of the ROS Driver for Robots board"
          loading="lazy"
          onClick={() => setZoom((z) => !z)}
          className="block"
          style={{ width: zoom ? '1900px' : '100%', maxWidth: zoom ? 'none' : '100%', cursor: zoom ? 'zoom-out' : 'zoom-in' }}
        />
      </div>
    </div>
  );
}

function Documents() {
  return (
    <div className="panel flex-[1_1_380px] p-4">
      <div className="hud-label">Board documents — served by this app</div>
      <div className="mt-2 grid gap-1.5">
        {DOCUMENTS.map((d, i) => (
          <motion.a
            key={d.file}
            href={d.file} target="_blank" rel="noreferrer"
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING_SOFT, delay: i * 0.04 }}
            className="panel-inset group flex items-center gap-2.5 p-2 transition hover:border-cyan/60"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-cyan" />
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-ink group-hover:text-cyan">{d.label}</div>
              <div className="truncate font-mono text-[10px] text-ink-dim">{d.note}</div>
            </div>
          </motion.a>
        ))}
      </div>
    </div>
  );
}

function CameraShortlist() {
  const s = CAMERA_SHORTLIST_SUPERSEDED;
  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="hud-label">{s.title}</div>
        <span className="chip border-amber/50 text-amber">research superseded</span>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_SOFT}
        className="panel-inset mt-2.5 p-3"
        style={{ borderLeft: '3px solid var(--color-amber)' }}
      >
        <div className="flex items-start gap-2">
          <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
          <p className="font-mono text-[10.5px] leading-relaxed text-ink">{s.note}</p>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {s.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="chip border-cyan/40 text-cyan hover:border-cyan hover:bg-cyan/10"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export function RefView() {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-stretch gap-4">
        <Pinout />
        <PowerRules />
      </div>
      <CalloutDiagram />
      <CameraShortlist />
      <Schematic />
      <div className="flex flex-wrap gap-4">
        <Documents />
        <div className="panel flex-[1_1_380px] p-4">
          <div className="hud-label">Provenance</div>
          <div className="mt-2 grid gap-2">
            {PROVENANCE.map((p) => (
              <div key={p.label} className="text-[12px]">
                <div className="font-semibold text-ink">{p.label}</div>
                <div className="font-mono text-[10px] text-ink-dim">{p.note}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel flex-[1_1_380px] p-4">
          <div className="hud-label">Confidence &amp; open items</div>
          <ul className="mt-2 grid list-disc gap-1.5 pl-4">
            {OPEN_ITEMS.map((o, i) => (
              <li key={i} className="font-mono text-[10px] leading-relaxed text-ink-dim">{o}</li>
            ))}
          </ul>
          <div className={clsx('mt-3 rounded-md border border-amber/60 bg-amber/10 p-2.5', 'font-mono text-[10px] leading-relaxed text-ink')}>
            {INTEGRITY_NOTE}
          </div>
        </div>
      </div>
    </div>
  );
}
