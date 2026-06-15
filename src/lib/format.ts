import type { LifecycleState, Mission, UnitStatus } from '../data/types';

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

export const LIFECYCLE_META: Record<LifecycleState, { label: string }> = {
  inventory: { label: 'In Inventory' },
  assembled: { label: 'Assembled' },
  deployed: { label: 'Deployed' },
  wishlist: { label: 'Wishlist' },
  'on-order': { label: 'On Order' },
};

export const MISSION_STATUS_META: Record<Mission['status'], { label: string; cls: string }> = {
  planning: { label: 'Planning', cls: 'text-amber border-amber/40 bg-amber/10' },
  active: { label: 'Active', cls: 'text-signal-ok border-signal-ok/40 bg-signal-ok/10' },
  standby: { label: 'Standby', cls: 'text-ink-dim border-rim bg-panel-2/40' },
  complete: { label: 'Complete', cls: 'text-cyan border-cyan/40 bg-cyan/10' },
};

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
