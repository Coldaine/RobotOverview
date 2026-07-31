'use client';

export function HonestyRail() {
  return (
    <footer className="panel border-rim bg-panel/85 flex flex-wrap items-center gap-3 p-3 shadow-sm relative overflow-hidden">
      {/* Scanline sheen */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.015)_0_1px,transparent_1px_3px)] opacity-50" />

      <span className="hud-label font-bold text-[10px] uppercase tracking-[0.14em] text-ink-dim/95 mr-1.5 z-10 select-none">
        Honesty rail
      </span>

      <div className="flex flex-wrap items-center gap-1.5 z-10 font-mono text-[9px] uppercase tracking-widest leading-none">
        {/* SOC% FAKE */}
        <span className="chip border-red-500/35 bg-red-950/20 text-red-500 py-1.5 px-3 rounded-full flex items-center gap-2">
          <span className="h-1 w-1 bg-red-500 rounded-full shadow-[0_0_4px_#ef4444]" />
          SOC% FAKE — HIDDEN
        </span>

        {/* PT JOINT FEEDBACK */}
        <span className="chip border-amber-500/35 bg-amber-950/20 text-amber-500 py-1.5 px-3 rounded-full flex items-center gap-2">
          <span className="h-1 w-1 bg-amber-500 rounded-full shadow-[0_0_4px_#f59e0b]" />
          PT JOINT FEEDBACK = Commanded, not measured
        </span>

        {/* IMU UNCALIBRATED */}
        <span className="chip border-amber-500/35 bg-amber-950/20 text-amber-500 py-1.5 px-3 rounded-full flex items-center gap-2">
          <span className="h-1 w-1 bg-amber-500 rounded-full shadow-[0_0_4px_#f59e0b]" />
          IMU UNCALIBRATED · ZERO COVARIANCE
        </span>

        {/* ESP32 NO FW HEARTBEAT */}
        <span className="chip border-red-500/35 bg-red-950/20 text-red-500 py-1.5 px-3 rounded-full flex items-center gap-2">
          <span className="h-1 w-1 bg-red-500 rounded-full shadow-[0_0_4px_#ef4444]" />
          ESP32: NO HEARTBEAT — WATCHDOG ONLY
        </span>
      </div>
    </footer>
  );
}
