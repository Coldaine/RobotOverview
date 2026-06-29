import { NextResponse } from 'next/server';
import {
  checkHangarDatabaseReachability,
  type HangarDatabasePreflight,
} from '@/server/hangar/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const database = await checkHangarDatabaseReachability();
  if (database.error) {
    console.warn('Hangar Postgres preflight failed.', {
      status: database.status,
      configSource: database.configSource,
      error: database.error,
    });
  }

  const payload = toHangarPreflightPayload(database);

  return NextResponse.json(payload, { status: payload.ok ? 200 : 503 });
}

export function toHangarPreflightPayload(database: HangarDatabasePreflight) {
  return {
    ok: database.reachable,
    checks: {
      database: {
        check: database.check,
        configured: database.configured,
        reachable: database.reachable,
        status: database.status,
        configSource: database.configSource,
        latencyMs: database.latencyMs,
      },
    },
  };
}
