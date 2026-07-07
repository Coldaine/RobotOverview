'use client';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import {
  Boxes,
  CircuitBoard,
  Cpu,
  Hexagon,
  Network,
  Package,
  ScrollText,
  Target,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHangar } from '@/lib/store';
import {
  HANGAR_READ_SOURCE_META,
  hangarFallbackDetail,
  hangarReadStatusLabel,
} from '@/lib/hangar-read-status';
import { THEME_LABELS, THEME_MODES } from '@/lib/hangar-preferences';
import { isNavActive } from '@/lib/nav';
import { InventoryDrawer } from './InventoryDrawer';
import { BAY_ACCENT_CLASSES, BAY_ICONS } from './bay-icons';
import { activityKindMeta, timeAgo } from '@/lib/format';
import type { ReactNode } from 'react';

type NavStation = {
  to: string;
  label: string;
  code: string;
  icon: typeof Cpu;
  end?: boolean;
  activePrefixes?: string[];
};

const NAV: NavStation[] = [
  { to: '/', label: 'Hangar', code: 'HUB', icon: Boxes, end: true },
  { to: '/board', label: 'The Board', code: 'WIRE', icon: CircuitBoard, activePrefixes: ['/board'] },
  { to: '/missions', label: 'Missions', code: 'MSN', icon: Target, activePrefixes: ['/mission'] },
  { to: '/items', label: 'Items', code: 'INV', icon: Package },
  { to: '/quartermaster', label: 'Quartermaster', code: 'QM', icon: Hexagon },
  { to: '/tech-tree', label: 'Tech Tree', code: 'CAP', icon: Network },
  { to: '/codex', label: 'Codex', code: 'WIKI', icon: ScrollText },
];

function NavItem({
  href,
  end,
  activePrefixes = [],
  children,
}: {
  readonly href: string;
  readonly end?: boolean;
  readonly activePrefixes?: readonly string[];
  readonly children: (isActive: boolean) => ReactNode;
}) {
  const pathname = usePathname();
  const isActive = isNavActive(pathname, href, { end, activePrefixes });
  return (
    <Link href={href} aria-current={isActive ? 'page' : undefined}>
      {children(isActive)}
    </Link>
  );
}

