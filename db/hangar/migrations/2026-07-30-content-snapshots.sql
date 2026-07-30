-- UI projection snapshot: full HangarData JSON as the Postgres-first read path.
-- Normalized tables remain for inventory queries / preflight; agents upsert via
-- the ingest API which updates this snapshot (and selective normalized rows).

CREATE TABLE IF NOT EXISTS content_snapshots (
  id         TEXT PRIMARY KEY,
  payload    JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE content_snapshots OWNER TO hangar;
GRANT ALL ON TABLE content_snapshots TO hangar;

COMMENT ON TABLE content_snapshots IS
  'Hangar UI spine snapshots. id=hangar holds the HangarData document.';
