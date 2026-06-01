import { motion } from 'framer-motion';
import { AlertTriangle, Globe, Home, Package, ShoppingCart } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SectionTitle, StatReadout } from '../components/ui/Primitives';
import { useHangar } from '../lib/store';
import { money } from '../lib/format';
import clsx from 'clsx';
import type { WishlistItem } from '../data/types';

const WSTATUS: Record<WishlistItem['status'], { label: string; cls: string }> = {
  watching: { label: 'Watching', cls: 'text-ink-dim border-rim bg-panel-2/40' },
  researching: { label: 'Researching', cls: 'text-cyan border-cyan/40 bg-cyan/10' },
  planned: { label: 'Planned', cls: 'text-cyan border-cyan/40 bg-cyan/10' },
  'buy-next': { label: 'Buy Next', cls: 'text-amber border-amber/40 bg-amber/10' },
  'on-order': { label: 'On Order', cls: 'text-amber border-amber/40 bg-amber/10' },
  received: { label: 'Received', cls: 'text-signal-ok border-signal-ok/40 bg-signal-ok/10' },
  rejected: { label: 'Rejected', cls: 'text-signal-crit border-signal-crit/40 bg-signal-crit/10' },
};

export function Quartermaster() {
  const { data, unit, capability, source, setSource } = useHangar();

  const total = useMemo(
    () =>
      data.wishlist.reduce((sum, w) => {
        const p = source === 'us' ? w.price.us : w.price.import ?? w.price.us;
        return sum + (p ?? 0);
      }, 0),
    [data.wishlist, source],
  );

  const buyNext = data.wishlist.filter((w) => w.status === 'buy-next').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan/70">Acquisitions</div>
          <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.06em] text-ink">Quartermaster</h1>
          <p className="mt-1 font-mono text-xs text-ink-dim">Wishlist, sourcing, and the running tab.</p>
        </div>
        {/* source toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-rim bg-panel-2/40 p-1">
          <button
            onClick={() => setSource('us')}
            className={clsx(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all',
              source === 'us' ? 'bg-cyan/15 text-cyan shadow-hud-cyan' : 'text-ink-dim hover:text-ink',
            )}
          >
            <Home className="h-3 w-3" /> US Distributor
          </button>
          <button
            onClick={() => setSource('import')}
            className={clsx(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all',
              source === 'import' ? 'bg-amber/15 text-amber shadow-hud-amber' : 'text-ink-dim hover:text-ink',
            )}
          >
            <Globe className="h-3 w-3" /> Import
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatReadout label="Items" value={data.wishlist.length} accent="cyan" />
        <StatReadout label="Buy Next" value={buyNext} accent="amber" />
        <StatReadout label={`Tab (${source})`} value={money(total)} accent={source === 'us' ? 'cyan' : 'amber'} />
      </div>

      <SectionTitle code="QM"><span className="inline-flex items-center gap-2"><ShoppingCart className="h-3.5 w-3.5 text-amber" /> Requisition List</span></SectionTitle>
      <div className="space-y-3">
        {data.wishlist.map((w, i) => {
          const st = WSTATUS[w.status];
          const us = w.price.us;
          const imp = w.price.import;
          const active = source === 'us' ? us : imp ?? us;
          const delta = us != null && imp != null ? us - imp : null;
          const fu = w.forUnit ? unit(w.forUnit) : undefined;
          const cap = w.unlocks ? capability(w.unlocks) : undefined;

          return (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="panel overflow-hidden p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 shrink-0 text-cyan" />
                    <span className="font-display text-sm uppercase tracking-[0.06em] text-ink">{w.name}</span>
                    <span className={clsx('chip', st.cls)}>{st.label}</span>
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-ink-dim">{w.rationale}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px]">
                    <span className="chip border-rim bg-panel-2/40 text-ink-dim">{w.category}</span>
                    {fu && (
                      <Link to={`/unit/${fu.id}`} className="chip border-cyan/30 bg-cyan/5 text-cyan hover:underline">
                        → {fu.name}
                      </Link>
                    )}
                    {cap && (
                      <Link to="/tech-tree" className="chip border-amber/30 bg-amber/5 text-amber hover:underline">
                        unlocks {cap.name}
                      </Link>
                    )}
                  </div>

                  {w.riskNote && (
                    <div className="mt-2 flex items-start gap-1.5 font-mono text-[10px] text-signal-warn">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {w.riskNote}
                    </div>
                  )}
                </div>

                {/* price block */}
                <div className="shrink-0 text-right">
                  <div className={clsx('font-mono text-xl tabular-nums', source === 'us' ? 'text-cyan' : 'text-amber')}>
                    {money(active)}
                  </div>
                  <div className="mt-1 flex flex-col items-end gap-0.5 font-mono text-[10px] text-ink-dim">
                    <span>US {money(us)}</span>
                    <span>IMP {money(imp)}</span>
                    {delta != null && delta > 0 && (
                      <span className="text-signal-ok">save {money(delta)} import</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
