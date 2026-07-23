'use client';
import { motion } from 'framer-motion';
import { Boxes, Package, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import { useHangar } from '@/lib/store';
import { SectionTitle, StatReadout } from '@/components/ui/Primitives';
import { Tag, ProvenanceTag } from '@/components/ui/Badges';
import { BAY_ACCENT_CLASSES } from '@/components/bay-icons';
import { ITEM_STATUS_META, TONE_CLASSES, money } from '@/lib/format';
import type { InventoryItem } from '@/data/types';

function ItemStatusChip({ status }: { status: InventoryItem['status'] }) {
  const meta = ITEM_STATUS_META[status];
  const tone = TONE_CLASSES[meta.tone];
  return (
    <span className={clsx('chip', tone.text, tone.border, tone.bg)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', tone.dot)} />
      {meta.label}
    </span>
  );
}

export default function Items() {
  const { items, unit, mission, capability, insight, bay } = useHangar();

  const ownedCount = items.filter((it) => it.status === 'owned' || it.status === 'deployed').length;
  const onOrderCount = items.filter((it) => it.status === 'on-order').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan/70">Inventory</div>
          <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.06em] text-ink">Items</h1>
          <p className="mt-1 font-mono text-xs text-ink-dim">
            Standalone products and parts — not yet units, not just wishlist entries.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatReadout label="Cataloged" value={items.length} accent="cyan" />
        <StatReadout label="Owned" value={ownedCount} accent="cyan" />
        <StatReadout label="On Order" value={onOrderCount} accent="amber" />
      </div>

      <SectionTitle code="INV">
        <span className="inline-flex items-center gap-2">
          <Boxes className="h-3.5 w-3.5 text-cyan" /> Item Catalog
        </span>
      </SectionTitle>

      {items.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 py-12 text-center">
          <Package className="h-8 w-8 text-ink-dim opacity-50" />
          <p className="font-mono text-xs text-ink-dim">No inventory items cataloged yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it, i) => {
            const b = bay(it.bay);
            const us = it.price?.us ?? null;
            const imp = it.price?.import ?? null;
            const relUnits = (it.relatedUnits ?? []).map(unit).filter(Boolean);
            const relMissions = (it.relatedMissions ?? []).map(mission).filter(Boolean);
            const relCaps = (it.relatedCapabilities ?? []).map(capability).filter(Boolean);
            const relInsights = (it.relatedInsights ?? []).map(insight).filter(Boolean);

            return (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="panel overflow-hidden p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Package className="h-4 w-4 shrink-0 text-cyan" />
                      <span className="font-display text-sm uppercase tracking-[0.06em] text-ink">{it.name}</span>
                      <ItemStatusChip status={it.status} />
                      <ProvenanceTag provenance={it.provenance} />
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-ink-dim">
                      {(it.manufacturer || it.model) && (
                        <span>{[it.manufacturer, it.model].filter(Boolean).join(' · ')}</span>
                      )}
                      <span className="chip border-rim bg-panel-2/40 text-ink-dim">{it.category}</span>
                      {b && (
                        <span className={clsx('chip', BAY_ACCENT_CLASSES[b.accent].chip)}>
                          {b.name}
                        </span>
                      )}
                      {it.quantity != null && it.quantity > 1 && (
                        <span className="chip border-rim bg-panel-2/40 text-ink-dim">×{it.quantity}</span>
                      )}
                    </div>

                    <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-dim">{it.summary}</p>

                    {/* related links */}
                    {(relUnits.length > 0 || relMissions.length > 0 || relCaps.length > 0 || relInsights.length > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px]">
                        {relUnits.map((u) => (
                          <Link key={u!.id} href={`/unit/${u!.id}`} className="chip border-cyan/30 bg-cyan/5 text-cyan hover:underline">
                            → {u!.name}
                          </Link>
                        ))}
                        {relMissions.map((m) => (
                          <Link key={m!.id} href={`/mission/${m!.id}`} className="chip border-amber/30 bg-amber/5 text-amber hover:underline">
                            ⛯ {m!.name}
                          </Link>
                        ))}
                        {relCaps.map((c) => (
                          <Link key={c!.id} href="/tech-tree" className="chip border-cyan/30 bg-cyan/5 text-cyan hover:underline">
                            unlocks {c!.name}
                          </Link>
                        ))}
                        {relInsights.map((ins) => (
                          <Link key={ins!.id} href="/datacore" className="chip border-rim/70 bg-panel-2/40 text-ink-dim hover:underline">
                            ✎ {ins!.title}
                          </Link>
                        ))}
                      </div>
                    )}

                    {it.tags && it.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {it.tags.map((t) => (
                          <Tag key={t}>{t}</Tag>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* price + horizon block */}
                  <div className="shrink-0 text-right">
                    {us != null || imp != null ? (
                      <>
                        <div className="font-mono text-xl tabular-nums text-cyan">{money(us ?? imp)}</div>
                        <div className="mt-1 flex flex-col items-end gap-0.5 font-mono text-[10px] text-ink-dim">
                          {us != null && <span>US {money(us)}</span>}
                          {imp != null && <span>IMP {money(imp)}</span>}
                        </div>
                      </>
                    ) : (
                      <div className="font-mono text-xs text-ink-dim">—</div>
                    )}
                    {it.horizon && (
                      <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-amber/80">{it.horizon}</div>
                    )}
                  </div>
                </div>

                {/* sources */}
                {it.sources && it.sources.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-rim/40 pt-2 font-mono text-[10px]">
                    {it.sources.map((s) => (
                      <a
                        key={s.url}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-ink-dim hover:text-cyan"
                      >
                        <ExternalLink className="h-3 w-3" /> {s.label}
                      </a>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
