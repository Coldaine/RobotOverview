---
title: Hangar DB — Master Inventory Standup
date: 2026-06-26
author: Patrick MacLyman
status: living
last_confirmed: 2026-07-07
---

# Hangar DB — master-inventory Postgres standup

The relational backend for the Hangar: **one master inventory of all gear**, with bays as first-class group rows, a video-game loadout, and the connected model (North Star AG1) preserved. Design provenance: `.omc/specs/deep-interview-hangar-master-inventory.md` (deep-interview session, 2026-06-26), which itself recovered + reconciled the deleted `docs/plans/postgres_schema.md`.

> **Status:** DB shape stood up + seeded in the `coldaine-k8cluster` logical `hangar` database on `pg18`. `src/data/hangar.ts` remains the bootstrap dataset and rollback source. Inventory items are browser-facing through the server Postgres read path (`src/server/hangar/`) with static fallback metadata surfaced in the app chrome. Cluster backup and restore-test status is owned by `coldaine-k8cluster`; RobotOverview should reference that evidence rather than independently declaring the restore gate complete. Broader Hangar surfaces still read from the TypeScript spine until each lane earns seed, preflight, parity, fallback, and migration proof.

## Where it lives

### Local proof / development

- **Instance:** the existing local `techdeals-postgres18` container (Postgres 18, host `:54329`).
- **Database:** `hangar` — a separate database in that instance. TechdealsHandoff data (`market_*`, `techdeals_work*`, `legacy_supabase`) is untouched.
- **Creds (dev):** `techdeals` / `techdeals`.

This local database proves the schema and seed shape. It is not the production target and should not be treated as authoritative runtime state.

### Target deployment

The target database belongs to `C:\_projects\coldaine-k8cluster`: a logical `hangar` database inside the `pg18` CloudNativePG cluster. Provisioning is cluster-repo work (`databases/pg18.yaml` plus `docs/connection-registry.md`), with a `hangar` role, structured `HANGAR_DB_*` app config, a runtime credential path, and cluster-owned backup/restore evidence.

Do not stand up a RobotOverview-owned Postgres server for Hangar; add a logical DB to `pg18`.
`HANGAR_DB_HOST`, port, name, user, and SSL mode are non-secret config; only
`HANGAR_DB_PASSWORD` is credential-bearing. The app currently accepts `HANGAR_DB_SSLMODE=disable`
or `require`; `require` encrypts without authenticating the self-signed CNPG certificate chain.
Future certificate-verified modes need an explicit trust-bundle/certificate contract.

## Files

- `schema.sql` — the full rebuild DDL. The source of truth for the current shape.
- `migrations/` — additive live migrations for databases that already contain stored data.
- `gen-seed.ts` — transforms `src/data/hangar.ts` → seed SQL (defensive: junctions filtered to resolvable refs).
- `seed.sql` — generated output (committed so the DB rebuilds with `psql` alone).

## App read path foundation

The first browser-facing read lane is intentionally small and reusable:

- `src/server/hangar/db.ts` lazily creates a `pg` pool only when a request asks for DB-backed data. It prefers structured `HANGAR_DB_*` config and keeps `HANGAR_DATABASE_URL`/`DATABASE_URL` only as compatibility paths.
- `src/server/hangar/queryable.ts`, `read-model.ts`, and `validators.ts` hold the shared repository contracts: the minimal query client shape, Postgres-with-static-fallback behavior, and row validation/coercion helpers. New DB-backed surfaces should reuse these instead of copying the inventory fallback pattern.
- `src/server/hangar/items.ts` maps normalized assets, groups, tags, and junctions back into the existing `InventoryItem` read model, including unit, mission, capability, and insight relationship arrays where present.
- `src/app/api/hangar/items/route.ts` exposes the read-only smoke-test route with `{ source, fallbackReason, count, items }`.
- `src/app/api/hangar/preflight/route.ts` exposes the no-fallback DB reachability gate.
- `src/app/layout.tsx` reads inventory through the same server path at request time and passes `{ source, fallbackReason }` into the client store so the Shell can expose static fallback state.

## Rebuild from scratch

Local proof rebuild, for remote/existing proof environments only. Do not start or rebuild
local containers on `icarus-laptop`; use the cluster path or a remote proof host instead.

