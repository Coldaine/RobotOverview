'use client';
import { ArrowLeft, Download, FileWarning } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { SectionTitle } from '@/components/ui/Primitives';
import { DriverBoardSchematic } from '@/components/datacore/DriverBoardSchematic';
import { useHangar } from '@/lib/store';
import {
  DOCUMENT_KIND_META,
  documentSubsystem,
  resolveDocumentUrl,
  stripLibraryPrefix,
} from '@/lib/documents';
import clsx from 'clsx';

// The driver-board schematic doc gets the interactive pinout explorer embedded.
const EXPLORER_DOC_ID = 'doc-gdb-schematic';

export default function DatacoreDocumentPage() {
  const params = useParams<{ docId: string }>();
  const docId = params?.docId;
  const { documents, nets, terminals, unit, libraryBaseUrl } = useHangar();

  const doc = useMemo(() => documents.find((d) => d.id === docId), [documents, docId]);

  const terminalName = useMemo(() => {
    const m = new Map(terminals.map((t) => [t.id, t]));
    return (id: string) => m.get(id)?.name ?? id;
  }, [terminals]);

  // Connected-twin evidence: the wiring nets that cite this document as proof.
  const evidenceNets = useMemo(
    () => (doc ? nets.filter((n) => n.documents?.includes(doc.id)) : []),
    [nets, doc],
  );

  if (!doc) {
    return (
      <div className="space-y-4">
        <Link href="/datacore" className="inline-flex items-center gap-1.5 font-mono text-[11px] text-cyan hover:underline">
          <ArrowLeft className="h-3 w-3" /> Datacore
        </Link>
        <div className="panel flex items-center gap-3 p-6">
          <FileWarning className="h-5 w-5 text-signal-warn" />
          <div>
            <h1 className="font-display text-lg uppercase tracking-[0.08em] text-ink">Document not found</h1>
            <p className="mt-1 font-mono text-xs text-ink-dim">
              No hardware document with id <span className="text-cyan">{docId}</span> exists in the library.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const kindMeta = DOCUMENT_KIND_META[doc.kind];
  const subsystem = documentSubsystem(doc);
  const url = resolveDocumentUrl(doc, libraryBaseUrl);
  const relatedUnits = (doc.units ?? []).map((id) => ({ id, u: unit(id) }));

  return (
    <div className="space-y-6">
      <Link href="/datacore" className="inline-flex items-center gap-1.5 font-mono text-[11px] text-cyan hover:underline">
        <ArrowLeft className="h-3 w-3" /> Datacore · Hardware Library
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan/70">{subsystem.label}</div>
          <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.05em] text-ink">{doc.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={clsx('chip', kindMeta.cls)}>{kindMeta.label}</span>
            <span className="chip border-rim bg-panel-2/40 font-mono text-ink-dim">{stripLibraryPrefix(doc.libraryPath)}</span>
          </div>
        </div>

        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-active text-[10px]"
          >
            <Download className="h-3 w-3" /> Open file
          </a>
        ) : (
          <span
            title="Set DATACORE_LIBRARY_URL to the library store to enable downloads"
            className="btn btn-ghost cursor-not-allowed text-[10px] opacity-60"
          >
            <FileWarning className="h-3 w-3" /> Library offline
          </span>
        )}
      </header>

      {doc.note && <p className="font-mono text-xs leading-relaxed text-ink-dim">{doc.note}</p>}

      {/* Interactive pinout explorer for the driver-board schematic */}
      {doc.id === EXPLORER_DOC_ID && (
        <section className="space-y-3">
          <SectionTitle code="PINOUT">Interactive board explorer</SectionTitle>
          <DriverBoardSchematic />
        </section>
      )}

      {relatedUnits.length > 0 && (
        <section className="space-y-3">
          <SectionTitle code="UNITS">Referenced by</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {relatedUnits.map(({ id, u }) =>
              u ? (
                <Link key={id} href={`/unit/${id}`} className="chip border-cyan/30 bg-cyan/5 text-cyan hover:border-cyan/60">
                  {u.name}
                </Link>
              ) : (
                <span key={id} className="chip border-rim bg-panel-2/40 text-ink-dim">{id}</span>
              ),
            )}
          </div>
        </section>
      )}

      {evidenceNets.length > 0 && (
        <section className="space-y-3">
          <SectionTitle code="TWIN">Proves {evidenceNets.length} wiring net{evidenceNets.length === 1 ? '' : 's'}</SectionTitle>
          <div className="space-y-2">
            {evidenceNets.map((net) => (
              <article key={net.id} className="panel p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-sm uppercase tracking-[0.08em] text-ink">{net.name}</h2>
                  <span className="chip border-rim bg-panel-2/40 text-ink-dim">{net.kind}</span>
                  {net.carries && <span className="chip border-cyan/30 bg-cyan/5 text-cyan">{net.carries}</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-ink-dim">
                  {net.terminals.map((tid, i) => (
                    <span key={tid} className="inline-flex items-center gap-1.5">
                      {i > 0 && <span className="text-cyan/50">↔</span>}
                      <span className="rounded border border-rim/60 bg-panel-2/30 px-1.5 py-0.5">{terminalName(tid)}</span>
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="border-t border-rim/40 pt-3 font-mono text-[10px] text-ink-dim">
        Provenance &amp; SHA256 hashes:{' '}
        <span className="text-cyan">docs/history/reference/beast-source-evidence-manifest.md</span>
      </div>
    </div>
  );
}
