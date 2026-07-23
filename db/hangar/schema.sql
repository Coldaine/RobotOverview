-- ─────────────────────────────────────────────────────────────────────────────
-- THE HANGAR — master-inventory relational schema  (PostgreSQL 18)
-- Database: hangar  (logical DB in the pg18 cluster; local standup is proof-only)
-- Source design: .omc/specs/deep-interview-hangar-master-inventory.md
--
-- Principles: one unified `assets` table (single-table inheritance); typed columns
-- for anything queried/aggregated (power/mass/price); JSONB only for display-only
-- leaves; first-class groups (bays are rows); a dedicated interface taxonomy drives
-- the video-game loadout; explicit junctions for referential integrity.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── ENUMS ────────────────────────────────────────────────────────────────────
-- asset_status is the union of the single Unit state machine and the separate
-- InventoryItem/Wishlist acquisition vocabularies stored in this shared table.
CREATE TYPE asset_status AS ENUM (
  'operational','needs-attention','blocked','inventory','integrating','deployed','owned',
  'on-order','researching','wishlist','watching','planned','buy-next','received',
  'retired','rejected'
);
CREATE TYPE lifecycle_state AS ENUM ('inventory','assembled','deployed','wishlist','on-order');
CREATE TYPE asset_kind     AS ENUM ('system','module','peripheral','accessory','consumable','cable','mount','tooling');
CREATE TYPE group_kind     AS ENUM ('bay','kit','location','project');
CREATE TYPE mission_status AS ENUM ('planning','active','standby','complete');
CREATE TYPE confidence_level AS ENUM ('high','medium','low');
CREATE TYPE interface_kind AS ENUM ('electrical','mechanical','power','data');

-- ── CORE INVENTORY ───────────────────────────────────────────────────────────
CREATE TABLE assets (
  id             TEXT PRIMARY KEY,
  kind           asset_kind   NOT NULL,
  name           TEXT         NOT NULL,
  manufacturer   TEXT,
  model          TEXT,
  callsign       TEXT,
  status         asset_status NOT NULL,
  lifecycle      lifecycle_state,
  provenance     TEXT CHECK (provenance IN ('owner','inferred','open')),
  flagship       BOOLEAN NOT NULL DEFAULT false,
  summary        TEXT,
  description    TEXT,
  planning_notes TEXT,
  monitored_via  TEXT,                         -- external system referenced (never operated) — AG2
  acquired       TEXT,
  horizon        TEXT,
  quantity       INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  -- typed, queryable numerics (revision #2)
  power_watts    NUMERIC CHECK (power_watts IS NULL OR power_watts >= 0),
  power_volts    NUMERIC CHECK (power_volts IS NULL OR power_volts >= 0),
  power_rail     TEXT CHECK (power_rail IN ('5V','12V','battery','mains')),
  mass_grams     INTEGER CHECK (mass_grams IS NULL OR mass_grams >= 0),
  price_us       NUMERIC CHECK (price_us IS NULL OR price_us >= 0),
  price_import   NUMERIC CHECK (price_import IS NULL OR price_import >= 0),
  -- display-only leaves
  specs          JSONB,                         -- [{label,value}]
  links          JSONB,                         -- [{label,url}]
  limitations    JSONB,                         -- [text]
  sources        JSONB,                         -- [{label,url,accessedAt,kind}]
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, lifecycle)
);

-- 1:1 optional extension for lifecycle='wishlist' assets (revision #7).
CREATE TABLE wishlist_meta (
  asset_id              TEXT PRIMARY KEY,
  asset_lifecycle       lifecycle_state NOT NULL DEFAULT 'wishlist' CHECK (asset_lifecycle = 'wishlist'),
  rationale             TEXT,
  unlocks_capability_id TEXT,                   -- FK added after capabilities exists
  risk_note             TEXT,
  for_asset_id          TEXT REFERENCES assets(id) ON DELETE SET NULL,
  for_mission_id        TEXT,                   -- FK added after missions exists
  FOREIGN KEY (asset_id, asset_lifecycle)
    REFERENCES assets(id, lifecycle) ON DELETE CASCADE
);

-- ── GROUPING ─────────────────────────────────────────────────────────────────
CREATE TABLE tags (
  id        SERIAL PRIMARY KEY,
  namespace TEXT NOT NULL DEFAULT 'tag',        -- tag | class | category | theme | ...
  name      TEXT NOT NULL,
  label     TEXT,
  UNIQUE (namespace, name)
);
CREATE TABLE asset_tags (
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, tag_id)
);

