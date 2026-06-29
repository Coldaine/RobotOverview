import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/hangar/items/route';
import { hangarData } from '@/data/hangar';
import {
  getInventoryItems,
  mapInventoryItemRow,
  readInventoryItemsFromPostgres,
} from '@/server/hangar/items';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Hangar inventory Postgres read path', () => {
  it('falls back to the static inventory spine when no database URL is configured', async () => {
    vi.stubEnv('HANGAR_DATABASE_URL', '');
    vi.stubEnv('DATABASE_URL', '');

    const result = await getInventoryItems();

    expect(result.source).toBe('static');
    expect(result.fallbackReason).toBe('not-configured');
    expect(result.items).toBe(hangarData.items);
  });

  it('maps item rows from the normalized assets schema back into the app read model', () => {
    const item = mapInventoryItemRow({
      id: 'glinet-comet-q-gl-rmq1',
      name: 'Comet Q',
      manufacturer: 'GL.iNet',
      model: 'GL-RMQ1',
      bay: 'network',
      category: 'Remote KVM',
      status: 'on-order',
      provenance: 'owner',
      summary: 'Remote KVM summary',
      description: 'Remote KVM description',
      planning_notes: 'Keep in Network Ops.',
      acquired: '2026 Kickstarter pledge',
      horizon: 'Estimated shipping Aug 2026',
      quantity: 1,
      price_us: '89',
      price_import: null,
      specs: [{ label: 'Video', value: '2K QHD @ 60 FPS' }],
      limitations: ['Requires USB-C DisplayPort Alt Mode.'],
      sources: [
        {
          label: 'GL.iNet Comet Q product page',
          url: 'https://www.gl-inet.com/products/gl-rmq1/',
          accessedAt: '2026-06-16',
          kind: 'official',
        },
      ],
      tags: ['kvm', 'usb-c'],
    });

    expect(item).toMatchObject({
      id: 'glinet-comet-q-gl-rmq1',
      bay: 'network',
      category: 'Remote KVM',
      status: 'on-order',
      price: { us: 89, import: null },
      specs: [{ label: 'Video', value: '2K QHD @ 60 FPS' }],
      tags: ['kvm', 'usb-c'],
    });
  });

  it('queries only peripheral assets with inventory item statuses', async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const row = {
      id: 'lafaer-lwr02-presence-sensor',
      name: 'LWR02 All-in-One Wireless Presence Sensor',
      manufacturer: 'GL.iNet / Lafaer',
      model: 'LWR02',
      bay: 'home',
      category: 'Presence Sensor',
      status: 'on-order',
      provenance: 'owner',
      summary: 'Matter-over-Thread 5-in-1 sensor.',
      description: 'Battery-powered occupancy and environment sensor.',
      planning_notes: null,
      acquired: '2026 Kickstarter add-on',
      horizon: 'Estimated shipping Aug 2026',
      quantity: 1,
      price_us: '36',
      price_import: null,
      specs: [],
      limitations: [],
      sources: [],
      tags: ['matter', 'thread'],
    };
    const query = async <T,>(sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return { rows: [row] as T[] };
    };

    const items = await readInventoryItemsFromPostgres({ query });

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("WHERE a.kind = 'peripheral'");
    expect(calls[0].values).toEqual([
      'owned',
      'on-order',
      'wishlist',
      'researching',
      'deployed',
      'retired',
      'rejected',
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('lafaer-lwr02-presence-sensor');
  });

  it('exposes the read path through a non-static route handler', async () => {
    vi.stubEnv('HANGAR_DATABASE_URL', '');
    vi.stubEnv('DATABASE_URL', '');

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toBe('static');
    expect(payload.fallbackReason).toBe('not-configured');
    expect(payload.count).toBe(hangarData.items.length);
  });
});
