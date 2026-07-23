import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BriefingMarkdown } from '@/components/datacore/BriefingMarkdown';

export const dynamic = 'force-dynamic';

export default async function ComputeWorkloadBriefingPage() {
  const markdown = await readFile(
    path.join(process.cwd(), 'content/datacore/compute-workload.md'),
    'utf8',
  );

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
          Research Brief · RND-COMPUTE-SIZING
        </div>
        <p className="max-w-3xl font-mono text-xs text-ink-dim">
          How engineers formally represent the workload that leads to Orin NX versus AGX Orin —
          linked views, not a single TOPS diagram.
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
