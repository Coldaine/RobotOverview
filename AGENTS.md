---
title: Hangar AGENTS
date: 2026-06-17
author: Patrick MacLyman
status: living
last_confirmed: 2026-06-29
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
- **Code implementation** -> `src/`
- **Superseded / historical docs and prototypes** -> `docs/history/`

## Tech Stack & Commands

- **Environment:** Node.js, Next.js, React, TypeScript, Tailwind CSS.
- **Boot:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Test:** `npm run test:run`

## Working Rules

- The robot is the interface (flagship schematic focus).
- Current app runtime source of truth is `src/data/hangar.ts` until the PostgreSQL-backed read path lands.
- The Postgres master-inventory schema/seed lives in `db/hangar/`; it is staged alongside the app, not yet the app's runtime source.
- Use the `HangarProvider` store for global state (lenses, sourcing).
- Maintain "Dark Engineering HUD" aesthetics (blueprint grids, cyan/amber accents).
- Do not commit bulk BEAST-01 archive binaries; store them in object storage and reference them from data/docs.
- Do not treat Hangar as an autonomous robot control plane. Supervised links/views are fine; human-in-loop remains the boundary.

## Branch Workflow

- Open development is a stacked PR chain. Do not put new work directly on `main` when the active stack is ahead.
- For follow-on feature work, branch from the newest relevant stack tip unless the user explicitly chooses a different base.
