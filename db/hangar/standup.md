---
title: Hangar DB — Master Inventory Standup
date: 2026-06-26
author: Patrick MacLyman
status: living
last_confirmed: 2026-07-30
---

# Hangar DB — Postgres-first standup

The relational backend for the Hangar: **one master inventory of all gear**, with bays as
first-class group rows, a video-game loadout, and the connected model (North Star AG1).

> **Status (2026-07-30):** Postgres-first cutover is live for the **UI spine**. Canonical
> HangarData lives in `content_snapshots` (`id=hangar`) on the `hangar` logical database in
> `pg18-core` (`coldaine-homelab` / `data-platform`). The Hangar Deployment reads that
> snapshot at request time. Agents write via `POST /api/hangar/ingest` (Bearer
> `HANGAR_INGEST_TOKEN`). `src/data/hangar.ts` remains the fixture / offline fallback and
> bootstrap source for `npm run hangar:seed-spine`. Normalized tables (`assets`, `missions`,
> …) still exist for inventory SQL and historical seed; keep them in sync via migrations
> when shapes change. Cluster runtime ownership: **`coldaine-homelab`**, not
> `coldaine-k8cluster`.

## Where it lives

### Target deployment

Logical `hangar` database inside CloudNativePG `pg18-core` (namespace `data-platform`),
provisioned in `coldaine-homelab` (`infra/k8s/platform/data-platform/`). App credentials:
`HANGAR_DB_*` + `HANGAR_INGEST_TOKEN` via ExternalSecret `hangar-runtime-secrets` in
namespace `hangar` (Doppler `homelab`/`dev`).

### Proof / development

On `icarus-laptop`, do **not** start local containers. Use the cluster DB (LAN
`pg18-core-rw-lan` / `192.168.30.205`) or another approved remote proof host with Doppler
injection.

## Files

- `schema.sql` — full rebuild DDL for normalized inventory tables.
- `migrations/` — additive live migrations (including `2026-07-30-content-snapshots.sql`).
- `gen-seed.ts` / `seed.sql` — normalized seed from the TypeScript fixture (legacy /
  inventory proof path).
- `seed-spine.ts` — writes the HangarData JSON snapshot into `content_snapshots`.

## App read / write path

- **Read:** `getHangarSpine()` (`src/server/hangar/spine.ts`) via Drizzle →
  `content_snapshots`. Layout injects into `HangarProvider`. Loud static fallback when
  missing/unreachable.
- **Write:** `POST /api/hangar/ingest` → upsert entity into the snapshot.
- **Preflight:** `GET /api/hangar/preflight` (DB reachability; readiness probe).
- Inventory SQL lane (`src/server/hangar/items.ts`) remains available for normalized
  reads; the primary UI lamp is the spine snapshot.

## Rebuild / bootstrap

```bash
# DDL (as a role that can create; then ensure hangar owns content_snapshots)
psql … -f db/hangar/schema.sql
psql … -f db/hangar/migrations/2026-07-30-content-snapshots.sql

# Push fixture → snapshot
doppler run -p homelab -c dev -- npm run hangar:seed-spine
```

For live DBs with data, prefer additive migrations + ingest — do not casually wipe
`content_snapshots`.
