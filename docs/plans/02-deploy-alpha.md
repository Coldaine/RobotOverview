---
title: Deploy Alpha Plan
date: 2026-06-13
author: Patrick MacLyman
status: queued
last_confirmed: 2026-06-13
---

# Deploy Alpha

## Objective

Publish the stabilized alpha so the Hangar can be opened from a real URL and reviewed outside the local dev environment.

## Status

Queued. Alpha stabilization has already landed.

## Investigate

- Start from current `main`; alpha stabilization has already landed.
- Confirm the repo's current branch, remote, and uncommitted state.
- Inspect `package.json`, `next.config.ts`, the App Router tree under `src/app`, and any existing deployment files.
- Check whether GitHub Pages or Vercel is already configured in repo history or remote settings.
- Default to Vercel if no clear hosting decision already exists.

## Implement

- Configure the minimum deployment path for the chosen host:
  - For Vercel, use the Next.js defaults unless a config file is required.
  - For GitHub Pages, document the static export constraints and any Pages setting required before choosing it.
- Preserve clean App Router deep-link behavior unless deployment testing proves a host-specific adjustment is required.
- Avoid adding backend services, databases, auth, or containerized workflows.
- Include the chosen host, build command, output directory, and deployment URL when known in the PR description.

## Verify

- Run `npm run lint`.
- Run `npm run build`.
- Preview the production build locally with `npm run start` when practical.
- Check the deployed or previewed app routes:
  - Hub opens.
  - Mission detail opens.
  - Unit detail opens.
  - Quartermaster source toggle works.
  - Reloading a clean deep route returns to the expected view.

## Handoff

- Commit deployment configuration and docs as a coherent chunk.
- Push the branch.
- Open a ready, non-draft PR that includes the deployment URL or the exact remaining deployment step.
