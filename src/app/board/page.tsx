'use client';
import { CircuitBoard } from 'lucide-react';
import { ConnectedTwin } from '@/components/board/ConnectedTwin';

export default function BoardPage() {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-cyan/70">
            <CircuitBoard className="h-4 w-4" /> BEAST-01 · Systems Board
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.06em] text-glow-cyan sm:text-3xl">The Board</h1>
          <p className="mt-1 max-w-2xl font-mono text-xs leading-relaxed text-ink-dim">
            The whole nervous system — every connector, wire, and proving document. Hover a port to trace its net,
            flip the host to watch the Jetson swap re-wire the rig.
          </p>
        </div>
      </header>
      <ConnectedTwin variant="full" />
    </div>
  );
}