-- first-class groups: bays/kits/locations/projects are all groups (revision #4).
-- App-facing assets currently require exactly one bay group; extra membership belongs in
-- kit/location/project groups or tags until the UI read model becomes multi-bay.
CREATE TABLE groups (
  id       TEXT PRIMARY KEY,
  kind     group_kind NOT NULL,
  name     TEXT NOT NULL,
  code     TEXT,
  tagline  TEXT,
  accent   TEXT
);
CREATE TABLE asset_groups (
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, group_id)
);

-- ── LOADOUT / SOCKETS  (the base-builder spine) ─────────────────────────────
CREATE TABLE hotspots (
  id            SERIAL PRIMARY KEY,
  host_asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,                  -- original per-schematic hotspot id
  label         TEXT,
  x             NUMERIC,
  y             NUMERIC,
  UNIQUE (host_asset_id, code)
);
CREATE TABLE sockets (
  id            SERIAL PRIMARY KEY,
  host_asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  slot_group    TEXT,                           -- 'Chassis Mounts' | 'Driver Board Interfaces'
  name          TEXT NOT NULL,
  hotspot_id    INTEGER REFERENCES hotspots(id) ON DELETE SET NULL,
  capacity      INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  note          TEXT,
  UNIQUE (host_asset_id, name)
);

