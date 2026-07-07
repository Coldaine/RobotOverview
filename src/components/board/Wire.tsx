'use client';
import clsx from 'clsx';
import type { WirePath } from '@/lib/twin';
import { strokeForKind, WIRE } from './palette';

export interface WireState {
  active: boolean;
  inTrace: boolean;
  dimmed: boolean;
  layerOn: boolean;
  selected: boolean;
  reducedMotion: boolean;
}

export function Wire({
  wire,
  state,
  interactive = true,
  onHover,
  onSelect,
}: {
  wire: WirePath;
  state: WireState;
  interactive?: boolean;
  onHover: (netId: string | null) => void;
  onSelect: (netId: string) => void;
}) {
  const { active, inTrace, dimmed, layerOn, selected, reducedMotion } = state;
  const stroke = strokeForKind(wire.kind);
  const lit = active && !dimmed;
  const emphasize = inTrace || selected;

  const opacity = !layerOn ? 0.05 : dimmed ? WIRE.dimOpacity : active ? WIRE.activeOpacity : WIRE.idleOpacity;
  const flowing = lit && !reducedMotion;
  const showGlow = layerOn && lit && (emphasize || !reducedMotion);

  return (
    <g
      className={clsx(interactive && 'cursor-pointer', 'outline-none transition-opacity duration-500')}
      style={{ opacity }}
      tabIndex={interactive && layerOn ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? `Trace ${wire.netId}` : undefined}
      onMouseEnter={interactive ? () => onHover(wire.netId) : undefined}
      onMouseLeave={interactive ? () => onHover(null) : undefined}
      onFocus={interactive ? () => onHover(wire.netId) : undefined}
      onBlur={interactive ? () => onHover(null) : undefined}
      onClick={interactive ? () => onSelect(wire.netId) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(wire.netId);
              }
            }
          : undefined
      }
    >
      {/* fat invisible hit target */}
      <path d={wire.d} fill="none" stroke="transparent" strokeWidth={16} strokeLinecap="round" />

      {showGlow && (
        <path
          d={wire.d}
          fill="none"
          stroke={stroke.primary}
          strokeWidth={emphasize ? WIRE.glowWidth + 3 : WIRE.glowWidth}
          strokeLinecap="round"
          opacity={WIRE.glowOpacity}
          style={{ filter: 'blur(4px)' }}
        />
      )}

      {/* core conductor */}
      <path
        d={wire.d}
        fill="none"
        stroke={stroke.primary}
        strokeWidth={emphasize ? WIRE.coreWidth + 1 : WIRE.coreWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={flowing ? WIRE.dashArray : undefined}
        className={clsx(flowing && 'animate-dash')}
      />

      {/* mixed rails carry a second strand */}
      {stroke.secondary && (
        <path
          d={wire.d}
          fill="none"
          stroke={stroke.secondary}
          strokeWidth={1}
          strokeLinecap="round"
          strokeDasharray="2 10"
          opacity={lit ? 0.9 : 0.4}
          className={clsx(flowing && 'animate-dash')}
        />
      )}

      {/* traveling charge */}
      {flowing && (
        <circle r={emphasize ? WIRE.pulseRadius + 1 : WIRE.pulseRadius} fill={stroke.primary}>
          <animateMotion dur={`${WIRE.pulseDuration}s`} repeatCount="indefinite" path={wire.d} rotate="auto" />
        </circle>
      )}
    </g>
  );
}
