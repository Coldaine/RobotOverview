'use client';

import { useEffect, useRef, useState } from 'react';
import { rosClient, useCockpitOverheadClearance } from '@/lib/ros/client';
import { Eye, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export function OpticsWall() {
  const clearance = useCockpitOverheadClearance();
  
  const rgbRef = useRef<HTMLImageElement | null>(null);
  const depthRef = useRef<HTMLImageElement | null>(null);

  // Frame counts live in refs so inbound frames never re-render React (the
  // image bytes go straight to <img>.src). Only the once-a-second FPS tick
  // touches state.
  const rgbFrameCount = useRef(0);
  const depthFrameCount = useRef(0);
  const [rgbFps, setRgbFps] = useState(0);
  const [depthFps, setDepthFps] = useState(0);
  const [rgbActive, setRgbActive] = useState(false);
  const [depthActive, setDepthActive] = useState(false);

  // Sample the frame counters once per second for FPS + liveness.
  useEffect(() => {
    const timer = setInterval(() => {
      const r = rgbFrameCount.current;
      const d = depthFrameCount.current;
      setRgbFps(r);
      setDepthFps(d);
      setRgbActive(r > 0);
      setDepthActive(d > 0);
      rgbFrameCount.current = 0;
      depthFrameCount.current = 0;
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Hook up image topic subscriptions
  useEffect(() => {
    const unsubRgb = rosClient.registerImageCallback('/oak/rgb/image_raw/compressed', (src) => {
      if (rgbRef.current) {
        rgbRef.current.src = src;
      }
      rgbFrameCount.current += 1;
    });

    const unsubDepth = rosClient.registerImageCallback('/cockpit/depth/compressed', (src) => {
      if (depthRef.current) {
        depthRef.current.src = src;
      }
      depthFrameCount.current += 1;
    });

    return () => {
      unsubRgb();
      unsubDepth();
    };
  }, []);

  // Determine safety limits for overhead clearance
  // Mission Undercroft duct clearance floor. Below 0.16m is critical, below 0.28m is warning
  const clearanceStatus = (() => {
    if (clearance <= 0 || clearance > 5.0) return { label: 'UNKNOWN', cls: 'text-ink-dim border-rim/60 bg-panel-2/20' };
    if (clearance < 0.16) return { label: 'CRITICAL', cls: 'text-rose-400 border-rose-500/30 bg-rose-500/10 animate-pulse text-glow-red' };
    if (clearance < 0.28) return { label: 'WARNING', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
    return { label: 'CLEAR', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' };
  })();

  return (
    <section className="panel border-rim bg-panel/85 flex flex-col p-4 shadow-md">
      <div className="flex items-center justify-between gap-1.5 mb-3">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center gap-1.5 leading-none">
          <Eye className="h-3.5 w-3.5" /> Optics <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">/compressed transports over bridge</span>
        </h2>
        {/* Overhead Clearance HUD */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9.5px] uppercase text-ink-dim scale-90">Clearance:</span>
          <div className={clsx("chip flex items-center gap-1.5 rounded-full px-2 py-0.5 border font-mono text-[10px] font-bold leading-none tracking-wider", clearanceStatus.cls)}>
            <span>{clearance > 0 ? `${clearance.toFixed(2)}m` : '—'}</span>
            <span>[{clearanceStatus.label}]</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        {/* ── OAK RGB FEED (WIDE) ────────────────── */}
        <div className="relative rounded-lg overflow-hidden border border-rim/70 bg-hull aspect-[21/9] col-span-2 flex items-center justify-center transition-transform hover:scale-[1.01]">
          {/* Scanline sheen */}
          <div className="pointer-events-none absolute inset-0 z-20 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.15)_0_1px,transparent_1px_3px)] opacity-30" />
          
          {/* Fallback pattern */}
          <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_68%_78%,rgba(245,158,11,0.14),transparent_34%),radial-gradient(circle_at_30%_60%,rgba(122,242,242,0.08),transparent_45%),linear-gradient(180deg,#1c2130_0%,#090d16_100%)] opacity-80" />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            ref={rgbRef} 
            alt="RGB Video Feed" 
            className={clsx("absolute inset-0 w-full h-full object-cover z-10", !rgbActive && "hidden")}
          />
          
          {rgbActive && (
            <motion.svg
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 pointer-events-none z-20 text-emerald-500/50 mix-blend-screen"
              viewBox="0 0 100 100"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <path d="M 30 20 L 20 20 L 20 30 M 70 20 L 80 20 L 80 30 M 20 70 L 20 80 L 30 80 M 80 70 L 80 80 L 70 80 M 50 40 L 50 60 M 40 50 L 60 50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          )}

          {/* OAK RGB Tags */}
          <span className="absolute left-3 top-3 z-30 chip border-rim/70 bg-hull/80 text-ink-dim py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase flex items-center gap-1">
            <span className={clsx("h-1 w-1 rounded-full", rgbActive ? "bg-emerald-500 shadow-[0_0_4px_#34d399]" : "bg-zinc-600")} /> OAK RGB
          </span>

          <span className="absolute right-3 top-3 z-30 chip border-rim/70 bg-hull/80 py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase flex items-center gap-1">
            {rgbActive ? (
              <span className="text-emerald-400 font-bold">{rgbFps.toFixed(1)} FPS</span>
            ) : (
              <span className="text-ink-dim">0.0 FPS</span>
            )}
          </span>

          {!rgbActive && (
            <div className="z-10 flex flex-col items-center gap-1 text-center font-mono opacity-60">
              <Video className="h-6 w-6 text-ink-dim/40 animate-pulse" />
              <span className="text-[10px] text-ink-dim tracking-wider">AWAITING CAMERA STREAM</span>
            </div>
          )}

          <div className="absolute left-3 right-3 bottom-2 z-30 flex justify-between items-center font-mono text-[8px] text-ink-dim/85 uppercase leading-none bg-hull/30 backdrop-blur-[1px] py-1 px-1.5 rounded">
            <span>640×480 BGR8 · JPEG</span>
            <span>USB2 · HIGH — USB3 CABLE PENDING</span>
          </div>
        </div>

        {/* ── OAK DEPTH FEED (SMALL) ─────────────── */}
        <div className="relative rounded-lg overflow-hidden border border-rim/70 bg-hull aspect-[4/3] flex items-center justify-center">
          {/* Scanline sheen */}
          <div className="pointer-events-none absolute inset-0 z-20 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.15)_0_1px,transparent_1px_3px)] opacity-30" />
          
          {/* Fallback pattern */}
          <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_68%_78%,rgba(239,68,68,0.12),transparent_30%),radial-gradient(circle_at_25%_55%,rgba(54,224,224,0.12),transparent_42%),linear-gradient(180deg,#0a1b2d_0%,#090d16_100%)] opacity-80" />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            ref={depthRef} 
            alt="Colorized Depth Feed" 
            className={clsx("absolute inset-0 w-full h-full object-cover z-10", !depthActive && "hidden")}
          />

          {depthActive && (
            <motion.svg
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 pointer-events-none z-20 text-emerald-500/50 mix-blend-screen"
              viewBox="0 0 100 100"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <path d="M 30 20 L 20 20 L 20 30 M 70 20 L 80 20 L 80 30 M 20 70 L 20 80 L 30 80 M 80 70 L 80 80 L 70 80 M 50 40 L 50 60 M 40 50 L 60 50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          )}

          <span className="absolute left-3 top-3 z-30 chip border-rim/70 bg-hull/80 text-ink-dim py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase flex items-center gap-1">
            <span className={clsx("h-1 w-1 rounded-full", depthActive ? "bg-emerald-500 shadow-[0_0_4px_#34d399]" : "bg-zinc-600")} /> OAK DEPTH
          </span>

          <span className="absolute right-3 top-3 z-30 chip border-rim/70 bg-hull/80 py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase flex items-center gap-1">
            {depthActive ? (
              <span className="text-emerald-400 font-bold">{depthFps.toFixed(1)} FPS</span>
            ) : (
              <span className="text-ink-dim">0.0 FPS</span>
            )}
          </span>

          {!depthActive && (
            <div className="z-10 flex flex-col items-center gap-1 text-center font-mono opacity-60">
              <Video className="h-6 w-6 text-ink-dim/40 animate-pulse" />
              <span className="text-[10px] text-ink-dim tracking-wider">AWAITING DEPTH</span>
            </div>
          )}

          <div className="absolute left-3 right-3 bottom-2 z-30 flex justify-between items-center font-mono text-[8px] text-ink-dim/85 uppercase leading-none bg-hull/30 backdrop-blur-[1px] py-1 px-1.5 rounded">
            <span>16UC1 · ALIGNED→RGB</span>
            <span>0.8–12 M RANGE</span>
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
            <span className="text-[8px] text-zinc-400">Launch from cockpit CLI node</span>
          </div>

          <div className="absolute left-3 right-3 bottom-2 z-30 flex justify-between items-center font-mono text-[8px] text-ink-dim/85 uppercase leading-none bg-hull/30 backdrop-blur-[1px] py-1 px-1.5 rounded">
            <span>/DEV/VIDEO0 · VERIFIED 07-31</span>
            <span>PAN 0.0° · TILT 0.0°</span>
          </div>
        </div>
      </div>
    </section>
  );
}
