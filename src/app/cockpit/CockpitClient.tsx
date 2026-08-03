'use client';

import { useEffect } from 'react';
import { rosClient, useConnectionState, useCockpitBridge } from '@/lib/ros/client';
import { ConnectionStateBadge } from '@/components/cockpit/ConnectionState';
import { SafetyStrip } from '@/components/cockpit/SafetyStrip';
import { SpatialView } from '@/components/cockpit/SpatialView';
import { OpticsWall } from '@/components/cockpit/OpticsWall';
import { CommandRail } from '@/components/cockpit/CommandRail';
import { TelemetryRow } from '@/components/cockpit/TelemetryRow';
import { HonestyRail } from '@/components/cockpit/HonestyRail';
import { Activity, AlertTriangle } from 'lucide-react';

interface CockpitClientProps {
  wsUrl: string;
}

export function CockpitClient({ wsUrl }: CockpitClientProps) {
  const connectionState = useConnectionState();
  const bridge = useCockpitBridge();

  useEffect(() => {
    if (!wsUrl) return;
    // connect() re-arms subscriptions on an already-open socket — the path
    // taken when the cockpit remounts while the socket is still up.
    rosClient.connect(wsUrl);

    return () => {
      rosClient.disconnect();
    };
  }, [wsUrl]);

  if (!wsUrl) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center p-6 text-center">
        <div className="panel select-none border-crit/50 bg-crit/10 px-8 py-10 shadow-hud-red text-glow-crit max-w-md">
          <Activity className="mx-auto h-12 w-12 text-crit animate-pulse mb-4" />
          <h1 className="font-display text-xl uppercase tracking-widest text-crit mb-3">COCKPIT DEGRADED</h1>
          <p className="font-mono text-sm text-ink-dim leading-relaxed">
            No bridge URL configured — the Command Deck has nothing to connect to.
          </p>
          <p className="font-mono text-xs text-ink-dim mt-4">
            BEAST_COCKPIT_WS_URL can override the default tailnet endpoint.
          </p>
        </div>
      </div>
    );
  }

  const errors = bridge.faults.filter((f) => f.level === 'error');

  return (
    <div className="flex flex-col gap-4 px-4 py-3 pb-24 md:px-6">
      {/* ── HEADER ────────────────────────────────────────── */}
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-cyan animate-pulse" />
          <h1 className="font-display text-xl font-bold tracking-[0.22em] text-ink uppercase">
            BEAST-01 <span className="text-cyan text-glow-cyan">{'//'} COMMAND DECK</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {connectionState !== 'connected' && (
            <span className="chip border-crit/40 bg-crit/5 text-crit px-3 py-1 font-mono text-[10px] tracking-wider animate-pulse">
              ROBOT UNREACHABLE
            </span>
          )}
          <ConnectionStateBadge url={wsUrl} />
        </div>
      </header>

      {/* ── BRIDGE FAULTS ─────────────────────────────────── */}
      {/* rosbridge refuses unlisted topics with an op:"status" frame and
          otherwise total silence. Surfacing them is the difference between "the
          control is dead" and "the control looks fine and does nothing". */}
      {errors.length > 0 && (
        <div
          role="alert"
          className="panel border-red-500/50 bg-red-950/25 flex flex-col gap-1.5 p-3 shadow-hud-red"
        >
          <div className="flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            rosbridge refused {errors.length} operation{errors.length === 1 ? '' : 's'}
          </div>
          <ul className="flex flex-col gap-1 font-mono text-[10px] text-red-300/90">
            {errors.slice(0, 4).map((f, i) => (
              <li key={`${f.id}-${i}`} className="truncate">
                <b className="mr-1.5">{f.topic ?? f.id ?? 'unattributed'}</b>— {f.msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── SAFETY STRIP ──────────────────────────────────── */}
      <SafetyStrip />

      {/* ── MAIN WORKSPACE ────────────────────────────────── */}
      <main className="grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_1.55fr_0.95fr]">
        {/* SPATIAL / LiDAR VIEW */}
        <SpatialView />

        {/* OPTICS / CAMERA WALL */}
        <OpticsWall />

        {/* COMMANDS & CONTROLS */}
        <CommandRail />
      </main>

      {/* ── TELEMETRY / BOTTOM ROW ───────────────────────── */}
      <TelemetryRow />

      {/* ── HONESTY RAIL / FOOTER ────────────────────────── */}
      <HonestyRail />
    </div>
  );
}
