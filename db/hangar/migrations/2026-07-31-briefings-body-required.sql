-- Migration 2026-07-31: all briefing kinds store body_markdown in Postgres.
-- repo_path remains provenance only (no runtime file reads required in the image).
-- Idempotent.

-- Drop the old kind/body XOR check (auto-named briefings_check on fresh schema;
-- also try the explicit name if a later edit named it).
ALTER TABLE briefings DROP CONSTRAINT IF EXISTS briefings_check;
ALTER TABLE briefings DROP CONSTRAINT IF EXISTS briefings_body_xor;

-- Backfill any plan rows that only have repo_path with a loud placeholder —
-- operators should re-seed or re-land corpus for full bodies. Never use ''
-- (falsy) so getBriefingBody cannot treat the row as "missing then file-read".
UPDATE briefings
SET body_markdown = COALESCE(
  NULLIF(body_markdown, ''),
  '<!-- DATACORE: body_markdown missing — re-seed or land_briefing -->'
)
WHERE body_markdown IS NULL OR body_markdown = '';

ALTER TABLE briefings ALTER COLUMN body_markdown SET NOT NULL;
