'use client';

import { useEffect, useRef, useState } from 'react';
import { 
  useCockpitVoltage, 
  useCockpitImu, 
  useCockpitDiagnostics 
} from '@/lib/ros/client';
import { Database } from 'lucide-react';
import clsx from 'clsx';

export function TelemetryRow() {
  const { voltage } = useCockpitVoltage();
  const imu = useCockpitImu();
  const diags = useCockpitDiagnostics();

  const voltCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imuCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // States for live history
  const voltHistoryRef = useRef<number[]>([]);
  const imuHistoryRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  // Handle voltage sparkline canvas drawing
  useEffect(() => {
    if (voltage > 0) {
      const arr = voltHistoryRef.current;
      arr.push(voltage);
      if (arr.length > 50) arr.shift();
    }

    const canvas = voltCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Clear background
    ctx.clearRect(0, 0, W, H);

    // Draw background grid
    ctx.strokeStyle = 'rgba(54,224,224,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 15) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Draw reference line for 10.5V Floor
    // Let's assume voltage range from 8.8V (bottom) to 12.6V (top)
    const getValY = (v: number) => {
      const minV = 8.8;
      const maxV = 12.6;
      return H - ((v - minV) / (maxV - minV)) * H;
    };

    const floorY = getValY(10.5);
    ctx.strokeStyle = 'rgba(245,158,11,0.25)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(W, floorY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(245,158,11,0.45)';
    ctx.font = '8px monospace';
    ctx.fillText('10.5V FLOOR', 5, floorY - 3);

    // Draw Voltage Trail as continuous path
    const voltHistory = voltHistoryRef.current;
    if (voltHistory.length > 1) {
      ctx.strokeStyle = '#ffb020';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      
      const step = W / 49;
      ctx.moveTo(0, getValY(voltHistory[0]));
      for (let i = 1; i < voltHistory.length; i++) {
        ctx.lineTo(i * step, getValY(voltHistory[i]));
      }
      ctx.stroke();
    } else {
      // Steady demo trace mapping centered close to 10.4 V
      ctx.strokeStyle = '#ffb020';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, getValY(10.48));
      for (let x = 0; x < W; x++) {
        const demoV = 10.45 + Math.sin(x / 14.5 + Date.now() / 900) * 0.05;
        ctx.lineTo(x, getValY(demoV));
      }
      ctx.stroke();
    }
  }, [voltage]);

  // Handle IMU sparkline canvas drawing
  useEffect(() => {
    const arr = imuHistoryRef.current;
    arr.push({ x: imu.gx, y: imu.gy, z: imu.gz });
    if (arr.length > 50) arr.shift();

    const canvas = imuCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Clear background
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(54,224,224,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 15) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Center line represents zero rotation
    ctx.strokeStyle = 'rgba(127,142,167,0.15)';
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();

    const getImuY = (val: number) => {
      // Handle range e.g. -2.0 rad/s to 2.0 rad/s
      const coeff = H / 4.0;
      return H / 2 - val * coeff;
    };

    const imuHistory = imuHistoryRef.current;
    if (imuHistory.length > 1) {
      const step = W / 49;
      // Draw standard X coordinate (cyan)
      ctx.strokeStyle = '#36e0e0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, getImuY(imuHistory[0].x));
      for (let i = 1; i < imuHistory.length; i++) {
        ctx.lineTo(i * step, getImuY(imuHistory[i].x));
      }
      ctx.stroke();

      // Draw standard Y coordinate (amber)
      ctx.strokeStyle = '#ffb020';
      ctx.beginPath();
      ctx.moveTo(0, getImuY(imuHistory[0].y));
      for (let i = 1; i < imuHistory.length; i++) {
        ctx.lineTo(i * step, getImuY(imuHistory[i].y));
      }
      ctx.stroke();

      // Draw standard Z coordinate (emerald)
      ctx.strokeStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(0, getImuY(imuHistory[0].z));
      for (let i = 1; i < imuHistory.length; i++) {
        ctx.lineTo(i * step, getImuY(imuHistory[i].z));
      }
      ctx.stroke();
    } else {
      // Draw quiet stationary waves
      const drawQuietAxis = (phase: number, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < W; x++) {
          const val = Math.sin(x / 8 + Date.now() / 600 + phase) * 0.1;
          ctx.lineTo(x * (W/200), getImuY(val));
        }
        ctx.stroke();
      };
      drawQuietAxis(0, '#36e0e0');
      drawQuietAxis(Math.PI / 3, '#ffb020');
      drawQuietAxis((Math.PI * 2) / 3, '#10b981');
    }
  }, [imu]);

  const handleRecordToggle = () => {
    setIsRecording(!isRecording);
    // Record trigger maps to ROS service or topic if required, here just a simulated event action.
  };

  const hasDiagnostics = diags.length > 0;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {/* ── VOLTAGE SPARKLINE ─────────────────────── */}
      <section className="panel border-rim bg-panel/85 p-4 shadow-md flex flex-col">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase leading-none mb-3">
          Pack voltage <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">/ugv/voltage · real volts only</span>
        </h2>
        <div className="relative border border-rim/50 bg-hull/65 rounded-lg overflow-hidden flex-1 h-20">
          <canvas ref={voltCanvasRef} width="400" height="80" className="w-full h-full" />
        </div>
      </section>

      {/* ── IMU SPARKLINE ─────────────────────────── */}
      <section className="panel border-rim bg-panel/85 p-4 shadow-md flex flex-col">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center justify-between leading-none mb-3">
          <span>IMU <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">/imu/data</span></span>
          <span className="chip border-amber-500/25 bg-amber-500/10 text-amber-500 rounded-full px-2 py-0.5 text-[8.5px] scale-[0.85] font-bold">
            uncal · not fused
          </span>
        </h2>
        <div className="relative border border-rim/50 bg-hull/65 rounded-lg overflow-hidden flex-1 h-20">
          <canvas ref={imuCanvasRef} width="400" height="80" className="w-full h-full" />
        </div>
      </section>

      {/* ── OPS LOG / DIAGNOSTICS TICKER ─────────── */}
      <section className="panel border-rim bg-panel/85 p-4 shadow-md flex flex-col tickerwrap">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase leading-none mb-3">
          Ops log <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">diagnostics · rosout</span>
        </h2>

        {/* Event List */}
        <div className="ticker flex flex-col gap-1.5 flex-1 select-none font-mono text-[10.5px]">
          {hasDiagnostics ? (
            diags.slice(0, 4).map((d, index) => {
              const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
              return (
                <div key={index} className={clsx("ev flex items-baseline gap-2.5", d.level === 2 ? 'text-rose-400' : d.level === 1 ? 'text-amber-500' : 'text-emerald-400')}>
                  <span className="text-ink-dim font-medium shrink-0">{timestamp}</span>
                  <span className="truncate leading-none">
                    <b className="font-bold mr-1.5 uppercase">
                      {d.name.split('/').pop() || d.name}
                    </b> 
                    — {d.message}
                  </span>
                </div>
              );
            })
          ) : (
            <>
              <div className="ev ok flex items-baseline gap-2.5 text-emerald-400">
                <span className="text-ink-dim font-medium shrink-0">03:41</span>
                <span><b className="font-bold mr-1.5 whitespace-nowrap">Bag closed</b> — oak-baseline-20260731 · 417 MB · 13 topics</span>
              </div>
              <div className="ev ok flex items-baseline gap-2.5 text-emerald-400">
                <span className="text-ink-dim font-medium shrink-0">03:33</span>
                <span><b className="font-bold mr-1.5 whitespace-nowrap">OAK first light</b> — MXID 1944…BE2F · USB SPEED: HIGH</span>
              </div>
              <div className="ev warn flex items-baseline gap-2.5 text-amber-500">
                <span className="text-ink-dim font-medium shrink-0">03:19</span>
                <span><b className="font-bold mr-1.5 whitespace-nowrap">Pack at floor</b> — 10.38 V &lt; 10.5 V · motion stays locked</span>
              </div>
              <div className="ev flex items-baseline gap-2.5 text-ink">
                <span className="text-ink-dim font-medium shrink-0">02:45</span>
                <span><b className="font-bold mr-1.5 whitespace-nowrap text-cyan">beast-ros-base</b> active · lidar/EKF/pan-tilt up · 24 topics</span>
              </div>
            </>
          )}
        </div>

        {/* Recording buttons */}
        <div className="flex items-center justify-between gap-2.5 border-t border-rim/50 pt-2.5 mt-3 leading-none">
          <button 
            onClick={handleRecordToggle}
            className={clsx(
              "btn rounded-md border font-mono px-3 py-1.5 text-[9.5px] uppercase tracking-wider select-none flex items-center gap-2 font-bold transition-all",
              isRecording 
                ? "border-emerald-500 text-emerald-400 bg-emerald-900/10 shadow-[0_0_8px_rgba(52,211,153,0.2)] animate-pulse" 
                : "border-red-500/50 text-red-500 hover:bg-red-500/5 bg-panel-2/40"
            )}
          >
            <span className={clsx("h-1.5 w-1.5 rounded-full", isRecording ? "bg-emerald-500 animate-ping" : "bg-red-500")} /> 
            {isRecording ? "BAG RECORDING ON" : "REC MISSION BAG"}
          </button>
          
          <span className="hud-label font-mono text-[9px] flex items-center gap-1.5 scale-90">
            <Database className="h-3 w-3 text-cyan" /> disk 1.8 TB free
          </span>
        </div>
      </section>
    </div>
  );
}
