---
title: RobotOverview Auto-Deploy Pipeline (SUPERSEDED)
audience: historical — AI agents and operators working on RobotOverview or coldaine-k8cluster
status: superseded
superseded_by: docs/deploy.md
last_updated: 2026-06-18
archived: 2026-06-26
---

# RobotOverview Auto-Deploy Pipeline

> **⚠️ SUPERSEDED — historical record only.** The deployment mechanism described here
> (GitHub Actions build → write digest to the GitOps repo → Argo CD reconcile) is **no longer the
> plan.** See
> [`docs/deploy.md`](../deploy.md) for current verified deployment facts. This document is
> kept for the design reasoning (pull-based, immutable digest pin, no inbound path) that may inform
> the new pipeline. It was never fully activated — the GitOps App secrets were never configured.

Original intent, now superseded: this described how the app was expected to ship to the cluster,
why that design was chosen, and how it would be operated. Historical product/service boundary
context lives in [Hangar Service Boundary](deploy/hangar-service-boundary.md).

## 1. What it is

A **pull-based, hands-off continuous deployment** pipeline. Every merge to `main` in the
**RobotOverview** app repo results in the new version running on the **`bee-mini`** single-node k3s
cluster, with **no human step** — no manual `docker push`, no `kubectl apply`, no PR to merge on the
cluster side.

It uses the **CI-writes-to-GitOps** pattern: the app's CI builds the image, then writes the new
image reference into the GitOps repo (`Coldaine/coldaine-k8cluster`), and **Argo CD** (already
running in the cluster) reconciles git → cluster.

Two repos are involved:
- **`Coldaine/RobotOverview`** (this repo) — the Next.js app + the CI that builds and deploys it.
- **`Coldaine/coldaine-k8cluster`** — the GitOps repo Argo CD watches; the cluster's desired state.

Historical state, as last checked on 2026-06-25:

- Image builds on RobotOverview `main` are succeeding.
- The GitOps write-back job is still skipping its real work when the GitHub App secrets are not
  configured.
- `coldaine-k8cluster` is still pinned to the older
  `ghcr.io/coldaine/robot-overview:sha-18930f680aca8d5f3b7d5397eb6899f7400011bf` image.
- The Cloudflare hostname for `hangar.moosegoose.xyz` is not represented as finished GitOps config.
- Live cluster health still needs to be verified with `kubectl get application robot-overview -n
  argocd`, pod status, service response, and the public/protected URL.

## 2. End-to-end flow

```
merge PR → main (RobotOverview)
  └─ GitHub Actions: .github/workflows/image.yml
       job "image":
         1. docker build (Next.js standalone, Dockerfile)
         2. push → ghcr.io/coldaine/robot-overview:sha-<commit>  (+ :0.1.0)   [public package]
         3. expose the pushed image @sha256 digest as a job output
       job "update-k8cluster" (only on push to main):
         4. mint a short-lived GitHub App token (scoped to coldaine-k8cluster, contents:write)
         5. checkout coldaine-k8cluster@main (persist-credentials:false)
         6. yq -> pin apps/robot-overview/deployment.yaml image to ghcr.io/...@sha256:<digest>
         7. commit directly to main as "robot-overview-delivery-bot" ([skip ci]); push (rebase-retry)
  └─ Argo CD in bee-mini polls coldaine-k8cluster@main (~every 3 min; no inbound path)
       8. detects the manifest diff → the robot-overview Application (automated + selfHeal) syncs
       9. Deployment rolls to the new digest → new pod pulls the image → live
```

Latency from merge to live: image build (~1–2 min) + Argo git poll (default `timeout.reconciliation`
= 120s + up to 60s jitter, i.e. **≤ ~3 min**) ≈ **under ~5 minutes**. (The pipeline only *commits*;
it never runs an explicit `argocd app sync` — combining that with auto-sync is the documented
race-condition footgun, which we avoid.)

## 3. Why it's built this way

- **Pull-based, no inbound path to the cluster.** CI never reaches into `bee-mini`. The cluster only
  ever *pulls* from git (read-only deploy key) and *pulls* images from GHCR. This preserves the
  cluster's security posture — there is no open ingress for deploys and we do not add one.
