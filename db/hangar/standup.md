---
title: Hangar DB — Master Inventory Standup
date: 2026-06-26
author: Patrick MacLyman
status: living
last_confirmed: 2026-06-29
---

# Hangar DB — master-inventory Postgres standup

The relational backend for the Hangar: **one master inventory of all gear**, with bays as first-class group rows, a video-game loadout, and the connected model (North Star AG1) preserved. Design provenance: `.omc/specs/deep-interview-hangar-master-inventory.md` (deep-interview session, 2026-06-26), which itself recovered + reconciled the deleted `docs/plans/postgres_schema.md`.

> **Status:** DB shape stood up + seeded + verified locally. App/ORM (Drizzle) wiring is **deferred** — the Next.js app still reads `src/data/hangar.ts` at runtime. The target deployment is a logical `hangar` database in `coldaine-k8cluster`'s `pg18` CloudNativePG cluster, not the local proof container.

## Where it lives

### Local proof / development

- **Instance:** the existing local `techdeals-postgres18` container (Postgres 18, host `:54329`).
- **Database:** `hangar` — a separate database in that instance. TechdealsHandoff data (`market_*`, `techdeals_work*`, `legacy_supabase`) is untouched.
- **Creds (dev):** `techdeals` / `techdeals`.

This local database proves the schema and seed shape. It is not the production target.

### Target deployment

The target database belongs to `C:\_projects\coldaine-k8cluster`: a logical `hangar` database inside the `pg18` CloudNativePG cluster. Provisioning is cluster-repo work (`databases/pg18.yaml` plus `docs/connection-registry.md`), with a `hangar` role, Doppler/ESO-managed password, `DATABASE_URL` for the app, and restore-tested backups before cutover.

Do not stand up a RobotOverview-owned Postgres server for Hangar; add a logical DB to `pg18`.

## Files

- `schema.sql` — the DDL (24 tables, 7 enums). The source of truth for the shape.
- `gen-seed.ts` — transforms `src/data/hangar.ts` → seed SQL (defensive: junctions filtered to resolvable refs).
- `seed.sql` — generated output (committed so the DB rebuilds with `psql` alone).

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

Cluster deployment is different: reserve the logical DB/role in `coldaine-k8cluster`, obtain `DATABASE_URL` via Doppler/ESO, apply migrations/schema there, restore-test backups, then wire the app.

## Schema in one breath

- **`assets`** — every possession in one table (single-table inheritance); `kind` discriminator; typed `power_*`/`mass_grams`/`price_*` columns (queryable for budgets); JSONB only for display-only leaves (`specs`/`links`/`limitations`/`sources`). Wishlist folds in via `lifecycle='wishlist'` + a 1:1 `wishlist_meta`.
- **Grouping** — `tags`/`asset_tags` (flexible, namespaced: `tag`/`class`/`category`) and first-class **`groups`/`asset_groups`** (`bay`|`kit`|`location`|`project`). Bays are **rows in `groups` with `kind='bay'`** — not SQL views.
- **Loadout** — `sockets` on a host, `interface_types` taxonomy, `socket_accepts` + `asset_interfaces` ⇒ candidacy, `loadout_assignments` ⇒ what's equipped with the proven compatible `interface_type_id`.
- **`missions` · `capabilities` · `insights` · `activity_log`** — explicit junctions (`mission_requisitions`, `asset_capabilities`, `insight_assets`/`insight_missions`, …).

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

- Cluster reservation: add the `hangar` logical DB/role/registry entry in `coldaine-k8cluster`.
- An **"onboard power"** view should filter mission power by location/tag — the raw requisition sum includes the offboard 5090 workstation.
- `interface_types` is seeded with a demonstrative set (host-mount, serial-bus-servo, ups-bay, i2c-display); expand as real connectors are catalogued.
- App migration: define these tables in Drizzle and point the Next.js server/data layer at the DB.
