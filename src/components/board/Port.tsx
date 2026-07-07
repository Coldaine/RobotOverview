'use client';
import type { Terminal } from '@/data/types';
import type { PortNode } from '@/lib/twin';
import { PORT } from './palette';

export interface PortState {
  active: boolean;
  inTrace: boolean;
  dimmed: boolean;
  selected: boolean;
  reducedMotion: boolean;
}

export function Port({
  port,
  terminal,
  state,
  showLabel,
  interactionId = port.terminalId,
  interactive = true,
  onHover,
  onSelect,
}: {
  port: PortNode;
  terminal: Terminal | undefined;
  state: PortState;
  showLabel: boolean;
  interactionId?: string;
  interactive?: boolean;
  onHover: (terminalId: string | null) => void;
  onSelect: (terminalId: string) => void;
}) {
  const { active, inTrace, dimmed, selected, reducedMotion } = state;
  const emphasize = inTrace || selected;
  const color = active ? 'var(--color-cyan)' : 'var(--color-ink-dim)';
  const opacity = dimmed ? 0.25 : 1;
  const label = terminal?.connector ?? terminal?.name ?? port.terminalId;

  // Label sits just outside the module edge, aligned to the outward normal.
  const lx = port.x + port.nx * 12;
  const ly = port.y + port.ny * 12;
  const anchor = port.nx > 0.3 ? 'start' : port.nx < -0.3 ? 'end' : 'middle';
  const dy = port.ny > 0.3 ? 10 : port.ny < -0.3 ? -4 : 3;

  return (
    <g
      style={{ opacity }}
      className={interactive ? 'cursor-pointer outline-none transition-opacity duration-500' : 'transition-opacity duration-500'}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={terminal ? `${terminal.name}${terminal.connector ? ` (${terminal.connector})` : ''}` : port.terminalId}
      onMouseEnter={interactive ? () => onHover(interactionId) : undefined}
      onMouseLeave={interactive ? () => onHover(null) : undefined}
      onFocus={interactive ? () => onHover(interactionId) : undefined}
      onBlur={interactive ? () => onHover(null) : undefined}
      onClick={interactive ? () => onSelect(interactionId) : undefined}
      onKeyDown={(e) => {
        if (!interactive) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(interactionId);
        }
      }}
    >
      <circle cx={port.x} cy={port.y} r={PORT.hitRadius} fill="transparent" />

      {emphasize && (
        <circle cx={port.x} cy={port.y} r={PORT.ringRadius} fill="none" stroke={color} strokeWidth={1.4} opacity={0.8}>
          {!reducedMotion && (
            <animate attributeName="r" values={`${PORT.ringRadius};${PORT.ringRadius + 3};${PORT.ringRadius}`} dur="2s" repeatCount="indefinite" />
          )}
        </circle>
      )}

      <circle
        cx={port.x}
        cy={port.y}
        r={PORT.radius}
        fill={active ? color : 'var(--color-void)'}
        stroke={color}
        strokeWidth={1.6}
        style={emphasize ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined}
      />

      {showLabel && (
        <text
          x={lx}
          y={ly}
          dy={dy}
          textAnchor={anchor}
          className="font-mono"
          fill="var(--color-ink)"
          fontSize={11}
          style={{ letterSpacing: '0.04em', paintOrder: 'stroke', stroke: 'var(--color-void)', strokeWidth: 3 }}
        >
          {label}
        </text>
      )}
    </g>
  );
}
