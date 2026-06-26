---
title: Data Backend — Master-Inventory Model
audience: AI agents and operators working on the Hangar data layer
status: living
last_updated: 2026-06-26
---

# Data Backend — Master-Inventory Model

> The Hangar's data spine: the static source it reads today, and the normalized Postgres
> master-inventory it is migrating to. This is the design + rationale; the live SQL lives in
> `db/hangar/` (`schema.sql`, `seed.sql`, `standup.md`).

## Current reality (read this first)

- **`src/data/hangar.ts` is the authoritative runtime source.** The Next.js app reads it directly.
- The **Postgres `hangar` database is stood up alongside it** (schema applied, seeded from
  `hangar.ts`, verified) but is **not yet authoritative**. App/ORM wiring (e.g. Drizzle) is
  deliberately deferred — see *Deferred* below.
- This staging is intentional, per the North Star pillar **"do not prescribe before populating":**
  the relational shape was designed only after there was real content to fit it to.

## The model in one paragraph

One unified **`assets`** pool holds everything owned, distinguished by `kind`/`status`/`lifecycle`
enums. Flexible **`groups`** (bay / kit / location / project) layer *over* the pool via the
`asset_groups` junction, so **bays are group-views, not silos**. The base-builder spine is typed:
assets expose **`interface_types`** (via `asset_interfaces`), **`sockets`** accept interface types
(via `socket_accepts`), an asset is a *candidate* for a socket when those sets intersect, and
equipping is a row in **`loadout_assignments`**. Power/mass/price are **typed columns** (so mission
budgets aggregate); JSONB is reserved for display-only leaves (`specs`, `links`).

## Key design decisions

These were crystallized in a deep-interview design session (2026-06-26) and realized in
`db/hangar/`. The rationale is preserved here because the design choices are load-bearing:

| # | Decision | Chosen | Why |
|---|----------|--------|-----|
| 1 | Asset modeling | One `assets` table (single-table inheritance) + JSONB leaves | Kinds share ~90% of fields; the dominant query is "the whole pool"; class-table joins aren't worth it at personal scale |
| 2 | power / mass / price | **Typed columns** (not JSONB) | Mission budgets must `SUM`/aggregate these against `mission_constraints` |
| 3 | specs / links | JSONB | Heterogeneous, display-only |
| 4 | Grouping | **First-class `groups`** (bay\|kit\|location\|project) + `asset_groups` | Multi-membership, kit bundles, group metadata — bays fall out as views |
| 5 | Socket compatibility | **Dedicated `interface_types`** taxonomy | Physical mating is typed and finite; keep it separate from loose grouping tags |
| 6 | Typed vs tagged | kind/status/lifecycle = enums; tags = flexible | Integrity on single-valued dimensions, flexibility on multi-valued |
| 7 | Wishlist | Fold into `assets` (`lifecycle`) + 1:1 `wishlist_meta` | Graduation = a status flip; the want list shares the one pool |
| 8 | Insight references | **Explicit `insight_assets` / `insight_missions`** junctions | Real FK integrity instead of polymorphic-orphan risk |

A graph database was evaluated and **rejected for now**: Postgres + junction tables + recursive
CTEs cover the connected-model queries (loadout candidacy, capability dependency trees) without a
second engine.

## Shape (~24 tables, 7 enums)

```
ENUMS    asset_kind · asset_status · lifecycle · group_kind(bay|kit|location|project)
         · mission_status · confidence_level · interface_kind(electrical|mechanical|power|data)

CORE     assets(id, kind, name, callsign, status, lifecycle, provenance, summary, acquired, horizon,
                 power_watts, power_volts, power_rail, mass_grams, price_us, price_import,
                 specs JSONB, links JSONB, created_at, updated_at)
         wishlist_meta(asset_id PK→assets, rationale, unlocks_capability_id→capabilities,
                 risk_note, for_asset_id→assets, for_mission_id→missions)
GROUPING tags / asset_tags ;  groups / asset_groups
LOADOUT  hotspots ; sockets(host_asset_id, capacity, ...) ; interface_types
         asset_interfaces (asset exposes) ; socket_accepts (socket accepts)
         loadout_assignments(socket_id, asset_id→assets, equipped_at)
         -- candidacy ⇔ asset_interfaces ∩ socket_accepts ≠ ∅ ; equip = an assignment
MISSIONS missions ; mission_requisitions ; mission_objectives ; mission_constraints
CAPS     capabilities ; capability_deps ; asset_capabilities
KNOWLEDGE insights ; insight_assets ; insight_missions ; insight_tags ; activity_log
```

The authoritative DDL is `db/hangar/schema.sql`. This table is a map, not a substitute.

## Where it runs

A **separate `hangar` database** inside the existing `techdeals-postgres18` instance (port `54329`).
TechdealsHandoff data (`market_*`, `techdeals_work*`, `legacy_supabase`) is untouched — same
instance, isolated database. Rebuild/verify steps are in `db/hangar/standup.md`.

## How it's seeded

`db/hangar/gen-seed.ts` transforms `src/data/hangar.ts` → `db/hangar/seed.sql` with defensive
reference-filtering (no junction row can violate an FK). The committed `seed.sql` rebuilds the DB
from `psql` alone. **`seed.sql` is generated — regenerate it whenever `hangar.ts` changes** rather
than hand-editing.

## Deferred (by design)

- **App / ORM wiring** (Drizzle). The Next.js app continues to read `hangar.ts` at runtime; the DB
  is stood up *alongside* it. When the app is wired to Postgres, the ORM schema must map to
  `db/hangar/schema.sql`, and the server-side data-access pattern is described in
  [`web-app.md`](web-app.md).
- **Retiring `hangar.ts`** as the runtime source — only after the DB-backed read path is proven.
