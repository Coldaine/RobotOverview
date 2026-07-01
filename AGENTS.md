---
title: Hangar AGENTS
date: 2026-06-17
author: Patrick MacLyman
status: living
last_confirmed: 2026-07-01
---

# AGENTS.md

## Identity

The Hangar is a high-fidelity command center for all physical tech and hobbies. It is a Next.js 16 / React 19 / Tailwind 4 app with a base-builder command-center feel.

## Decision Tree

- **Understand project intent** -> `docs/NORTH_STAR.md`
- **How we've chosen to build it, and why** -> `docs/architecture.md` (approach + rationale; routes to the component docs)
- **Data layer (master-inventory model, Postgres, `hangar.ts`)** -> `docs/components/data-backend.md`
- **Connected twin / BEAST-01 wiring model** -> `docs/components/connected-twin.md`
- **Frontend / Next.js server layer** -> `docs/components/web-app.md`
- **Deployment (current direction - in transition to Shipwright)** -> `docs/deploy/deployment.md`
- **Storage/object-store pivot for archive-backed documents** -> `docs/deploy/storage-and-twin-pivot-plan.md`
- **Operate / control the Beast (network, drive, telemetry, programming)** -> `docs/beast-ops.md`
- **Source archive digest (no bulk binaries in git)** -> `docs/reference/ugv-beast-source-archive.md`
- **Tooling bootstrap / command surface** -> `docs/components/bootstrap.md`
- **Documentation ownership / source-of-truth workflow** -> `docs/documentation-workflow.md`
- **Code implementation** -> `src/`
- **Superseded / historical docs and prototypes** -> `docs/history/`

## Documentation Ownership

- Do not spread live/current state across every doc. Put the full status in the one owning doc, then use a one-line summary and link elsewhere.
- Read `docs/documentation-workflow.md` before any documentation update. It owns the mandatory workflow for doc ownership, status placement, ambiguity handling, and drift checks.
- `AGENTS.md` should stay as routing guidance plus durable invariants. Update it only when ownership, commands, or hard project rules change.

## Tech Stack & Commands

- **Environment:** Node.js, Next.js, React, TypeScript, Tailwind CSS.
- **Command surface:** `npm` owns app/package commands; `Taskfile.yml` is the agent/operator front door for workflows; details live in `docs/components/bootstrap.md`.
- **Boot:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Test:** `npm run test:run`
- **Workflow check:** `task check`
- **Tooling bootstrap:** `task bootstrap:core` for core local setup, `task bootstrap:tools` for all profiles.

## Working Rules

- The robot is the interface (flagship schematic focus).
- `src/data/hangar.ts` remains the bootstrap and fallback seed source until a surface has moved through app-level seed/parity/rollback proof; the current cutover state lives in `docs/components/data-backend.md`.
- The Postgres master-inventory schema/seed lives in `db/hangar/`; local standup proves shape only. The target DB summary lives in `docs/components/data-backend.md`, with cluster provisioning truth owned by `coldaine-k8cluster`.
- Use the `HangarProvider` store for global state (lenses, sourcing).
- Maintain "Dark Engineering HUD" aesthetics (blueprint grids, cyan/amber accents).
- Do not commit bulk BEAST-01 archive binaries; store them in object storage and reference them from data/docs.
- Do not treat Hangar as an autonomous robot control plane. Supervised links/views are fine; human-in-loop remains the boundary.

## Branch Workflow

- Open development is a stacked PR chain. Do not put new work directly on `main` when the active stack is ahead.
- For follow-on feature work, branch from the newest relevant stack tip unless the user explicitly chooses a different base.
- Fill out the pull request template intentionally. Its checklist is a required behavioral checkpoint for branch scope, review, split rationale, docs, cleanup, and validation.
