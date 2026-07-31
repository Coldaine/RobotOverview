---
title: Deployment — verified facts
last_verified: 2026-07-30
---

# Deployment — verified facts

Everything below was verified against the live cluster (`admin@homelab-target`) and
`coldaine-homelab` on 2026-07-30. Normalized cutover landed 2026-07-31 (reconstruction
read path, op-verb ingest, briefings in DB). When this page and reality disagree, reality
wins — check live state (`kubectl`, `curl`) before building on anything here.

**This repo** owns the Hangar app code, `Dockerfile`, and content tooling.
**[`coldaine-homelab`](https://github.com/Coldaine/coldaine-homelab)** owns runtime
manifests, secrets (via Doppler/ESO), Gateway listeners, and Flux reconciliation.

## What runs today

- **Workload:** Deployment `hangar` in namespace `hangar` (Flux `target-apps` →
  `infra/k8s/apps/hangar/`). Image `ghcr.io/coldaine/robot-overview:latest` with
  `imagePullPolicy: Always` (Soil-style interim; digest pin is a follow-up).
- **Database:** Logical DB `hangar` on CloudNativePG `pg18-core` (`data-platform`).
  App env from Secret `hangar-runtime-secrets` (`HANGAR_DB_*`, `HANGAR_INGEST_TOKEN`).
  Readiness probe is `GET /api/hangar/preflight` — a Ready pod means Postgres is reachable.
- **UI spine:** Reconstructs HangarData from normalized tables at request time
  (`getHangarSpine` → `buildHangarDataFromDb`). Agents write via op-verb
  `POST /api/hangar/ingest` (Bearer `HANGAR_INGEST_TOKEN`) — verb table in
  [`AGENTS.md`](../AGENTS.md). Static `hangar.ts` is the offline/fixture fallback only
  (loudly indicated in the Shell when used).
- **Datacore:** Packs/briefings read from the `briefings` table. When Postgres is
  unavailable, briefings return empty and pages show a **DATACORE OFFLINE** banner.
- **Build:** GitHub Actions (`.github/workflows/image.yml`) builds and publishes to GHCR
  on `main` (and PR proof tags). Shipwright is installed on the cluster but is not the
  Hangar image path today.
- **Route:** HTTPRoute `hangar` → hostname `hangar.moosegoose.xyz` on Gateway
  `platform-gateway` listener `https-hangar` (TLS via cert-manager DNS-01). LAN path:
  Gateway VIP `192.168.30.201` (verify with
  `curl --resolve hangar.moosegoose.xyz:443:192.168.30.201 https://hangar.moosegoose.xyz/api/hangar/preflight`).
  Public Cloudflare tunnel ingress is dashboard-managed; confirm the hostname still points
  at the platform Gateway if WAN access times out.

## Shipping a change

1. Merge app code to `RobotOverview` `main` → GHA publishes a new GHCR image.
2. With `:latest` + `Always`, restart/roll the Deployment if the node cached an old pull:
   `kubectl -n hangar rollout restart deploy/hangar`.
3. For digest-pinned deploys (future): bump the image ref in
   `coldaine-homelab/infra/k8s/apps/hangar/deployment.yaml` and merge so Flux reconciles.
4. Verify: `GET https://hangar.moosegoose.xyz/api/hangar/preflight` and Shell DATA lamp = PG.

## Agent ingest

Op-verb API (`{ "op", "input" }`); auth, shapes, and errors in [`AGENTS.md`](../AGENTS.md).
Token: Doppler `homelab`/`dev` → `HANGAR_INGEST_TOKEN`.

## Fresh-environment bootstrap

See also [`db/hangar/standup.md`](../db/hangar/standup.md).

```bash
# schema + migrations (corpus and snapshot-drop — paths in standup.md)
psql … -f db/hangar/schema.sql
# then apply db/hangar/migrations/* in date order (see standup.md)

# Fixture → seed → apply
npx tsx db/hangar/gen-seed.ts --out db/hangar/seed.sql
psql … -f db/hangar/seed.sql

# Replay research corpus into briefings
doppler run -p homelab -c dev -- npx tsx db/hangar/ingest-research-corpus.ts
```

## Known gaps

- Datacore library store (`DATACORE_LIBRARY_URL` / Garage) is not wired — library "Open"
  links stay offline by design until the bucket exists.
- Digest pinning in Git (instead of `:latest`) is deferred.
- Shipwright `Build` for Hangar is optional future work; not required for production today.
