'use client';
import clsx from 'clsx';
import { LayoutGrid, Boxes, Rows3, Cpu, CircuitBoard } from 'lucide-react';
import type { ActiveHost, NetColorKey, ViewMode } from '@/lib/twin';
import { LAYERS, NET_STROKE } from './palette';
import type { NetKind } from '@/data/types';

const VIEW_MODES: { mode: ViewMode; label: string; icon: typeof Cpu }[] = [
  { mode: 'board', label: 'Board', icon: LayoutGrid },
  { mode: 'iso', label: 'Cutaway', icon: Boxes },
  { mode: 'bus', label: 'Bus', icon: Rows3 },
];

export function ViewModeSwitch({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex gap-1" role="tablist" aria-label="View mode">
      {VIEW_MODES.map(({ mode: m, label, icon: Icon }) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          onClick={() => onChange(m)}
          className={clsx('btn', mode === m ? 'btn-active' : 'btn-ghost')}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

const HOSTS: { host: ActiveHost; label: string }[] = [
  { host: 'pi5', label: 'Raspberry Pi 5' },
  { host: 'orin', label: 'Jetson Orin' },
];

export function HostSwitch({ host, onChange }: { host: ActiveHost; onChange: (h: ActiveHost) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="hud-label flex items-center gap-1.5">
        <CircuitBoard className="h-3.5 w-3.5 text-cyan" />
        Host
      </span>
      <div className="flex gap-1" role="radiogroup" aria-label="Onboard host">
        {HOSTS.map(({ host: h, label }) => (
          <button
            key={h}
            role="radio"
            aria-checked={host === h}
            onClick={() => onChange(h)}
            className={clsx('btn', host === h ? 'btn-active' : 'btn-ghost')}
          >
            {label}
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
