---
title: Hangar AGENTS
date: 2026-06-01
author: Patrick MacLyman
status: living
last_confirmed: 2026-06-01
---

# AGENTS.md

## Identity

The Hangar is a high-fidelity command center for all physical tech and hobbies. It is a React SPA built with Vite, Tailwind, and Framer Motion.

## Decision Tree

- **Understand project intent** -> `docs/NORTH_STAR.md`
- **Code implementation** -> `src/`

## Tech Stack & Commands

- **Environment:** Node.js, Vite, React, TypeScript, Tailwind CSS.
- **Boot:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint`

## Working Rules

- The robot is the interface (flagship schematic focus).
- Data source of truth is `src/data/hangar.ts`.
- Use the `HangarProvider` store for global state (lenses, sourcing).
- Maintain "Dark Engineering HUD" aesthetics (blueprint grids, cyan/amber accents).

