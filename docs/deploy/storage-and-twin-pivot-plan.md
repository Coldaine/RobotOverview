---
title: Storage + Twin Pivot Plan
date: 2026-06-28
author: Patrick MacLyman (drafted with assistant)
status: proposal
---

# Storage + Twin Pivot Plan

## Why pivot

The Beast research and the wiring-twin work landed in the wrong shape: ~75 MB of binaries at the app-repo root (not gitignored, not dockerignored), a `docs/twin/` silo outside the `AGENTS.md` decision tree, and standalone HTML previews instead of app code. The correct shape separates concerns by lifecycle: app code and data in `RobotOverview`, storage and infra in `coldaine-k8cluster`, bulk binaries in object storage, all sitting on a hardware fabric. This plan realigns everything we discussed into that shape.

## Target architecture: where each thing lives

| Concern | Home | Notes |
|---|---|---|
| Hangar app + the wiring view UI | `RobotOverview/src` | React/Next; reads from DB/API, not from binaries |
| Twin data model (assets / terminals / nets) | `RobotOverview/src/data` + Postgres schema | data-is-truth; documented in `docs/components/data-backend.md` |
| Hangar knowledge (Beast wiring, Orin path, storage decisions) | `RobotOverview/docs` (`beast-ops.md`, `deploy/`) | fold out of the `docs/twin/` silo; register in `AGENTS.md` + `architecture.md` |
| Bulk source files (PDF/CAD/zips) | Object-storage bucket, referenced by URL from Postgres | never git, never the image |
| Object-storage service (S3/RGW) | `coldaine-k8cluster` | currently absent; must be added |
| Hangar Postgres | `coldaine-k8cluster` | reuse the existing DB provisioning you already have |
| Storage/infra research notes | `coldaine-k8cluster/docs` | persist once I have repo access |
| Hardware fabric | 3-node TB4-mesh mini PCs, hyperconverged Proxmox/Talos + Ceph | RBD backs PVCs/Postgres; RGW serves buckets |

## Confirmed from this thread

- The cluster currently stands up **no S3/R2-compatible object storage**; it must be added for the hangar's documents.
- Postgres / database backing **is** already provisioned (to verify in-repo), so the hangar DB reuses that pattern rather than inventing one.
- Object storage is S3-compatible end to end, so app code is identical whether the bucket is an interim Garage/R2 today or Ceph RGW later. Storage choice never blocks app work.

## Workstreams and sequencing

### Phase 0 — App repo, doable now (no hardware)
1. Stop the bleeding: add `UGV-Beast-Archive/` to `.gitignore` and `.dockerignore`.
2. Realign docs into their real homes; retire `docs/twin/`; register in `AGENTS.md` + `architecture.md`.
3. Build the storage abstraction: an S3 client plus a `sources`/`assets` reference scheme that reads endpoint and credentials from env, so the app is storage-agnostic.
4. Land the twin data model (`Terminal`/`Net` types + `beast.nets.json`) and convert `WiringDiagram.tsx` from hardcoded paths to data-driven nets.

### Phase 1 — Infra repo (needs `coldaine-k8cluster` access)
1. Verify state: confirm no object storage, confirm the Postgres provisioning, and write the findings + storage research as notes in the k8s repo.
2. Stand up the hangar Postgres (reuse existing pattern) and apply the master-inventory schema + `terminals`/`nets`.
3. Stand up an S3 endpoint. Interim (pre-hardware): a lightweight single-node Garage/SeaweedFS, or R2 as a stopgap, so the hangar is not blocked on the cluster build. Long-term: Ceph RGW.

### Phase 2 — Hardware fabric
1. Acquire 3 identical mini PCs (dual TB4/USB4, 2+ M.2, 64 GB), wire the TB4 mesh, OS on one NVMe and a dedicated OSD NVMe on each.
2. Stand up Proxmox/Talos + Ceph (Rook or Proxmox-Ceph). Pools: replicated size 3 for RBD/Postgres; replicated or EC for the document bucket via RGW.
3. Decide 3 vs 4 nodes (4 gives Ceph self-heal headroom).

### Phase 3 — Migration and cutover
1. Upload the archive binaries to the bucket; write reference rows in Postgres; repoint each twin `net.source_doc` to a bucket URL; delete the in-repo archive.
2. Point the hangar Postgres onto Ceph RBD; move the bucket onto RGW; flip the app's S3 endpoint (a config change only, thanks to Phase 0).
3. Wire Drizzle to Postgres (the deferred ORM step); the app reads the DB instead of `hangar.ts`.

## Per-repo ownership (the boundary)

- `RobotOverview` owns what the hangar **is**: app, data model, wiring UI, knowledge docs. It references storage by URL and env, never embeds it.
- `coldaine-k8cluster` owns how it **runs**: Postgres, object storage, deployments, and the storage research notes.
- The hardware fabric is the Ceph layer underneath both.

## Open decisions

- Interim object storage before the cluster exists: Garage/SeaweedFS on an existing node, or R2 as a stopgap. App code is identical either way.
- Target node count: 3 (size 3, no self-heal headroom during a node loss) vs 4 (Ceph can self-heal).
- Bucket pool encoding: replication (simpler, better for small/random) vs EC (more usable space, better for large write-once objects).

## Immediate next steps

1. With your OK, gitignore + dockerignore the archive in `RobotOverview` now (no-regret safety fix).
2. Grant access to `coldaine-k8cluster` (mount the folder, or enable the GitHub connector) so I can verify the S3/Postgres state and drop the storage notes there.
3. I land the Phase 0 app changes on a branch for your review.
