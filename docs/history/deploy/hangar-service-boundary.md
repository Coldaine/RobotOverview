---
title: Hangar Service Boundary
audience: AI agents and operators working across RobotOverview, MooseGooseWebsite, and coldaine-k8cluster
status: historical
last_updated: 2026-06-25
---

# Hangar Service Boundary

> Historical snapshot. Current deployment and service-boundary facts belong in `docs/deploy.md`
> and must be verified against `coldaine-k8cluster` manifests and live cluster state. The GitOps
> write-back mechanism below is superseded.

RobotOverview, also called **The Hangar**, should be treated as a self-contained service in the
MooseGoose web estate. It is not currently code that lives inside `MooseGooseWebsite`, and it does
not need to be folded into that app to be useful.

The intended shape is:

```text
hangar.moosegoose.xyz
  -> Cloudflare Tunnel / access policy
  -> robot-overview Kubernetes Service
  -> RobotOverview Next.js container
```

MooseGooseWebsite remains the public front door and should link to Hangar as a related service.
Hangar remains a separate deployable app with its own image, pod, health checks, and resource
budget.

## Why a Separate Service

Hangar already behaves like a full-screen app. It owns routes such as `/missions`, `/items`,
`/unit/[id]`, and `/quartermaster`; it also owns its visual shell, data spine, and local browser
state. Keeping it as a separate service avoids teaching the app that every route lives under
`/hangar`.

A separate Kubernetes Deployment does **not** mean a separate machine. The MooseGoose website,
Hangar, home-app, soil, and support services can all run as separate pods on the same worker. The
separation gives each app its own rollout, restart boundary, probes, and resource requests/limits.

Do not combine Hangar into the MooseGoose website pod just to "save" a pod. Sharing one pod would
tie their deploys and failures together, make routing more complex, and remove the main operational
benefit Kubernetes gives us.

## Pinned Images

The cluster does not run "the latest RobotOverview repo." It runs the exact image reference written
in `coldaine-k8cluster`:

```text
apps/robot-overview/deployment.yaml -> spec.template.spec.containers[0].image
```

That image is pinned to a specific build. As last checked on 2026-06-25, the manifest still points
at:

```text
ghcr.io/coldaine/robot-overview:sha-18930f680aca8d5f3b7d5397eb6899f7400011bf
```

That is an older RobotOverview build from June 17, 2026. Newer RobotOverview images can exist in
GHCR without changing what the cluster runs. The manifest must change before Argo CD will roll the
Deployment forward.

## GitOps Write-Back

> **⚠️ Superseded mechanism.** This section describes the old Argo/GitOps write-back, which is being
> replaced by a Shipwright-based approach. Kept for context; see [`deployment.md`](deployment.md).

The GitOps write-back is a GitHub Actions and GitHub App handoff, not an Argo setting.

The intended loop is:

```text
RobotOverview main changes
  -> GitHub Actions builds and pushes a new image
  -> GitHub Actions uses a narrow GitHub App token
  -> GitHub Actions updates coldaine-k8cluster/apps/robot-overview/deployment.yaml
  -> Argo CD sees the GitOps repo changed
  -> Argo CD reconciles the robot-overview Deployment
```

Argo CD only follows the GitOps repo. It does not choose the newest app image on its own.

Historical state: the image build succeeded, but the write-back job no-oped when the required
`GITOPS_APP_CLIENT_ID` and `GITOPS_APP_KEY` secrets are not configured in RobotOverview. Until those
exist and the GitHub App can push to `coldaine-k8cluster`, the app image must be bumped manually in
the cluster repo.

## URL And Access Direction

Use a subdomain first:

```text
hangar.moosegoose.xyz
```

Prefer this over:

```text
moosegoose.xyz/hangar
```

The subdomain lets Hangar keep owning `/`, so its internal routes and assets remain natural. A path
route would require app-level path/base handling and is a migration, not just an edge-route change.

Access should be protected/private at first and should stay consistent with the MooseGoose website
access pattern. Cloudflare is the first outside-access path. Tailscale can be added later as a
private/local-network path to the same service if useful.

## Ownership Across Repos

- `RobotOverview` owns what Hangar is, how it builds, and what service it exposes.
- `coldaine-k8cluster` owns how Hangar runs in Kubernetes.
- `MooseGooseWebsite` owns why Hangar belongs in the MooseGoose estate, how it is discovered from
  the main site, and the public/private access posture.

Cross-repo work should be linked explicitly with GitHub issues and PRs. Do not rely on memory or
chat history for this boundary.

