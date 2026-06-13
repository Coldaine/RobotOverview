---
title: Hangar Plans Index
date: 2026-06-01
author: Patrick MacLyman
status: active
last_confirmed: 2026-06-01
---

# Hangar Plans

These plans are execution handoffs. They do not replace the authority docs:

- Project intent lives in [NORTH_STAR.md](../NORTH_STAR.md).
- System shape lives in [architecture.md](../architecture.md).
- Current status lives in [PROGRESS.md](../PROGRESS.md).

## Execution Order

Run these plans in numeric order:

1. [01-alpha-stabilize.md](./01-alpha-stabilize.md) - make the current alpha truthful, stable, and ready for review.
2. [02-deploy-alpha.md](./02-deploy-alpha.md) - publish the stabilized alpha.
3. [03-expand-product.md](./03-expand-product.md) - expand the product once the alpha is stable and deployed.

## Agent Workflow

For each plan:

1. Investigate the current repo state before changing files.
2. Keep changes inside the owning artifact: plans for execution detail, `PROGRESS.md` for status, architecture docs for system decisions, and North Star for intent.
3. Implement the smallest coherent chunk that satisfies the plan.
4. Run the stated checks.
5. Update [PROGRESS.md](../PROGRESS.md) with what changed and what remains.
6. Commit meaningful increments as coherent chunks complete.
7. Push the branch and open a ready, non-draft pull request when the phase is ready for review.

## Defaults

- Prefer the existing branch when it fits the work.
- Do not run local containers on this machine.
- Do not introduce a database, service, or hosting platform unless the active plan calls for it.
- Preserve `src/data/hangar.ts` as the data source of truth unless a later architecture decision explicitly changes that.