-- dedicated interface taxonomy drives compatibility (revision #5)
CREATE TABLE interface_types (
  id   TEXT PRIMARY KEY,                         -- 'i2c' | 'uart' | 'picatinny-21mm' | 'serial-bus-servo' ...
  name TEXT NOT NULL,
  kind interface_kind NOT NULL,
  note TEXT
);
CREATE TABLE asset_interfaces (                  -- what an asset EXPOSES / can mate
  asset_id          TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  interface_type_id TEXT NOT NULL REFERENCES interface_types(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, interface_type_id)
);
CREATE TABLE socket_accepts (                    -- what a socket ACCEPTS
  socket_id         INTEGER NOT NULL REFERENCES sockets(id) ON DELETE CASCADE,
  interface_type_id TEXT NOT NULL REFERENCES interface_types(id) ON DELETE CASCADE,
  PRIMARY KEY (socket_id, interface_type_id)
);
CREATE TABLE loadout_assignments (               -- what is currently equipped (one per socket)
  socket_id         INTEGER NOT NULL,
  asset_id          TEXT NOT NULL,
  interface_type_id TEXT NOT NULL,
  equipped_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (socket_id),
  FOREIGN KEY (socket_id, interface_type_id)
    REFERENCES socket_accepts(socket_id, interface_type_id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id, interface_type_id)
    REFERENCES asset_interfaces(asset_id, interface_type_id) ON DELETE CASCADE
);

-- ── MISSIONS ─────────────────────────────────────────────────────────────────
CREATE TABLE missions (
  id          TEXT PRIMARY KEY,
  code        TEXT,
  name        TEXT NOT NULL,
  status      mission_status NOT NULL,
  objective   TEXT,
  environment TEXT
);
CREATE TABLE mission_requisitions (
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  asset_id   TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  PRIMARY KEY (mission_id, asset_id)
);
CREATE TABLE mission_objectives (
  id         SERIAL PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE mission_constraints (
  id         SERIAL PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  value      NUMERIC NOT NULL CHECK (value >= 0),
  budget     NUMERIC NOT NULL CHECK (budget >= 0),
  unit       TEXT NOT NULL CHECK (unit IN ('W','g','$'))
);
CREATE TABLE mission_after_actions (
  id          SERIAL PRIMARY KEY,
  mission_id  TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL CHECK (position >= 0),
  text        TEXT NOT NULL,
  UNIQUE (mission_id, position)
);

-- ── CAPABILITIES (tech tree) ─────────────────────────────────────────────────
CREATE TABLE capabilities (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  unlocked    BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE capability_deps (
  capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  PRIMARY KEY (capability_id, depends_on_id)
);
CREATE TABLE asset_capabilities (                -- what grants/enables a capability
  asset_id      TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, capability_id)
);

-- ── KNOWLEDGE / LOG ──────────────────────────────────────────────────────────
CREATE TABLE insights (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT,
  confidence  confidence_level,
  source      TEXT,
  captured_at TIMESTAMPTZ
);
CREATE TABLE insight_assets (                    -- explicit junctions (revision #8)
  insight_id TEXT NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  asset_id   TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  PRIMARY KEY (insight_id, asset_id)
);
CREATE TABLE insight_missions (
  insight_id TEXT NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  PRIMARY KEY (insight_id, mission_id)
);
CREATE TABLE insight_tags (
  insight_id TEXT NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (insight_id, tag_id)
);

CREATE TABLE activity_log (
  id       TEXT PRIMARY KEY,
  at       TIMESTAMPTZ,
  kind     TEXT,
  text     TEXT,
  asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL
);

-- ── CONNECTED TWIN (terminals + nets) ────────────────────────────────────────
-- A terminal is a physical connector on an asset; a net joins terminals that
-- are wired together (power rail, UART link, servo daisy-chain). Documents are
-- the downloaded source library (library_path is the stable key, under beast/;
-- url filled once files move to object storage).
CREATE TYPE net_kind AS ENUM ('power','data','mixed','mechanical');

CREATE TABLE terminals (
  id        TEXT PRIMARY KEY,
  asset_id  TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  connector TEXT,
  role      TEXT CHECK (role IN ('input','output','bidirectional')),
  note      TEXT
);

CREATE TABLE nets (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  kind    net_kind NOT NULL,
  carries TEXT,
  note    TEXT
);

CREATE TABLE net_terminals (
  net_id      TEXT NOT NULL REFERENCES nets(id) ON DELETE CASCADE,
  terminal_id TEXT NOT NULL REFERENCES terminals(id) ON DELETE CASCADE,
  PRIMARY KEY (net_id, terminal_id)
);

CREATE TABLE documents (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('schematic','manual','cad','firmware','wiki','datasheet','image')),
  library_path TEXT NOT NULL UNIQUE,
  url          TEXT,
  note         TEXT
);

CREATE TABLE document_assets (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  asset_id    TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, asset_id)
);

CREATE TABLE net_documents (
  net_id      TEXT NOT NULL REFERENCES nets(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (net_id, document_id)
);

-- deferred FKs on wishlist_meta (targets now exist)
ALTER TABLE wishlist_meta
  ADD CONSTRAINT wishlist_meta_capability_fk
    FOREIGN KEY (unlocks_capability_id) REFERENCES capabilities(id) ON DELETE SET NULL,
  ADD CONSTRAINT wishlist_meta_mission_fk
    FOREIGN KEY (for_mission_id) REFERENCES missions(id) ON DELETE SET NULL;

-- ── INDEXES (the access patterns we'll actually run) ─────────────────────────
CREATE INDEX idx_assets_kind        ON assets(kind);
CREATE INDEX idx_assets_status      ON assets(status);
CREATE INDEX idx_assets_lifecycle   ON assets(lifecycle);
CREATE INDEX idx_asset_groups_group ON asset_groups(group_id);
CREATE INDEX idx_asset_tags_tag     ON asset_tags(tag_id);
CREATE INDEX idx_sockets_host       ON sockets(host_asset_id);
CREATE INDEX idx_assignments_asset_iface ON loadout_assignments(asset_id, interface_type_id);
CREATE INDEX idx_terminals_asset    ON terminals(asset_id);
CREATE INDEX idx_net_terminals_term ON net_terminals(terminal_id);
CREATE INDEX idx_document_assets_asset ON document_assets(asset_id);

COMMIT;
