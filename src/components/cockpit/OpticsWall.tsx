'use client';

import { useEffect, useRef, useState } from 'react';
import { rosClient, useCockpitOverheadClearance } from '@/lib/ros/client';
import { Eye, Video } from 'lucide-react';
import clsx from 'clsx';

/** Above this the picture is old enough to mislead an operator who is driving. */
const LATENCY_ALARM_MS = 500;

type FeedState = { fps: number; active: boolean; latencyMs: number | null };
const IDLE_FEED: FeedState = { fps: 0, active: false, latencyMs: null };

export function OpticsWall() {
  const clearance = useCockpitOverheadClearance();

  const rgbRef = useRef<HTMLImageElement | null>(null);
  const depthRef = useRef<HTMLImageElement | null>(null);

  // Frame counts live in refs so inbound frames never re-render React (the
  // image bytes go straight to <img>.src). Only the once-a-second FPS tick
  // touches state.
  const rgbFrameCount = useRef(0);
  const depthFrameCount = useRef(0);
  const rgbLatency = useRef<number | null>(null);
  const depthLatency = useRef<number | null>(null);
  const [rgb, setRgb] = useState<FeedState>(IDLE_FEED);
  const [depth, setDepth] = useState<FeedState>(IDLE_FEED);

  // Sample the frame counters once per second for FPS + liveness.
  useEffect(() => {
    const timer = setInterval(() => {
      const r = rgbFrameCount.current;
      const d = depthFrameCount.current;
      setRgb({ fps: r, active: r > 0, latencyMs: rgbLatency.current });
      setDepth({ fps: d, active: d > 0, latencyMs: depthLatency.current });
      rgbFrameCount.current = 0;
      depthFrameCount.current = 0;
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Hook up image topic subscriptions
  useEffect(() => {
    const unsubRgb = rosClient.registerImageCallback('/oak/rgb/image_raw/compressed', (frame) => {
      if (rgbRef.current) rgbRef.current.src = frame.src;
      rgbFrameCount.current += 1;
      rgbLatency.current = frame.latencyMs;
    });

    const unsubDepth = rosClient.registerImageCallback('/cockpit/depth/compressed', (frame) => {
      if (depthRef.current) depthRef.current.src = frame.src;
      depthFrameCount.current += 1;
      depthLatency.current = frame.latencyMs;
    });

    return () => {
      unsubRgb();
      unsubDepth();
    };
  }, []);

  // Determine safety limits for overhead clearance
  // Mission Undercroft duct clearance floor. Below 0.18m is critical, below 0.28m is warning
  const clearanceStatus = (() => {
    const m = clearance.meters;
    if (!clearance.hasReceived) {
      return { label: 'UNKNOWN', cls: 'text-ink-dim border-rim/60 bg-panel-2/20' };
    }
    if (clearance.stale) return { label: 'STALE', cls: 'text-ink-dim border-rim/60 bg-panel-2/20 line-through' };
    if (m === null || m <= 0 || m > 5.0) return { label: 'UNKNOWN', cls: 'text-ink-dim border-rim/60 bg-panel-2/20' };
    if (m < 0.16) return { label: 'CRITICAL', cls: 'text-rose-400 border-rose-500/30 bg-rose-500/10 animate-pulse text-glow-red' };
    if (m < 0.28) return { label: 'WARNING', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
    return { label: 'CLEAR', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' };
  })();

  const laggy = (f: FeedState) => f.active && f.latencyMs !== null && f.latencyMs > LATENCY_ALARM_MS;

  const latencyChip = (f: FeedState) => {
    if (!f.active) return <span className="text-ink-dim">0.0 FPS</span>;
    return (
      <span className={clsx('font-bold', laggy(f) ? 'text-rose-400' : 'text-emerald-400')}>
        {f.fps.toFixed(1)} FPS
        {f.latencyMs !== null && <span className="ml-1 font-normal">· {f.latencyMs.toFixed(0)} ms</span>}
      </span>
    );
  };

  return (
    <section className="panel border-rim bg-panel/85 flex flex-col p-4 shadow-md">
      <div className="flex items-center justify-between gap-1.5 mb-3">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center gap-1.5 leading-none">
          <Eye className="h-3.5 w-3.5" /> Optics{' '}
          <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">/compressed transports over bridge</span>
        </h2>
        {/* Overhead Clearance HUD */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9.5px] uppercase text-ink-dim scale-90">Clearance:</span>
          <div
            className={clsx(
              'chip flex items-center gap-1.5 rounded-full px-2 py-0.5 border font-mono text-[10px] font-bold leading-none tracking-wider',
              clearanceStatus.cls,
            )}
          >
            <span>{clearance.meters !== null && clearance.hasReceived ? `${clearance.meters.toFixed(2)}m` : '—'}</span>
            <span>[{clearanceStatus.label}]</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        {/* ── OAK RGB FEED (WIDE) ────────────────── */}
        <div
          className={clsx(
            'relative rounded-lg overflow-hidden border bg-hull aspect-[21/9] col-span-2 flex items-center justify-center group',
            laggy(rgb) ? 'border-rose-500/70' : 'border-rim/70',
          )}
        >
          {/* Scanline sheen */}
          <div className="pointer-events-none absolute inset-0 z-20 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.15)_0_1px,transparent_1px_3px)] opacity-30" />

          {/* Fallback pattern */}
          <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_68%_78%,rgba(245,158,11,0.14),transparent_34%),radial-gradient(circle_at_30%_60%,rgba(122,242,242,0.08),transparent_45%),linear-gradient(180deg,#1c2130_0%,#090d16_100%)] opacity-80" />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={rgbRef}
            alt="RGB Video Feed"
            className={clsx(
              'absolute inset-0 w-full h-full object-cover z-10',
              !rgb.active && 'hidden',
              // A late frame is not a live view. Wash it out rather than let it
              // read as the robot's current surroundings.
              laggy(rgb) && 'opacity-30 grayscale',
            )}
          />

          {laggy(rgb) && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-rose-300 bg-hull/70 px-2 py-1 rounded">
                Feed lagging {rgb.latencyMs?.toFixed(0)} ms — do not drive on this
              </span>
            </div>
          )}

          {/* OAK RGB Tags */}
          <span className="absolute left-3 top-3 z-30 chip border-rim/70 bg-hull/80 text-ink-dim py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase flex items-center gap-1">
            <span className={clsx('h-1 w-1 rounded-full', rgb.active ? 'bg-emerald-500 shadow-[0_0_4px_#34d399]' : 'bg-zinc-600')} /> OAK RGB
          </span>

          <span className="absolute right-3 top-3 z-30 chip border-rim/70 bg-hull/80 py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase flex items-center gap-1">
            {latencyChip(rgb)}
          </span>

          {!rgb.active && (
            <div className="z-10 flex flex-col items-center gap-1 text-center font-mono opacity-60">
              <Video className="h-6 w-6 text-ink-dim/40 animate-pulse" />
              <span className="text-[10px] text-ink-dim tracking-wider">AWAITING CAMERA STREAM</span>
            </div>
          )}

          <div className="absolute left-3 right-3 bottom-2 z-30 flex justify-between items-center font-mono text-[8px] text-ink-dim/85 uppercase leading-none bg-hull/30 backdrop-blur-[1px] py-1 px-1.5 rounded">
            {/* Resolution/encoding are robot-side pipeline config we cannot read
                from here — measured rate above is the honest claim. */}
            <span>compressed · queue 1</span>
            <span>USB2 · HIGH — USB3 CABLE PENDING</span>
          </div>
        </div>

        {/* ── OAK DEPTH FEED (SMALL) ─────────────── */}
        <div
          className={clsx(
            'relative rounded-lg overflow-hidden border bg-hull aspect-[4/3] flex items-center justify-center',
            laggy(depth) ? 'border-rose-500/70' : 'border-rim/70',
          )}
        >
          {/* Scanline sheen */}
          <div className="pointer-events-none absolute inset-0 z-20 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.15)_0_1px,transparent_1px_3px)] opacity-30" />

          {/* Fallback pattern */}
          <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_68%_78%,rgba(239,68,68,0.12),transparent_30%),radial-gradient(circle_at_25%_55%,rgba(54,224,224,0.12),transparent_42%),linear-gradient(180deg,#0a1b2d_0%,#090d16_100%)] opacity-80" />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={depthRef}
            alt="Colorized Depth Feed"
            className={clsx(
              'absolute inset-0 w-full h-full object-cover z-10',
              !depth.active && 'hidden',
              laggy(depth) && 'opacity-30 grayscale',
            )}
          />

          <span className="absolute left-3 top-3 z-30 chip border-rim/70 bg-hull/80 text-ink-dim py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase flex items-center gap-1">
            <span className={clsx('h-1 w-1 rounded-full', depth.active ? 'bg-emerald-500 shadow-[0_0_4px_#34d399]' : 'bg-zinc-600')} /> OAK DEPTH
          </span>

          <span className="absolute right-3 top-3 z-30 chip border-rim/70 bg-hull/80 py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase flex items-center gap-1">
            {latencyChip(depth)}
          </span>

          {!depth.active && (
            <div className="z-10 flex flex-col items-center gap-1 text-center font-mono opacity-60">
              <Video className="h-6 w-6 text-ink-dim/40 animate-pulse" />
              <span className="text-[10px] text-ink-dim tracking-wider">AWAITING DEPTH</span>
            </div>
          )}

          <div className="absolute left-3 right-3 bottom-2 z-30 flex justify-between items-center font-mono text-[8px] text-ink-dim/85 uppercase leading-none bg-hull/30 backdrop-blur-[1px] py-1 px-1.5 rounded">
            <span>colorized · aligned→rgb</span>
            <span>queue 1</span>
          </div>
        </div>

        {/* ── PT CAMERA FEED (STANDBY) ───────────── */}
        <div className="relative rounded-lg overflow-hidden border border-rim/70 bg-hull aspect-[4/3] flex items-center justify-center">
          <div className="pointer-events-none absolute inset-0 z-20 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.15)_0_1px,transparent_1px_3px)] opacity-30" />

          <span className="absolute left-3 top-3 z-30 chip border-rim/70 bg-hull/80 text-ink-dim py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-amber-500 shadow-[0_0_4px_#f59e0b]" /> PT CAM 5MP
          </span>

          <span className="absolute right-3 top-3 z-30 chip border-rim/70 bg-hull/80 text-amber-500 py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase">
            STANDBY
          </span>

          <div className="z-10 flex flex-col items-center gap-1.5 text-center font-mono text-zinc-500 select-none">
            <span className="text-[10px] tracking-[0.3em] font-black uppercase text-zinc-600">STANDBY</span>
            <span className="text-[8px] text-zinc-400">Not subscribed — no cockpit topic</span>
          </div>

          <div className="absolute left-3 right-3 bottom-2 z-30 flex justify-between items-center font-mono text-[8px] text-ink-dim/85 uppercase leading-none bg-hull/30 backdrop-blur-[1px] py-1 px-1.5 rounded">
            <span>/dev/video0 · verified 2026-07-31</span>
            <span>no live feed</span>
          </div>
        </div>
      </div>
    </section>
  );
}
