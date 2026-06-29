---
title: Data Backend — Master-Inventory Model
audience: AI agents and operators working on the Hangar data layer
status: living
last_updated: 2026-06-29
---

# Data Backend — Master-Inventory Model

> The Hangar's data spine: the static bootstrap dataset it reads today, the normalized Postgres store intended to become authoritative after seed/parity/read-cutover gates, and the cluster target it will run on.
> The live SQL lives in `db/hangar/` (`schema.sql`, `seed.sql`, `standup.md`).

## Current reality (read this first)

- **`src/data/hangar.ts` is the current runtime source and bootstrap dataset.** The browser-facing Next.js app still reads it directly today.
- The **Postgres `hangar` schema is the intended authoritative store** once the cluster DB is provisioned, seeded from `hangar.ts`, reachable through the app preflight, parity-checked, and app reads are cut over. The local standup proves shape only; it is not the production target.
- The first app read-path foundation now exists for inventory items: `GET /api/hangar/items` attempts a server-side Postgres read when structured `HANGAR_DB_*` config is present, and falls back to `src/data/hangar.ts` when it is not configured or the read fails. `HANGAR_DATABASE_URL`/`DATABASE_URL` remain compatibility paths, but the preferred contract is not a credential-bearing URL. This is the first proof lane toward Postgres authority, not the full UI cutover yet.
- The **target deployment database is not decided inside RobotOverview.** It is a logical Hangar database in `C:\_projects\coldaine-k8cluster`'s `pg18` CloudNativePG cluster (`databases/pg18.yaml` + `docs/connection-registry.md`). RobotOverview owns the app schema/migrations and app behavior; the cluster repo owns provisioning, roles/secrets, backups, and restore gates.
- This staging is intentional, per the North Star pillar **"do not prescribe before populating"**: the relational shape was designed only after there was real content to fit it to.

## The model in one paragraph

One unified **`assets`** pool holds everything owned, distinguished by `kind`/`status`/`lifecycle` enums. Flexible **`groups`** (bay / kit / location / project) layer over the pool via the `asset_groups` junction, so **bays are group-views, not silos**. The base-builder spine is typed: assets expose **`interface_types`** via `asset_interfaces`; **`sockets`** accept interface types via `socket_accepts`; an asset is a candidate for a socket when those sets intersect; and equipping is a row in **`loadout_assignments`**. Power/mass/price are typed columns so mission budgets aggregate; JSONB is reserved for display-only leaves (`specs`, `links`, etc.).

## Key design decisions

These were crystallized in a deep-interview design session (2026-06-26) and realized in `db/hangar/`. The rationale is preserved because the choices are load-bearing:

| # | Decision | Chosen | Why |
|---|---|---|---|
| 1 | Asset modeling | One `assets` table (single-table inheritance) + JSONB leaves | Kinds share most fields; the dominant query is "the whole pool"; class-table joins are not worth it at personal scale. |
| 2 | Power / mass / price | **Typed columns** | Mission budgets must `SUM`/aggregate these against `mission_constraints`. |
| 3 | Specs / links | JSONB | Heterogeneous, display-only fields. |
| 4 | Grouping | **First-class `groups`** (`bay`/`kit`/`location`/`project`) + `asset_groups` | Multi-membership, kit bundles, group metadata; bays fall out as views. |
| 5 | Socket compatibility | **Dedicated `interface_types`** taxonomy | Physical mating is typed and finite; keep it separate from loose grouping tags. |
| 6 | Typed vs tagged | kind/status/lifecycle = enums; tags = flexible | Integrity on single-valued dimensions, flexibility on multi-valued dimensions. |
| 7 | Wishlist | Fold into `assets` (`lifecycle`) + 1:1 `wishlist_meta` | Graduation = a status flip; the want list shares the one pool. |
| 8 | Insight references | **Explicit `insight_assets` / `insight_missions`** junctions | Real FK integrity instead of polymorphic-orphan risk. |

A graph database was evaluated and **rejected for now**: Postgres + junction tables + recursive CTEs cover the connected-model queries (loadout candidacy, capability dependency trees) without a second engine. If graph-specific needs emerge later, `coldaine-k8cluster` already has a separate `falkordb` target, but the Hangar master inventory currently belongs in Postgres.

## Shape (~24 tables, 7 enums)

```text
ENUMS    asset_kind · asset_status · lifecycle · group_kind(bay|kit|location|project)
         · mission_status · confidence_level · interface_kind(electrical|mechanical|power|data)

CORE     assets(id, kind, name, callsign, status, lifecycle, provenance, summary, acquired, horizon,
                 power_watts, power_volts, power_rail, mass_grams, price_us, price_import,
                 specs JSONB, links JSONB, created_at, updated_at)
         wishlist_meta(asset_id PK→assets, rationale, unlocks_capability_id→capabilities,
                 risk_note, for_asset_id→assets, for_mission_id→missions)
GROUPING tags / asset_tags ; groups / asset_groups
LOADOUT  hotspots ; sockets(host_asset_id, capacity, ...) ; interface_types
         asset_interfaces (asset exposes) ; socket_accepts (socket accepts)
         loadout_assignments(socket_id, asset_id→assets, equipped_at)
         -- candidacy ⇔ asset_interfaces ∩ socket_accepts ≠ ∅ ; equip = an assignment
MISSIONS missions ; mission_requisitions ; mission_objectives ; mission_constraints
CAPS     capabilities ; capability_deps ; asset_capabilities
KNOWLEDGE insights ; insight_assets ; insight_missions ; insight_tags ; activity_log
```

