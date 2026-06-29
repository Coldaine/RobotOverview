---
title: Hangar Architecture
audience: AI agents and operators working on RobotOverview
status: living
last_updated: 2026-06-29
---

# Hangar — Architecture Approach

> How we've chosen to build the Hangar, and *why*, grounded in `NORTH_STAR.md`.
> This document is the **approach + rationale only**. It is deliberately not a catalog of what
> has been built or a place for implementation detail — that lives in the component docs linked
> from each decision below. If a section here grows code, schemas, or step-by-step procedure,
> that content belongs in a component doc and should be moved there.

## Grounding

The North Star asks for **one home for all physical tech** — inventory, wiki, and want list at
once — that:

- keeps a **connected model** where units, missions, and lessons relate (North Star AG1), not a flat catalog;
- is **cheap enough to maintain that an LLM populates and Patrick curates** (G2);
- sustains a **base-builder "hangar" feel** so maintaining it is wanted, not a chore (G3, G4);
- is **desktop / widescreen-first**, with phone layouts that don't break (G6);
- keeps a **strict data spine** while letting the schema **emerge from real content** rather than being prescribed up front.

Two pillars drive every choice that follows:

- **The spine is data, not UI.** A strict relational spine for topology (assets socketed into loadout slots, mission requisitions), with flexible localized metadata over it.
- **The presentation is load-bearing.** The hangar feel is worth real effort, because an inventory no one enjoys maintaining goes stale, and a stale inventory is worthless.

## The chosen approach, and why

### 1. A web app with a real server layer (Next.js)

A browser-only SPA (the original Vite bootstrap) cannot hold database credentials, so it dies the
moment the inventory needs a real backend. Next.js fuses the UI to a secure server layer — Server
Components query data server-side and never ship to the browser; Server Actions handle mutations.
The app is built on Next.js 16 / React 19 / Tailwind 4 today and renders from the static data
source below.
→ detail: [`docs/components/web-app.md`](components/web-app.md)

### 2. Source of truth: static `hangar.ts` now, a Postgres master-inventory next

Per the pillar **"do not prescribe before populating,"** `src/data/hangar.ts` stays the
authoritative runtime source through the alpha, so the shape keeps emerging from real entries. A
normalized Postgres **master-inventory** backend has been *designed and stood up alongside it* but
is **not yet authoritative** — the app still reads `hangar.ts` at runtime. App/ORM wiring is the
deliberately deferred next step.
→ detail: [`docs/components/data-backend.md`](components/data-backend.md)

### 3. One master inventory; bays are views, not silos

One pool of **everything owned** (compute, network, robotics, home, audio, plus loose
accessories/tooling), with flexible grouping (bay / kit / location / project) layered *over* the
relational spine. **Bays are group-views over the one pool, never separate silos** — this is what
keeps AG1's connected model intact instead of fragmenting into per-bay catalogs.
→ detail: [`docs/components/data-backend.md`](components/data-backend.md)

### 4. The base-builder loadout spine

Assets expose **typed interfaces**; sockets **accept** interface types; an asset is a *candidate*
for a socket when their interfaces intersect, and equipping is an **assignment**. This typed
mating model is the upgrade tree (G3/G4): it makes maintenance feel like a loadout screen and lets
the system surface what to acquire next and why.
→ detail: [`docs/components/data-backend.md`](components/data-backend.md)

### 4.5. Connected twin as a data layer, not a second app

The Beast wiring/twin work belongs under the same data spine: terminals and nets extend assets/sockets/interfaces so the Hangar can show what is physically wired, what rail or signal a connection carries, and which schematic proves it. The standalone HTML prototypes are historical review artifacts; the product path is an in-app data-driven wiring view that reuses the existing shell, store, themes, loadout compatibility, and source provenance.

Bulk source PDFs/CAD/firmware stay out of git and out of the container image. They should live in object storage and be referenced from the database/app by URL.
→ detail: [`docs/components/connected-twin.md`](components/connected-twin.md), [`docs/reference/ugv-beast-source-archive.md`](reference/ugv-beast-source-archive.md)

### 5. Deployment: a separate service at `hangar.moosegoose.xyz`

The Hangar behaves like a full-screen app that owns `/`, so it stays a **separate deployable
service** in the MooseGoose estate — its own image, pod, probes, and resource budget — reached at a
**subdomain**, not a path under the main site.
**The deployment *mechanism* is being redesigned (moving to Shipwright); it is paused, not broken.**
→ detail: [`docs/deploy/deployment.md`](deploy/deployment.md), [`docs/deploy/hangar-service-boundary.md`](deploy/hangar-service-boundary.md)

### 6. Secrets via Doppler (target state)

Database credentials must never reach the browser; Doppler injects them into the server process at
runtime. This becomes load-bearing once the DB is wired — while the app reads `hangar.ts`, there are
no runtime secrets to manage.
→ detail: [`docs/components/web-app.md`](components/web-app.md)

## What this is not (anti-goals)

- **Not a flat inventory list** (AG1) — the connected model is the reason it exists.
- **Not an autonomous control plane** (AG2) — it may *link out* to a unit's own controls and may one
  day host a *supervised* view, but a human stays in the loop. Operating detail for a unit lives in
  its runbook, not here → [`docs/beast-ops.md`](beast-ops.md).

## Live open questions

- The runtime/pipeline specifics of the **Shipwright-based deployment** (in flux — see the deploy docs).
- How **LLM population** actually works: the intake from a chat or research run into an entry.
- Turning the **want list into an upgrade plan** that says what to buy next and why.
