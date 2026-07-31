-- Migration 2026-07-31: drop the JSON snapshot table.
-- The UI spine now reconstructs from normalized tables; content_snapshots was
-- the interim Postgres-first bridge. Also removes the ingest canary rows that
-- only ever lived inside the snapshot payload.
--
-- DEPLOY ORDER: the app image containing the normalized read path must be
-- fully rolled out BEFORE this migration is applied — a pod still running the
-- snapshot reader will fail its next request once the table is gone.

BEGIN;
DROP TABLE IF EXISTS content_snapshots;
COMMIT;
