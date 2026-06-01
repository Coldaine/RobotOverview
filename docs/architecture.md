---
title: Hangar architecture (DRAFT)
date: 2026-05-31
author: Patrick MacLyman
status: draft
last_confirmed: unconfirmed
---

# architecture.md

> Draft. Most of this is intentionally Candidate or Open. Provenance tags retained for review.
> Authority flows NORTH_STAR -> architecture -> PROGRESS; if anything here contradicts the North Star, this doc is wrong.

## Architecture Thesis

The system is a content spine (a uniform record model) with a game-styled view layer; the data is the source of truth and the UI is a projection that scales by adding records, not screens. Hosting remains undecided; the current implementation uses a static TypeScript data module and the Vite/React stack recorded below. `[INFERRED]` the "uniform record" framing came from our design conversation, not your stated words; confirm before it hardens

## Status Legend

- **Current:** reflected in an existing artifact or a decision already made.
- **Planned:** decided direction, not built.
- **Candidate:** plausible option, not decided.
- **Deferred / Open:** intentionally undecided right now.

## System Shape

| Area | Status | Approach |
|---|---|---|
| Information model | Current | Everything is a "unit" record (robots, computers, network gear, home systems, audio), with sibling collections for missions, capabilities, and insights. |
| Top-level taxonomy (bays) | Current | Robotics, Compute, Network, Home Systems, Audio; extensible. |
| Asset lifecycle | Current | inventory / assembled / deployed / wishlist / on-order |
| Missions | Current | Named jobs that requisition units and a loadout; Undercroft is Mission 01. |
| Presentation | Current | A base-builder HUD / Hangar SPA built with Vite, React, Tailwind CSS, and Framer Motion. |
| Population pipeline | Open | Mostly LLM-driven; manual seed data in `src/data/hangar.ts`. |
| Want list and upgrade planning | Current | "Quartermaster" view with US vs Import sourcing toggle and buy-next prioritization. |
| Storage | Current | Static data provider (`src/data/hangar.ts`) acting as a read-only source of truth for the SPA. |
| Hosting | Open | Where it lives undecided. |
| Tech stack | Current | Vite 5, React 18, TypeScript 5, Tailwind CSS 3, Framer Motion 11, Lucide React. |

## Key Differentiator

Not "more notes." The bet is that all asset knowledge shares one record shape and one home, then gets routed into views, so the want list, the inventory, the wiki, and the mission planning are facets of the same content rather than four separate apps.

## Current Architecture

The Hangar is a rich, dependency-heavy Single Page Application (SPA). 

- **Data Spine:** A central `HangarData` object defines the entire fleet and hobby state.
- **Store:** A React Context (`HangarProvider`) manages view state, mission lenses, and global sourcing preferences.
- **Views:** Highly styled HUD-style projections of the data.
- **Invariants:** The robot is the interface (schematic focus); presentation is load-bearing; view state in URL (via HashRouter).

## Invariants

Confirmed:

- Undercroft, and any mission, is content inside the system, never the system's identity.
- Structure is not prescribed ahead of population; the content forces the schema, not the reverse.
- The data is the source of truth; the UI is a projection.
- One uniform record shape spans every category; the system scales by adding records, not screens.
- View state lives in the URL (when possible) or the global store.

## Decided ADRs

- **Tech Stack:** Vite + React + TypeScript + Tailwind CSS + Framer Motion. Chosen for high-fidelity styling and rich interactive capabilities.
- **Storage:** Static TypeScript module (`hangar.ts`). Simple, local, and LLM-editable.
- **Layout:** "Dark Engineering HUD" aesthetic. Slate base, cyan/amber accents, blueprint grids, CRT scanline overlays.

## Open Architecture Questions

- Do parts move between units (a GPU between PCs, a sensor between rovers), and how is that represented?
- What keeps the inventory truthful over time, so it does not rot into a list that no longer matches reality?

## Links

- [NORTH_STAR.md](./NORTH_STAR.md) - project intent
- [PROGRESS.md](./PROGRESS.md) - current status and open questions
- [AGENTS.md](../AGENTS.md) - agent entrypoint
- [hangar_ui_mockup_prompt.md](./hangar_ui_mockup_prompt.md) - session artifact feeding this design
