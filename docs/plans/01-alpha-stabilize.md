---
title: Alpha Stabilize Plan
date: 2026-06-13
author: Patrick MacLyman
status: active
last_confirmed: 2026-06-13
---

# Alpha Stabilize

## Objective

Make the current alpha truthful, stable, and ready for review. This phase fixes known misleading behavior, finishes lightweight persistence, and updates handoff docs before deployment work starts.

## Status

Complete for the stabilization scope. PR #1 remediation has landed, authored constraint baselines are preserved, source and mission lens state persist in local storage, unit cards surface high-draw and missing-requirement flags, and handoff docs have been updated.

## Investigate

- Confirm the current branch and inspect uncommitted work before editing.
- Read [NORTH_STAR.md](../NORTH_STAR.md), [architecture.md](../architecture.md), and [PROGRESS.md](../PROGRESS.md) for authority boundaries.
- Inspect `src/lib/store.tsx`, mission rendering, unit-card rendering, and `src/data/hangar.ts`.
- Confirm `AGENTS.md` authority links still point at the `docs/` folder and check any `@RTK.md` reference visible in session context; do not invent an RTK document unless project intent is confirmed.

## Historical Notes

- PR #1 remediated the seeded `undercroft` constraint bug where authored values of `22W`, `380g`, and `$35` were replaced by raw wishlist sums.

## Implement

- Preserve authored mission constraint baselines:
  - Power and mass gauges must include each constraint's authored `value` as the baseline.
  - Wishlist items should add only incremental values that are actually selected for the mission.
  - Cost must not blindly sum mutually exclusive wishlist alternatives for the same loadout choice.
  - If no selection model exists yet, use the mission's authored cost value as the displayed baseline and avoid replacing it with a sum of all alternatives.
- Preserve authority doc links:
  - Keep AGENTS decision-tree links pointed at `docs/NORTH_STAR.md`, `docs/architecture.md`, and `docs/PROGRESS.md`.
  - Leave missing `RTK.md` as a documented handoff note unless the file exists or the owner supplies it.
- Add persistent global store state:
  - Persist `source` and `lensMissionId` in `localStorage`.
  - Default to `source: 'us'` and `lensMissionId: null` when stored values are missing or invalid.
  - Keep state client-only and avoid breaking Vite build or SSR-free assumptions.
- Finish unit-card flags:
  - Keep the existing high-draw visual treatment and make the label understandable from the card tooltip or visible flag text.
  - Add a requirement-missing flag when a unit has empty loadout slots or mission-required gaps that the current data can identify.
  - Do not add a new schema unless the existing `loadout`, `requiredLoadout`, `wishlist`, and status fields cannot support the flag.

## Verify

- Run `npm run lint`.
- Run `npm run build`.
- Manually inspect the mission and hub constraint gauges for `undercroft`; they should no longer report only the light bar's `8W/85g` or overcount both lighting alternatives as the live cost.
- Verify the source toggle and mission lens survive a page reload.
- Verify unit cards show high-draw and requirement-missing states without text overlap on common desktop and mobile widths.

## Handoff

- Update [PROGRESS.md](../PROGRESS.md) with completed stabilization work and remaining blockers.
- Commit stabilization changes in coherent increments.
- Push the branch and open a ready, non-draft PR.
