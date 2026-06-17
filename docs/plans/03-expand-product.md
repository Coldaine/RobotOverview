---
title: Expand Product Plan
date: 2026-06-13
author: Patrick MacLyman
status: queued
last_confirmed: 2026-06-13
---

# Expand Product

## Objective

Move beyond the static alpha into the smallest next slice of product value while preserving the Hangar's core identity: one content spine for inventory, wiki, want list, missions, and lessons.

## Status

Queued until deployment is complete or explicitly accepted.

## Investigate

- Start only after [02-deploy-alpha.md](./02-deploy-alpha.md) is complete or explicitly accepted.
- Re-read [NORTH_STAR.md](../NORTH_STAR.md).
- Inspect current data shape in `src/data/hangar.ts` and `src/data/types.ts`.
- Identify the smallest expansion that makes the app more useful without turning it into a generic CRUD dashboard.
- Consider these candidates in order:
  - Content intake workflow for adding units, wishlist items, insights, or mission notes.
  - Richer upgrade planning in Quartermaster.
  - Editable mission/objective state with local persistence.
  - Acquisition status updates for wishlist items.
  - Home Assistant status sync as catalog reference only, never control-plane behavior.

## Implement

- Choose one v1 expansion slice before broad implementation and keep that scope visible in the PR.
- Keep `src/data/hangar.ts` as the data source of truth unless a later architecture pass, regenerated after the North Star is finalized, explicitly changes storage.
- Prefer local, reversible state for user interactions before introducing durable external storage.
- Keep the robot and mission views as first-class surfaces; do not bury new capability in a settings-only workflow.
- Preserve the Dark Engineering HUD aesthetic and avoid landing-page or marketing-page drift.

## Verify

- Run `npm run lint`.
- Run `npm run build`.
- Browser-check the full affected workflow on desktop and mobile widths.
- Confirm no text overlaps and no card layout shifts when content is long.
- Confirm the expansion improves one of the North Star goals:
  - one current picture of the fleet,
  - cheaper LLM-assisted maintenance,
  - more enjoyable base-builder feel,
  - clearer buy-next path,
  - better retrieval of lessons by unit or mission.

## Handoff

- Commit in meaningful chunks.
- Push the branch and open a ready, non-draft PR.
