import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { BriefingMarkdown } from '@/components/datacore/BriefingMarkdown';
import { DATACORE_BRIEFINGS, briefingById } from '@/data/datacore-briefings';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return DATACORE_BRIEFINGS.map((b) => ({ slug: b.id }));
}

const KIND_LABEL: Record<string, string> = {
  research: 'Research Brief',
  plan: 'Plan',
};

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // The slug only selects a record; the path comes from the briefing index, so
  // no caller-supplied path ever reaches the filesystem.
  const briefing = briefingById(slug);
  if (!briefing) notFound();

  const markdown = await readFile(path.join(process.cwd(), briefing.source), 'utf8');

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
          {KIND_LABEL[briefing.kind] ?? 'Briefing'} · {briefing.id.toUpperCase()}
        </div>
        <h1 className="text-xl font-semibold text-ink md:text-2xl">{briefing.title}</h1>
        <p className="max-w-3xl font-mono text-xs text-ink-dim">{briefing.summary}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim/70">
          source · {briefing.source}
        </p>
      </header>

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
    </div>
  );
}
