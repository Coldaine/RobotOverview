# Hangar PostgreSQL Schema Design

This schema maps the TypeScript data model into a PostgreSQL database. It strikes a balance between **strict relational integrity** (for things that relate to each other, like units and their loadout slots) and **JSONB flexibility** (for loosely structured metadata like power budgets and prices).

Given the North Star goal of "low friction" and keeping the system easily maintainable, using `JSONB` for localized specs prevents table explosion while still allowing indexing and querying.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE unit_status AS ENUM ('operational', 'needs-attention', 'blocked', 'in-mission', 'wishlist', 'on-order', 'researching', 'retired');
CREATE TYPE lifecycle_state AS ENUM ('inventory', 'assembled', 'deployed', 'wishlist', 'on-order');
CREATE TYPE mission_status AS ENUM ('planning', 'active', 'standby', 'complete');
CREATE TYPE wishlist_status AS ENUM ('watching', 'researching', 'planned', 'buy-next', 'on-order', 'received', 'rejected');
CREATE TYPE confidence_level AS ENUM ('high', 'medium', 'low');

-- ─────────────────────────────────────────────────────────────────────────────
-- BAYS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE bays (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) NOT NULL,
    tagline VARCHAR(255),
    accent VARCHAR(20) -- 'cyan' | 'amber'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CAPABILITIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE capabilities (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    bay_id VARCHAR(50) REFERENCES bays(id),
    unlocked BOOLEAN DEFAULT false,
    depends_on VARCHAR(50)[] -- Array of capability IDs this depends on
);

-- ─────────────────────────────────────────────────────────────────────────────
-- UNITS (The core inventory)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE units (
    id VARCHAR(50) PRIMARY KEY,
    bay_id VARCHAR(50) REFERENCES bays(id),
    name VARCHAR(100) NOT NULL,
    callsign VARCHAR(50),
    class VARCHAR(100),
    status unit_status NOT NULL,
    lifecycle lifecycle_state NOT NULL,
    flagship BOOLEAN DEFAULT false,
    summary TEXT,
    mass_grams INTEGER,
    acquired VARCHAR(50),
    horizon VARCHAR(100),
    provenance VARCHAR(50),
    
    -- Using JSONB for flexible sub-structures that don't need independent tables
    power JSONB, -- { "watts": 25, "volts": 5, "rail": "5V" }
    price JSONB, -- { "us": 249, "import": 199 }
    specs JSONB, -- [{ "label": "SoC", "value": "BCM2712" }]
    tags TEXT[],
    links JSONB  -- [{ "label": "Store", "url": "https..." }]
);

-- ─────────────────────────────────────────────────────────────────────────────
-- LOADOUT SLOTS (The relational "Base-Builder" spine)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE unit_hotspots (
    id VARCHAR(50) PRIMARY KEY,
    unit_id VARCHAR(50) REFERENCES units(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    x NUMERIC NOT NULL,
    y NUMERIC NOT NULL
    -- Note: 'status' and 'detail' are omitted. They are dynamically derived 
    -- from the loadout slots mapped to this hotspot!
);

CREATE TABLE unit_loadout_slots (
    id SERIAL PRIMARY KEY,
    unit_id VARCHAR(50) REFERENCES units(id) ON DELETE CASCADE,
    hotspot_id VARCHAR(50) REFERENCES unit_hotspots(id), -- Tightly couples visual overlay to structural spine!
    slot_group VARCHAR(100), -- e.g., 'Chassis Mounts'
    slot_name VARCHAR(100) NOT NULL, -- e.g., '21mm Picatinny Rail'
    filled_by_unit_id VARCHAR(50) REFERENCES units(id), -- Connects a slot to another unit!
    note TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MISSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE missions (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    status mission_status NOT NULL,
    objective TEXT NOT NULL,
    environment TEXT,
    required_loadout TEXT[]
);

-- Mission many-to-many associations
CREATE TABLE mission_requisitions (
    mission_id VARCHAR(50) REFERENCES missions(id) ON DELETE CASCADE,
    unit_id VARCHAR(50) REFERENCES units(id) ON DELETE CASCADE,
    PRIMARY KEY (mission_id, unit_id)
);

CREATE TABLE mission_objectives (
    id SERIAL PRIMARY KEY,
    mission_id VARCHAR(50) REFERENCES missions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    done BOOLEAN DEFAULT false
);

CREATE TABLE mission_constraints (
    id SERIAL PRIMARY KEY,
    mission_id VARCHAR(50) REFERENCES missions(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    value NUMERIC NOT NULL,
    budget NUMERIC NOT NULL,
    unit VARCHAR(10) -- 'W', 'g', '$'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- WISHLIST
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE wishlist (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    for_unit_id VARCHAR(50) REFERENCES units(id),
    for_mission_id VARCHAR(50) REFERENCES missions(id),
    rationale TEXT,
    status wishlist_status NOT NULL,
    unlocks_capability_id VARCHAR(50) REFERENCES capabilities(id),
    risk_note TEXT,
    horizon VARCHAR(100),
    source VARCHAR(100),
    mass_grams INTEGER,
    
    -- Flexible metrics
    price JSONB NOT NULL,
    power JSONB
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INSIGHTS (The Knowledge Base)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE insights (
    id VARCHAR(50) PRIMARY KEY,
    bay_id VARCHAR(50) REFERENCES bays(id),
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    confidence confidence_level NOT NULL,
    source VARCHAR(200),
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags TEXT[]
);

-- Insights can map to multiple units or missions
CREATE TABLE insight_references (
    insight_id VARCHAR(50) REFERENCES insights(id) ON DELETE CASCADE,
    reference_type VARCHAR(20) NOT NULL, -- 'unit' or 'mission'
    reference_id VARCHAR(50) NOT NULL,   -- The ID of the unit or mission
    PRIMARY KEY (insight_id, reference_type, reference_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ACTIVITY LOG
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE activity_log (
    id VARCHAR(50) PRIMARY KEY,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    kind VARCHAR(50) NOT NULL,
    text TEXT NOT NULL
);
```
