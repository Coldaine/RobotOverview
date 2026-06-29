import { NextResponse } from 'next/server';
import { checkHangarDatabaseReachability } from '@/server/hangar/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const database = await checkHangarDatabaseReachability();
  const ok = database.reachable;

  return NextResponse.json(
    {
      ok,
      checks: {
        database,
      },
    },
    { status: ok ? 200 : 503 },
  );
}
