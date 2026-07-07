import { describe, it, expect } from 'vitest';
import {
  ACQUISITION_PIPELINE_STATUSES,
  acquisitionStatusPriority,
  money,
  SELECTED_REQUISITION_STATUSES,
  timeAgo,
  STATUS_META,
  ACTIVITY_KIND_META,
  LIFECYCLE_META,
  ITEM_STATUS_META,
  TONE_COLOR_VARS,
  WISHLIST_STATUS_META,
  activityKindMeta,
  unitStatusColorVar,
} from '@/lib/format';
import {
  INVENTORY_ITEM_STATUSES,
  LIFECYCLE_STATES,
  MISSION_STATUSES,
  ACTIVITY_KINDS,
  UNIT_STATUSES,
  WISHLIST_STATUSES,
} from '@/data/types';
import { MISSION_STATUS_META } from '@/lib/format';

describe('money()', () => {
  it('returns em-dash for null', () => expect(money(null)).toBe('—'));
  it('returns em-dash for undefined', () => expect(money(undefined)).toBe('—'));
  it('formats zero as $0', () => expect(money(0)).toBe(`$${(0).toLocaleString('en-US')}`));
  it('formats 1234 with locale grouping', () => expect(money(1234)).toBe(`$${(1234).toLocaleString('en-US')}`));
  it('formats 999999 with locale grouping', () => expect(money(999999)).toBe(`$${(999999).toLocaleString('en-US')}`));
});

describe('timeAgo()', () => {
  it('returns unknown for a non-date string', () => {
    expect(timeAgo('not-a-date')).toBe('unknown');
  });

  it('returns "just now" for a timestamp 10 seconds ago', () => {
    const iso = new Date(Date.now() - 10_000).toISOString();
    expect(timeAgo(iso)).toBe('just now');
  });

  it('returns Xm ago for a timestamp 45 minutes ago', () => {
    const iso = new Date(Date.now() - 45 * 60_000).toISOString();
    expect(timeAgo(iso)).toBe('45m ago');
  });

  it('returns Xh ago for a timestamp 3 hours ago', () => {
    const iso = new Date(Date.now() - 3 * 3_600_000).toISOString();
    expect(timeAgo(iso)).toBe('3h ago');
  });

  it('returns Xd ago for a timestamp 2 days ago', () => {
    const iso = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(timeAgo(iso)).toBe('2d ago');
  });

  it('returns "just now" for a future timestamp (Math.max guard)', () => {
    const iso = new Date(Date.now() + 60_000).toISOString();
    expect(timeAgo(iso)).toBe('just now');
  });
});

describe('STATUS_META exhaustiveness', () => {
  it.each(UNIT_STATUSES)('has an entry for status "%s"', (status) => {
    expect(STATUS_META[status]).toBeDefined();
    expect(STATUS_META[status].label).toBeTruthy();
    expect(STATUS_META[status].tone).toBeTruthy();
    expect(TONE_COLOR_VARS[STATUS_META[status].tone]).toBeTruthy();
    expect(unitStatusColorVar(status)).toBe(TONE_COLOR_VARS[STATUS_META[status].tone]);
  });
});

describe('LIFECYCLE_META exhaustiveness', () => {
  it.each(LIFECYCLE_STATES)('has an entry for lifecycle "%s"', (state) => {
    expect(LIFECYCLE_META[state]).toBeDefined();
    expect(LIFECYCLE_META[state].label).toBeTruthy();
  });
});

describe('ITEM_STATUS_META exhaustiveness', () => {
  it.each(INVENTORY_ITEM_STATUSES)('has an entry for item status "%s"', (status) => {
    expect(ITEM_STATUS_META[status]).toBeDefined();
    expect(ITEM_STATUS_META[status].label).toBeTruthy();
    expect(ITEM_STATUS_META[status].tone).toBeTruthy();
  });
});

describe('MISSION_STATUS_META exhaustiveness', () => {
  it.each(MISSION_STATUSES)('has an entry for mission status "%s"', (status) => {
    expect(MISSION_STATUS_META[status]).toBeDefined();
    expect(MISSION_STATUS_META[status].label).toBeTruthy();
    expect(MISSION_STATUS_META[status].cls).toBeTruthy();
  });
});

describe('WISHLIST_STATUS_META exhaustiveness', () => {
  it.each(WISHLIST_STATUSES)('has an entry for wishlist status "%s"', (status) => {
    expect(WISHLIST_STATUS_META[status]).toBeDefined();
    expect(WISHLIST_STATUS_META[status].label).toBeTruthy();
    expect(WISHLIST_STATUS_META[status].cls).toBeTruthy();
  });

  it('keeps rejected out of the acquisition stepper pipeline', () => {
    expect(ACQUISITION_PIPELINE_STATUSES).toEqual([
      'watching',
      'researching',
      'planned',
      'buy-next',
      'on-order',
      'received',
    ]);
    expect(ACQUISITION_PIPELINE_STATUSES).not.toContain('rejected');
  });

  it('defines selected requisition statuses as the committed part of the acquisition pipeline', () => {
    expect(SELECTED_REQUISITION_STATUSES).toEqual(['planned', 'buy-next', 'on-order', 'received']);
    expect(SELECTED_REQUISITION_STATUSES.every((status) => ACQUISITION_PIPELINE_STATUSES.includes(status))).toBe(true);
    expect(SELECTED_REQUISITION_STATUSES).not.toContain('watching');
    expect(SELECTED_REQUISITION_STATUSES).not.toContain('researching');
    expect(SELECTED_REQUISITION_STATUSES).not.toContain('rejected');
  });

  it('prioritizes statuses by acquisition pipeline order', () => {
    expect(acquisitionStatusPriority('watching')).toBeLessThan(acquisitionStatusPriority('planned'));
    expect(acquisitionStatusPriority('buy-next')).toBeLessThan(acquisitionStatusPriority('on-order'));
    expect(acquisitionStatusPriority('on-order')).toBeLessThan(acquisitionStatusPriority('received'));
  });
});

describe('ACTIVITY_KIND_META exhaustiveness', () => {
  it.each(ACTIVITY_KINDS)('has an entry for activity kind "%s"', (kind) => {
    expect(ACTIVITY_KIND_META[kind]).toBeDefined();
    expect(ACTIVITY_KIND_META[kind].label).toBeTruthy();
    expect(ACTIVITY_KIND_META[kind].dotClass).toBeTruthy();
  });

  it('preserves activity ticker labels and dot classes', () => {
    expect(ACTIVITY_KIND_META).toEqual({
      acquired: { label: 'ACQUIRED', dotClass: 'bg-signal-ok' },
      'price-drop': { label: 'PRICE-DROP', dotClass: 'bg-amber' },
      shipped: { label: 'SHIPPED', dotClass: 'bg-cyan' },
      insight: { label: 'INSIGHT', dotClass: 'bg-cyan' },
      mission: { label: 'MISSION', dotClass: 'bg-amber' },
      researched: { label: 'RESEARCHED', dotClass: 'bg-ink-dim' },
    });
  });

  it.each(ACTIVITY_KINDS)('returns mapped metadata through activityKindMeta for "%s"', (kind) => {
    expect(activityKindMeta(kind)).toBe(ACTIVITY_KIND_META[kind]);
  });

  it('falls back to the previous unstyled uppercase behavior for unknown activity kinds', () => {
    expect(activityKindMeta('custom-event')).toEqual({ label: 'CUSTOM-EVENT' });
  });
});
