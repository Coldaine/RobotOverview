---
title: Deploy Alpha Plan
date: 2026-06-01
author: Patrick MacLyman
status: planned
last_confirmed: 2026-06-01
---

# Deploy Alpha

## Objective

Publish the stabilized alpha so the Hangar can be opened from a real URL and reviewed outside the local dev environment.

## Investigate

- Start only after [01-alpha-stabilize.md](./01-alpha-stabilize.md) is merged or explicitly accepted.
- Confirm the repo's current branch, remote, and uncommitted state.
- Inspect `package.json`, `vite.config.ts`, router setup, and any existing deployment files.
- Check whether GitHub Pages or Vercel is already configured in repo history or remote settings.
- Default to Vercel if no clear hosting decision already exists.

## Implement

- Configure the minimum deployment path for the chosen host:
  - For Vercel, keep Vite defaults unless a config file is required.
  - For GitHub Pages, set the correct Vite base path and document any workflow or Pages setting required.
- Preserve HashRouter behavior unless deployment testing proves it is wrong for the chosen host.
- Avoid adding backend services, databases, auth, or containerized workflows.
- Add a short deployment note to [PROGRESS.md](../PROGRESS.md) with the chosen host, build command, output directory, and deployment URL when known.

## Verify

- Run `npm run lint`.
- Run `npm run build`.
- Preview the production build locally with `npm run preview` when practical.
- Check the deployed or previewed app routes:
  - Hub opens.
  - Mission detail opens.
  - Unit detail opens.
  - Quartermaster source toggle works.
  - Reloading a deep hash route returns to the expected view.

## Handoff

- Commit deployment configuration and docs as a coherent chunk.
- Push the branch.
- Open a ready, non-draft PR that includes the deployment URL or the exact remaining deployment step.