```bash
docker exec techdeals-postgres18 psql -U techdeals -d postgres \
  -c "DROP DATABASE IF EXISTS hangar;" -c "CREATE DATABASE hangar;"
docker exec -i techdeals-postgres18 psql -U techdeals -d hangar -v ON_ERROR_STOP=1 < db/hangar/schema.sql
npx tsx db/hangar/gen-seed.ts --out db/hangar/seed.sql    # regenerate after editing hangar.ts
docker exec -i techdeals-postgres18 psql -U techdeals -d hangar -v ON_ERROR_STOP=1 < db/hangar/seed.sql
```

Cluster deployment is different: reserve the logical DB/role in `coldaine-k8cluster`, provide address config as `HANGAR_DB_HOST`/`HANGAR_DB_PORT`/`HANGAR_DB_NAME`/`HANGAR_DB_USER`, provide only the credential-bearing piece through the chosen runtime auth path, apply migrations/schema there, load seed data generated from `hangar.ts`, verify the cluster-owned backup/restore status, verify `GET /api/hangar/preflight` can reach the DB, parity-check representative reads, then cut each app read lane over to Postgres. The inventory-item lane has passed the app-level seed/preflight/parity/read gates; repeat that app-level proof for each broader Hangar surface before moving it off `hangar.ts`.

## Schema in one breath

- **`assets`** — every possession in one table (single-table inheritance); `kind` discriminator; typed `power_*`/`mass_grams`/`price_*` columns (queryable for budgets); JSONB only for display-only leaves (`specs`/`links`/`limitations`/`sources`). Wishlist folds in via `lifecycle='wishlist'` + a 1:1 `wishlist_meta`.
- **Grouping** — `tags`/`asset_tags` (flexible, namespaced: `tag`/`class`/`category`) and first-class **`groups`/`asset_groups`** (`bay`|`kit`|`location`|`project`). Bays are **rows in `groups` with `kind='bay'`** — not SQL views. Current app-facing assets must have exactly one bay group; use non-bay groups or tags for additional membership until the UI model is explicitly multi-bay.
- **Loadout** — `sockets` on a host, `interface_types` taxonomy, `socket_accepts` + `asset_interfaces` ⇒ candidacy, `loadout_assignments` ⇒ what's equipped with the proven compatible `interface_type_id`.
- **`missions` · `capabilities` · `insights` · `activity_log`** — explicit mission child tables and junctions (`mission_requisitions`, `mission_after_actions`, `asset_capabilities`, `insight_assets`/`insight_missions`, …).

A separate graph database is not the Hangar inventory target. Postgres plus junction tables and,
when needed, recursive CTEs cover the current connected-model queries; the cluster's `falkordb`
service is for graph-specific consumers, not for this master-inventory spine unless a future
decision explicitly moves a graph-shaped workload there.

## Verification queries (the three proofs)

```sql
-- video-game loadout: who can fill the Beast's host mount? (pi5 equipped, orin-nano = swap)
SELECT a.id, (la.asset_id IS NOT NULL) AS equipped
FROM sockets s JOIN socket_accepts sa ON sa.socket_id=s.id
  JOIN asset_interfaces ai ON ai.interface_type_id=sa.interface_type_id
  JOIN assets a ON a.id=ai.asset_id
  LEFT JOIN loadout_assignments la ON la.socket_id=s.id
    AND la.asset_id=a.id
    AND la.interface_type_id=sa.interface_type_id
WHERE s.host_asset_id='beast' AND s.name='Host Controller Mount';

-- budget math: sum the typed power column for a mission's requisitioned assets
SELECT SUM(a.power_watts) FROM mission_requisitions mr JOIN assets a ON a.id=mr.asset_id
WHERE mr.mission_id='undercroft';

-- bay membership through groups, not a hard column
SELECT g.code, count(ag.asset_id) FROM groups g
  LEFT JOIN asset_groups ag ON ag.group_id=g.id WHERE g.kind='bay' GROUP BY g.code;
```

## Known follow-ups (not blockers)

- Restore discipline: treat pg18/Garage backup and restore-test status as cluster-owned evidence; repeat app-level parity proof when schema or seed changes materially.
- An **"onboard power"** view should filter mission power by location/tag — the raw requisition sum includes the offboard 5090 workstation.
- `interface_types` is seeded with a demonstrative set (host-mount, serial-bus-servo, ups-bay, i2c-display); expand as real connectors are catalogued.
- Surface cutovers: before moving units, missions, wishlist, activity, insights, terminals, nets, or documents off `hangar.ts`, add a focused server read lane with validators, static fallback metadata, parity proof, and migration handling for existing DB rows. Do this before introducing DB writes.
