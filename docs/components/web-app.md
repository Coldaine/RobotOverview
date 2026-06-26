---
title: Web App — Next.js Server Layer
audience: AI agents and operators working on the Hangar frontend / server layer
status: living
last_updated: 2026-06-26
---

# Web App — Next.js Server Layer

> How the Hangar app is structured: the server/client split, mutations, caching, and secrets.
> Where the data layer is concerned, this describes the **target** server-side pattern; today the
> app reads the static `src/data/hangar.ts` (see [`data-backend.md`](data-backend.md)), and the
> DB-backed examples below apply once the database read path is wired.

## Why Next.js (not a Vite SPA)

The Vite SPA was the right bootstrap, but a browser bundle cannot hold database credentials. Next.js
fuses the frontend with a secure Node.js backend in one project:

- **Server Components** run only on the server, can query data directly, and never ship to the browser bundle.
- **Server Actions** (`"use server"`) run securely on the server in response to user interaction; they replace REST routes for mutations.
- **`proxy.ts`** (Next.js 16, replaces `middleware.ts`) is the network boundary — auth checks, redirects, routing — before any page logic runs.

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

```
read:   Browser → proxy.ts → Server Component → (data layer) → render → HTML
write:  Browser onClick → Server Action ("use server") → (data layer) → revalidatePath()/Tag → re-render
```

When the DB read path is wired, the data layer is the Postgres master-inventory via an ORM whose
schema maps to `db/hangar/schema.sql`. Until then, the same Server Components read `hangar.ts`
directly, so the split above already applies — only the data source changes.

## Caching

Next.js 16's caching (`use cache` / `unstable_cache`) covers expensive reads without an external
Redis: cache the fleet list with a revalidate window + tags, and bust the tag from the Server Action
that mutates it. Not load-bearing while reads come from the in-process `hangar.ts`.

## Secrets (Doppler) — target state

Doppler injects secrets (e.g. `DATABASE_URL`) into the server process at runtime; Next.js reads them
server-side and they never touch the browser. Validate them at startup (fail fast on a missing var)
rather than mid-request. This becomes relevant when the DB is wired — while the app reads `hangar.ts`
there are no runtime secrets to manage.

## Aesthetics

Maintain the **"Dark Engineering HUD"** look — blueprint grids, cyan/amber accents. The robot is the
interface (flagship schematic focus). The presentation is load-bearing per the North Star, not
decoration.
