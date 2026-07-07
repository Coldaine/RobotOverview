'use client';
import clsx from 'clsx';
import { LayoutGrid, Boxes, Rows3, Cpu, CircuitBoard } from 'lucide-react';
import {
  ACTIVE_HOST_LABELS,
  ACTIVE_HOSTS,
  VIEW_MODE_LABELS,
  VIEW_MODES,
  type ActiveHost,
  type NetColorKey,
  type ViewMode,
} from '@/lib/twin';
import { LAYERS, NET_STROKE } from './palette';
import type { NetKind } from '@/data/types';

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

export function HostSwitch({ host, onChange }: { host: ActiveHost; onChange: (h: ActiveHost) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="hud-label flex items-center gap-1.5">
        <CircuitBoard className="h-3.5 w-3.5 text-cyan" />
        Host
      </span>
      <div className="flex gap-1" role="radiogroup" aria-label="Onboard host">
        {ACTIVE_HOSTS.map((h) => (
          <button
            key={h}
            type="button"
            role="radio"
            aria-checked={host === h}
            onClick={() => onChange(h)}
            className={clsx('btn', host === h ? 'btn-active' : 'btn-ghost')}
          >
            {ACTIVE_HOST_LABELS[h]}
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
