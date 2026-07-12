'use client';
import clsx from 'clsx';
import { LayoutGrid, Boxes, Rows3, Cpu, CircuitBoard } from 'lucide-react';
import {
  VIEW_MODE_LABELS,
  VIEW_MODES,
  type NetColorKey,
  type ViewMode,
} from '@/lib/twin';
import { LAYERS, NET_STROKE } from './palette';
import type { NetKind } from '@/data/types';
import type { SchematicConfiguration, SchematicHost } from '@/data/schematic-types';

export function SchematicConfigurationSwitch({
  configurations,
  configuration,
  onChange,
  compact = false,
}: {
  configurations: SchematicConfiguration[];
  configuration: string;
  onChange: (configuration: string) => void;
  compact?: boolean;
}) {
  const active = configurations.find((candidate) => candidate.id === configuration);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="hud-label">Configuration</span>
      <div className="flex gap-1" role="radiogroup" aria-label="Configuration">
        {configurations.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="radio"
            aria-checked={configuration === candidate.id}
            onClick={() => onChange(candidate.id)}
            className={clsx(
              'btn whitespace-nowrap',
              compact && '!px-2 !py-1 text-[9px]',
              configuration === candidate.id ? 'btn-active' : 'btn-ghost',
            )}
          >
            {candidate.label}
          </button>
        ))}
      </div>
      {active?.badge ? (
        <span className="chip border-amber/50 bg-amber/10 text-amber">{active.badge}</span>
      ) : null}
    </div>
  );
}

const VIEW_MODE_ICONS: Record<ViewMode, typeof Cpu> = {
  board: LayoutGrid,
  iso: Boxes,
  bus: Rows3,
};

export function ViewModeSwitch({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex gap-1" role="tablist" aria-label="View mode">
      {VIEW_MODES.map((m) => {
        const Icon = VIEW_MODE_ICONS[m];
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => onChange(m)}
            className={clsx('btn', mode === m ? 'btn-active' : 'btn-ghost')}
          >
            <Icon className="h-3.5 w-3.5" />
            {VIEW_MODE_LABELS[m]}
          </button>
        );
      })}
    </div>
  );
}

export function HostSwitch({ hosts, host, onChange }: { hosts: SchematicHost[]; host: string; onChange: (host: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="hud-label flex items-center gap-1.5">
        <CircuitBoard className="h-3.5 w-3.5 text-cyan" />
        Host
      </span>
      <div className="flex gap-1" role="radiogroup" aria-label="Onboard host">
        {hosts.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="radio"
            aria-checked={host === candidate.id}
            onClick={() => onChange(candidate.id)}
            className={clsx('btn', host === candidate.id ? 'btn-active' : 'btn-ghost')}
          >
            {candidate.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function swatch(color: NetColorKey): string {
  return NET_STROKE[color].primary;
}

export function LayerBar({
  enabled,
  onToggle,
}: {
  enabled: Set<NetKind>;
  onToggle: (kind: NetKind) => void;
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Layers">
      {LAYERS.map(({ kind, label, color }) => {
        const on = enabled.has(kind);
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(kind)}
            className={clsx(
              'chip transition-opacity',
              on ? 'text-ink' : 'text-ink-dim opacity-50',
            )}
            style={{
              borderColor: on ? `color-mix(in srgb, ${swatch(color)} 45%, transparent)` : 'var(--color-rim)',
              backgroundColor: on ? `color-mix(in srgb, ${swatch(color)} 12%, transparent)` : 'transparent',
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: swatch(color) }} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
