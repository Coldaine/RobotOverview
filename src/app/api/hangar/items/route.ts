import { NextResponse } from 'next/server';
import { getInventoryItems } from '@/server/hangar/items';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const read = await getInventoryItems();

  return NextResponse.json({
    source: read.source,
    fallbackReason: read.fallbackReason ?? null,
    count: read.items.length,
    items: read.items,
  });
}
