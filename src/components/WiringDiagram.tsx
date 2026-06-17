'use client';
import React from 'react';
import { useHangar } from '@/lib/store';

export function WiringDiagram() {
  const { unit, theme } = useHangar();
  const beast = unit('beast');
  const loadout = beast?.loadout ?? [];

  const filled = {
    power: loadout.some(s => s.hotspotId === 'power' && s.filledBy !== null),
    compute: loadout.some(s => s.hotspotId === 'compute' && s.filledBy !== null),
    driver: loadout.some(s => s.hotspotId === 'driver' && s.filledBy !== null),
    arm: loadout.some(s => s.hotspotId === 'arm' && s.filledBy !== null),
    lighting: loadout.some(s => s.hotspotId === 'lighting' && s.filledBy !== null),
  };

  const connections = [
    {
      id: 'power_to_compute',
      spline: 'M 50 79 Q 47 66.5 50 54',
      cad: 'M 50 79 L 50 54',
      active: filled.power,
    },
    {
      id: 'power_to_driver',
      spline: 'M 50 79 Q 42 75 40 48',
      cad: 'M 50 79 L 40 79 L 40 48',
      active: filled.power,
    },
    {
      id: 'driver_to_arm',
      spline: 'M 40 48 Q 52 42 64 40',
      cad: 'M 40 48 L 40 40 L 64 40',
      active: filled.power && filled.arm,
    },
    {
      id: 'compute_to_lighting',
      spline: 'M 50 54 Q 38 40 30 19',
      cad: 'M 50 54 L 30 54 L 30 19',
      active: filled.compute && filled.lighting,
    },
    {
      id: 'compute_to_driver',
      spline: 'M 50 54 Q 45 51 40 48',
      cad: 'M 50 54 L 50 48 L 40 48',
      active: filled.compute && filled.power,
    }
  ];

  return (
    <g>
      <defs>
        <filter id="blueprintGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {connections.map((c) => {
        const path = theme === 'industrial' ? c.cad : c.spline;

        if (theme === 'blueprint') {
          return (
            <g key={c.id}>
              {/* Glow backing */}
              {c.active && (
                <path
                  d={path}
                  fill="none"
                  stroke="var(--color-cyan)"
                  strokeWidth="1.2"
                  filter="url(#blueprintGlow)"
                  opacity="0.4"
                />
              )}
              {/* Foreground line */}
              <path
                d={path}
                fill="none"
                stroke={c.active ? 'var(--color-cyan)' : 'var(--color-rim)'}
                strokeWidth={c.active ? 0.6 : 0.4}
                strokeDasharray={c.active ? '2 2' : '1 3'}
                className={c.active ? 'animate-dash' : undefined}
                opacity={c.active ? 1 : 0.3}
              />
            </g>
          );
        }

        if (theme === 'industrial') {
          return (
            <g key={c.id}>
              {/* Flat CAD line */}
              <path
                d={path}
                fill="none"
                stroke={c.active ? 'var(--color-cyan)' : 'var(--color-rim)'}
                strokeWidth={c.active ? 1.5 : 1}
                opacity={c.active ? 1 : 0.25}
              />
              {/* Corner nodes */}
              {c.active && c.id === 'power_to_driver' && <rect x={39.1} y={78.1} width={1.8} height={1.8} fill="var(--color-cyan)" />}
              {c.active && c.id === 'driver_to_arm' && <rect x={39.1} y={39.1} width={1.8} height={1.8} fill="var(--color-cyan)" />}
              {c.active && c.id === 'compute_to_lighting' && <rect x={29.1} y={53.1} width={1.8} height={1.8} fill="var(--color-cyan)" />}
              {c.active && c.id === 'compute_to_driver' && <rect x={49.1} y={47.1} width={1.8} height={1.8} fill="var(--color-cyan)" />}
            </g>
          );
        }

        // Topology Theme: Thick bandwidth flows with pulsing dots
        return (
          <g key={c.id}>
            {/* Thick flow background */}
            <path
              d={path}
              fill="none"
              stroke="var(--color-cyan)"
              strokeWidth={c.active ? 3.5 : 1.5}
              opacity={c.active ? 0.15 : 0.05}
            />
            {/* Core wire */}
            <path
              d={path}
              fill="none"
              stroke={c.active ? 'var(--color-cyan)' : 'var(--color-rim)'}
              strokeWidth={0.6}
              opacity={c.active ? 0.8 : 0.25}
            />
            {/* Traveling pulse */}
            {c.active && (
              <circle r="1.1" fill="var(--color-cyan)">
                <animateMotion dur="2.5s" repeatCount="indefinite" path={path} />
              </circle>
            )}
          </g>
        );
      })}
    </g>
  );
}
