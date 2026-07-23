'use client';
import { Plus, Search, SlidersHorizontal, Trash2, X, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SectionTitle } from '@/components/ui/Primitives';
import { isHangarBayId } from '@/data/hangar';
import { DATACORE_BRIEFINGS } from '@/data/datacore-briefings';
import { INSIGHT_CONFIDENCE_LEVELS, isInsightConfidence, type InsightConfidence } from '@/data/types';
import { insightConfidenceMeta } from '@/lib/format';
import { useHangar, LOCAL_INSIGHT_PREFIX } from '@/lib/store';
import clsx from 'clsx';

type ConfidenceFilter = 'all' | InsightConfidence;

export default function Datacore() {
  const { data, insights, unit, mission, addLocalInsight, removeLocalInsight } = useHangar();
  const [q, setQ] = useState('');
  const [bay, setBay] = useState<'all' | string>('all');
  const [conf, setConf] = useState<ConfidenceFilter>('all');

  // Content intake — a lightweight, reversible local-notes capture (no backend).
  const [showCapture, setShowCapture] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftBay, setDraftBay] = useState<'' | string>('');
  const [draftTags, setDraftTags] = useState('');

  const onConfidenceChange = (value: string) => {
    setConf(value === 'all' || isInsightConfidence(value) ? value : 'all');
  };

  const submitDraft = () => {
    addLocalInsight({
      title: draftTitle,
      body: draftBody,
      bay: isHangarBayId(draftBay) ? draftBay : undefined,
      tags: draftTags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setDraftTitle('');
    setDraftBody('');
    setDraftBay('');
    setDraftTags('');
    setShowCapture(false);
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return insights.filter((ins) => {
      if (bay !== 'all' && ins.bay !== bay) return false;
      if (conf !== 'all' && ins.confidence !== conf) return false;
      if (!needle) return true;
      const hay = `${ins.title} ${ins.body} ${ins.tags.join(' ')}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [insights, q, bay, conf]);

  const briefingHits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return DATACORE_BRIEFINGS;
    return DATACORE_BRIEFINGS.filter((b) => {
      const hay = `${b.title} ${b.summary} ${b.tags.join(' ')}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [q]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan/70">Knowledge Core</div>
          <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.06em] text-ink">Datacore</h1>
          <p className="mt-1 font-mono text-xs text-ink-dim">
            Research briefs, field notes, and speculative intel — searchable, linked to units and missions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCapture((v) => !v)}
          className="btn btn-ghost text-[10px]"
        >
          {showCapture ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showCapture ? 'Cancel' : 'Capture Note'}
        </button>
      </header>

      {showCapture && (
        <div className="panel space-y-2 p-3">
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Insight title"
            className="w-full rounded-md border border-rim bg-panel-2/40 px-3 py-2 font-mono text-xs text-ink outline-none ring-cyan/40 transition focus:ring"
          />
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            placeholder="What did you learn? (body)"
            rows={3}
            className="w-full rounded-md border border-rim bg-panel-2/40 px-3 py-2 font-mono text-xs text-ink outline-none ring-cyan/40 transition focus:ring"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={draftBay}
              onChange={(e) => setDraftBay(e.target.value)}
              className="rounded-md border border-rim bg-panel-2/40 px-2.5 py-2 font-mono text-xs text-ink outline-none"
            >
              <option value="">No bay</option>
              {data.bays.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <input
              value={draftTags}
              onChange={(e) => setDraftTags(e.target.value)}
              placeholder="tags, comma, separated"
              className="rounded-md border border-rim bg-panel-2/40 px-3 py-2 font-mono text-xs text-ink outline-none ring-cyan/40 transition focus:ring"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submitDraft}
              disabled={!draftTitle.trim() || !draftBody.trim()}
              className="btn btn-active text-[10px] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3 w-3" /> Save Note
            </button>
          </div>
        </div>
      )}

      <div className="panel p-3">
        <div className="grid gap-2 md:grid-cols-[1.6fr_0.8fr_0.8fr]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search briefs, insight title, body, tags..."
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
              {INSIGHT_CONFIDENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {insightConfidenceMeta(level).label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {briefingHits.length > 0 && (
        <>
          <SectionTitle code="BRIEF">{briefingHits.length} research brief{briefingHits.length === 1 ? '' : 's'}</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {briefingHits.map((brief) => (
              <Link
                key={brief.id}
                href={brief.href}
                className="panel group block p-4 transition-all hover:border-cyan/40 hover:shadow-hud-cyan"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded border border-cyan/30 bg-cyan/5 text-cyan">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan/70">
                      {brief.capturedAt}
                    </div>
                    <h2 className="mt-1 font-display text-sm uppercase tracking-[0.08em] text-ink group-hover:text-cyan">
                      {brief.title}
                    </h2>
                    <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-dim">{brief.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {brief.tags.map((t) => (
                        <span key={t} className="chip border-cyan/30 bg-cyan/5 text-cyan">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <SectionTitle code="CORE">{filtered.length} insight{filtered.length === 1 ? '' : 's'}</SectionTitle>
      <div className="space-y-3">
        {filtered.map((ins) => {
          const isLocal = ins.id.startsWith(LOCAL_INSIGHT_PREFIX);
          const confidenceMeta = insightConfidenceMeta(ins.confidence);
          return (
          <article key={ins.id} className="panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm uppercase tracking-[0.08em] text-ink">{ins.title}</h2>
              <span className={clsx('chip', confidenceMeta.cls)}>
                {ins.confidence}
              </span>
              {ins.bay && (
                <span className="chip border-rim bg-panel-2/40 text-ink-dim">{ins.bay}</span>
              )}
              {isLocal && (
                <>
                  <span className="chip border-cyan/30 bg-cyan/5 text-cyan">LOCAL</span>
                  <button
                    type="button"
                    aria-label={`Delete note ${ins.title}`}
                    onClick={() => removeLocalInsight(ins.id)}
                    className="ml-auto grid h-6 w-6 place-items-center rounded border border-rim/60 text-ink-dim hover:border-signal-crit/50 hover:text-signal-crit cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </>
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

            {((ins.units?.length ?? 0) > 0 || (ins.missions?.length ?? 0) > 0) && (
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
          );
        })}
      </div>
    </div>
  );
}