export function Shell({ children }: { readonly children: ReactNode }) {
  const { data, inventoryRead, theme, setTheme } = useHangar();
  const pathname = usePathname();
  const inventoryStatus = hangarReadStatusLabel(inventoryRead);

  return (
    <div className="relative flex min-h-screen overflow-x-hidden text-ink">
      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-rim/70 bg-hull/70 backdrop-blur-md lg:flex">
        <div className="flex items-center gap-3 border-b border-rim/70 px-5 py-5">
          <div className="relative grid h-10 w-10 place-items-center rounded-lg border border-cyan/40 bg-cyan/5 shadow-hud-cyan">
            <Hexagon className="h-5 w-5 text-cyan" />
            <div className="absolute inset-0 animate-sweep rounded-lg [mask:linear-gradient(transparent,transparent_60%,rgba(54,224,224,0.4))]" />
          </div>
          <div>
            <div className="font-display text-sm font-bold tracking-[0.18em] text-glow-cyan">HANGAR</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-ink-dim">{data.meta.codename}</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-3 py-4">
          <div className="hud-label px-2 pb-1">Stations</div>
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <NavItem key={n.to} href={n.to} end={n.end} activePrefixes={n.activePrefixes}>
                {(isActive) => (
                  <span
                    className={clsx(
                      'group relative flex items-center gap-3 rounded-md px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] transition-all',
                      isActive
                        ? 'border border-cyan/40 bg-cyan/10 text-cyan shadow-hud-cyan'
                        : 'border border-transparent text-ink-dim hover:border-rim hover:bg-panel-2/40 hover:text-ink',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{n.label}</span>
                    <span className="text-[9px] text-ink-dim/60 group-hover:text-cyan/60">{n.code}</span>
                  </span>
                )}
              </NavItem>
            );
          })}
        </nav>

        <div className="px-3 py-2">
          <div className="hud-label px-2 pb-1">Bays</div>
          <div className="flex flex-col gap-0.5">
            {data.bays.map((b) => {
              const Icon = BAY_ICONS[b.id];
              const accentClasses = BAY_ACCENT_CLASSES[b.accent];
              const count = data.units.filter((u) => u.bay === b.id).length;
              return (
                <NavItem key={b.id} href={`/bay/${b.id}`}>
                  {(isActive) => (
                    <span
                      className={clsx(
                        'flex items-center gap-3 rounded-md px-3 py-1.5 text-xs transition-all',
                        isActive ? 'bg-panel-2/60 text-ink' : 'text-ink-dim hover:bg-panel-2/40 hover:text-ink',
                      )}
                    >
                      <Icon className={clsx('h-3.5 w-3.5', accentClasses.text)} />
                      <span className="flex-1 font-mono text-[11px]">{b.name}</span>
                      <span className="font-mono text-[10px] tabular-nums text-ink-dim/70">{count}</span>
                    </span>
                  )}
                </NavItem>
              );
            })}
          </div>
        </div>

        <div className="border-t border-rim/70 px-4 py-3">
          <div className="hud-label px-1 pb-2">Paradigm</div>
          <div className="flex gap-1">
            {THEME_MODES.map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={clsx(
                  'flex-1 rounded border py-1 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors',
                  theme === t
                    ? 'border-cyan/50 bg-cyan/10 text-cyan'
                    : 'border-rim/50 text-ink-dim hover:border-rim hover:text-ink',
                )}
              >
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto border-t border-rim/70 px-5 py-4">
          <div className="hud-label">Operator</div>
          <div className="mt-0.5 font-mono text-xs text-ink">{data.meta.operator}</div>
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-ink-dim">
            <span className="h-1.5 w-1.5 animate-pulse-trace rounded-full bg-signal-ok" />
            SYNC · {data.meta.updated}
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-ink-dim">
            <span
              className={clsx(
                'h-1.5 w-1.5 rounded-full',
                HANGAR_READ_SOURCE_META[inventoryRead.source].dotClass,
              )}
            />
            DATA · {inventoryStatus}
          </div>
        </div>
      </aside>

      {/* ── MAIN ───────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <StaticDataBanner />
        <ActivityTicker />
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0 max-w-full flex-1 overflow-x-hidden px-5 pb-28 pt-6 sm:px-8 lg:px-10 lg:pb-6"
        >
          {children}
        </motion.main>
      </div>

      <MobileNav />
      <InventoryDrawer />
    </div>
  );
}

function StaticDataBanner() {
  const { inventoryRead } = useHangar();
  if (inventoryRead.source === 'postgres') return null;
  const detail = hangarFallbackDetail(inventoryRead.fallbackReason);
  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-amber/50 bg-amber/10 px-5 py-2 [background-image:repeating-linear-gradient(-45deg,transparent,transparent_10px,rgba(255,176,32,0.06)_10px,rgba(255,176,32,0.06)_20px)]"
    >
      <span aria-hidden="true" className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber" />
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber">
        STATIC INVENTORY
      </span>
      <span className="min-w-0 truncate font-mono text-[11px] text-ink-dim">{detail}</span>
    </div>
  );
}

function MobileNav() {
  const { data } = useHangar();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-rim/70 bg-hull/95 px-3 pb-3 pt-2 backdrop-blur-md lg:hidden">
      <div className="no-scrollbar overflow-x-auto">
        <div className="flex min-w-max items-center gap-1.5">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <NavItem key={n.to} href={n.to} end={n.end} activePrefixes={n.activePrefixes}>
                {(isActive) => (
                  <span
                    className={clsx(
                      'flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-md border font-mono text-[9px] uppercase tracking-[0.08em] transition-all',
                      isActive
                        ? 'border-cyan/40 bg-cyan/10 text-cyan shadow-hud-cyan'
                        : 'border-rim/60 bg-panel-2/40 text-ink-dim hover:text-ink',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="max-w-full truncate px-1">{n.code}</span>
                  </span>
                )}
              </NavItem>
            );
          })}

          <div className="mx-1 h-10 w-px shrink-0 bg-rim/70" />

          {data.bays.map((b) => {
            const Icon = BAY_ICONS[b.id];
            const accentClasses = BAY_ACCENT_CLASSES[b.accent];
            return (
              <NavItem key={b.id} href={`/bay/${b.id}`}>
                {(isActive) => (
                  <span
                    className={clsx(
                      'flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-md border font-mono text-[9px] uppercase tracking-[0.08em] transition-all',
                      isActive ? accentClasses.activeNav : 'border-rim/60 bg-panel-2/40 text-ink-dim hover:text-ink',
                    )}
                  >
                    <Icon className={clsx('h-4 w-4', accentClasses.text)} />
                    <span className="max-w-full truncate px-1">{b.code}</span>
                  </span>
                )}
              </NavItem>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function ActivityTicker() {
  const { data } = useHangar();
  const items = [...data.activity, ...data.activity]; // duplicate for seamless loop
  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-rim/70 bg-hull/85 px-4 py-2 backdrop-blur-md">
      <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-amber">
        <Activity className="h-3.5 w-3.5 animate-pulse-trace" />
        Live Feed
      </div>
      <div className="relative flex-1 overflow-hidden [mask:linear-gradient(90deg,transparent,black_4%,black_96%,transparent)]">
        <motion.div
          className="flex gap-10 whitespace-nowrap"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 38, ease: 'linear', repeat: Infinity }}
        >
          {items.map((ev, i) => {
            const kindMeta = activityKindMeta(ev.kind);
            return (
              <span key={`${ev.id}-${i}`} className="flex items-center gap-2 font-mono text-[11px] text-ink-dim">
                <span className={clsx('h-1.5 w-1.5 rounded-full', kindMeta.dotClass)} />
                <span className="text-cyan/70">{kindMeta.label}</span>
                {ev.text}
                <span className="text-ink-dim/50">· {timeAgo(ev.at)}</span>
              </span>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
