# Deployment — verified facts

Everything below was verified against the live cluster and `coldaine-k8cluster` origin/main
on 2026-07-07. When this page and reality disagree, reality wins — check live state
(`kubectl`, `curl`) before building on anything here. This repo owns the app code, the
`Dockerfile`, and its content; `coldaine-k8cluster` owns every runtime manifest, secret,
build definition, and database provision.

## What runs today

- **Workload:** Deployment `robot-overview` in namespace `apps`, running and Ready.
  Image pinned by `@sha256` digest. Env from Secret `hangar-env`
  (`HANGAR_DB_HOST/PORT/NAME/USER/PASSWORD/SSLMODE` → the shared `pg18` CloudNativePG cluster).
  Readiness probe is `GET /api/hangar/preflight`, which requires DB reachability — a Ready pod
  means the app is talking to Postgres.
- **Build:** Shipwright `Build` `robot-overview` in namespace `builds` (buildkit strategy)
  builds this repo's `main` from GitHub and pushes `ghcr.io/coldaine/robot-overview` with the
  `ghcr-push` secret. GitHub Actions (`.github/workflows/image.yml`) also builds images for
  main pushes and PRs, and publishes same-repo refs to GHCR for CI/package proof; production still
  deploys the Shipwright-built digest pinned in `coldaine-k8cluster`.
- **Route:** HTTPRoute `robot-overview` (namespace `apps`) attaches hostname
  `hangar.moosegoose.xyz` to the shared Gateway `main`; the route is Accepted and has
  ResolvedRefs. DNS resolves the hostname to the Gateway/LAN path, and
  `GET /api/hangar/preflight` returns OK through the Gateway. Public egress is via
  `cloudflared` (token-managed tunnel — hostname mappings live in the Cloudflare Zero
  Trust dashboard, not in cluster manifests).

## Known gaps (as of 2026-07-07)

- **Gateway TLS is still using the cluster self-signed path.** The route and preflight are
  healthy, but normal clients may reject `https://hangar.moosegoose.xyz` unless that trust path
  is accepted or replaced with a public/managed certificate.
- **The apex `moosegoose.xyz` is currently served by a legacy Vercel deployment**, not the
  cluster. Irrelevant to the Hangar — the subdomain does not depend on it.
- **No automatic cluster rollout.** The cluster model is deliberate apply (no GitOps reconciler;
  Argo CD and Flux are gone). A GitHub push may build/publish an image, but shipping new code to
  production = trigger a BuildRun, pin the new Shipwright digest in
  `coldaine-k8cluster/apps/robot-overview/deployment.yaml`, apply. Any future push-triggered
  pipeline must still end in an explicit digest pin plus deliberate cluster apply.
- **Hardware archive host is not stood up yet.** The Datacore Hardware Library
  (`docs/hardware-library.md`) resolves CAD/schematic/datasheet files from
  `NEXT_PUBLIC_ARCHIVE_BASE_URL`. The intended host is `rclone serve` (WebDAV/HTTP/S3) over the
  Google Drive copy of `UGV-Beast-Archive/`, exposed read-only through the Cloudflare tunnel.
  Until that endpoint exists and the env var is set, the library is browsable but "Open" links
  show "archive offline" — by design, never broken. The env var and rclone/tunnel wiring are
  cluster-owned (`coldaine-k8cluster`); the app only reads the base URL.

## Deploying by hand

From a machine with the operator kubeconfig:

```powershell
kubectl create -n builds -f - # a BuildRun referencing Build/robot-overview
# wait for completion, note the pushed digest, then in coldaine-k8cluster:
# edit apps/robot-overview/deployment.yaml to the new @sha256 digest
kubectl apply -f apps/robot-overview/deployment.yaml
kubectl rollout status -n apps deploy/robot-overview
```

Never use a floating tag with `imagePullPolicy: IfNotPresent` — the node caches the first
image forever. Always pin the digest.

## Content and data deploys

`src/data/hangar.ts` (and everything else agents ingest into this repo) is baked into the
image at build time for static or not-yet-cutover surfaces. For Postgres-backed lanes,
authored content reaches production only after the matching seed, migration, or data load is
applied to the target database as well. If a change alters what is stored in Postgres, the
change must include a migration that handles data already in the database — never assume the
DB is empty or disposable.
