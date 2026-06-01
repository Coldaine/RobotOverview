---
title: Hangar PROGRESS
date: 2026-06-01
author: Patrick MacLyman
status: active
last_confirmed: confirmed
---

# PROGRESS.md

## Current State

**Alpha Build Complete.** The Hangar is a functional Single Page Application (SPA) tracking the robotics and fleet state.

- **Stack:** Vite + React + Tailwind + Framer Motion.
- **Data:** `src/data/hangar.ts` contains the full seed roster (Beast flagship, CORE-PRIME workstation, network ops, etc.).
- **Views:** Hub, Missions (Undercroft), Quartermaster, Tech Tree, Codex, and Unit Detail (with interactive Beast schematic).
- **Features:** Mission lensing, interactive schematics, tech tree nodes, searchable codex, US/Import sourcing toggle.

## Active Work

- **Finalizing Repository:** Stabilizing the folder structure, moving authority docs to `docs/` and entrypoints to root.
- **Git State:** Establishing the remote repository and baseline branch.
- **Persistent Store:** Implementing `localStorage` sync for user preferences (source toggle, active mission).
- **Execution Plans:** Added ordered plan handoffs under `docs/plans/` for alpha stabilization, deployment, and product expansion.
- **Documentation Hygiene:** Correcting authority-doc links and Markdown drift before the next implementation pass.

## Roadmap & Milestones

- [x] Initial Build (Hub + Detail views)
- [x] Data Spine (initial roster seed)
- [x] Mission 01: Undercroft implemented
- [x] Quartermaster / Wishlist view
- [ ] Reactive Constraint Logic finalized (preserve authored baselines)
- [ ] Persistent Global State (localStorage sync)
- [ ] External Hosting (GitHub Pages / Vercel candidate)

## Blockers and Open Questions

- **Hosting:** Decide on a deployment target.
- **Persistence:** How to handle user-driven price/status updates (Local Storage is current candidate).
- **Automation Hub Sync:** Future goal: can HA feed status back to the Hangar?

## Next Session Focus

- Finalize simulation logic (calculated constraints).
- Implement persistent store (localStorage).
- Add "High Draw" and "Requirement Missing" flags to unit cards.
- Commit and tag `v0.1.0-alpha`.
