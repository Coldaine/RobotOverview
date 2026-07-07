'use client';
import type { Unit, UnitStatus } from '@/data/types';
import type { ModuleBox, ViewMode } from '@/lib/twin';
import { BAY_ICONS } from '@/components/bay-icons';

const STATUS_COLOR: Record<UnitStatus, string> = {
  operational: 'var(--color-signal-ok)',
  'needs-attention': 'var(--color-amber)',
  blocked: 'var(--color-signal-crit)',
  'in-mission': 'var(--color-cyan)',
  wishlist: 'var(--color-ink-dim)',
  'on-order': 'var(--color-cyan)',
  researching: 'var(--color-cyan)',
  retired: 'var(--color-signal-idle)',
};

export function Module({
  module,
  unit,
  mode,
  hovered,
  dimmed,
  isCore,
  reducedMotion,
  interactive = true,
  onHover,
}: {
  module: ModuleBox;
  unit: Unit | undefined;
  mode: ViewMode;
  hovered: boolean;
  dimmed: boolean;
  isCore: boolean;
  reducedMotion: boolean;
  interactive?: boolean;
  onHover: (unitId: string | null) => void;
}) {
  const Icon = unit ? BAY_ICONS[unit.bay] : BAY_ICONS.compute;
  const accent = hovered || isCore ? 'var(--color-cyan)' : 'var(--color-rim)';
  const status = unit ? STATUS_COLOR[unit.status] : 'var(--color-ink-dim)';
  const isBus = mode === 'bus';

  return (
    <g
      style={{ opacity: dimmed ? 0.4 : 1 }}
      className="outline-none transition-opacity duration-500"
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'group' : undefined}
      aria-label={interactive ? (unit?.name ?? module.unitId) : undefined}
      onMouseEnter={interactive ? () => onHover(module.unitId) : undefined}
      onMouseLeave={interactive ? () => onHover(null) : undefined}
      onFocus={interactive ? () => onHover(module.unitId) : undefined}
      onBlur={interactive ? () => onHover(null) : undefined}
    >
      {isCore && !reducedMotion && (
        <rect
          x={module.x - 6}
          y={module.y - 6}
          width={module.w + 12}
          height={module.h + 12}
          rx={14}
          fill="none"
          stroke="var(--color-cyan)"
          strokeWidth={1}
          opacity={0.4}
          className="animate-pulse-trace"
        />
      )}

      <rect
        x={module.x}
        y={module.y}
        width={module.w}
        height={module.h}
        rx={isBus ? 6 : 12}
        fill="var(--color-panel)"
        fillOpacity={isBus ? 0.35 : 0.82}
        stroke={accent}
        strokeWidth={hovered || isCore ? 1.6 : 1}
        style={hovered || isCore ? { filter: `drop-shadow(0 0 14px color-mix(in srgb, ${accent} 40%, transparent))` } : undefined}
      />

      {/* corner tick — targeting-reticle motif */}
      <path
        d={`M ${module.x + 6} ${module.y + 16} L ${module.x + 6} ${module.y + 6} L ${module.x + 16} ${module.y + 6}`}
        fill="none"
        stroke={accent}
        strokeWidth={1}
        opacity={0.7}
      />

      <Icon x={module.x + 12} y={module.y + 14} width={15} height={15} color={hovered || isCore ? 'var(--color-cyan)' : 'var(--color-ink-dim)'} />

      <text
        x={module.x + 34}
        y={module.y + 22}
        className="font-display"
        fill="var(--color-ink)"
        fontSize={13}
        style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
      >
        {(unit?.callsign ?? unit?.name ?? module.unitId).slice(0, isBus ? 12 : 22)}
      </text>

      {!isBus && (
        <text x={module.x + 34} y={module.y + 38} className="font-mono" fill="var(--color-ink-dim)" fontSize={10} style={{ letterSpacing: '0.1em' }}>
          {(unit?.class ?? '').toUpperCase().slice(0, 28)}
        </text>
      )}

      <circle cx={module.x + module.w - 12} cy={module.y + 14} r={3.5} fill={status}>
        {!reducedMotion && unit?.status === 'operational' && (
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2.4s" repeatCount="indefinite" />
        )}
      </circle>
    </g>
  );
}
