'use client';
import { BookOpen, Box, CircuitBoard, Cpu, Download, FileText, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import clsx from 'clsx';
import type { DocumentKind, DocumentRef } from '@/data/types';
import { useHangar } from '@/lib/store';
import {
  DOCUMENT_KIND_META,
  groupDocumentsBySubsystem,
  resolveDocumentUrl,
  stripLibraryPrefix,
} from '@/lib/documents';

const KIND_ICON: Record<DocumentKind, typeof FileText> = {
  schematic: CircuitBoard,
  manual: BookOpen,
  cad: Box,
  firmware: Cpu,
  wiki: FileText,
  datasheet: FileText,
  image: ImageIcon,
};

/** The filename tail of a library path (for the mono caption). */
function fileName(libraryPath: string): string {
  const parts = stripLibraryPrefix(libraryPath).split('/');
  return parts[parts.length - 1] ?? libraryPath;
}

export function HardwareLibrary({ query }: { query: string }) {
  const { documents, unit, libraryBaseUrl } = useHangar();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((d) => {
      const unitNames = (d.units ?? []).map((id) => unit(id)?.name ?? id).join(' ');
      const hay = `${d.title} ${d.kind} ${d.libraryPath} ${unitNames} ${d.note ?? ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [documents, query, unit]);

  const groups = useMemo(() => groupDocumentsBySubsystem(filtered), [filtered]);

  if (documents.length === 0) {
    return (
      <div className="panel p-6 text-center font-mono text-xs text-ink-dim">
        No documents in the library yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="panel-inset p-3 font-mono text-[10px] leading-relaxed text-ink-dim">
        Source-of-truth CAD, schematics, datasheets &amp; firmware for the UGV Beast, referenced by stable
        <span className="text-cyan"> beast/</span> keys. Files are served from the Datacore library store
        (cluster S3) — open links resolve when the library store is reachable, otherwise the
        catalog stays fully browsable. See <span className="text-cyan">docs/hardware-library.md</span>.
      </div>

      {filtered.length === 0 ? (
        <div className="panel p-6 text-center font-mono text-xs text-ink-dim">
          No documents match “{query}”.
        </div>
      ) : (
        groups.map(({ subsystem, documents: docs }) => (
          <section key={subsystem.key} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan/70">
                {String(subsystem.order).padStart(2, '0')}
              </span>
              <h2 className="font-display text-sm uppercase tracking-[0.12em] text-ink">{subsystem.label}</h2>
              <span className="h-px flex-1 bg-rim/50" />
              <span className="font-mono text-[10px] text-ink-dim">{docs.length}</span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {docs.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  unitName={(id) => unit(id)?.name ?? id}
                  libraryBaseUrl={libraryBaseUrl}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function DocumentCard({
  doc,
  unitName,
  libraryBaseUrl,
}: {
  doc: DocumentRef;
  unitName: (id: string) => string;
  libraryBaseUrl: string | null;
}) {
  const kindMeta = DOCUMENT_KIND_META[doc.kind];
  const Icon = KIND_ICON[doc.kind];
  const url = resolveDocumentUrl(doc, libraryBaseUrl);

  return (
    <div className="panel group flex flex-col p-4 transition-all hover:border-cyan/40 hover:shadow-hud-cyan">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded border border-cyan/30 bg-cyan/5 text-cyan">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/datacore/${doc.id}`}
            className="font-display text-sm uppercase tracking-[0.06em] text-ink transition-colors group-hover:text-cyan"
          >
            {doc.title}
          </Link>
          <div className="mt-1 truncate font-mono text-[10px] text-ink-dim">{fileName(doc.libraryPath)}</div>
        </div>
        <span className={clsx('chip shrink-0', kindMeta.cls)}>{kindMeta.label}</span>
      </div>

      {doc.note && <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink-dim">{doc.note}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {(doc.units ?? []).map((id) => (
          <span key={id} className="chip border-rim bg-panel-2/40 text-ink-dim">{unitName(id)}</span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-rim/40 pt-2.5">
        <Link href={`/datacore/${doc.id}`} className="font-mono text-[10px] text-cyan hover:underline">
          Details →
        </Link>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[10px] text-ink-dim hover:text-cyan"
          >
            <Download className="h-3 w-3" /> Open
          </a>
        ) : (
          <span className="font-mono text-[10px] text-ink-dim/60">library offline</span>
        )}
      </div>
    </div>
  );
}
