'use client';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useHangar, useCalculatedConstraints } from '@/lib/store';
import type { ConstraintGauge } from '@/data/types';
import { money } from '@/lib/format';

export function Gauge({ gauge, delay = 0 }: { gauge: ConstraintGauge; delay?: number }) {
  const { theme, data, lensMissionId } = useHangar();
  
  const pct = gauge.budget > 0 ? (gauge.value / gauge.budget) * 100 : 0;
  const over = gauge.value > gauge.budget;
  
  const primaryMission = data.missions.find((m) => m.status === 'active') ?? data.missions[0];
  const activeMissionId = lensMissionId ?? primaryMission?.id ?? '';
  const allConstraints = useCalculatedConstraints(activeMissionId);

  const massG = allConstraints.find(c => c.unit === 'g') || { value: 0, budget: 1, label: 'Mass' };
  const powerG = allConstraints.find(c => c.unit === 'W') || { value: 0, budget: 1, label: 'Power' };
  const costG = allConstraints.find(c => c.unit === '$' || c.unit === 'S') || { value: 0, budget: 1, label: 'Cost' };

  const formatVal = (val: number, unit: string) => {
    if (unit === '$') return money(val);
    return `${val}${unit}`;
  };

  // Blueprint: neon segmented cockpit HUD arcs with 85% amber threshold warning.
  if (theme === 'blueprint') {
    const radius = 35;
    const circumference = 2 * Math.PI * radius; // ~219.9
    const arcLength = circumference * 0.75; // ~165
    // Scale progress so that 100% budget corresponds to 83.3% of the arc (up to 120% budget at 100% arc)
    const progressLength = (Math.min(pct, 120) / 120) * arcLength;
    
    const strokeColor = over
      ? 'var(--color-signal-crit)'
      : pct > 85
      ? 'var(--color-signal-warn)'
      : 'var(--color-cyan)';

    return (
      <div className={clsx("panel-inset min-w-0 px-3 py-3 relative flex flex-col items-center justify-center border-cyan/25", over && "voltage-drop-active")}>
        <div className="w-full flex items-baseline justify-between gap-2 mb-2">
          <span className="hud-label truncate">{gauge.label}</span>
          <span className={clsx("font-mono text-xs tabular-nums", over ? "text-signal-crit" : pct > 85 ? "text-signal-warn" : "text-cyan")}>
            {formatVal(gauge.value, gauge.unit)}
          </span>
        </div>
        <div className="relative w-28 h-28 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Backing HUD Segmented Ring */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--color-rim)"
              strokeWidth="2.5"
              strokeDasharray="3 1.5"
              transform="rotate(135 50 50)"
              opacity="0.3"
            />
            {/* Progress Arc */}
            <motion.circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth="3.5"
              strokeDasharray={`${progressLength} 999`}
              transform="rotate(135 50 50)"
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 999` }}
              animate={{ strokeDasharray: `${progressLength} 999` }}
              transition={{ delay, duration: 0.8, ease: "easeOut" }}
            />
            {/* Limit mark at 12 o'clock */}
            <line
              x1="50"
              y1="10"
              x2="50"
              y2="18"
              stroke="var(--color-ink-dim)"
              strokeWidth="1.5"
              opacity="0.6"
            />
            <text x="50" y="24" textAnchor="middle" className="fill-ink-dim font-mono text-[6px] tracking-widest" opacity="0.6">
              LIMIT
            </text>
          </svg>
          {/* Centered Readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center mt-2">
            <span className={clsx("font-mono text-[9px] uppercase tracking-widest", over ? "text-signal-crit" : "text-ink-dim")}>
              {over ? '[SYS_OVR]' : pct > 85 ? '[WARNING]' : '[SYS_OK]'}
            </span>
            <span className="font-mono text-[10px] text-ink-dim mt-0.5">
              {Math.round(pct)}%
            </span>
          </div>
        </div>
        <div className="w-full text-center mt-1">
          <span className="font-mono text-[9px] text-ink-dim">BUDGET: {formatVal(gauge.budget, gauge.unit)}</span>
        </div>
      </div>
    );
  }

  // Industrial: solid analog dial with a physical needle indicator and black/yellow hazard stripe headers.
  if (theme === 'industrial') {
    const minAngle = -90; // Left
    const maxAngle = 90;  // Right
    // Scale needle angle so 100% budget is at 90 deg (straight right), and 120% is at 108 deg.
    const needleAngle = minAngle + (Math.min(pct, 120) / 120) * (maxAngle - minAngle);

    const dialColor = over
      ? 'var(--color-signal-crit)'
      : pct > 80
      ? 'var(--color-signal-warn)'
      : '#2563eb';

    return (
      <div className="relative panel-inset min-w-0 pt-4 pb-3 px-3 overflow-hidden border-rim bg-white">
        {/* Hazard header if overloaded */}
        {over && (
          <div className="absolute top-0 left-0 right-0 h-2" style={{
            backgroundImage: 'repeating-linear-gradient(-45deg, var(--color-amber), var(--color-amber) 8px, #000 8px, #000 16px)'
          }} />
        )}
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="hud-label font-bold text-gray-700">{gauge.label}</span>
          <span className={clsx("font-mono text-xs font-bold tabular-nums", over ? "text-signal-crit" : "text-gray-900")}>
            {formatVal(gauge.value, gauge.unit)}
          </span>
        </div>
        <div className="relative w-full h-16 flex items-center justify-center">
          <svg viewBox="0 0 100 60" className="w-full h-full">
            {/* Backing solid dial arc */}
            <path
              d="M 15 55 A 35 35 0 0 1 85 55"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Progress segment */}
            <path
              d="M 15 55 A 35 35 0 0 1 85 55"
              fill="none"
              stroke={dialColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(Math.min(pct, 120) / 120) * 110} 999`}
            />
            {/* 100% budget limit marker (peg) */}
            <circle cx="79.2" cy="30" r="1.5" fill="#4b5563" />
            {/* 0% peg */}
            <circle cx="20.8" cy="30" r="1.5" fill="#4b5563" />
            {/* Center hub */}
            <circle cx="50" cy="55" r="4.5" fill="#1f2937" />
            {/* Needle */}
            <motion.line
              x1="50"
              y1="55"
              x2="50"
              y2="24"
              stroke="#ef4444"
              strokeWidth="2.2"
              strokeLinecap="round"
              style={{ originX: "50px", originY: "55px" }}
              animate={over ? {
                rotate: [needleAngle - 2.5, needleAngle + 2.5, needleAngle - 1.5, needleAngle + 1.5, needleAngle],
                transition: { repeat: Infinity, duration: 0.15, ease: "linear" }
              } : {
                rotate: needleAngle,
                transition: { type: "spring", stiffness: 85, damping: 12 }
              }}
            />
          </svg>
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] text-gray-500 font-bold uppercase tracking-wider">
          <span>0%</span>
          <span>LIMIT: {formatVal(gauge.budget, gauge.unit)}</span>
          <span>120%</span>
        </div>
      </div>
    );
  }

  // Topology: clean, concentric radial rings showing mass, power, and cost simultaneously.
  const isMass = gauge.unit === 'g';
  const isPower = gauge.unit === 'W';
  const isCost = gauge.unit === '$' || gauge.unit === 'S' || gauge.label.toLowerCase().includes('cost');

  const massPct = massG.budget > 0 ? (massG.value / massG.budget) * 100 : 0;
  const powerPct = powerG.budget > 0 ? (powerG.value / powerG.budget) * 100 : 0;
  const costPct = costG.budget > 0 ? (costG.value / costG.budget) * 100 : 0;

  const rMass = 38;
  const rPower = 28;
  const rCost = 18;

  const cMass = 2 * Math.PI * rMass;
  const cPower = 2 * Math.PI * rPower;
  const cCost = 2 * Math.PI * rCost;

  return (
    <div className="panel-inset min-w-0 px-3 py-3 relative border-rim flex flex-col items-center">
      <div className="w-full flex items-baseline justify-between mb-2">
        <span className="hud-label font-bold text-violet-300">{gauge.label}</span>
        <span className="font-mono text-xs text-glow-cyan text-cyan font-bold tabular-nums">
          {formatVal(gauge.value, gauge.unit)}
        </span>
      </div>
      <div className="relative w-28 h-28 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Bleeding concentric waves if overloaded and active */}
          {isMass && massG.value > massG.budget && (
            <>
              <circle cx="50" cy="50" r={rMass} fill="none" stroke="var(--color-signal-crit)" strokeWidth="0.5">
                <animate attributeName="r" values={`${rMass};${rMass + 14};${rMass}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite" />
              </circle>
            </>
          )}
          {isPower && powerG.value > powerG.budget && (
            <>
              <circle cx="50" cy="50" r={rPower} fill="none" stroke="var(--color-signal-crit)" strokeWidth="0.5">
                <animate attributeName="r" values={`${rPower};${rPower + 12};${rPower}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite" />
              </circle>
            </>
          )}
          {isCost && costG.value > costG.budget && (
            <>
              <circle cx="50" cy="50" r={rCost} fill="none" stroke="var(--color-signal-crit)" strokeWidth="0.5">
                <animate attributeName="r" values={`${rCost};${rCost + 10};${rCost}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite" />
              </circle>
            </>
          )}

          {/* Mass Ring (Outer) */}
          <circle
            cx="50"
            cy="50"
            r={rMass}
            fill="none"
            stroke="var(--color-rim)"
            strokeWidth="2"
            opacity={isMass ? 0.25 : 0.08}
          />
          <motion.circle
            cx="50"
            cy="50"
            r={rMass}
            fill="none"
            stroke={massG.value > massG.budget ? "var(--color-signal-crit)" : "var(--color-cyan)"}
            strokeWidth="3.2"
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            opacity={isMass ? 1 : 0.22}
            initial={{ strokeDasharray: `0 999` }}
            animate={{ strokeDasharray: `${(Math.min(massPct, 100) / 100) * cMass} 999` }}
            transition={{ delay: 0.1, duration: 0.8 }}
          />

          {/* Power Ring (Middle) */}
          <circle
            cx="50"
            cy="50"
            r={rPower}
            fill="none"
            stroke="var(--color-rim)"
            strokeWidth="2"
            opacity={isPower ? 0.25 : 0.08}
          />
          <motion.circle
            cx="50"
            cy="50"
            r={rPower}
            fill="none"
            stroke={powerG.value > powerG.budget ? "var(--color-signal-crit)" : "var(--color-cyan)"}
            strokeWidth="3.2"
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            opacity={isPower ? 1 : 0.22}
            initial={{ strokeDasharray: `0 999` }}
            animate={{ strokeDasharray: `${(Math.min(powerPct, 100) / 100) * cPower} 999` }}
            transition={{ delay: 0.2, duration: 0.8 }}
          />

          {/* Cost Ring (Inner) */}
          <circle
            cx="50"
            cy="50"
            r={rCost}
            fill="none"
            stroke="var(--color-rim)"
            strokeWidth="2"
            opacity={isCost ? 0.25 : 0.08}
          />
          <motion.circle
            cx="50"
            cy="50"
            r={rCost}
            fill="none"
            stroke={costG.value > costG.budget ? "var(--color-signal-crit)" : "var(--color-cyan)"}
            strokeWidth="3.2"
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            opacity={isCost ? 1 : 0.22}
            initial={{ strokeDasharray: `0 999` }}
            animate={{ strokeDasharray: `${(Math.min(costPct, 100) / 100) * cCost} 999` }}
            transition={{ delay: 0.3, duration: 0.8 }}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center mt-1">
          <span className="font-mono text-[7px] text-ink-dim uppercase tracking-wider">
            {isMass ? 'MASS' : isPower ? 'POWER' : 'COST'}
          </span>
          <span className="font-mono text-[9px] font-bold text-ink mt-0.5">
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      <div className="w-full text-center mt-1">
        <span className="font-mono text-[9px] text-ink-dim">LIMIT: {formatVal(gauge.budget, gauge.unit)}</span>
      </div>
    </div>
  );
}
