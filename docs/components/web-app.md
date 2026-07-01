---
title: Web App — Next.js Server Layer
audience: AI agents and operators working on the Hangar frontend / server layer
status: living
last_updated: 2026-06-30
---

# Web App — Next.js Server Layer

> How the Hangar app is structured: the server/client split, mutations, caching, and secrets.
> Where the data layer is concerned, inventory items now use the server-side Postgres read path with
> `src/data/hangar.ts` fallback, while remaining surfaces still migrate one at a time (see
> [`data-backend.md`](data-backend.md)).
> This is the source of truth for app runtime and server-boundary current state. High-level docs
> should link here rather than restating route/config status.

## Why Next.js (not a Vite SPA)

The Vite SPA was the right bootstrap, but a browser bundle cannot hold database credentials. Next.js
fuses the frontend with a secure Node.js backend in one project:

- **Server Components** run only on the server, can query data directly, and never ship to the browser bundle.
- **Server Actions** (`"use server"`) run securely on the server in response to user interaction; they replace REST routes for mutations.
- **Next.js middleware** (`middleware.ts`) is the network boundary — auth checks, redirects, routing — before any page logic runs. The Hangar app does not implement middleware yet; this is a placeholder for future auth/redirect work.

Net result: the UI and the data layer speak through the server, with secrets injected at runtime and
never exposed to the client.

## The server / client split

Everything is a **Server Component by default**. Opt into `"use client"` only at the leaves that
genuinely need browser APIs — state, event listeners, animation. Getting this wrong causes either
security leaks or bloated bundles.

| Component | Server / Client | Why |
|---|---|---|
| Page (e.g. unit detail) | **Server** | Fetches its data server-side |
| A static row/section | **Server** | No interactivity |
| A fill/toggle button | **Client** | Needs `onClick` + optimistic update |
| Animated gauge / schematic | **Client** | `framer-motion` / `useState` need the browser |
| Command bar | **Client** | Search input + keyboard shortcuts |
| HUD shell (layout) | **Server** | Static wrapper |

Global UI state (lenses, sourcing) lives in the `HangarProvider` store.

## Data flow (target, DB-backed)

```text
read:   Browser → Next.js server → Server Component → (data layer) → render → HTML
write:  Browser onClick → Server Action ("use server") → (data layer) → revalidatePath()/Tag → re-render
```

The first DB-backed read path is deliberately narrow:

```text
GET /api/hangar/items
  -> src/server/hangar/items.ts
  -> src/server/hangar/db.ts
  -> Postgres assets/groups/tags if structured HANGAR_DB_* config is present
  -> src/data/hangar.ts fallback otherwise

GET /api/hangar/preflight
  -> src/server/hangar/db.ts
  -> SELECT 1 against the configured Hangar Postgres endpoint
  -> HTTP 200 only when the DB is reachable; HTTP 503 when not configured or unreachable
```

This proves server-only credentials, query shape, normalized-to-UI mapping, and fallback behavior.
The root layout reads inventory items through this server boundary at request time and seeds the client
store with those records; if Postgres is not configured or reachable, the same boundary falls back to
`hangar.ts`. Broader UI/data migration should continue one surface at a time while keeping rollback to
`hangar.ts` straightforward.

## Caching

Next.js 16's caching (`use cache` / `unstable_cache`) covers expensive reads without an external
Redis: cache the fleet list with a revalidate window + tags, and bust the tag from the Server Action
that mutates it. This is not yet load-bearing for the unconverted surfaces that still use the
bootstrap/fallback data spine.

## Database Config And Secrets — Target State

Doppler/ESO should inject only the credential-bearing part of the connection into the server process
at runtime. The preferred app contract is structured config, not a credential-bearing URL:

```text
HANGAR_DB_HOST
HANGAR_DB_PORT
HANGAR_DB_NAME
HANGAR_DB_USER
HANGAR_DB_SSLMODE
HANGAR_DB_PASSWORD
```

Host, port, database, user, and SSL mode are ordinary deployment config. The current app helper
explicitly supports `HANGAR_DB_SSLMODE=disable` or `require`; `require` encrypts without verifying the
self-signed CNPG certificate chain, matching libpq `sslmode=require`. Certificate-verified modes should
be added with the actual cert/trust-bundle fields rather than silently treated as generic TLS.
`HANGAR_DB_PASSWORD` is the phase-1 credential and should later be replaceable by
workload-identity-backed auth (client cert, Vault lease, or proxy-issued token) without changing the
browser-facing app.

Keep DB clients lazily initialized inside server-only accessors so `next build` can run without
runtime credentials. For the current inventory route, missing DB config is not fatal; it is an
explicit static-data fallback. `HANGAR_DATABASE_URL`/`DATABASE_URL` remain compatibility escape
hatches, but they are not the preferred contract.

## Aesthetics

Maintain the **"Dark Engineering HUD"** look — blueprint grids, cyan/amber accents. The robot is the
interface (flagship schematic focus). The presentation is load-bearing per the North Star, not
decoration.
