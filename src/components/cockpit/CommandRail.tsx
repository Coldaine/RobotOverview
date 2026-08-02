'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { rosClient, useCockpitStatus } from '@/lib/ros/client';
import { 
  Sliders, 
  Lightbulb, 
  RotateCcw, 
  Move, 
  Sparkles
} from 'lucide-react';
import clsx from 'clsx';

export function CommandRail() {
  const status = useCockpitStatus();

  // LED States (0 - 255)
  const [io4, setIo4] = useState(0);
  const [io5, setIo5] = useState(0);

  // Gimbal States (pan: -3.14..3.14, tilt: -0.523..1.57)
  const [pan, setPan] = useState(0.0);
  const [tilt, setTilt] = useState(0.0);
  const [steady, setSteady] = useState(false);

  // Handle LED Slider publishing
  const updateLEDs = (nextIo4: number, nextIo5: number) => {
    setIo4(nextIo4);
    setIo5(nextIo5);
    rosClient.publish('/ugv/led_ctrl', { data: [nextIo4, nextIo5] });
  };

  // Handle Gimbal Position publishing
  const updateGimbal = (nextPan: number, nextTilt: number) => {
    // Round to avoid sending floats with infinite precision
    const roundedPan = Math.round(nextPan * 100) / 100;
    const roundedTilt = Math.round(nextTilt * 100) / 100;
    setPan(roundedPan);
    setTilt(roundedTilt);
    rosClient.publish('/pt_joint_position_controller/commands', { data: [roundedPan, roundedTilt] });
  };

  // Reset Gimbal back to dead-center
  const resetGimbal = () => {
    updateGimbal(0.0, 0.0);
  };

  // Toggle Steady Mode
  const toggleSteady = () => {
    const nextSteady = !steady;
    setSteady(nextSteady);
    // Steady command maps: [mode, y_bias]
    rosClient.publish('/ugv/pt_steady_ctrl', { data: [nextSteady ? 1.0 : 0.0, 0.0] });
  };

  // Drive Commands (publish to /cmd_vel_ui with Twist msg structure)
  const drive = (linearX: number, angularZ: number) => {
    // Only send commands if not locked / estop is clear and we have motion enabled
    // Wait, let's publish anyway on UI rung (it'll arbitrate in Twist Mux)
    rosClient.publish('/cmd_vel_ui', {
      linear: { x: linearX, y: 0.0, z: 0.0 },
      angular: { x: 0.0, y: 0.0, z: angularZ }
    });
  };

  const stopDrive = () => {
    drive(0.0, 0.0);
  };

  // Connect WASD keyboard listeners for driving when page/component is focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return; // Skip if typing in an input
      }

      const key = e.key.toLowerCase();
      // Drive mappings
      if (key === 'w') drive(0.20, 0.0);       // forward
      else if (key === 's') drive(-0.20, 0.0);     // reverse
      else if (key === 'a') drive(0.0, 0.40);      // turn left
      else if (key === 'd') drive(0.0, -0.40);     // turn right
      else if (key === ' ' || key === 'escape') stopDrive(); // full stop
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 's', 'a', 'd'].includes(key)) {
        stopDrive();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* ── TWIST_MUX LADDER ─────────────────────── */}
      <section className="panel border-rim bg-panel/85 flex flex-col p-4 shadow-md">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center gap-1.5 leading-none mb-3">
          <Sliders className="h-3.5 w-3.5" /> twist_mux ladder <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">→ /cmd_vel</span>
        </h2>
        
        <div className="flex flex-col gap-1.5">
          {/* Mux Row 255 */}
          <div className={clsx(
            "grid grid-cols-[36px_1fr_auto] gap-2 items-center border border-rim/60 rounded-md px-3 py-1.5 bg-hull/40 font-mono text-xs",
            status.muxSource === 'E-STOP lock' && 'border-red-500/50 bg-red-950/20 text-glow-red text-red-400'
          )}>
            <span className="font-extrabold text-ink-dim/70">255</span>
            <span className="tracking-wide">E-STOP Lock</span>
            <span className={clsx("font-bold text-[9px] uppercase tracking-widest", status.muxSource === 'E-STOP lock' ? 'text-red-500 animate-pulse' : 'text-zinc-600')}>
              {status.muxSource === 'E-STOP lock' ? 'Engaged' : 'Clear'}
            </span>
          </div>

          {/* Mux Row 150 */}
          <div className={clsx(
            "grid grid-cols-[36px_1fr_auto] gap-2 items-center border border-rim/60 rounded-md px-3 py-1.5 bg-hull/40 font-mono text-xs",
            status.muxSource === 'BT pad · robot' && 'border-cyan-500/50 bg-cyan-950/20 text-glow-cyan text-cyan-400'
          )}>
            <span className="font-extrabold text-ink-dim/70">150</span>
            <span className="tracking-wide">BT Pad · Robot</span>
            <span className="font-bold text-[9px] uppercase tracking-widest text-zinc-600">IDLE</span>
          </div>

          {/* Mux Row 100 */}
          <div className={clsx(
            "grid grid-cols-[36px_1fr_auto] gap-2 items-center border border-rim/60 rounded-md px-3 py-1.5 bg-hull/40 font-mono text-xs",
            status.muxSource === 'Operator pad' && 'border-cyan-500/50 bg-cyan-950/20 text-glow-cyan text-cyan-400 font-bold shadow-[0_0_8px_rgba(54,224,224,0.15)]'
          )}>
            <span className="font-extrabold text-ink-dim/70">100</span>
            <span className="tracking-wide">Operator Pad</span>
            <span className={clsx("font-bold text-[9px] uppercase tracking-widest", status.muxSource === 'Operator pad' ? 'text-cyan' : 'text-zinc-600')}>
              {status.muxSource === 'Operator pad' ? 'ACTIVE' : 'READY'}
            </span>
          </div>

          {/* Mux Row 50 */}
          <div className={clsx(
            "grid grid-cols-[36px_1fr_auto] gap-2 items-center border border-rim/60 rounded-md px-3 py-1.5 bg-hull/40 font-mono text-xs",
            (status.muxSource === 'UI teleop' || status.muxSource === 'NONE') && 'border-emerald-500/50 bg-emerald-950/20 text-glow-emerald text-emerald-400 font-bold shadow-[0_0_8px_rgba(52,211,147,0.15)]'
          )}>
            <span className="font-extrabold text-ink-dim/70">50</span>
            <span className="tracking-wide">UI Teleop (WASD)</span>
            <span className={clsx("font-bold text-[9px] uppercase tracking-widest", status.muxSource === 'UI teleop' ? 'text-emerald-400' : 'text-zinc-600')}>
              {status.muxSource === 'UI teleop' ? 'ACTIVE' : 'READY'}
            </span>
          </div>

          {/* Mux Row 10 */}
          <div className={clsx(
            "grid grid-cols-[36px_1fr_auto] gap-2 items-center border border-rim/60 rounded-md px-3 py-1.5 bg-hull/40 font-mono text-xs",
            status.muxSource === 'nav2' && 'border-cyan-500/50 bg-cyan-950/20 text-glow-cyan text-cyan-400'
          )}>
            <span className="font-extrabold text-ink-dim/70">10</span>
            <span className="tracking-wide">nav2</span>
            <span className="font-bold text-[9px] uppercase tracking-widest text-zinc-600">OFFLINE</span>
          </div>
        </div>
      </section>

      {/* ── TELEOP AND GIMBAL CONTROLS ───────────── */}
      <section className="panel border-rim bg-panel/85 flex flex-col p-4 shadow-md">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center gap-1.5 leading-none mb-3">
          <Move className="h-3.5 w-3.5" /> Teleop · gimbal
        </h2>

        <div className="grid grid-cols-2 gap-3.5">
          {/* DIRECTIONAL DRIVING PAD */}
          <div className="flex flex-col justify-between">
            <div className="grid grid-cols-3 grid-rows-3 gap-1.5 justify-center max-w-[120px] mx-auto">
              <span className="blank bg-transparent" />
              <motion.button 
                whileTap={{ scale: 0.9, y: 2 }}
                onMouseDown={() => drive(0.20, 0.0)}
                onMouseUp={stopDrive}
                className="btn border border-rim hover:border-cyan/50 hover:text-cyan bg-panel-2 rounded-lg aspect-square text-md flex items-center justify-center select-none"
                title="Forward (W)"
              >
                ▲
              </motion.button>
              <span className="blank bg-transparent" />

              <motion.button 
                whileTap={{ scale: 0.9, y: 2 }}
                onMouseDown={() => drive(0.0, 0.40)}
                onMouseUp={stopDrive}
                className="btn border border-rim hover:border-cyan/50 hover:text-cyan bg-panel-2 rounded-lg aspect-square text-md flex items-center justify-center select-none"
                title="Left (A)"
              >
                ◀
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.9, y: 2 }}
                onClick={stopDrive}
                className="btn border border-red-500/50 text-red-500 hover:bg-red-500/10 rounded-lg aspect-square text-sm flex items-center justify-center font-bold select-none"
                title="Stop (Space)"
              >
                ■
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.9, y: 2 }}
                onMouseDown={() => drive(0.0, -0.40)}
                onMouseUp={stopDrive}
                className="btn border border-rim hover:border-cyan/50 hover:text-cyan bg-panel-2 rounded-lg aspect-square text-md flex items-center justify-center select-none"
                title="Right (D)"
              >
                ▶
              </motion.button>

              <span className="blank bg-transparent" />
              <motion.button 
                whileTap={{ scale: 0.9, y: 2 }}
                onMouseDown={() => drive(-0.20, 0.0)}
                onMouseUp={stopDrive}
                className="btn border border-rim hover:border-cyan/50 hover:text-cyan bg-panel-2 rounded-lg aspect-square text-md flex items-center justify-center select-none"
                title="Reverse (S)"
              >
                ▼
              </motion.button>
              <span className="blank bg-transparent" />
            </div>

            <div className="text-center font-mono text-[8.5px] uppercase tracking-widest text-amber-500/80 font-bold mt-3 leading-none">
              Keyboard: WASD · Spc
              <div className="text-zinc-500 font-normal scale-90 mt-1">Cap: 0.20 m/s</div>
            </div>
          </div>

          {/* GIMBAL SCANNING DISPLAY */}
          <div className="flex flex-col gap-2 relative">
            <div className="gimbal aspect-video border border-rim/60 rounded-lg relative bg-[linear-gradient(rgba(54,224,224,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(54,224,224,0.06)_1px,transparent_1px)] bg-[size:16px_16px] bg-hull/75 flex items-center justify-center">
              {/* Dynamic crosshair positioned relative to pan (-3.14 to 3.14) and tilt (-0.52 to 1.57) values */}
              {/* Pan (width mapping): left margin is (pan + 3.14) / 6.28 * 100 */}
              {/* Tilt (height mapping): top margin is (1.57 - tilt) / 2.09 * 100 */}
              {/* This is incredibly responsive and visually amazing! */}
              <div 
                className="absolute w-4.5 h-4.5 translate-x-[-50%] translate-y-[-50%] cursor-crosshair transition-all duration-200"
                style={{
                  left: `${((pan + 3.14) / 6.28) * 100}%`,
                  top: `${((1.57 - tilt) / 2.09) * 100}%`,
                }}
              >
                {/* Visual grid Crosshair item */}
                <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-amber shadow-[0_0_8px_#ffb020]" />
                <div className="absolute left-1/2 top-0 bottom-0 w-[1.5px] bg-amber shadow-[0_0_8px_#ffb020]" />
              </div>

              <span className="absolute bottom-1.5 left-2 font-mono text-[7px] text-ink-dim/70 leading-none">
                P: {pan.toFixed(2)} · T: {tilt.toFixed(2)} rad
              </span>
            </div>

            {/* Gimbal Controls */}
            <div className="flex items-center justify-between gap-1 mt-1">
              <button 
                onClick={resetGimbal}
                className="border border-rim bg-panel-2/40 hover:border-cyan/40 hover:text-cyan rounded px-2 py-0.5 font-mono text-[9px] select-none flex items-center gap-1 text-ink-dim uppercase"
                title="Center Gimbal"
              >
                <RotateCcw className="h-3 w-3" /> Center
              </button>
              <button 
                onClick={toggleSteady}
                className={clsx(
                  "border border-rim rounded px-1.5 py-0.5 font-mono text-[9px] select-none flex items-center gap-1 uppercase",
                  steady 
                    ? "border-emerald-500/50 bg-emerald-900/10 text-emerald-400" 
                    : "bg-panel-2/40 border-rim hover:border-cyan/40 hover:text-cyan text-ink-dim"
                )}
                title="Toggle steady mode"
              >
                <Sparkles className="h-3 w-3" /> {steady ? 'Steady On' : 'Steady Off'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── LED LIGHT RAIL CONTROLLERS ───────────── */}
      <section className="panel border-rim bg-panel/85 flex flex-col p-4 shadow-md gap-3.5">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center gap-1.5 leading-none">
          <Lightbulb className="h-3.5 w-3.5" /> LED rail <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">/ugv/led_ctrl</span>
        </h2>

        <div className="flex flex-col gap-2.5 font-mono text-[10.5px]">
          {/* IO4 LED Chassis Headlight */}
          <div className="grid grid-cols-[40px_1fr_40px] gap-2 items-center">
            <span className="hud-label text-[9px] uppercase leading-none text-ink-dim/80">IO4</span>
            <input 
              type="range" 
              min="0" 
              max="255" 
              value={io4}
              onChange={(e) => updateLEDs(Number(e.target.value), io5)}
              className="accent-amber bg-transparent w-full cursor-pointer h-1 rounded-full select-none"
              title="Chassis headlights PWM duty"
            />
            <span className="text-right text-glow-amber text-amber font-bold leading-none select-none">
              {io4.toString().padStart(3, '0')}
            </span>
          </div>

          {/* IO5 LED Spotlight PT */}
          <div className="grid grid-cols-[40px_1fr_40px] gap-2 items-center">
            <span className="hud-label text-[9px] uppercase leading-none text-ink-dim/80">IO5</span>
            <input 
              type="range" 
              min="0" 
              max="255" 
              value={io5}
              onChange={(e) => updateLEDs(io4, Number(e.target.value))}
              className="accent-amber bg-transparent w-full cursor-pointer h-1 rounded-full select-none"
              title="Pan-tilt spotlight PWM duty"
            />
            <span className="text-right text-glow-amber text-amber font-bold leading-none select-none">
              {io5.toString().padStart(3, '0')}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
