import {
  assertIngestAuthorized,
  IngestAuthError,
  ingestHangarEntity,
  parseIngestBody,
} from '@/server/hangar/ingest';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    assertIngestAuthorized(request.headers.get('authorization'));
    const raw = await request.json();
    const body = parseIngestBody(raw);
    const result = await ingestHangarEntity(body);
    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof IngestAuthError) {
      return Response.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return Response.json(
        { ok: false, error: 'Invalid ingest body', issues: error.issues },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