The authoritative DDL is `db/hangar/schema.sql`. This table is a map, not a substitute.

## Connected twin extension (next)

The BEAST-01 wiring/twin layer should extend this same relational spine rather than creating a separate model. Add:

- `terminals` — named ports/pins/leads/headers on an asset.
- `nets` — connections between terminals, with signal/medium and source provenance.

This sits below loadout compatibility: sockets/interfaces say what can mount; terminals/nets say what is physically wired and where that claim came from. The current direction is documented in [`connected-twin.md`](connected-twin.md). Standalone prototypes live under `docs/history/twin-prototypes/`; they are reference artifacts, not app code.

## Where it runs

There are two different “where” answers, and future work must not confuse them:

| Context | Location | Meaning |
|---|---|---|
| Local proof / development | A separate `hangar` database inside the existing local `techdeals-postgres18` container (`:54329`) | Historical/proof-only validation of `schema.sql` and `seed.sql`. Do not start local containers on `icarus-laptop`; use a remote proof host or the cluster path for new verification. Not the deployment target. |
| Target deployment | A logical `hangar` database in `coldaine-k8cluster`'s `pg18` CloudNativePG cluster (`pg18-rw.data-platform.svc.cluster.local:5432`) | The real target. Must be declared in the cluster repo, added to the connection registry, wired through Doppler/ESO, backed up, and restore-tested before the app depends on it. |

The likely cluster contract is:

```text
Logical database: hangar
Cluster: pg18
Operator: CloudNativePG
Role: hangar
Doppler password key: HANGAR_DB_PASSWORD
Owner repo: RobotOverview
App env:
  HANGAR_DB_HOST=pg18-rw.data-platform.svc.cluster.local
  HANGAR_DB_PORT=5432
  HANGAR_DB_NAME=hangar
  HANGAR_DB_USER=hangar
  HANGAR_DB_SSLMODE=require
  HANGAR_DB_PASSWORD=<runtime credential, from Doppler/ESO in phase 1>
```

Do **not** create a new Postgres server for Hangar. Per `coldaine-k8cluster`, current app databases are logical databases inside `pg18`; `pg19` is future/PG19-specific and not for irreplaceable data yet; `falkordb` is for graph data.

`HANGAR_DB_HOST`, port, database name, role, and SSL mode are configuration, not secrets. Only the runtime credential carries authority. The app helper currently accepts `HANGAR_DB_SSLMODE=disable` or `require`; `require` encrypts without verifying the self-signed CNPG certificate chain, matching libpq `sslmode=require`. Future certificate-verified modes should add the real certificate/trust-bundle config instead of being treated as a generic on/off switch. Longer-term, that credential should become workload-identity backed (client certificate, Vault lease, or proxy-issued token) rather than a durable password; the app-side contract can stay structured either way.

## App read path foundation

The current server boundary is intentionally small:

- `src/server/hangar/db.ts` lazily creates a `pg` pool only after a request asks for DB-backed data. It prefers a structured `HANGAR_DB_*` connection object and keeps `HANGAR_DATABASE_URL`/`DATABASE_URL` only for compatibility.
- `src/server/hangar/items.ts` maps the normalized `assets`/`groups`/`tags` shape back into the existing `InventoryItem` read model.
- `src/app/api/hangar/items/route.ts` exposes a read-only smoke-test route with `{ source, fallbackReason, count, items }`.
- `src/app/api/hangar/preflight/route.ts` exposes the no-fallback DB reachability gate. `GET /api/hangar/preflight` returns HTTP `200` only when the configured Hangar Postgres endpoint answers `SELECT 1`; otherwise it returns HTTP `503` with `not-configured`, `config-error`, or `unreachable`.
- `src/app/layout.tsx` reads inventory items through the same server path at request time and passes
  them into the client store, so the browser-facing Items station can use Postgres-backed data while
  retaining the static fallback if the DB is unavailable.

This keeps `next build` safe without database secrets, gives the deployment path a simple verification target, and separates "can reach Postgres" from "can fall back to static data." Inventory items are the first browser-facing read cutover; broader Hangar data still comes from `hangar.ts` until each surface has its own seed/parity/rollback proof.

## How it's seeded

`db/hangar/gen-seed.ts` transforms `src/data/hangar.ts` → `db/hangar/seed.sql` with defensive reference-filtering (no junction row can violate an FK). The committed `seed.sql` rebuilds the DB from `psql` alone. **`seed.sql` is generated — regenerate it whenever `hangar.ts` changes** rather than hand-editing.

## Deferred (by design)

- **Cluster restore gate**: Hangar is now a `pg18` logical database with schema/seed loaded; restore testing remains the production authority gate.
- **Broader app / ORM wiring**: the first direct `pg` read path exists, but an ORM choice remains deferred. If Drizzle is introduced, its schema must map to `db/hangar/schema.sql`, and the server-side data-access pattern is described in [`web-app.md`](web-app.md).
- **Retiring `hangar.ts`** as the runtime source — only after every Hangar surface has moved through seed/parity/read-cutover gates and rollback is understood. Inventory items are only the first read surface.
