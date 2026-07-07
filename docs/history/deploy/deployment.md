---
title: Hangar Deployment (current direction)
audience: AI agents and operators working on RobotOverview deployment
status: historical
last_updated: 2026-06-29
---

# Hangar Deployment

> **Status: the deployment mechanism is being redesigned. It is paused, not broken.**
> This is the source of truth for *where deployment stands and where it's going*. The previous
> GitHub-Actions → GitOps → Argo CD pipeline is **superseded** and archived under
> [`docs/history/`](../history/) — do not treat it as current.

## Where it stands today

- **The app is not auto-deploying.** The old pipeline's deploy step is a graceful **no-op**: the
  `update-k8cluster` job in `.github/workflows/image.yml` only runs when both `GITOPS_APP_CLIENT_ID`
  and `GITOPS_APP_KEY` secrets are present, and **they were never configured**. So every push builds
  an image to GHCR but nothing is written to the cluster — the workflow stays green and the cluster
  keeps running an older pinned image. This is the intended paused state, not a failure.
- The only thing still running on each push/PR is the **GHCR image build** (`image` job). It is
  harmless but largely redundant work given the direction below; leave it unless it gets in the way.

## Where it's going

The deployment approach has been **deliberately changed**. The new direction:

- **Build with [Shipwright](https://shipwright.io/).** Move image building toward Shipwright rather
  than the GitHub-Actions-build → write-digest-to-GitOps → Argo-reconcile loop. *(The concrete
  Shipwright pipeline — build strategy, triggers, how the result reaches the cluster — is still to
  be designed. Do not infer it from the archived Argo docs.)*
- **Serve at `hangar.moosegoose.xyz`.** A subdomain, not a path under the main site, so the Hangar
  keeps owning `/`. Cloudflare is the first outside-access path; access is protected/private at
  first. See [`hangar-service-boundary.md`](hangar-service-boundary.md).
- **Stay a separate service.** Own image, pod, probes, and resource budget in the MooseGoose estate
  — see [`hangar-service-boundary.md`](hangar-service-boundary.md), which remains valid on the
  *service boundary, subdomain, and cross-repo ownership* (but whose Argo/GitOps *mechanism* sections
  are superseded by this document).

## What still holds from the old approach

Carry these principles into the Shipwright design unless a reason emerges not to:

- **Pull-based, no inbound path to the cluster** — the cluster pulls; CI never reaches into it.
- **Immutable image references** (digest pin) so a rollout actually happens and is reproducible.
- **Separate service / separate pod** for the Hangar (the boundary decision is unchanged).

## Storage boundary for source documents

BEAST-01 source PDFs/CAD/firmware are not deployable app assets. Keep `UGV-Beast-Archive/` out of git and out of Docker builds. The target shape is S3/RGW-compatible object storage with database rows/URLs pointing to source documents. The app code should be endpoint-agnostic so an interim bucket can later move to the final cluster object store without changing the UI model.

See [`storage-and-twin-pivot-plan.md`](storage-and-twin-pivot-plan.md) and [`../reference/ugv-beast-source-archive.md`](../reference/ugv-beast-source-archive.md).

## Open / to-design

- The Shipwright build pipeline itself (strategy, trigger, source→image→cluster path).
- Whether the GHCR build job in `image.yml` is retired, repurposed, or kept during the transition.
- Cloudflare hostname wiring for `hangar.moosegoose.xyz` and the access policy.
