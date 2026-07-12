import { readFile } from 'node:fs/promises';
import path from 'node:path';

const assets = {
  'index.html': 'text/html; charset=utf-8',
  'flow.html': 'text/html; charset=utf-8',
  'dashboard.html': 'text/html; charset=utf-8',
  'story.html': 'text/html; charset=utf-8',
  'styles.css': 'text/css; charset=utf-8',
  'dossier.js': 'text/javascript; charset=utf-8',
} as const;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> },
) {
  const { asset } = await params;
  const contentType = assets[asset as keyof typeof assets];
  if (!contentType) return new Response('Not found', { status: 404 });

  const source = path.join(process.cwd(), 'design', 'beast-storage', asset);
  return new Response(await readFile(source), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
