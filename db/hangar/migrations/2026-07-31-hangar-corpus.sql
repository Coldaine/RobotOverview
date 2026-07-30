-- Migration 2026-07-31: hangar corpus tables (shortcuts, hangar meta, briefings).
-- Additive only. Normalized cutover Wave 1 — tables owned by hangar.

BEGIN;
SET client_min_messages = warning;

CREATE TABLE asset_shortcuts (
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  label    TEXT NOT NULL,
  type     TEXT NOT NULL CHECK (type IN ('url','command')),
  url      TEXT,
  command  TEXT,
  note     TEXT,
  PRIMARY KEY (asset_id, position),
  CHECK ((type = 'url' AND url IS NOT NULL) OR (type = 'command' AND command IS NOT NULL))
);

CREATE TABLE hangar_meta (
  id       TEXT PRIMARY KEY CHECK (id = 'hangar'),
  title    TEXT NOT NULL,
  operator TEXT NOT NULL,
  codename TEXT NOT NULL,
  updated  TEXT NOT NULL
);

CREATE TABLE briefing_packs (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  code            TEXT NOT NULL,
  summary         TEXT NOT NULL,
  hub_briefing_id TEXT,
  topics          TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE briefings (
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

ALTER TABLE briefing_packs
  ADD CONSTRAINT briefing_packs_hub_fk
    FOREIGN KEY (hub_briefing_id) REFERENCES briefings(id) ON DELETE SET NULL;

ALTER TABLE asset_shortcuts OWNER TO hangar;
GRANT ALL ON TABLE asset_shortcuts TO hangar;

ALTER TABLE hangar_meta OWNER TO hangar;
GRANT ALL ON TABLE hangar_meta TO hangar;

ALTER TABLE briefing_packs OWNER TO hangar;
GRANT ALL ON TABLE briefing_packs TO hangar;

ALTER TABLE briefings OWNER TO hangar;
GRANT ALL ON TABLE briefings TO hangar;

COMMIT;
