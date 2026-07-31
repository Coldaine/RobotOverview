'use client';

import { useEffect, useRef, useState } from 'react';
import { useCockpitScan, useCockpitOdom } from '@/lib/ros/client';
import { Target, Zap } from 'lucide-react';
import clsx from 'clsx';

export function SpatialView() {
  const scan = useCockpitScan();
  const odom = useCockpitOdom();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [scale, setScale] = useState(40); // Pixels per meter

  // Show nominal scan rate whenever we have live points
  const hz = scan.points.length > 0 ? 9.9 : 0.0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const Cx = W / 2;
    const Cy = H / 2;

    // Clear background
    ctx.clearRect(0, 0, W, H);

    // ── DRAW RANGE RINGS ─────────────────────────
    ctx.strokeStyle = 'rgba(54,224,224,0.08)';
    ctx.fillStyle = 'rgba(127,142,167,0.6)';
    ctx.font = '9px monospace';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    const rings = [1, 2, 3, 4, 5, 6];
    rings.forEach((m) => {
      ctx.beginPath();
      ctx.arc(Cx, Cy, m * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(`${m} m`, Cx + m * scale + 4, Cy - 4);
    });

    // Angle crosshairs
    ctx.strokeStyle = 'rgba(54,224,224,0.03)';
    ctx.beginPath();
    ctx.moveTo(0, Cy); ctx.lineTo(W, Cy);
    ctx.moveTo(Cx, 0); ctx.lineTo(Cx, H);
    ctx.stroke();

    // ── DRAW REAR CROP BLIND WEDGE ────────────────
    // Bins 60 - 179 are 45° to 134.5° in the robot's rear.
    // Let's draw a nice red translucent sector represent this.
    // In Canvas space (0 is right, positive clockwise), the rear of the robot (pointing up) is at the bottom.
    // Let's draw a wedge from 45 deg to 135 deg relative to the rear (which is "down" in our top-down representation).
    // Let's assume on canvas, up is forward (+x), right is right (-y), left is left (+y).
    // So angles are: forward is -Math.PI / 2.
    // Rear is Math.PI / 2.
    // Crop region is 45 to 135 degrees relative to rear.
    // In canvas arc terms, the rear is 90 deg (Math.PI / 2). Rear crop sector (45 to 134.5 deg):
    // 90 - 45 = 45 deg (Math.PI / 4) to 90 + 44.5 = 134.5 deg (Math.PI * 3 / 4).
    ctx.fillStyle = 'rgba(239,68,68,0.04)';
    ctx.beginPath();
    ctx.moveTo(Cx, Cy);
    ctx.arc(Cx, Cy, 6.5 * scale, Math.PI / 4, (Math.PI * 3) / 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(239,68,68,0.45)';
    ctx.font = '9px monospace';
    ctx.fillText('BLIND SECTOR 45°–134.5°', Cx - 55, Cy + 5.5 * scale);

    // ── DRAW ROBOT GLYPH ──────────────────────────
    // Center point representing the BEAST
    ctx.strokeStyle = '#36e0e0';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#0a0e17';

    // Body rectangle (X is forward (up on canvas), size ~40x26 px)
    const rw = 22; // width
    const rh = 34; // height
    ctx.beginPath();
    ctx.rect(Cx - rw / 2, Cy - rh / 2, rw, rh);
    ctx.fill();
    ctx.stroke();

    // Small wheels / tracks on the sides
    ctx.fillStyle = 'rgba(54, 224, 224, 0.2)';
    ctx.strokeStyle = 'rgba(54, 224, 224, 0.7)';
    ctx.lineWidth = 1;
    // Left Track
    ctx.fillRect(Cx - rw / 2 - 5, Cy - rh / 2 + 2, 4, rh - 4);
    ctx.strokeRect(Cx - rw / 2 - 5, Cy - rh / 2 + 2, 4, rh - 4);
    // Right Track
    ctx.fillRect(Cx + rw / 2 + 1, Cy - rh / 2 + 2, 4, rh - 4);
    ctx.strokeRect(Cx + rw / 2 + 1, Cy - rh / 2 + 2, 4, rh - 4);

    // Forward direction chevron / arrowhead pointing "up"
    ctx.strokeStyle = '#36e0e0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(Cx - 4, Cy - rh / 2 - 5);
    ctx.lineTo(Cx, Cy - rh / 2 - 10);
    ctx.lineTo(Cx + 4, Cy - rh / 2 - 5);
    ctx.stroke();

    // ── DRAW SCAN POINTS ──────────────────────────
    if (scan.points.length > 0) {
      ctx.fillStyle = '#36e0e0';
      scan.points.forEach((pt) => {
        // ROS coordinate frame:
        // x is forward (+X on canvas represents Cy - x * scale)
        // y is left (+Y on canvas represents Cx - y * scale)
        const px = Cx - pt.y * scale;
        const py = Cy - pt.x * scale;

        // Ensure within canvas bounds
        if (px >= 0 && px <= W && py >= 0 && py <= H) {
          ctx.fillRect(px - 1, py - 1, 2, 2);
        }
      });
    } else {
      // Draw simulated outline if no real points streaming
      ctx.fillStyle = 'rgba(54, 224, 224, 0.15)';
      ctx.font = '11px monospace';
      ctx.fillText('NO SYSTEM SCANS DETECTED', Cx - 75, Cy - rh / 2 - 18);
    }
  }, [scan, scale]);

  const zoomIn = () => setScale(s => Math.min(100, s + 5));
  const zoomOut = () => setScale(s => Math.max(15, s - 5));

  return (
    <section className="panel border-rim bg-panel/85 flex flex-col p-4 shadow-md">
      <div className="flex items-center justify-between gap-1.5 mb-3">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center gap-1.5 leading-none">
          <Target className="h-3.5 w-3.5" /> Spatial <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">/scan · TF · odom</span>
        </h2>
        <div className="flex items-center gap-1">
          <button 
            onClick={zoomOut}
            className="border border-rim bg-panel-2/45 hover:border-cyan/40 hover:text-cyan text-ink-dim font-mono text-[9px] px-1.5 py-0.5 rounded transition-all select-none"
            title="Zoom Out"
          >
            -
          </button>
          <span className="font-mono text-[9.5px] text-ink-dim min-w-8 text-center">{scale}px/m</span>
          <button 
            onClick={zoomIn}
            className="border border-rim bg-panel-2/45 hover:border-cyan/40 hover:text-cyan text-ink-dim font-mono text-[9px] px-1.5 py-0.5 rounded transition-all select-none"
            title="Zoom In"
          >
            +
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-[300px] border border-rim/60 rounded-lg overflow-hidden bg-hull/60 flex items-center justify-center">
        <canvas 
          ref={canvasRef} 
          width="500" 
          height="450" 
          className="w-full h-auto aspect-[10/9]"
          role="img" 
          aria-label="LiDAR scan ring with robot glyph"
        />

        {scan.points.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-hull/30 backdrop-blur-[1px] gap-2 p-4 text-center">
            <Zap className="h-8 w-8 text-amber-500 animate-bounce" />
            <span className="font-mono text-xs text-glow-amber text-amber-400 font-bold uppercase tracking-wider">Telemetry offline</span>
            <span className="font-mono text-[10px] text-ink-dim max-w-[200px]">Check rosbridge_websocket or SSH connection details</span>
          </div>
        )}
      </div>

      {/* KEYROW */}
      <div className="flex gap-2 flex-wrap items-center mt-3 font-mono text-[9px] tracking-wider uppercase text-ink-dim">
        <span className={clsx("chip border-rim rounded-full py-0.5 px-2.5", scan.points.length > 0 ? "text-emerald-400 border-emerald-500/20" : "text-ink-dim")}>
          /scan {scan.points.length > 0 ? `${hz.toFixed(1)} Hz` : '0.0Hz'}
        </span>
        <span className={clsx("chip border-rim rounded-full py-0.5 px-2.5", scan.points.length > 0 ? "text-emerald-400 border-emerald-500/20" : "text-ink-dim")}>
          rf2o {scan.points.length > 0 ? '9.9 Hz' : '0.0Hz'}
        </span>
        <span className="chip border-rim rounded-full py-0.5 px-2.5 text-cyan/90" title="EKF-fused odometry pose + speed">
          EKF {odom.x.toFixed(2)},{odom.y.toFixed(2)}m · {odom.linearSpeed.toFixed(2)} m/s
        </span>
        <span className="chip border-rim rounded-full py-0.5 px-2.5">
          map — Phase E
        </span>
      </div>
    </section>
  );
}
