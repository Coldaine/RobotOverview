'use client';

import { 
  rosClient, 
  useCockpitVoltage, 
  useCockpitStatus,
  useConnectionState
} from '@/lib/ros/client';
import { motion } from 'framer-motion';
import { useState } from 'react';
import clsx from 'clsx';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export function SafetyStrip() {
  const { voltage } = useCockpitVoltage();
  const status = useCockpitStatus();
  const connection = useConnectionState();

  const [estopLocal, setEstopLocal] = useState(false);

  // The robot's twist_mux is the source of truth for the lock; local optimistic
  // state only applies while connected and is overridden by a real mux report.
  const connected = connection === 'connected';
  const estopEngaged = status.muxSource === 'E-STOP lock' || (connected && estopLocal);

  // Only flip the button when the command actually leaves the socket. A
  // disconnected click must never present a false "LOCKED".
  const handleEstop = () => {
    if (!connected) return;
    const next = !estopEngaged;
    const sent = rosClient.publish('/cmd_vel_estop_lock', { data: next });
    if (sent) setEstopLocal(next);
  };

  // Calculate voltage slider progress (range 8.8V - 12.6V)
  const minVolts = 8.8;
  const maxVolts = 12.6;
  const voltPct = Math.max(0, Math.min(100, ((voltage - minVolts) / (maxVolts - minVolts)) * 100));

  const isLowVoltage = voltage > 0 && voltage < 10.5;

  return (
    <motion.section 
      className="panel border-rim bg-panel/85 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5 p-4 items-stretch shadow-md relative overflow-hidden" 
      aria-label="Safety strip"
      animate={estopEngaged ? { borderColor: ["#404040", "#ef4444", "#404040"] } : {}}
      transition={estopEngaged ? { repeat: Infinity, duration: 1.5 } : {}}
    >
      {/* SCANLINE SHEEN EFFECT */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.015)_0_1px,transparent_1px_3px)] opacity-50" />

      {/* ── E-STOP BUTTON ───────────────────────── */}
      <button 
        onClick={handleEstop}
        disabled={!connected}
        className={clsx(
          "relative z-10 flex flex-col items-center justify-center gap-1.5 rounded-lg border px-4 py-3 font-display font-black tracking-widest text-sm transition-all shadow-inner select-none",
          !connected
            ? "border-zinc-600 bg-zinc-900/40 text-zinc-500 cursor-not-allowed"
            : estopEngaged 
              ? "border-emerald-500 bg-emerald-950/40 text-emerald-400 shadow-hud-green text-glow-emerald" 
              : "border-red-500 bg-red-950/40 text-red-500 shadow-hud-red text-glow-red animate-pulse"
        )}
      >
        <span>{!connected ? "E-STOP" : estopEngaged ? "ESTOP LOCKED" : "E-STOP"}</span>
        <small className={clsx("font-mono text-[9px] uppercase tracking-wider font-bold", !connected ? "text-zinc-500" : estopEngaged ? "text-emerald-500" : "text-red-500/80")}>
          {!connected ? "offline" : estopEngaged ? "click to clear" : "mux lock · pri 255"}
        </small>
      </button>

      {/* ── MOTION STATE ────────────────────────── */}
      <div className="flex flex-col justify-center min-w-0 z-10">
        <span className="hud-label text-[10px]">Motion state</span>
        {status.allowMotion ? (
          <span className="font-mono text-lg font-bold tracking-wide text-emerald-400 text-glow-emerald flex items-center gap-1.5 mt-0.5">
            <ShieldCheck className="h-4 w-4" /> ARMED
          </span>
        ) : (
          <span className="font-mono text-lg font-bold tracking-wide text-amber-400 text-glow-amber flex items-center gap-1.5 mt-0.5">
            <ShieldAlert className="h-4 w-4 animate-pulse" /> LOCKED
          </span>
        )}
        <span className="font-mono text-[10px] text-ink-dim truncate mt-1">
          {status.allowMotion ? "Live operation active" : "re-gate: beast-paces Ph.2 pending"}
        </span>
      </div>

      {/* ── WATCHDOG ────────────────────────────── */}
      <div className="flex flex-col justify-center min-w-0 z-10">
        <span className="hud-label text-[10px]">cmd_vel watchdog</span>
        <span className={clsx(
          "font-mono text-lg font-bold tracking-wide mt-0.5", 
          status.watchdogArmed ? "text-emerald-400 text-glow-emerald" : "text-amber-500"
        )}>
          {status.watchdogArmed ? "ARMED · 0.5 s" : "OFF-LINE"}
        </span>
        <span className="font-mono text-[10px] text-ink-dim truncate mt-1">
          {status.watchdogFired ? "WATCHDOG TRIGGERED" : "test: pending · ESP32 no FW HB"}
        </span>
      </div>

      {/* ── ACTIVE SOURCE ───────────────────────── */}
      <div className="flex flex-col justify-center min-w-0 z-10">
        <span className="hud-label text-[10px]">Active source · age</span>
        <span className="font-mono text-lg font-bold tracking-wide text-ink-dim mt-0.5 truncate">
          <span className={clsx(status.muxSource !== 'NONE' && 'text-cyan text-glow-cyan font-extrabold')}>
            {status.muxSource}
          </span>
          <span className="text-sm font-medium ml-1">
            {status.cmdAge >= 0 ? `· ${status.cmdAge.toFixed(2)}s` : '· —'}
          </span>
        </span>
        <span className="font-mono text-[10px] text-ink-dim truncate mt-1">
          /cmd_vel publishers: {status.pubCount}
        </span>
      </div>

      {/* ── VOLTAGE TRACK BAR ───────────────────── */}
      <div className="flex flex-col justify-center z-10 sm:col-span-2 md:col-span-1 min-w-0 col-span-1">
        <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
          <span className="hud-label text-[10px]">Pack bus</span>
          <span className={clsx("font-mono text-lg font-black", isLowVoltage ? "text-amber-400 text-glow-amber" : voltage > 0 ? "text-cyan text-glow-cyan" : "text-ink")}>
            {voltage > 0 ? `${voltage.toFixed(2)} V` : "— V"}
          </span>
        </div>

        {/* TRACKBAR BAR */}
        <div className="relative h-2.5 rounded-full bg-hull border border-rim/60 overflow-visible mt-2">
          {voltage > 0 && (
            <div 
              className={clsx(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-300 opacity-90",
                isLowVoltage ? "bg-gradient-to-r from-red-500 to-amber-500" : "bg-gradient-to-r from-amber-500 to-emerald-400"
              )}
              style={{ width: `${voltPct}%` }}
            />
          )}
          {/* Brownout @ 8.8V */}
          <div className="absolute top-[-3px] bottom-[-3px] w-[1px] bg-red-500" style={{ left: '0%' }} title="8.8V Brownout">
            <span className="absolute top-[-11px] left-[-4px] font-mono text-[6px] text-red-500/80 font-bold scale-[0.8]">8.8</span>
          </div>
          {/* Floor @ 10.5V */}
          <div className="absolute top-[-3px] bottom-[-3px] w-[1.5px] bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]" style={{ left: '44.7%' }} title="10.5V Motion Floor">
            <span className="absolute top-[-11px] left-[-4px] font-mono text-[6px] text-amber-500 font-bold scale-[0.8]">10.5</span>
          </div>
        </div>

        <div className="flex justify-between items-center mt-1.5 font-mono text-[8.5px] text-ink-dim leading-none">
          {/* No reading is not a pass. With the socket down `voltage` is 0, and
              an unqualified "Ok" would vouch for a pack we cannot see. */}
          <span>{voltage <= 0 ? "NO READING" : isLowVoltage ? "LOW - CHARGE FIRST" : "Ok"}</span>
          <span className="text-[8px] opacity-70">SOC%: NOT DERIVABLE FROM VOLTS</span>
        </div>
      </div>
    </motion.section>
  );
}
