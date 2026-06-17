'use client';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SectionTitle } from '@/components/ui/Primitives';
import { useHangar } from '@/lib/store';
import clsx from 'clsx';

type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low';

export default function Codex() {
  const { data, unit, mission } = useHangar();
  const [q, setQ] = useState('');
  const [bay, setBay] = useState<'all' | string>('all');
  const [conf, setConf] = useState<ConfidenceFilter>('all');

  const onConfidenceChange = (value: string) => {
    const allowed: ConfidenceFilter[] = ['all', 'high', 'medium', 'low'];
    setConf(allowed.includes(value as ConfidenceFilter) ? (value as ConfidenceFilter) : 'all');
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.insights.filter((ins) => {
      if (bay !== 'all' && ins.bay !== bay) return false;
      if (conf !== 'all' && ins.confidence !== conf) return false;
      if (!needle) return true;
      const hay = `${ins.title} ${ins.body} ${ins.tags.join(' ')}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [data.insights, q, bay, conf]);

  return (
    <div className="space-y-6">
      <header>
        <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan/70">Field Notes</div>
        <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.06em] text-ink">Codex</h1>
        <p className="mt-1 font-mono text-xs text-ink-dim">Searchable tactical knowledge. Tiny wiki brain, no fluff.</p>
      </header>

      <div className="panel p-3">
        <div className="grid gap-2 md:grid-cols-[1.6fr_0.8fr_0.8fr]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search insight title, body, tags..."
              className="w-full rounded-md border border-rim bg-panel-2/40 py-2 pl-9 pr-3 font-mono text-xs text-ink outline-none ring-cyan/40 transition focus:ring"
            />
          </label>

          <label className="flex items-center gap-2 rounded-md border border-rim bg-panel-2/40 px-2.5">
            <SlidersHorizontal className="h-4 w-4 text-cyan" />
            <select value={bay} onChange={(e) => setBay(e.target.value)} className="w-full bg-transparent py-2 font-mono text-xs text-ink outline-none">
              <option value="all">All bays</option>
              {data.bays.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-md border border-rim bg-panel-2/40 px-2.5">
            <SlidersHorizontal className="h-4 w-4 text-amber" />
            <select value={conf} onChange={(e) => onConfidenceChange(e.target.value)} className="w-full bg-transparent py-2 font-mono text-xs text-ink outline-none">
              <option value="all">All confidence</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>
      </div>

      <SectionTitle code="WIKI">{filtered.length} insight{filtered.length === 1 ? '' : 's'}</SectionTitle>
      <div className="space-y-3">
        {filtered.map((ins) => (
          <article key={ins.id} className="panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm uppercase tracking-[0.08em] text-ink">{ins.title}</h2>
              <span
                className={clsx(
                  'chip',
                  ins.confidence === 'high' && 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok',
                  ins.confidence === 'medium' && 'border-amber/40 bg-amber/10 text-amber',
                  ins.confidence === 'low' && 'border-signal-crit/40 bg-signal-crit/10 text-signal-crit',
                )}
              >
                {ins.confidence}
              </span>
              {ins.bay && (
                <span className="chip border-rim bg-panel-2/40 text-ink-dim">{ins.bay}</span>
              )}
            </div>

            <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-dim">{ins.body}</p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {ins.tags.map((t) => (
                <button
                  key={t}
                  onClick={() => setQ((prev) => (prev ? `${prev} ${t}` : t))}
                  className="chip border-cyan/30 bg-cyan/5 text-cyan hover:border-cyan/60"
                >
                  #{t}
                </button>
              ))}
            </div>

            {(ins.units?.length || ins.missions?.length) && (
              <div className="mt-3 border-t border-rim/50 pt-2 font-mono text-[10px] text-ink-dim">
                {ins.units?.map((uid) => {
                  const u = unit(uid);
                  return u ? (
                    <Link key={uid} href={`/unit/${uid}`} className="mr-2 inline-flex text-cyan hover:underline">unit:{u.name}</Link>
                  ) : null;
                })}
                {ins.missions?.map((mid) => {
                  const m = mission(mid);
                  return m ? (
                    <Link key={mid} href={`/mission/${mid}`} className="mr-2 inline-flex text-amber hover:underline">mission:{m.code}</Link>
                  ) : null;
                })}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}