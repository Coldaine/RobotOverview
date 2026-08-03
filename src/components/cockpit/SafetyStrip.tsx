'use client';

import { useEffect, useRef, useState } from 'react';
import {
  rosClient,
  useCockpitVoltage,
  useCockpitStatus,
  useConnectionState,
} from '@/lib/ros/client';
import { motion } from 'framer-motion';
import clsx from 'clsx';
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

/** RE-ARM requires the operator to hold the button this long. DISARM does not. */
const REARM_HOLD_MS = 2000;
/** How long after a successful service call we wait for the topic echo before
 * rendering UNCONFIRMED. The status slices re-render this component on every
 * aggregator tick, so the grace check re-evaluates without a timer. */
const ECHO_GRACE_MS = 4000;

export function SafetyStrip() {
  const volts = useCockpitVoltage();
  const status = useCockpitStatus();
  const connection = useConnectionState();

  const connected = connection === 'connected';

  // A hardware interlock (charging / Ethernet) means ugv_safety_monitor will
  // re-disarm any re-arm attempt, so offering RE-ARM then is a lie.
  const interlocked = status.isCharging === true || status.isEthernetConnected === true;
  const interlockReason = status.isCharging === true
    ? 'charging interlock'
    : status.isEthernetConnected === true
      ? 'ethernet interlock'
      : null;

  // The last service call we made: its TARGET allow_motion and when. Rendered
  // state is derived, never synced by an effect. "Now" comes from the status
  // slice's own receivedAt — pure store state that advances on every aggregator
  // tick, so a silent bridge reads as UNCONFIRMED, not as "still waiting".
  //   target unmet + inside grace → "awaiting robot echo"
  //   target unmet + past grace   → UNCONFIRMED (the robot never echoed)
  //   target met                  → confirmed; the request is history
  const [request, setRequest] = useState<{ target: boolean; at: number } | null>(null);
  const [armFault, setArmFault] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const targetMet = request !== null && status.allowMotion === request.target;
  const now = status.receivedAt ?? request?.at ?? 0;
  const awaitingEcho =
    request !== null && !targetMet && now - request.at < ECHO_GRACE_MS;
  const echoTimedOut =
    request !== null && !targetMet && !awaitingEcho;

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  const requestMotion = async (allow: boolean) => {
    setArmFault(null);
    setRequest({ target: allow, at: Date.now() });
    const result = await rosClient.setMotionAllowed(allow);
    if (!result.ok) {
      setRequest(null);
      setArmFault(
        `${allow ? 'RE-ARM' : 'DISARM'} UNCONFIRMED — ${result.message ?? 'service call failed'}. Robot state unknown; check /ugv/allow_motion.`,
      );
    }
  };

  const startRearmHold = () => {
    if (holdTimer.current || awaitingEcho) return;
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setHolding(false);
      void requestMotion(true);
    }, REARM_HOLD_MS);
  };

  const cancelRearmHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
  };

  const disarmed = status.allowMotion === false;
  const unconfirmed = !awaitingEcho && (armFault !== null || echoTimedOut);
  const rearmBlocked = disarmed && interlocked;

  const armLabel = !connected
    ? 'OFFLINE'
    : awaitingEcho
        ? request?.target === false
          ? 'DISARMING…'
          : 'RE-ARMING…'
      : status.allowMotion === false
        ? interlocked
          ? 'LOCKED'
          : holding
            ? 'KEEP HOLDING…'
            : 'RE-ARM · HOLD 2S'
        : 'DISARM';
  const armCaption = !connected
    ? 'offline'
      : unconfirmed
        ? 'UNCONFIRMED'
      : awaitingEcho
        ? 'awaiting robot echo'
        : interlocked
          ? (interlockReason ?? 'interlock')
             : status.allowMotion === null
             ? 'state unknown — disarm to be safe'
            : status.allowMotion
              ? 'one click — stops all motion'
              : 'hold to re-enable motion';
  const armDisabled =
    !connected || awaitingEcho || unconfirmed || rearmBlocked;
  const armBtnCls = !connected
    ? 'border-zinc-600 bg-zinc-900/40 text-zinc-500 cursor-not-allowed'
    : unconfirmed
      ? 'border-red-500 bg-red-950/60 text-red-300 shadow-hud-red text-glow-red'
      : rearmBlocked
        ? 'border-amber-500/60 bg-amber-950/30 text-amber-400 cursor-not-allowed'
        : disarmed
          ? 'border-emerald-500/50 bg-panel-2/40 text-emerald-400 hover:bg-emerald-950/30'
          : 'border-red-500/50 bg-panel-2/40 text-red-400 hover:bg-red-950/30';
  const armCaptionCls =
    !connected ? 'text-zinc-500' : unconfirmed ? 'text-red-300' : 'text-ink-dim';

  // Calculate voltage slider progress (range 8.8V - 12.6V)
  const minVolts = 8.8;
  const maxVolts = 12.6;
  const voltage = volts.voltage;
  const voltPct =
    voltage === null ? 0 : Math.max(0, Math.min(100, ((voltage - minVolts) / (maxVolts - minVolts)) * 100));
  const isLowVoltage = voltage !== null && voltage < 10.5;
  const voltStale = volts.stale && volts.hasReceived;

  return (
    <motion.section
      className="panel border-rim bg-panel/85 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5 p-4 items-stretch shadow-md relative overflow-hidden"
      aria-label="Safety strip"
      animate={disarmed ? { borderColor: ["#404040", "#f59e0b", "#404040"] } : {}}
      transition={disarmed ? { repeat: Infinity, duration: 1.5 } : {}}
    >
      {/* SCANLINE SHEEN EFFECT */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.015)_0_1px,transparent_1px_3px)] opacity-50" />

      {/* ── MOTION AUTHORITY (DISARM / RE-ARM) ──── */}
      <button
        onClick={() => {
          if (status.allowMotion !== false) void requestMotion(false);
        }}
        onPointerDown={() => {
          if (status.allowMotion === false) startRearmHold();
        }}
        onPointerUp={cancelRearmHold}
        onPointerLeave={cancelRearmHold}
        onPointerCancel={cancelRearmHold}
        disabled={armDisabled}
        className={clsx(
          'relative z-10 flex flex-col items-center justify-center gap-1.5 rounded-lg border px-4 py-3 font-display font-black tracking-widest text-sm transition-all shadow-inner select-none overflow-hidden',
          armBtnCls,
        )}
      >
        {/* Hold-to-confirm progress fill behind the RE-ARM label */}
        {holding && (
          <motion.div
            className="absolute inset-y-0 left-0 bg-emerald-500/25"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: REARM_HOLD_MS / 1000, ease: 'linear' }}
          />
        )}
        <span className="relative">{armLabel}</span>
        <small className={clsx('relative font-mono text-[9px] uppercase tracking-wider font-bold', armCaptionCls)}>
          {armCaption}
        </small>
      </button>

      {/* ── MOTION STATE ────────────────────────── */}
      <div className="flex flex-col justify-center min-w-0 z-10">
        <span className="hud-label text-[10px]">Motion state</span>
        {unconfirmed ? (
          <span className="font-mono text-lg font-bold tracking-wide mt-0.5 flex items-center gap-1.5 text-red-300 text-glow-red">
            <ShieldAlert className="h-4 w-4" /> UNCONFIRMED
          </span>
        ) : status.allowMotion === null ? (
          <span className="font-mono text-lg font-bold tracking-wide mt-0.5 flex items-center gap-1.5">
            <Unknown reason="no allow_motion publisher" />
          </span>
        ) : interlocked ? (
          <span className="font-mono text-lg font-bold tracking-wide flex items-center gap-1.5 mt-0.5 text-amber-400 text-glow-amber">
            <ShieldAlert className="h-4 w-4 animate-pulse" /> LOCKED
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
            <ShieldAlert className="h-4 w-4 animate-pulse" /> DISARMED
          </span>
        )}
        <span className="font-mono text-[10px] text-ink-dim truncate mt-1">
          {status.allowMotion === null
            ? '/ugv/allow_motion silent'
            : status.allowMotion
              ? 'motion permitted — ugv_bringup gate open'
              : (interlockReason ?? 'disarmed via /ugv/set_allow_motion')}
        </span>
        {armFault && (
          <span className="font-mono text-[9.5px] text-red-400 leading-tight mt-1">{armFault}</span>
        )}
        {echoTimedOut && !armFault && (
          <span className="font-mono text-[9.5px] text-red-400 leading-tight mt-1">
            {request?.target === false ? 'DISARM' : 'RE-ARM'} UNCONFIRMED — service answered
            but no /ugv/allow_motion echo within {ECHO_GRACE_MS / 1000}s.
          </span>
        )}
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
    </motion.section>
  );
}
