-- Migration 2026-07-31: hangar corpus tables + gap columns + enum drift.
-- Idempotent: every statement is re-runnable. Note: ALTER TYPE ... ADD VALUE
-- cannot run inside a transaction on PG < 12, so this file has no BEGIN/COMMIT;
-- statements apply individually (psql default), which also makes partial
-- replay safe given the IF NOT EXISTS guards.

CREATE TABLE IF NOT EXISTS asset_shortcuts (
  asset_id    TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  shortcut_id TEXT,
  position    INTEGER NOT NULL,
  label       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('url','command')),
  url         TEXT,
  command     TEXT,
  note        TEXT,
  PRIMARY KEY (asset_id, position),
  CHECK ((type = 'url' AND url IS NOT NULL) OR (type = 'command' AND command IS NOT NULL))
);
-- Identity column (added after first cutover version): slug-free shortcut ids.
ALTER TABLE asset_shortcuts ADD COLUMN IF NOT EXISTS shortcut_id TEXT;
-- Backfill legacy rows seeded without ids: slug the label.
UPDATE asset_shortcuts
SET shortcut_id = lower(regexp_replace(label, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE shortcut_id IS NULL;
ALTER TABLE asset_shortcuts ALTER COLUMN shortcut_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS asset_shortcuts_id_key
  ON asset_shortcuts (asset_id, shortcut_id);

CREATE TABLE IF NOT EXISTS hangar_meta (
  id       TEXT PRIMARY KEY CHECK (id = 'hangar'),
  title    TEXT NOT NULL,
  operator TEXT NOT NULL,
  codename TEXT NOT NULL,
  updated  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS briefing_packs (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  code            TEXT NOT NULL,
  summary         TEXT NOT NULL,
  hub_briefing_id TEXT,
  topics          TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS briefings (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('research','plan')),
  summary       TEXT NOT NULL,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  aliases       TEXT[] NOT NULL DEFAULT '{}',
  pack_id       TEXT REFERENCES briefing_packs(id) ON DELETE SET NULL,
  captured_at   TEXT,
  href          TEXT NOT NULL,
  body_markdown TEXT,
  repo_path     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind = 'research' AND body_markdown IS NOT NULL) OR (kind = 'plan' AND repo_path IS NOT NULL))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'briefing_packs_hub_fk'
  ) THEN
    ALTER TABLE briefing_packs
      ADD CONSTRAINT briefing_packs_hub_fk
      FOREIGN KEY (hub_briefing_id) REFERENCES briefings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Corpus gaps the June schema never modeled (present in the HangarData fixture):
ALTER TABLE missions ADD COLUMN IF NOT EXISTS required_loadout TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE insights ADD COLUMN IF NOT EXISTS bay TEXT REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS bay TEXT REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE wishlist_meta ADD COLUMN IF NOT EXISTS source TEXT;

-- Live enum drift: this DB was seeded from a pre-2026-07-12 schema snapshot
-- ('in-mission' present but unused; 'inventory' and 'integrating' missing).
ALTER TYPE asset_status ADD VALUE IF NOT EXISTS 'inventory';
ALTER TYPE asset_status ADD VALUE IF NOT EXISTS 'integrating';

-- The live DB predates mission_after_actions (canonical since June schema).
CREATE TABLE IF NOT EXISTS mission_after_actions (
  id         SERIAL PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL CHECK (position >= 0),
  text       TEXT NOT NULL,
  UNIQUE (mission_id, position)
);

ALTER TABLE asset_shortcuts OWNER TO hangar;
GRANT ALL ON TABLE asset_shortcuts TO hangar;
ALTER TABLE hangar_meta OWNER TO hangar;
GRANT ALL ON TABLE hangar_meta TO hangar;
ALTER TABLE briefing_packs OWNER TO hangar;
GRANT ALL ON TABLE briefing_packs TO hangar;
ALTER TABLE briefings OWNER TO hangar;
GRANT ALL ON TABLE briefings TO hangar;
ALTER TABLE mission_after_actions OWNER TO hangar;
GRANT ALL ON TABLE mission_after_actions TO hangar;
