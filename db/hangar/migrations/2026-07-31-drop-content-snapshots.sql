-- Migration 2026-07-31: drop the JSON snapshot table.
-- The UI spine now reconstructs from normalized tables; content_snapshots was
-- the interim Postgres-first bridge. Also removes the ingest canary rows that
-- only ever lived inside the snapshot payload.

BEGIN;
DROP TABLE IF EXISTS content_snapshots;
COMMIT;
