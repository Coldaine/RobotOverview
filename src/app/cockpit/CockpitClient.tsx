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
    // connect() re-arms subscriptions on an already-open socket, which is the
    // path taken when we return to the cockpit with an e-stop still held.
    rosClient.connect(wsUrl);
    // Only one tab may command the e-stop; this joins the election.
    const releaseWriter = rosClient.claimEstopWriter();

    return () => {
      // Safe to call unconditionally: the election teardown is itself a no-op
      // while a stop is held, because a tab that is still publishing the
      // heartbeat must stay reachable by the election. That invariant lives in
      // client.ts next to the heartbeat's own lifetime, rather than depending
      // on every call site remembering to check first.
      releaseWriter();
      if (rosClient.isEstopEngaged()) {
        // An engaged e-stop keeps the socket — and therefore its >= 1 Hz
        // republish — alive past this unmount. twist_mux drops the lock if it
        // restarts, so the heartbeat has to outlive a route change or a Strict
        // Mode double-invoke; tearing the socket down here would silently mute
        // the only thing holding the robot stopped.
        //
        // The video and LiDAR streams have no such claim on the link, so drop
        // them: nobody is looking at the page, and they are the bandwidth.
        rosClient.releaseHeavyStreams();
        return;
      }
      rosClient.disconnect();
    };
  }, [wsUrl]);

  // Leaving the page entirely with a stop held means nothing will ever publish
  // the release — the robot stays locked until someone comes back.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!rosClient.isEstopEngaged()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

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
