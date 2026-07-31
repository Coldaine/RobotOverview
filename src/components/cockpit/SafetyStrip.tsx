'use client';

import {
  rosClient,
  useCockpitVoltage,
  useCockpitStatus,
  useCockpitEstop,
  useConnectionState,
  ESTOP_CONFIRM_GRACE_MS,
  ESTOP_MUX_SOURCE,
} from '@/lib/ros/client';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, HelpCircle } from 'lucide-react';

/** Rendered wherever the robot has told us nothing. Never a default value. */
function Unknown({ reason = 'no publisher' }: { readonly reason?: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-ink-dim/80" title={`UNKNOWN — ${reason}`}>
      <HelpCircle className="h-3 w-3" aria-hidden="true" />
      UNKNOWN
    </span>
  );
}

export function SafetyStrip() {
  const volts = useCockpitVoltage();
  const status = useCockpitStatus();
  const connection = useConnectionState();
  const estop = useCockpitEstop();

  const connected = connection === 'connected';

  // ── E-STOP: THREE STATES, NOT TWO ─────────────────────────────────────────
  // Latching intent is not proof of a stop. The only confirmation that the
  // robot is locked is twist_mux reporting it. So:
  //   CLEAR       — no intent, no robot lock
  //   ASSERTING   — we are holding the heartbeat, the robot has NOT echoed it
  //   LOCKED      — the robot reports the lock (green, and only then)
  // ASSERTING past the grace window is styled as loudly as a failure, because
  // that is what it is: the operator pressed stop and nothing came back.
  const robotConfirmed = status.muxSource === ESTOP_MUX_SOURCE;
  const intentLatched = connected && estop.engaged;

  // Re-render across the grace boundary so "ASSERTING" escalates on its own.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!intentLatched || robotConfirmed) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [intentLatched, robotConfirmed]);

  const assertingFor = intentLatched && estop.engagedAt !== null ? now - estop.engagedAt : 0;
  const asserting = intentLatched && !robotConfirmed;
  const assertStalled = asserting && assertingFor > ESTOP_CONFIRM_GRACE_MS;

  const estopMode: 'offline' | 'readonly' | 'locked' | 'asserting' | 'clear' = !connected
    ? 'offline'
    : !estop.writer
      ? 'readonly'
      : robotConfirmed
        ? 'locked'
        : asserting
          ? 'asserting'
          : 'clear';

  const handleEstop = () => {
    if (!connected) return;
    if (!estop.writer) {
      // The "other tab" may have been closed without yielding. Never let a
      // stale claim be the last word between the operator and a stop — re-probe
      // so the role can come back to this tab within the grace window.
      rosClient.probeEstopWriter();
      return;
    }
    rosClient.setEstopLock(!(robotConfirmed || estop.engaged));
  };

  const estopLabel = {
    offline: 'E-STOP',
    readonly: 'E-STOP',
    locked: 'ESTOP LOCKED',
    asserting: 'ASSERTING',
    clear: 'E-STOP',
  }[estopMode];

  const estopCaption = {
    offline: 'offline',
    readonly: 'held by another tab · click to re-check',
    locked: estop.heartbeat ? 'robot confirmed · holding 2 hz' : 'robot confirmed · not holding',
    asserting: assertStalled
      ? 'awaiting robot confirmation — no echo'
      : 'awaiting robot confirmation',
    clear: estop.releasing ? 'clearing · resending' : 'mux lock · pri 255',
  }[estopMode];

  const estopBtnCls = {
    offline: 'border-zinc-600 bg-zinc-900/40 text-zinc-500 cursor-not-allowed',
    // Not `disabled`: a disabled control could not run the re-probe, which is
    // the only way back from a writer tab that closed without yielding.
    readonly: 'border-zinc-600 bg-zinc-900/40 text-zinc-500',
    locked: 'border-emerald-500 bg-emerald-950/40 text-emerald-400 shadow-hud-green text-glow-emerald',
    // Deliberately as loud as a fault: an unconfirmed stop IS a fault.
    asserting: assertStalled
      ? 'border-red-500 bg-red-950/60 text-red-300 shadow-hud-red text-glow-red animate-pulse'
      : 'border-amber-500 bg-amber-950/40 text-amber-300 shadow-hud-amber text-glow-amber animate-pulse',
    clear: 'border-red-500 bg-red-950/40 text-red-500 shadow-hud-red text-glow-red animate-pulse',
  }[estopMode];

  const estopCaptionCls = {
    offline: 'text-zinc-500',
    readonly: 'text-zinc-500',
    locked: 'text-emerald-500',
    asserting: assertStalled ? 'text-red-300' : 'text-amber-400',
    clear: 'text-red-500/80',
  }[estopMode];

  // Calculate voltage slider progress (range 8.8V - 12.6V)
  const minVolts = 8.8;
  const maxVolts = 12.6;
  const voltage = volts.voltage;
  const voltPct =
    voltage === null ? 0 : Math.max(0, Math.min(100, ((voltage - minVolts) / (maxVolts - minVolts)) * 100));
  const isLowVoltage = voltage !== null && voltage < 10.5;
  const voltStale = volts.stale && volts.hasReceived;

  return (
    <section
      className="panel border-rim bg-panel/85 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5 p-4 items-stretch shadow-md relative overflow-hidden"
      aria-label="Safety strip"
    >
      {/* SCANLINE SHEEN EFFECT */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.015)_0_1px,transparent_1px_3px)] opacity-50" />

      {/* ── E-STOP BUTTON ───────────────────────── */}
      <button
        onClick={handleEstop}
        disabled={!connected}
        className={clsx(
          'relative z-10 flex flex-col items-center justify-center gap-1.5 rounded-lg border px-4 py-3 font-display font-black tracking-widest text-sm transition-all shadow-inner select-none',
          estopBtnCls,
        )}
      >
        <span>{estopLabel}</span>
        <small className={clsx('font-mono text-[9px] uppercase tracking-wider font-bold', estopCaptionCls)}>
          {estopCaption}
        </small>
      </button>

      {/* ── MOTION STATE ────────────────────────── */}
      <div className="flex flex-col justify-center min-w-0 z-10">
        <span className="hud-label text-[10px]">Motion state</span>
        {status.allowMotion === null ? (
          <span className="font-mono text-lg font-bold tracking-wide mt-0.5 flex items-center gap-1.5">
            <Unknown reason="no allow_motion publisher" />
          </span>
        ) : status.allowMotion ? (
          <span
            className={clsx(
              'font-mono text-lg font-bold tracking-wide flex items-center gap-1.5 mt-0.5',
              status.stale ? 'text-ink-dim line-through' : 'text-emerald-400 text-glow-emerald',
            )}
          >
            <ShieldCheck className="h-4 w-4" /> ARMED
          </span>
        ) : (
          <span
            className={clsx(
              'font-mono text-lg font-bold tracking-wide flex items-center gap-1.5 mt-0.5',
              status.stale ? 'text-ink-dim line-through' : 'text-amber-400 text-glow-amber',
            )}
          >
            <ShieldAlert className="h-4 w-4 animate-pulse" /> LOCKED
          </span>
        )}
        <span className="font-mono text-[10px] text-ink-dim truncate mt-1">
          {status.allowMotion === null
            ? '/ugv/allow_motion not deployed'
            : status.allowMotion
              ? 'Live operation active'
              : 're-gate: beast-paces Ph.2 pending'}
        </span>
      </div>

      {/* ── WATCHDOG ────────────────────────────── */}
      <div className="flex flex-col justify-center min-w-0 z-10">
        <span className="hud-label text-[10px]">cmd_vel watchdog</span>
        <span
          className={clsx(
            'font-mono text-lg font-bold tracking-wide mt-0.5',
            status.watchdogArmed === null
              ? ''
              : status.stale
                ? 'text-ink-dim line-through'
                : status.watchdogArmed
                  ? 'text-emerald-400 text-glow-emerald'
                  : 'text-amber-500',
          )}
        >
          {status.watchdogArmed === null ? (
            <Unknown reason="no watchdog publisher" />
          ) : status.watchdogArmed ? (
            'ARMED · 0.5 s'
          ) : (
            'OFF-LINE'
          )}
        </span>
        <span className="font-mono text-[10px] text-ink-dim truncate mt-1">
          {status.watchdogFired === true ? 'WATCHDOG TRIGGERED' : 'test: pending · ESP32 no FW HB'}
        </span>
      </div>

      {/* ── ACTIVE SOURCE ───────────────────────── */}
      <div className="flex flex-col justify-center min-w-0 z-10">
        <span className="hud-label text-[10px]">Active source · age</span>
        <span
          className={clsx(
            'font-mono text-lg font-bold tracking-wide mt-0.5 truncate',
            status.stale ? 'text-ink-dim line-through' : 'text-ink-dim',
          )}
        >
          {status.muxSource === null ? (
            <Unknown reason="/cockpit/status has no publisher" />
          ) : (
            <span className={clsx(!status.stale && 'text-cyan text-glow-cyan font-extrabold')}>
              {status.muxSource}
            </span>
          )}
          <span className="text-sm font-medium ml-1">
            {status.cmdAge !== null && status.cmdAge >= 0 ? `· ${status.cmdAge.toFixed(2)}s` : '· —'}
          </span>
        </span>
        <span className="font-mono text-[10px] text-ink-dim truncate mt-1">
          /cmd_vel publishers: {status.pubCount ?? '—'}
        </span>
      </div>

      {/* ── VOLTAGE TRACK BAR ───────────────────── */}
      <div className="flex flex-col justify-center z-10 sm:col-span-2 md:col-span-1 min-w-0 col-span-1">
        <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
          <span className="hud-label text-[10px]">Pack bus</span>
          <span
            className={clsx(
              'font-mono text-lg font-black',
              voltage === null || voltStale
                ? 'text-ink-dim line-through decoration-1'
                : isLowVoltage
                  ? 'text-amber-400 text-glow-amber'
                  : 'text-cyan text-glow-cyan',
            )}
          >
            {voltage === null ? '— V' : `${voltage.toFixed(2)} V`}
          </span>
        </div>

        {/* TRACKBAR BAR */}
        <div className="relative h-2.5 rounded-full bg-hull border border-rim/60 overflow-visible mt-2">
          {voltage !== null && (
            <div
              className={clsx(
                'absolute inset-y-0 left-0 rounded-full transition-all duration-300',
                voltStale ? 'bg-zinc-700 opacity-50' : 'opacity-90',
                !voltStale &&
                  (isLowVoltage
                    ? 'bg-gradient-to-r from-red-500 to-amber-500'
                    : 'bg-gradient-to-r from-amber-500 to-emerald-400'),
              )}
              style={{ width: `${voltPct}%` }}
            />
          )}
          {/* Brownout @ 8.8V */}
          <div className="absolute top-[-3px] bottom-[-3px] w-[1px] bg-red-500" style={{ left: '0%' }} title="8.8V Brownout">
            <span className="absolute top-[-11px] left-[-4px] font-mono text-[6px] text-red-500/80 font-bold scale-[0.8]">8.8</span>
          </div>
          {/* Floor @ 10.5V */}
          <div
            className="absolute top-[-3px] bottom-[-3px] w-[1.5px] bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]"
            style={{ left: '44.7%' }}
            title="10.5V Motion Floor"
          >
            <span className="absolute top-[-11px] left-[-4px] font-mono text-[6px] text-amber-500 font-bold scale-[0.8]">10.5</span>
          </div>
        </div>

        <div className="flex justify-between items-center mt-1.5 font-mono text-[8.5px] text-ink-dim leading-none">
          <span>
            {voltage === null
              ? 'no /ugv/voltage publisher'
              : voltStale
                ? 'STALE — last value shown'
                : isLowVoltage
                  ? 'LOW - CHARGE FIRST'
                  : 'Ok'}
          </span>
        </div>
      </div>
    </section>
  );
}
