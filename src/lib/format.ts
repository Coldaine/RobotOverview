import {
  ACTIVITY_KINDS,
  type ActivityKind,
  type InventoryItemStatus,
  type LifecycleState,
  type MissionStatus,
  type UnitStatus,
  type WishlistStatus,
} from '../data/types';

export function money(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$${n.toLocaleString('en-US')}`;
}

export const STATUS_META: Record<
  UnitStatus,
  { label: string; tone: 'ok' | 'warn' | 'crit' | 'cyan' | 'amber' | 'idle' }
> = {
  operational: { label: 'Operational', tone: 'ok' },
  'needs-attention': { label: 'Needs Attention', tone: 'warn' },
  blocked: { label: 'Blocked on Part', tone: 'crit' },
  'in-mission': { label: 'In Mission', tone: 'cyan' },
  wishlist: { label: 'Wishlist', tone: 'idle' },
  'on-order': { label: 'On Order', tone: 'amber' },
  researching: { label: 'Researching', tone: 'cyan' },
  retired: { label: 'Retired', tone: 'idle' },
};

export const ITEM_STATUS_META: Record<
  InventoryItemStatus,
  { label: string; tone: 'ok' | 'warn' | 'crit' | 'cyan' | 'amber' | 'idle' }
> = {
  owned: { label: 'Owned', tone: 'ok' },
  'on-order': { label: 'On Order', tone: 'amber' },
  wishlist: { label: 'Wishlist', tone: 'idle' },
  researching: { label: 'Researching', tone: 'cyan' },
  deployed: { label: 'Deployed', tone: 'ok' },
  retired: { label: 'Retired', tone: 'idle' },
  rejected: { label: 'Rejected', tone: 'crit' },
};

export const LIFECYCLE_META: Record<LifecycleState, { label: string }> = {
  inventory: { label: 'In Inventory' },
  assembled: { label: 'Assembled' },
  deployed: { label: 'Deployed' },
  wishlist: { label: 'Wishlist' },
  'on-order': { label: 'On Order' },
};

export const MISSION_STATUS_META: Record<MissionStatus, { label: string; cls: string }> = {
  planning: { label: 'Planning', cls: 'text-amber border-amber/40 bg-amber/10' },
  active: { label: 'Active', cls: 'text-signal-ok border-signal-ok/40 bg-signal-ok/10' },
  standby: { label: 'Standby', cls: 'text-ink-dim border-rim bg-panel-2/40' },
  complete: { label: 'Complete', cls: 'text-cyan border-cyan/40 bg-cyan/10' },
};

export const WISHLIST_STATUS_META: Record<WishlistStatus, { label: string; cls: string }> = {
  watching: { label: 'Watching', cls: 'text-ink-dim border-rim bg-panel-2/40' },
  researching: { label: 'Researching', cls: 'text-cyan border-cyan/40 bg-cyan/10' },
  planned: { label: 'Planned', cls: 'text-cyan border-cyan/40 bg-cyan/10' },
  'buy-next': { label: 'Buy Next', cls: 'text-amber border-amber/40 bg-amber/10' },
  'on-order': { label: 'On Order', cls: 'text-amber border-amber/40 bg-amber/10' },
  received: { label: 'Received', cls: 'text-signal-ok border-signal-ok/40 bg-signal-ok/10' },
  rejected: { label: 'Rejected', cls: 'text-signal-crit border-signal-crit/40 bg-signal-crit/10' },
};

export const ACTIVITY_KIND_META: Record<ActivityKind, { label: string; dotClass: string }> = {
  acquired: { label: 'ACQUIRED', dotClass: 'bg-signal-ok' },
  'price-drop': { label: 'PRICE-DROP', dotClass: 'bg-amber' },
  shipped: { label: 'SHIPPED', dotClass: 'bg-cyan' },
  insight: { label: 'INSIGHT', dotClass: 'bg-cyan' },
  mission: { label: 'MISSION', dotClass: 'bg-amber' },
  researched: { label: 'RESEARCHED', dotClass: 'bg-ink-dim' },
};

export function activityKindMeta(kind: ActivityKind | string): { label: string; dotClass?: string } {
  if ((ACTIVITY_KINDS as readonly string[]).includes(kind)) {
    return ACTIVITY_KIND_META[kind as ActivityKind];
  }

  return { label: kind.toUpperCase() };
}

// The acquisition pipeline a user steps an item through; 'rejected' is set out-of-band.
export const ACQUISITION_PIPELINE_STATUSES: readonly WishlistStatus[] = [
  'watching',
  'researching',
  'planned',
  'buy-next',
  'on-order',
  'received',
] as const;

export const SELECTED_REQUISITION_STATUSES: readonly WishlistStatus[] = [
  'planned',
  'buy-next',
  'on-order',
  'received',
] as const;

export function acquisitionStatusPriority(status: WishlistStatus): number {
  return ACQUISITION_PIPELINE_STATUSES.indexOf(status);
}

export const TONE_CLASSES: Record<
  'ok' | 'warn' | 'crit' | 'cyan' | 'amber' | 'idle',
  { text: string; border: string; bg: string; dot: string }
> = {
  ok: { text: 'text-signal-ok', border: 'border-signal-ok/40', bg: 'bg-signal-ok/10', dot: 'bg-signal-ok' },
  warn: { text: 'text-signal-warn', border: 'border-signal-warn/40', bg: 'bg-signal-warn/10', dot: 'bg-signal-warn' },
  crit: { text: 'text-signal-crit', border: 'border-signal-crit/40', bg: 'bg-signal-crit/10', dot: 'bg-signal-crit' },
  cyan: { text: 'text-cyan', border: 'border-cyan/40', bg: 'bg-cyan/10', dot: 'bg-cyan' },
  amber: { text: 'text-amber', border: 'border-amber/40', bg: 'bg-amber/10', dot: 'bg-amber' },
  idle: { text: 'text-ink-dim', border: 'border-rim', bg: 'bg-panel-2/50', dot: 'bg-ink-dim' },
};

export const TONE_COLOR_VARS: Record<keyof typeof TONE_CLASSES, string> = {
  ok: 'var(--color-signal-ok)',
  warn: 'var(--color-signal-warn)',
  crit: 'var(--color-signal-crit)',
  cyan: 'var(--color-cyan)',
  amber: 'var(--color-amber)',
  idle: 'var(--color-ink-dim)',
};

export function unitStatusColorVar(status: UnitStatus): string {
  return TONE_COLOR_VARS[STATUS_META[status].tone];
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'unknown';

  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}
