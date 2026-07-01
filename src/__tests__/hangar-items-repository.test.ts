import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/hangar/items/route';
import {
  GET as GET_PREFLIGHT,
  toHangarPreflightPayload,
} from '@/app/api/hangar/preflight/route';
import { hangarData } from '@/data/hangar';
import {
  checkHangarDatabaseReachability,
  closeHangarPoolForTests,
  getHangarPoolConfig,
} from '@/server/hangar/db';
import {
  getInventoryItems,
  mapInventoryItemRow,
  readInventoryItemsFromPostgres,
} from '@/server/hangar/items';
import { readWithStaticFallback } from '@/server/hangar/read-model';

afterEach(async () => {
  await closeHangarPoolForTests();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Hangar inventory Postgres read path', () => {
  it('shared read helper falls back to static data when a configured Postgres read fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const staticData = [{ id: 'static-item' }];
    const client = {
      query: async <T,>(): Promise<{ rows: T[] }> => {
        throw new Error('query failed');
      },
    };

    const result = await readWithStaticFallback({
      label: 'test records',
      staticData,
      getClient: async () => client,
      readFromPostgres: async (queryable) => {
        await queryable.query('SELECT explode');
        return [{ id: 'postgres-item' }];
      },
    });

    expect(result).toEqual({
      source: 'static',
      fallbackReason: 'postgres-error',
      data: staticData,
    });
    expect(console.warn).toHaveBeenCalledWith(
      'Hangar Postgres test records read failed; falling back to static spine.',
      expect.any(Error),
    );
  });

  it('falls back to the static inventory spine when no database config is present', async () => {
    vi.stubEnv('HANGAR_DB_HOST', '');
    vi.stubEnv('HANGAR_DATABASE_URL', '');
    vi.stubEnv('DATABASE_URL', '');

    const result = await getInventoryItems();

    expect(result.source).toBe('static');
    expect(result.fallbackReason).toBe('not-configured');
    expect(result.items).toBe(hangarData.items);
  });

  it('prefers structured Hangar database config over credential-bearing URLs', () => {
    vi.stubEnv('HANGAR_DB_HOST', 'pg18-rw.data-platform.svc.cluster.local');
    vi.stubEnv('HANGAR_DB_PORT', '5432');
    vi.stubEnv('HANGAR_DB_NAME', 'hangar');
    vi.stubEnv('HANGAR_DB_USER', 'hangar');
    vi.stubEnv('HANGAR_DB_PASSWORD', ' temporary-or-runtime-secret ');
    vi.stubEnv('HANGAR_DB_SSLMODE', 'require');
    vi.stubEnv('HANGAR_DATABASE_URL', 'postgres://legacy:secret@legacy/hangar');

    const config = getHangarPoolConfig();

    expect(config?.source).toBe('structured');
    expect(config?.poolConfig).toMatchObject({
      host: 'pg18-rw.data-platform.svc.cluster.local',
      port: 5432,
      database: 'hangar',
      user: 'hangar',
      password: ' temporary-or-runtime-secret ',
      ssl: { rejectUnauthorized: false },
    });
    expect(config?.poolConfig).not.toHaveProperty('connectionString');
  });

  it('keeps credential-bearing database URLs as a compatibility fallback', () => {
    vi.stubEnv('HANGAR_DB_HOST', '');
    vi.stubEnv('HANGAR_DATABASE_URL', 'postgres://hangar:secret@pg18-rw/hangar');
    vi.stubEnv('DATABASE_URL', '');

    const config = getHangarPoolConfig();

    expect(config?.source).toBe('url');
    expect(config?.poolConfig).toMatchObject({
      connectionString: 'postgres://hangar:secret@pg18-rw/hangar',
    });
  });

  it('rejects unsupported SSL modes instead of silently weakening their meaning', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('HANGAR_DB_HOST', 'pg18-rw.data-platform.svc.cluster.local');
    vi.stubEnv('HANGAR_DB_SSLMODE', 'verify-full');

    expect(() => getHangarPoolConfig()).toThrow(
      'Unsupported HANGAR_DB_SSLMODE "verify-full". Supported values: disable, require.',
    );

    const result = await getInventoryItems();

    expect(result.source).toBe('static');
    expect(result.fallbackReason).toBe('postgres-error');
  });

  it('maps item rows from the normalized assets schema back into the app read model', () => {
    const item = mapInventoryItemRow({
      id: 'glinet-comet-q-gl-rmq1',
      name: 'Comet Q',
      manufacturer: 'GL.iNet',
      model: 'GL-RMQ1',
      bay_groups: ['network'],
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
      related_units: ['beast'],
      related_missions: ['undercroft'],
      related_capabilities: ['teleop'],
      related_insights: ['beast-socket-control'],
    });

    expect(item).toMatchObject({
      id: 'glinet-comet-q-gl-rmq1',
      bay: 'network',
      category: 'Remote KVM',
      status: 'on-order',
      price: { us: 89, import: null },
      specs: [{ label: 'Video', value: '2K QHD @ 60 FPS' }],
      tags: ['kvm', 'usb-c'],
      relatedUnits: ['beast'],
      relatedMissions: ['undercroft'],
      relatedCapabilities: ['teleop'],
      relatedInsights: ['beast-socket-control'],
    });
  });

  it('rejects inventory rows without exactly one bay group', () => {
    expect(() =>
      mapInventoryItemRow({
        id: 'ambiguous-item',
        name: 'Ambiguous Item',
        manufacturer: null,
        model: null,
        bay_groups: ['network', 'robotics'],
        category: null,
        status: 'owned',
        provenance: 'owner',
        summary: null,
        description: null,
        planning_notes: null,
        acquired: null,
        horizon: null,
        quantity: 1,
        price_us: null,
        price_import: null,
        specs: [],
        limitations: [],
        sources: [],
        tags: [],
        related_units: [],
        related_missions: [],
        related_capabilities: [],
        related_insights: [],
      }),
    ).toThrow('Expected exactly one bay group for inventory item "ambiguous-item"; got network, robotics.');
  });

  it('queries only peripheral assets with inventory item statuses', async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const row = {
      id: 'lafaer-lwr02-presence-sensor',
      name: 'LWR02 All-in-One Wireless Presence Sensor',
      manufacturer: 'GL.iNet / Lafaer',
      model: 'LWR02',
      bay_groups: ['home'],
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
      related_units: [],
      related_missions: [],
      related_capabilities: [],
      related_insights: [],
    };
    const query = async <T,>(sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return { rows: [row] as T[] };
    };

    const items = await readInventoryItemsFromPostgres({ query });

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("WHERE a.kind = 'peripheral'");
    expect(calls[0].sql).toContain('bay_membership.bay_groups');
    expect(calls[0].sql).toContain('related_units');
    expect(calls[0].sql).toContain('related_missions');
    expect(calls[0].sql).toContain('related_capabilities');
    expect(calls[0].sql).toContain('related_insights');
    expect(calls[0].values).toEqual([[
      'owned',
      'on-order',
      'wishlist',
      'researching',
      'deployed',
      'retired',
      'rejected',
    ]]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('lafaer-lwr02-presence-sensor');
  });

  it('exposes the read path through a non-static route handler', async () => {
    vi.stubEnv('HANGAR_DB_HOST', '');
    vi.stubEnv('HANGAR_DATABASE_URL', '');
    vi.stubEnv('DATABASE_URL', '');

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toBe('static');
    expect(payload.fallbackReason).toBe('not-configured');
    expect(payload.count).toBe(hangarData.items.length);
  });

  it('exposes a database preflight route that does not treat fallback as healthy', async () => {
    vi.stubEnv('HANGAR_DB_HOST', '');
    vi.stubEnv('HANGAR_DATABASE_URL', '');
    vi.stubEnv('DATABASE_URL', '');

    const response = await GET_PREFLIGHT();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      ok: false,
      checks: {
        database: {
          check: 'hangar-postgres',
          configured: false,
          reachable: false,
          status: 'not-configured',
          configSource: null,
        },
      },
    });
  });

  it('reports a reachable configured Hangar database preflight', async () => {
    const calls: string[] = [];
    const query = async <T,>(sql: string) => {
      calls.push(sql);
      return { rows: [{ ok: 1 }] as T[] };
    };

    vi.stubEnv('HANGAR_DB_HOST', 'pg18-rw.data-platform.svc.cluster.local');
    vi.stubEnv('HANGAR_DB_NAME', 'hangar');
    vi.stubEnv('HANGAR_DB_USER', 'hangar');

    const result = await checkHangarDatabaseReachability({ query });

    expect(result).toMatchObject({
      check: 'hangar-postgres',
      configured: true,
      reachable: true,
      status: 'reachable',
      configSource: 'structured',
    });
    expect(result.latencyMs).toEqual(expect.any(Number));
    expect(calls).toEqual(['SELECT 1 AS ok']);
  });

  it('reports configured Hangar database preflight failures without falling back', async () => {
    const query = async <T,>(): Promise<{ rows: T[] }> => {
      throw new Error('connection refused');
    };

    vi.stubEnv('HANGAR_DB_HOST', 'pg18-rw.data-platform.svc.cluster.local');
    vi.stubEnv('HANGAR_DB_NAME', 'hangar');
    vi.stubEnv('HANGAR_DB_USER', 'hangar');

    const result = await checkHangarDatabaseReachability({ query });

    expect(result).toMatchObject({
      check: 'hangar-postgres',
      configured: true,
      reachable: false,
      status: 'unreachable',
      configSource: 'structured',
      error: 'connection refused',
    });
    expect(result.latencyMs).toEqual(expect.any(Number));
  });

  it('keeps raw database preflight errors out of the public response payload', () => {
    const payload = toHangarPreflightPayload({
      check: 'hangar-postgres',
      configured: true,
      reachable: false,
      status: 'unreachable',
      configSource: 'structured',
      latencyMs: 12,
      error: 'password authentication failed for user "hangar"',
    });

    expect(payload).toMatchObject({
      ok: false,
      checks: {
        database: {
          check: 'hangar-postgres',
          configured: true,
          reachable: false,
          status: 'unreachable',
          configSource: 'structured',
          latencyMs: 12,
        },
      },
    });
    expect(payload.checks.database).not.toHaveProperty('error');
  });
});
