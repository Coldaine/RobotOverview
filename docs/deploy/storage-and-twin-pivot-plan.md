---
title: Storage + Twin Pivot Plan
date: 2026-06-28
author: Patrick MacLyman (drafted with assistant)
status: proposal
last_updated: 2026-06-29
---

# Storage + Twin Pivot Plan

## Why pivot

The Beast research and the wiring-twin work initially landed in the wrong shape: bulk binaries at the app-repo root, a `docs/twin/` silo outside the decision tree, and standalone HTML previews instead of app-integrated code. The correct shape separates concerns by lifecycle: app code and data model in `RobotOverview`, runtime infrastructure in `coldaine-k8cluster`, bulk source binaries in object storage, and the physical hardware fabric underneath.

## Target architecture: where each thing lives

| Concern | Home | Notes |
|---|---|---|
| Hangar app + wiring view UI | `RobotOverview/src` | React/Next; reads from app data layer/DB, not from local binaries. |
| Master inventory schema | `RobotOverview/db/hangar` | `schema.sql`, generated seed, future migrations/ORM mapping. |
| Twin data model | RobotOverview schema + seed inputs | Assets/sockets/interfaces now; terminals/nets/source refs next. |
| Hangar docs/knowledge | `RobotOverview/docs` | Beast ops, connected twin, source archive digest, storage plan. |
| Bulk source files (PDF/CAD/ZIP/firmware/wiki captures) | S3-compatible object bucket | Never git, never Docker image; DB stores metadata + object keys/URLs. |
| Hangar Postgres target | `coldaine-k8cluster` `pg18` | Logical `hangar` database in the CloudNativePG `pg18` cluster; not a new server. |
| Object-storage service | `coldaine-k8cluster` | Garage is the declared in-cluster S3 service for DB backups and light app object storage; Hangar still needs an explicit per-app bucket/key/offsite decision. |
| Deployment | `coldaine-k8cluster/apps` + `builds` | App service, image build, secrets, and route live in cluster repo once ready. |

## Confirmed from `coldaine-k8cluster`

- The target database set is already enumerated:
  - `pg18`: PostgreSQL 18, CloudNativePG, all-extension image, current logical DBs.
  - `pg19`: PostgreSQL 19, CloudNativePG, future/empty/PG19-specific; not for irreplaceable data yet.
  - `falkordb`: graph database, KubeBlocks.
- Hangar should target `pg18` as a logical database (`hangar`) with a role (`hangar`) and structured app config (`HANGAR_DB_*`). In phase 1, only the runtime credential (`HANGAR_DB_PASSWORD`) should come from Doppler/ESO; longer-term auth can move to client certs, Vault leases, or a proxy-issued token without changing the address contract.
- `coldaine-k8cluster` declares **Garage** for in-cluster S3: database backups plus light app object storage. Do not assume the default `kubeblocks-backups` bucket is the Hangar document bucket; choose a Hangar source-document bucket/key/policy deliberately.
- App code should use an S3-compatible abstraction so the archive can move from interim storage to the final object-store path without changing the data model.

## Workstreams and sequencing

### Phase 0 — App repo, doable now

1. Keep `UGV-Beast-Archive/` ignored in `.gitignore` and `.dockerignore`.
2. Keep the DB schema/seed in `db/hangar/` and document that local standup is proof-of-shape only.
3. Register the connected-twin direction in `docs/components/connected-twin.md` and the data-backend docs.
4. Preserve source-archive knowledge as a digest/reference doc, not as committed binaries.
5. When implementing code, add `Terminal`/`Net` types + seed inputs and convert `WiringDiagram.tsx` from hardcoded paths to data-driven nets.

### Phase 1 — Cluster contract

In `C:\_projects\coldaine-k8cluster`:

1. Add Hangar to the database contract:
   - CNPG `Database` in `databases/pg18.yaml`.
   - `hangar` role and structured connection contract.
   - `docs/connection-registry.md` row.
   - Doppler key, likely `HANGAR_DB_PASSWORD`.
2. Decide source-document object storage:
   - same Garage service with a separate Hangar bucket/key/policy,
   - separate Garage instance only if the shared service is not appropriate,
   - or R2/offsite first.
3. Record the bucket contract: bucket name, app role/secret names, access pattern, retention/offsite stance.
4. Restore-test the DB backup path before any app depends on the cluster DB.

### Phase 2 — Schema/app cutover

1. Apply the Hangar schema to the cluster `pg18` logical DB.
2. Load seed data generated from `src/data/hangar.ts`.
3. Wire the Next.js server layer/ORM to structured `HANGAR_DB_*` config while keeping rollback to `hangar.ts` clear.
4. Prove representative reads and app pages from the DB.
5. Only then retire `hangar.ts` as runtime source.

### Phase 3 — Source-backed connected twin

1. Upload curated source archive binaries to the chosen object bucket.
2. Add source-document metadata rows and link specs/nets to source documents.
3. Add `terminals` and `nets` schema/seed.
4. Build the in-app wiring/board dossier view using the existing Hangar shell, store, theme system, and loadout compatibility.

## Per-repo ownership

- `RobotOverview` owns what the Hangar **is**: app, schema, data model, wiring UI, and knowledge docs.
- `coldaine-k8cluster` owns how it **runs**: logical DB provisioning, app deployment, secrets, object storage, backups, and restore gates.
- Bulk source archives are data, not source code: store them in object storage and reference them from the DB/app.

## Open decisions

- Exact logical database name: likely `hangar`.
- Exact role and Doppler key: likely `hangar` / `HANGAR_DB_PASSWORD`.
- Whether the source-document bucket is a separate Garage bucket/key/policy, or uses R2/offsite first.
- Whether source archive objects need offsite durability before being considered safe.
- Whether/when any Hangar relationship data belongs in `falkordb`; default is no, Postgres first.
