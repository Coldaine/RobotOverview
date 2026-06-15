'use client';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronRight, Star } from 'lucide-react';
import Link from 'next/link';
import type { Mission, Unit, WishlistItem } from '@/data/types';
import { money } from '@/lib/format';
import { StatusBadge } from '@/components/ui/Badges';
import { useHangar } from '@/lib/store';

const MISSING_WISHLIST_STATUSES = new Set<WishlistItem['status']>([
  'watching',
  'researching',
  'planned',
  'buy-next',
  'on-order',
]);

function normalizeRequirement(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function UnitCard({
  unit,
  dim = false,
  index = 0,
  mission,
}: {
  unit: Unit;
  dim?: boolean;
  index?: number;
  mission?: Mission;
}) {
  const { source, wish } = useHangar();
  const highDraw = (unit.power?.watts ?? 0) >= 25 && unit.bay === 'robotics';
  const attention = unit.status === 'needs-attention' || unit.status === 'blocked';
  const emptyLoadoutSlots = unit.loadout?.filter((slot) => !slot.filledBy) ?? [];
  const missionRequirements = mission?.requiredLoadout?.map(normalizeRequirement) ?? [];
  const missionWishlistGaps = mission
    ? mission.wishlist
      .map(wish)
      .filter((item): item is WishlistItem => Boolean(item))
      .filter((item) => item.forUnit === unit.id && MISSING_WISHLIST_STATUSES.has(item.status))
      .filter((item) => {
        if (missionRequirements.length === 0) return true;
        const category = normalizeRequirement(item.category);
        const unlocks = item.unlocks ? normalizeRequirement(item.unlocks) : '';
        return missionRequirements.some(
          (requirement) => requirement.includes(category) || (unlocks.length > 0 && requirement.includes(unlocks)),
        );
      })
    : [];
  const missingRequiredSlots = missionRequirements.length
    ? emptyLoadoutSlots.filter((slot) => {
        const slotName = normalizeRequirement(slot.slot);
        return missionRequirements.some((requirement) => requirement.includes(slotName) || slotName.includes(requirement));
      })
    : [];
  const hasRequirementGap = missingRequiredSlots.length > 0 || missionWishlistGaps.length > 0;
  const requirementGapSummary = [
    missingRequiredSlots.length > 0 && `Open slots: ${missingRequiredSlots.map((slot) => slot.slot).join(', ')}`,
    missionWishlistGaps.length > 0 && `Pending requisitions: ${missionWishlistGaps.map((item) => item.name).join(', ')}`,
  ]
    .filter(Boolean)
    .join(' | ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: dim ? 0.35 : 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/unit/${unit.id}`}
        className={clsx(
          'panel group relative block overflow-hidden p-4 transition-all duration-300',
          'hover:border-cyan/40 hover:shadow-hud-cyan',
          unit.flagship && 'ring-1 ring-amber/20',
          attention && 'border-signal-warn/40',
        )}
      >
        {/* sheen on hover */}
        <div className="pointer-events-none absolute inset-0 -translate-x-full bg-panel-sheen opacity-0 transition-all duration-700 group-hover:translate-x-full group-hover:opacity-100" />

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {unit.flagship && <Star className="h-3.5 w-3.5 shrink-0 fill-amber text-amber" />}
              <span className="truncate font-display text-sm uppercase tracking-[0.1em] text-ink group-hover:text-glow-cyan">
                {unit.name}
              </span>
            </div>
            {unit.callsign && (
              <span className="font-mono text-[10px] tracking-[0.2em] text-cyan/60">{unit.callsign}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-dim transition-transform group-hover:translate-x-0.5 group-hover:text-cyan" />
          </div>
        </div>

        <p className="mt-2 line-clamp-2 font-mono text-[11px] leading-relaxed text-ink-dim">{unit.summary}</p>

        {(highDraw || hasRequirementGap) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {highDraw && (
              <span
                className="chip inline-flex items-center gap-1 border-signal-warn/40 bg-signal-warn/10 text-signal-warn"
                title={`Critical draw: ${unit.power?.watts}W on ${unit.power?.rail || 'rail'}`}
              >
                <AlertTriangle className="h-3 w-3 animate-pulse-trace" />
                High Draw
              </span>
            )}
            {hasRequirementGap && (
              <span
                className="chip border-signal-crit/40 bg-signal-crit/10 text-signal-crit"
                title={requirementGapSummary || 'Required loadout has open slots'}
              >
                Req Missing
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <StatusBadge status={unit.status} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-dim">{unit.class}</span>
        </div>

        {(unit.power?.watts != null || unit.price) && (
          <div className="mt-3 flex items-center gap-3 border-t border-rim/50 pt-2 font-mono text-[10px] text-ink-dim">
            {unit.power?.watts != null && (
              <span>
                <span className="text-amber">{unit.power.watts}W</span>
                {unit.power.rail && ` · ${unit.power.rail}`}
              </span>
            )}
            {unit.price && (
              <span className="text-cyan">
                {money(source === 'us' ? unit.price.us : unit.price.import ?? unit.price.us)}
              </span>
            )}
          </div>
        )}
      </Link>
    </motion.div>
  );
}
