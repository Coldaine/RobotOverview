import {
  assertIngestAuthorized,
  IngestAuthError,
  IngestConflictError,
  IngestNotFoundError,
  IngestUnavailableError,
  ingestHangarOp,
  parseIngestBody,
} from '@/server/hangar/ingest';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    assertIngestAuthorized(request.headers.get('authorization'));
    const raw = await request.json();
    const body = parseIngestBody(raw);
    const result = await ingestHangarOp(body);
    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof IngestAuthError) {
      return Response.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof IngestUnavailableError) {
      return Response.json({ ok: false, error: error.message }, { status: 503 });
    }
    if (error instanceof IngestNotFoundError) {
      return Response.json({ ok: false, ...error.body }, { status: 404 });
    }
    if (error instanceof IngestConflictError) {
      return Response.json({ ok: false, ...error.body }, { status: 409 });
    }
    if (error instanceof ZodError) {
      return Response.json(
        { ok: false, error: 'Invalid ingest body', issues: error.issues },
        { status: 400 },
      );
    }
    // Unmapped failures (driver errors, FK violations) expose constraint and
    // table names via error.message — log server-side, answer generic.
    console.error('hangar ingest: unhandled failure', error);
    return Response.json({ ok: false, error: 'Ingest failed' }, { status: 500 });
  }
}
