---
title: Hangar PROGRESS
date: 2026-06-14
author: Patrick MacLyman
status: active
last_confirmed: 2026-06-14
---

# PROGRESS.md

## Current State

**Alpha Build Complete.** The Hangar is a functional Single Page Application (SPA) tracking the robotics and fleet state.

- **Stack:** Vite + React + Tailwind + Framer Motion.
- **Data:** `src/data/hangar.ts` contains the full seed roster (Beast flagship, CORE-PRIME workstation, network ops, etc.).
- **Views:** Hub, Missions (Undercroft), Quartermaster, Tech Tree, Codex, and Unit Detail (with interactive Beast schematic).
- **Features:** Mission lensing, interactive schematics, tech tree nodes, searchable codex, US/Import sourcing toggle.
- **Branching:** Canonical branch is now `main` with `master` retained as a legacy branch.

## Active Work

- **Usability Pass:** PR #4 is active on `chore/ui-usability-pass`; PR review comments are addressed and browser-driven workflow checks have prioritized desktop and wide layouts, with mobile used as a guardrail.
- **Branch Migration:** `main` is now canonical for RobotOverview; default branch switched from `feat/hangar-static-app`; PRs #4, #3, and #5 are retargeted to `main`; branch protection now requires PR review, status checks (`GitGuardian Security Checks`, `Kilo Code Review`), and disallows force-push/delete.
- **PR Review Remediation:** PR #1 remediation has been merged for mission requisition statuses, hub mission fallback safety, tech-tree requirement discriminators and lookup performance, loadout constraint math, mobile navigation, integral loadout data, and timestamp fallback safety.
- **Alpha Stabilization:** `docs/plans/01-alpha-stabilize.md` is the active handoff; persistent `localStorage` sync and unit-card missing-requirement flags remain pending.
- **Documentation Hygiene:** Plan status drift has been corrected; `docs/architecture.md` remains draft/unconfirmed until the open architecture questions are explicitly confirmed.
- **Workflow Coverage:** Core user paths are captured in `docs/USABILITY_WORKFLOWS.md` for repeat usability checks.

## UI Audit Findings

- **Preferred Form Factor:** Desktop, widescreen, and ultrawide should be treated as the primary experience. Mobile should remain functional, but it is a guardrail rather than the design center.
- **Wide Layout Rails:** Quartermaster, Codex, and Tech Tree currently stretch list/card rows across very wide canvases. Add intentional wide-screen rails, detail panes, or max scan-widths so rows stay easy to compare.
- **Tech Tree Pivot:** Evolve Tech Tree from a flat card grid into a real planning surface on desktop: graph or lane layout plus a persistent selected-capability inspector.
- **Quartermaster Pivot:** Split sourcing into a dense requisition list plus a sticky comparison/detail rail. The current full-width row list is stable, but not as fast to scan on ultrawide.
- **Codex Pivot:** Add a left filter rail and right reading/detail pane, or constrain article row width. Insight bodies are too long as single-line ultrawide cards.
- **Hub Strength:** Hub and Unit Detail are the strongest large-screen views because the schematic and diagnostic side rail give the layout a clear command-center shape.

## Roadmap & Milestones

- [x] Initial Build (Hub + Detail views)
- [x] Data Spine (initial roster seed)
- [x] Mission 01: Undercroft implemented
- [x] Quartermaster / Wishlist view
- [x] Reactive Constraint Logic finalized (preserve authored baselines)
- [x] Mobile navigation for station and bay routes
- [ ] Persistent Global State (localStorage sync)
- [ ] External Hosting (GitHub Pages / Vercel candidate)

## Blockers and Open Questions

- **Hosting:** Decide on a deployment target.
- **Persistence:** How to handle user-driven price/status updates (Local Storage is current candidate).
- **Automation Hub Sync:** Future goal: can HA feed status back to the Hangar?

## Next Session Focus

- Implement persistent store (localStorage).
- Add "High Draw" and "Requirement Missing" flags to unit cards.
- Commit and tag `v0.1.0-alpha`.