- **`argocd-image-updater` was deliberately rejected** (documented in `coldaine-k8cluster`
  `docs/decisions.md` / `docs/app-delivery.md`). The **decisive, still-current** reason: it only
  supports Kustomize/Helm apps and **does not support plain-YAML / Directory apps** — which
  robot-overview is (verified against its README + open issue #460, June 2026). Secondary: it needs a
  separate write-capable git credential (Argo's deploy key is read-only). (Note: it has since reached
  a stable v1.x line — v1.2.1, May 2026 — though its maintainers still caveat against *critical*
  production use; so don't argue the rejection on "pre-1.0/not-prod-ready" grounds — argue it on the
  plain-YAML limitation, which is what actually applies here.) **Do not propose or install it.**
- **Flux image-automation was rejected** too: it would mean running a second GitOps engine next to
  Argo on a single node. Overkill.
- **CI-writes-to-GitOps is the canonical Argo CD CI flow** (per Argo's own docs) and the lowest
  surface area: zero in-cluster components, works identically for plain-YAML + Kustomize, fails
  loudly in an Actions log instead of silently.
- **Immutable `@sha256` digest pin.** Argo reconciles git *text*; a mutable tag (`:0.1.0`) never
  changes the manifest, so Argo never redeploys, and `imagePullPolicy: IfNotPresent` caches the
  first image on the node forever. A unique digest changes the manifest every release → guaranteed
  rollout, and captures the exact bits (reproducible, rollback = `git revert`).
- **GitHub App token, not a PAT.** Short-lived (~1h), bot-identity, scoped to only the GitOps repo
  with only `contents:write`. Lives as Actions secrets in the *app* repo, never in the cluster (the
  cluster keeps only its two hand-seeded bootstrap creds).

## 4. The moving parts (files)

| File | Repo | Role |
|---|---|---|
| `.github/workflows/image.yml` | RobotOverview | builds the image and writes the digest to the GitOps repo (the `update-k8cluster` job). All actions SHA-pinned. |
| `Dockerfile` | RobotOverview | 3-stage `node:24-alpine` Next.js **standalone** build, non-root, `HEALTHCHECK`. |
| `next.config.ts` | RobotOverview | `output: "standalone"`. |
| `apps/robot-overview/deployment.yaml` | coldaine-k8cluster | the Deployment + Service; its `image:` line is what CI rewrites. |
| `apps/robot-overview/kustomization.yaml` | coldaine-k8cluster | plain resource list (namespace + deployment). |
| `clusters/bee-mini/robot-overview.app.yaml` | coldaine-k8cluster | the Argo `Application` (`automated`, `selfHeal: true`, `prune: false`, sync-wave 2). |

## 5. One-time setup (required for auto-deploy to activate)

Until these exist, the `update-k8cluster` job **no-ops gracefully** (it checks `APP_READY` =
both secrets present). This is intentional so the workflow never hard-fails before setup.

1. **Create a GitHub App** (personal/org), Repository permission **Contents: Read and write** (only),
   installed on **only** `Coldaine/coldaine-k8cluster`.
2. Add these **repo secrets to RobotOverview**:
   - `GITOPS_APP_CLIENT_ID` — the App's **Client ID** (the workflow uses `create-github-app-token@v3`,
     which deprecated the older `app-id` input in favor of `client-id`)
   - `GITOPS_APP_KEY` — the App's PEM private key (full contents)
   - (Remove the old `K8CLUSTER_REPO_TOKEN` PAT — no longer used.)
3. **Allow the delivery bot to push to `coldaine-k8cluster` `main`** — add the App to the branch
   protection bypass/allowlist (direct push, no PR). The cluster repo's docs already require this.

This setup happens in GitHub, not in Argo. Argo only watches the GitOps repo and reconciles what it
finds there. The GitHub App is the narrow credential that lets RobotOverview CI update the one image
reference Argo later applies.

## 6. How to monitor it

- **Did the build + write-back run?** RobotOverview → Actions → "Build RobotOverview image" run for
  the merge commit. The `update-k8cluster` job log shows the digest it pinned (or the no-op notice if
  the App isn't configured).
- **Did the digest land in git?** `coldaine-k8cluster` `main` history — look for
  `chore(robot-overview): deploy <sha> [skip ci]` by `robot-overview-delivery-bot`, and confirm the
  `image:` line in `apps/robot-overview/deployment.yaml` is `...@sha256:<digest>`.
- **Did Argo sync?** `kubectl get application robot-overview -n argocd` → expect `Synced / Healthy`.
  (argocd CLI is not installed; use kubectl. Cluster access is via the kubeconfig pointing at
  `bee-mini`'s API.)
- **Is the new pod running the new digest?**
  `kubectl -n robot-overview get pods` (expect `1/1 Running`) and
  `kubectl -n robot-overview get deploy robot-overview -o jsonpath='{.spec.template.spec.containers[0].image}'`.
- **Is it serving?** In-cluster: `http://robot-overview.robot-overview.svc.cluster.local:80/`.
  Publicly: `hangar.moosegoose.xyz` once Cloudflare routes that hostname to the service.

## 7. Operating rules & gotchas

- **Never pin a mutable tag** (`:0.1.0`, `:latest`) in the manifest — it won't redeploy. Always a
  unique per-commit digest (CI does this) or, for a manual hotfix, a unique `sha-<commit>` tag.
- **Rollback = `git revert`** in `coldaine-k8cluster` (selfHeal will re-enforce git; never
  `kubectl edit`).
- **The GHCR package is public** — no image pull secret needed. If it's ever made private, add an
  ESO-managed `dockerconfigjson` pull secret to the `robot-overview` namespace + `imagePullSecrets`.
- **Loop safety:** the bot commit lands in the *cluster* repo, which has no build-on-push workflow,
  so it can't retrigger the app build; `[skip ci]` is belt-and-suspenders.
- **Concurrency:** the `update-k8cluster` job serializes (concurrency group) and rebase-retries so two
  rapid merges don't collide pushing to `main`.
- **To deploy current `main` without a new commit** (e.g. App not set up yet): bump the `image:` line
  in `apps/robot-overview/deployment.yaml` to the desired `@sha256` digest or `sha-<commit>` tag and
  merge — Argo picks it up.
- **SonarCloud** fails on every RobotOverview PR (no coverage uploaded) but is **not a required
  check**; it does not block merges.
