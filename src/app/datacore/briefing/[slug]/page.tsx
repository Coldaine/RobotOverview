import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { BriefingMarkdown } from '@/components/datacore/BriefingMarkdown';
import { getBriefing, getBriefingBody, getBriefings } from '@/server/hangar/briefings';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  research: 'Research Brief',
  plan: 'Plan',
};

function sourceLine(briefing: {
  id: string;
  kind: string;
  source: string;
  repoPath: string | null;
}): string {
  if (briefing.kind === 'plan') {
    const repoPath = briefing.repoPath ?? briefing.source;
    return `source · ${repoPath}`;
  }
  return `source · datacore:${briefing.id}`;
}

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Distinguish "DB offline" from "unknown slug": offline still serves the
  // corpus fixture (loud banner on /datacore) so research stays readable;
  // online + missing row is a real 404.
  const all = await getBriefings();
  const offline = all.source !== 'postgres';

  const briefing = offline
    ? (all.briefings.find((b) => b.id === slug) ?? null)
    : await getBriefing(slug);
  if (!offline && !briefing) notFound();
  if (offline && !briefing) notFound();

  const markdown = briefing ? await getBriefingBody(briefing) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          href="/datacore"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan/80 hover:text-cyan"
        >
          <ArrowLeft className="h-3 w-3" />
          Datacore
        </Link>
        <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan/70">
          {briefing ? `${KIND_LABEL[briefing.kind] ?? 'Briefing'} · ${briefing.id.toUpperCase()}` : `BRIEFING · ${slug.toUpperCase()}`}
        </div>
        <h1 className="text-xl font-semibold text-ink md:text-2xl">{briefing ? briefing.title : slug}</h1>
        {briefing && (
          <>
            <p className="max-w-3xl font-mono text-xs text-ink-dim">{briefing.summary}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim/70">
              {sourceLine(briefing)}
            </p>
          </>
        )}
      </header>

      {offline && markdown != null && (
        <div
          role="status"
          className="flex items-center gap-3 border border-amber/50 bg-amber/10 px-4 py-2.5 [background-image:repeating-linear-gradient(-45deg,transparent,transparent_10px,rgba(255,176,32,0.06)_10px,rgba(255,176,32,0.06)_20px)]"
        >
          <span aria-hidden="true" className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber">
            DATACORE OFFLINE · static fixture
          </span>
        </div>
      )}

      {markdown == null ? (
        <div
          role="status"
          className="panel space-y-2 border-amber/50 p-5 [background-image:repeating-linear-gradient(-45deg,transparent,transparent_10px,rgba(255,176,32,0.06)_10px,rgba(255,176,32,0.06)_20px)] md:p-8"
        >
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber" />
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber">
              DATACORE OFFLINE
            </span>
          </div>
          <p className="font-mono text-[11px] leading-relaxed text-ink-dim">
            {offline
              ? 'Hangar Postgres is unreachable and this slug is not in the static research fixture.'
              : 'Briefing body unavailable — Postgres body missing. Research content should live in body_markdown.'}
          </p>
        </div>
      ) : (
        <article className="panel relative overflow-hidden p-5 md:p-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'linear-gradient(rgba(54,224,224,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(54,224,224,0.04) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
            aria-hidden
          />
          <div className="relative">
            <BriefingMarkdown markdown={markdown} />
          </div>
        </article>
      )}
    </div>
  );
}
