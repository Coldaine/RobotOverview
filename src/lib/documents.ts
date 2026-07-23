// ─────────────────────────────────────────────────────────────────────────────
// Datacore Hardware Library — document resolution + grouping helpers.
//
// DocumentRefs (src/data/types.ts) reference files by a stable `archivePath`
// under UGV-Beast-Archive/. The bytes are not in the repo or the container
// image; they live in an external archive (Google Drive, exposed to the cluster
// read-only via `rclone serve`). The app resolves an archivePath to a URL at
// render time using NEXT_PUBLIC_ARCHIVE_BASE_URL — so the UI ships useful even
// when the archive endpoint is offline (it just shows metadata, never a broken
// link). See docs/hardware-library.md.
// ─────────────────────────────────────────────────────────────────────────────

import type { DocumentKind, DocumentRef } from '@/data/types';

export const ARCHIVE_PREFIX = 'UGV-Beast-Archive/';

/** Drop the stable `UGV-Beast-Archive/` prefix, leaving the archive-relative key. */
export function stripArchivePrefix(archivePath: string): string {
  return archivePath.startsWith(ARCHIVE_PREFIX)
    ? archivePath.slice(ARCHIVE_PREFIX.length)
    : archivePath;
}

/** The configured archive host (rclone/Drive), trailing slashes trimmed, or null. */
export function archiveBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_ARCHIVE_BASE_URL;
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve a DocumentRef to an openable URL, or null when it can't be resolved.
 * Precedence: an explicit `url` on the record, else `${base}/${archive-key}`.
 * Returns null (→ "archive offline" in the UI) when no base URL is configured.
 */
export function resolveDocumentUrl(doc: Pick<DocumentRef, 'url' | 'archivePath'>): string | null {
  if (doc.url && doc.url.trim().length > 0) return doc.url;
  const base = archiveBaseUrl();
  if (!base) return null;
  const key = stripArchivePrefix(doc.archivePath)
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  return `${base}/${key}`;
}

export interface Subsystem {
  key: string; // raw archive folder, e.g. '02-Driver-Board'
  order: number; // numeric prefix for stable ordering
  label: string; // 'Driver Board'
}

/** Derive the subsystem grouping from a document's archive folder. */
export function documentSubsystem(doc: Pick<DocumentRef, 'archivePath'>): Subsystem {
  const rest = stripArchivePrefix(doc.archivePath);
  const seg = rest.split('/')[0] || 'misc';
  const m = seg.match(/^(\d+)[-_](.*)$/);
  const order = m ? Number.parseInt(m[1], 10) : 999;
  const rawLabel = m ? m[2] : seg;
  const label = rawLabel
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { key: seg, order, label };
}

export interface SubsystemGroup {
  subsystem: Subsystem;
  documents: DocumentRef[];
}

/** Group documents by subsystem folder, ordered by the numeric folder prefix. */
export function groupDocumentsBySubsystem(docs: DocumentRef[]): SubsystemGroup[] {
  const groups = new Map<string, SubsystemGroup>();
  for (const doc of docs) {
    const subsystem = documentSubsystem(doc);
    const existing = groups.get(subsystem.key);
    if (existing) existing.documents.push(doc);
    else groups.set(subsystem.key, { subsystem, documents: [doc] });
  }
  return [...groups.values()].sort((a, b) => a.subsystem.order - b.subsystem.order);
}

export const DOCUMENT_KIND_META: Record<DocumentKind, { label: string; cls: string }> = {
  schematic: { label: 'Schematic', cls: 'border-cyan/40 bg-cyan/10 text-cyan' },
  manual: { label: 'Manual', cls: 'border-amber/40 bg-amber/10 text-amber' },
  cad: { label: 'CAD', cls: 'border-signal-ok/40 bg-signal-ok/10 text-signal-ok' },
  firmware: { label: 'Firmware', cls: 'border-signal-warn/40 bg-signal-warn/10 text-signal-warn' },
  wiki: { label: 'Wiki', cls: 'border-rim bg-panel-2/40 text-ink-dim' },
  datasheet: { label: 'Datasheet', cls: 'border-cyan/40 bg-cyan/10 text-cyan' },
  image: { label: 'Image', cls: 'border-rim bg-panel-2/40 text-ink-dim' },
};
