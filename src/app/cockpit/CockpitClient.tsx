'use client';

import { useEffect } from 'react';
import { rosClient, useConnectionState } from '@/lib/ros/client';
import { ConnectionStateBadge } from '@/components/cockpit/ConnectionState';
import { SafetyStrip } from '@/components/cockpit/SafetyStrip';
import { SpatialView } from '@/components/cockpit/SpatialView';
import { OpticsWall } from '@/components/cockpit/OpticsWall';
import { CommandRail } from '@/components/cockpit/CommandRail';
import { TelemetryRow } from '@/components/cockpit/TelemetryRow';
import { HonestyRail } from '@/components/cockpit/HonestyRail';
import { Activity } from 'lucide-react';

interface CockpitClientProps {
  wsUrl: string;
}

export function CockpitClient({ wsUrl }: CockpitClientProps) {
  const connectionState = useConnectionState();

  useEffect(() => {
    if (wsUrl) {
      rosClient.connect(wsUrl);
      return () => {
        rosClient.disconnect();
      };
    }
  }, [wsUrl]);

  if (!wsUrl) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center p-6 text-center">
        <div className="panel select-none border-crit/50 bg-crit/10 px-8 py-10 shadow-hud-red text-glow-crit max-w-md">
          <Activity className="mx-auto h-12 w-12 text-crit animate-pulse mb-4" />
          <h1 className="font-display text-xl uppercase tracking-widest text-crit mb-3">COCKPIT DEGRADED</h1>
          <p className="font-mono text-sm text-ink-dim leading-relaxed">
            The environment variable <code className="text-crit">BEAST_COCKPIT_WS_URL</code> is not configured.
          </p>
          <p className="font-mono text-xs text-ink-dim mt-4">
            Add this secret in Doppler or your local environment to enable the live Command Deck.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-3 pb-24 md:px-6">
      {/* ── HEADER ────────────────────────────────────────── */}
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-cyan animate-pulse" />
          <h1 className="font-display text-xl font-bold tracking-[0.22em] text-ink uppercase">
            BEAST-01 <span className="text-cyan text-glow-cyan">{"//"} COMMAND DECK</span>
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
