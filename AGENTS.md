---
title: Hangar AGENTS
date: 2026-06-17
author: Patrick MacLyman
status: living
last_confirmed: 2026-06-17
---

# AGENTS.md

## Identity

The Hangar is a high-fidelity command center for all physical tech and hobbies. The active PR stack has migrated it to Next.js 16, React 19, Tailwind CSS 4, and Framer Motion.

## Decision Tree

- **Understand project intent** -> `docs/NORTH_STAR.md`
- **Operate / control the Beast (network, drive, telemetry, programming)** -> `docs/beast-ops.md`
- **Code implementation** -> `src/`

## Tech Stack & Commands

- **Environment:** Node.js, Next.js, React, TypeScript, Tailwind CSS.
- **Boot:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint`

## Working Rules

- The robot is the interface (flagship schematic focus).
- Current data source of truth is `src/data/hangar.ts` until the resolved PostgreSQL backend migration lands.
- Use the `HangarProvider` store for global state (lenses, sourcing).
- Maintain "Dark Engineering HUD" aesthetics (blueprint grids, cyan/amber accents).

## Branch Workflow

- Open development is a stacked PR chain. Do not put new work directly on `main` when the active stack is ahead.
- For follow-on feature work, branch from the newest relevant stack tip unless the user explicitly chooses a different base.
