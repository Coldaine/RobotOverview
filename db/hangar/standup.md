---
title: Hangar DB — Master Inventory Standup
date: 2026-06-26
author: Patrick MacLyman
status: living
last_confirmed: 2026-07-31
---

# Hangar DB — Postgres-first standup

The relational backend for the Hangar: one master inventory of all gear, a claims graph
for research, and the connected model (North Star AG1).

## Corpus model

- **Claims graph.** Insights carry confidence, provenance, and source; assets/missions
  carry lifecycle statuses; research longform lives in `briefings` / `briefing_packs`
  (markdown in `body_markdown`, not in the repo).
- **Two-tier retention.** Structured facts and research bodies are DB rows. Vendor
  binaries stay in `keyArtifactstosort/` (binaries-only; awaiting Garage) —
  see `keyArtifactstosort/agents.md`.

## Status

**Normalized cutover LIVE (2026-07-31):**

- UI read path reconstructs HangarData from normalized tables
  (`getHangarSpine` → `buildHangarDataFromDb`). Loud static fallback when Postgres is
  missing or errors.
- Agents write via op-verb ingest (`POST /api/hangar/ingest`) — see [`AGENTS.md`](../../AGENTS.md).
- Datacore packs/briefings render from the `briefings` table; offline returns empty and
  pages show a **DATACORE OFFLINE** banner.
- `content_snapshots` is dropped by `migrations/2026-07-31-drop-content-snapshots.sql`
  (supersedes `2026-07-30-content-snapshots.sql`).

## Where it lives

Logical `hangar` database on CloudNativePG `pg18-core` (`data-platform`), provisioned in
`coldaine-homelab`. Role **`hangar` owns all tables**. App credentials (`HANGAR_DB_*`,
`HANGAR_INGEST_TOKEN`) via ExternalSecret / Doppler `homelab`/`dev`.

On `icarus-laptop`, do not start local containers. Use the cluster DB (LAN
`pg18-core-rw-lan` / `192.168.30.205`) with Doppler injection.

## Files

- `schema.sql` — full rebuild DDL for normalized inventory tables.
- `migrations/` — additive live migrations, including
  `2026-07-31-hangar-corpus.sql` (corpus tables) and
  `2026-07-31-drop-content-snapshots.sql` (drop legacy snapshot table).
- `gen-seed.ts` / `seed.sql` — fixture → normalized seed (CI / fresh-DB bootstrap).
- `ingest-research-corpus.ts` — replayable corpus migration; embeds the research corpus
  snapshot. Run: `npx tsx db/hangar/ingest-research-corpus.ts` with `HANGAR_DB_*`.

## App read / write path

- **Read (spine):** reconstruct from normalized tables; static fixture only on fallback.
- **Read (Datacore):** `briefings` / `briefing_packs` via `src/server/hangar/briefings.ts`.
- **Write:** op-verb ingest ([`AGENTS.md`](../../AGENTS.md)).
- **Preflight:** `GET /api/hangar/preflight`.

## Rebuild from scratch

```bash
# 1. Base schema
psql … -f db/hangar/schema.sql

# 2. Apply migrations (corpus + drop snapshot, in date order)
psql … -f db/hangar/migrations/2026-07-31-hangar-corpus.sql
psql … -f db/hangar/migrations/2026-07-31-drop-content-snapshots.sql
# (plus any earlier additive migrations not already folded into schema.sql)

# 3. Fixture → seed → apply
npx tsx db/hangar/gen-seed.ts --out db/hangar/seed.sql
psql … -f db/hangar/seed.sql

# 4. Replay research corpus into briefings
doppler run -p homelab -c dev -- npx tsx db/hangar/ingest-research-corpus.ts
```

For live DBs with data, prefer additive migrations + ingest — do not casually wipe.
