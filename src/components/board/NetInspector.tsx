'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, X, ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { DocumentRef, Net, Terminal, Unit } from '@/data/types';
import { documentsForNet, netKindColor, type ActiveSet } from '@/lib/twin';
import { resolveDocumentUrl } from '@/lib/documents';
import { docIcon, NET_STROKE } from './palette';

export function NetInspector({
  net,
  units,
  terminals,
  documents,
  libraryBaseUrl,
  active,
  onClose,
  onHoverTerminal,
}: {
  net: Net | null;
  units: Unit[];
  terminals: Terminal[];
  documents: DocumentRef[];
  libraryBaseUrl: string | null;
  active: ActiveSet;
  onClose: () => void;
  onHoverTerminal: (terminalId: string | null) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copiedTimeout = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimeout.current !== null) window.clearTimeout(copiedTimeout.current);
    };
  }, []);

  const copy = async (doc: DocumentRef) => {
    const value = doc.url ?? doc.libraryPath;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(doc.id);
      if (copiedTimeout.current !== null) window.clearTimeout(copiedTimeout.current);
      copiedTimeout.current = window.setTimeout(() => {
        setCopied((c) => (c === doc.id ? null : c));
        copiedTimeout.current = null;
      }, 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  const colorKey = net ? netKindColor(net.kind) : 'cyan';
  const accent = NET_STROKE[colorKey].primary;
  const netActive = net ? active.netIds.has(net.id) : false;
  const proving = net ? documentsForNet(documents, net) : [];

  return (
    <AnimatePresence>
      {net && (
        <motion.aside
          key={net.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="panel corner-bracket absolute right-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] w-80 max-w-[calc(100%-1.5rem)] flex-col overflow-hidden"
        >
          <header className="flex items-start justify-between gap-2 border-b border-rim/70 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}` }} />
                <h3 className="truncate font-display text-sm uppercase tracking-[0.1em] text-ink">{net.name}</h3>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="chip"
                  style={{ borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`, color: accent, backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)` }}
                >
                  {net.kind}
                </span>
                <span className={clsx('chip', netActive ? 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok' : 'border-rim/60 text-ink-dim')}>
                  {netActive ? 'Energized' : 'Inactive'}
                </span>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close inspector" className="btn btn-ghost shrink-0 !p-1.5">
              <X className="h-3.5 w-3.5" />
            </button>
          </header>

          <div className="no-scrollbar flex-1 overflow-y-auto p-4">
            {net.carries && (
              <div className="mb-3">
                <div className="hud-label mb-1">Carries</div>
                <div className="hud-value text-xs text-ink">{net.carries}</div>
              </div>
            )}
            {net.note && <p className="mb-4 text-xs leading-relaxed text-ink-dim">{net.note}</p>}

            <div className="hud-label mb-1.5">Terminals</div>
            <ul className="mb-4 flex flex-col gap-1">
              {net.terminals.map((tid) => {
                const t = terminals.find((x) => x.id === tid);
                const u = units.find((x) => x.id === t?.unitId);
                const on = active.terminalIds.has(tid);
                return (
                  <li
                    key={tid}
                    onMouseEnter={() => onHoverTerminal(tid)}
                    onMouseLeave={() => onHoverTerminal(null)}
                    className="panel-inset flex items-center gap-2 px-2.5 py-1.5"
                  >
                    <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', on ? 'bg-signal-ok' : 'bg-signal-idle')} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[11px] text-ink">{t?.name ?? tid}</div>
                      <div className="truncate font-mono text-[10px] text-ink-dim">
                        {u?.callsign ?? u?.name ?? t?.unitId}
                        {t?.connector ? ` · ${t.connector}` : ''}
                      </div>
                    </div>
                    {t?.role && <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-dim/70">{t.role}</span>}
                  </li>
                );
              })}
            </ul>

            <div className="hud-label mb-1.5">Proving Documents</div>
            {proving.length === 0 ? (
              <p className="text-xs text-ink-dim">No documents linked.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {proving.map((doc) => {
                  const DocIcon = docIcon(doc.kind);
                  const url = resolveDocumentUrl(doc, libraryBaseUrl);
                  return (
                    <li key={doc.id} className="panel-inset group flex items-center gap-2 px-2.5 py-2">
                      <DocIcon className="h-4 w-4 shrink-0 text-cyan" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[11px] text-ink">{doc.title}</div>
                        <div className="truncate font-mono text-[9px] text-ink-dim">{doc.libraryPath}</div>
                      </div>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost shrink-0 !p-1.5" aria-label={`Open ${doc.title}`}>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <button type="button" onClick={() => copy(doc)} className="btn btn-ghost shrink-0 !p-1.5" aria-label={`Copy library path for ${doc.title}`}>
                          {copied === doc.id ? <Check className="h-3.5 w-3.5 text-signal-ok" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
