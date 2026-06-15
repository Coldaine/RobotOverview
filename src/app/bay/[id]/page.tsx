'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { UnitCard } from '@/components/UnitCard';
import { SectionTitle } from '@/components/ui/Primitives';
import { useHangar } from '@/lib/store';
import type { BayId } from '@/data/types';

export default function BayView() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const { bay, unitsByBay } = useHangar();
  const bayId = id as BayId | undefined;
  const b = bayId ? bay(bayId) : undefined;

  if (!b) {
    return (
      <div className="panel p-8 text-center">
        <p className="font-mono text-sm text-ink-dim">Bay not found.</p>
      </div>
    );
  }

  const units = unitsByBay(b.id);

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim transition-colors hover:text-cyan">
        <ArrowLeft className="h-3 w-3" /> Hangar
      </Link>

      <header>
        <div className="font-mono text-[11px] tracking-[0.3em] text-cyan/70">{b.code}</div>
        <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.06em] text-ink">{b.name}</h1>
        <p className="mt-1 font-mono text-xs text-ink-dim">{b.tagline}</p>
      </header>

      <section>
        <SectionTitle code="UNITS">Roster</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {units.map((u, i) => (
            <UnitCard key={u.id} unit={u} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}