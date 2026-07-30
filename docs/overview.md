---
title: Repository overview
date: 2026-07-30
author: Patrick MacLyman
status: living
---

# Repository overview

Start here. One level down from the repo root, pointing at the thicker docs.
When something moves, update the map — the map is one file so it stays true.

## What this repo is

The Hangar: a Next.js 16 / React 19 / Tailwind 4 command-center app for Patrick's
physical tech (inventory, wiki, want list, robot portal), plus the Postgres read path
behind it and the vendor/research artifacts that feed it. Intent and goals live in
[`docs/NORTH_STAR.md`](./NORTH_STAR.md) — read that before the code.

## The app — `src/`

### Surfaces (routes) — `src/app/`

| Route | File | What it is |
| --- | --- | --- |
| `/` | `page.tsx` | Hub — dashboard with mission lens, constraint gauges, bays |
| `/board` | `board/page.tsx` | The Board — interactive wiring twin for BEAST-01 |
| `/missions` | `missions/page.tsx` | Mission list (card grid; ops-board upgrade tracked in #110) |
| `/mission/[id]` | `mission/[id]/page.tsx` | Mission detail — gauges, objectives, loadout, AAR |
| `/unit/[id]` | `unit/[id]/page.tsx` | Unit detail; BEAST-only rich modules gated on `id === 'beast'` |
| `/bay/[id]` | `bay/[id]/page.tsx` | Bay roster (systems views tracked in #113) |
| `/items` | `items/page.tsx` | Inventory item catalog |
| `/quartermaster` | `quartermaster/page.tsx` | Wishlist / sourcing |
| `/tech-tree` | `tech-tree/page.tsx` | Capability cards with spotlight (graph tracked in #111) |
| `/datacore` | `datacore/page.tsx` | Datacore — insights, plans, briefings, Hardware Library, Beast Console |
| `/design/*` | `design/` | Design/theme sandbox routes |
| `/api/hangar/*` | `api/hangar/` | API: items read path, preflight |

### Components — `src/components/`

- `Shell.tsx` — app chrome: desktop sidebar, `MobileNav`, theme switch, inventory-read banner.
- `board/` — ConnectedTwin canvas (`TwinCanvas`, `Module`, `Port`, `Wire`, `NetInspector`, `Controls`).
- `datacore/beast-console/` — Beast Console tabs (Bench/Live Plug, Mount, Power, Reference) + `console-store.ts`.
- `datacore/` — `HardwareLibrary`, `DriverBoardSchematic`, `BriefingMarkdown`.
- `RoverSchematic.tsx`, `UnitCard.tsx`, `InventoryDrawer.tsx`, `WiringDiagram.tsx`, `ui/` (Badges, Gauge, Primitives).

### Data spine — `src/data/`

- `types.ts` — the TypeScript truth for every domain shape.
- `hangar.ts` — the content: bays, units, missions, capabilities, wishlist, insights, activity.
- `wiring.ts` — the single wiring surface (29-cable loom) the Board and console project from.
- `datacore-briefings.ts` — Datacore document/briefing content.

### State & logic — `src/lib/`

`store.tsx` (HangarProvider state: mission lens, spotlight, objectives, preferences) plus
helpers: `compatibility`, `twin`, `schematic`, `documents`, `nav`, `format`,
`hangar-preferences`, `hangar-read-status`, `unit-shortcuts`.

### Postgres read path

- `src/server/hangar/` — server-side repository (`db.ts`, `read-model.ts`, `items.ts`,
  `validators.ts`).
- `src/app/api/hangar/` — HTTP surface over it (items, preflight).
- `db/hangar/` — `schema.sql`, `gen-seed.ts` -> `seed.sql`, `migrations/`, and
  [`standup.md`](../db/hangar/standup.md) — data/backend shape, cutover status.
- Static-fallback vs Postgres state must be loudly visible in the UI (`hangar-read-status`).

## Content & artifacts

- `content/datacore/` — longform markdown content served by the Datacore.
- `artifactIntake/` — research intake notes (BEAST vision, camera, LiDAR decisions).
- `keyArtifactstosort/` — vendor source artifacts (schematics, datasheets, CAD, archives)
  with `reference/INDEX.md` as the register; large archives ignored, tracked by index.
- `design/` — design assets (board, beast-storage dossiers).
- `docs/assets/` — audit screenshot evidence (e.g. the 2026-07-08 rich-GUI audit).
- `public/` — static assets served by Next.

## Docs

| Doc | Owns |
| --- | --- |
| [`docs/NORTH_STAR.md`](./NORTH_STAR.md) | Intent, goals, anti-goals |
| [`docs/deploy.md`](./deploy.md) | Verified deploy/runtime facts and gaps |
| [`docs/beast-ops.md`](./beast-ops.md) | BEAST-01 operating facts |
| [`docs/hardware-library.md`](./hardware-library.md) | CAD, schematics, datasheets reference |
| [`docs/rich-ui.md`](./rich-ui.md) | Rich UI reasoning checklist & anti-patterns |
| [`docs/plans/`](./plans/) | Work plans / handoff work orders |
| `db/hangar/standup.md` | Data/backend shape, seed, migrations, cutover status |
| `docs/history/` | Graveyard — evidence only, never guidance |

## Build, test, ship

- `Taskfile.yml` — front door (`task check` = lint + typecheck + tests + build);
  `npm run dev|build|lint|typecheck|test:run`; `npm run beast:probe` (zero-motion robot probe).
- `src/__tests__/` — vitest suite; `hangar-integrity.test.ts` enforces referential
  integrity on `hangar.ts`.
- `Dockerfile` + `.github/workflows/image.yml` — image build; runtime deploy lives in the
  `coldaine-k8cluster` repo, verified facts in `docs/deploy.md`.
- `bootstrap/` — machine tool install/verify scripts; `tools/` — probe/postinstall scripts.

## Not in the repo

- Cluster/runtime manifests and live state — sibling repo `coldaine-k8cluster`.
- Bulk vendor archives (`UGV-Beast-Archive/`, large zips) — object storage / re-downloadable,
  recorded in `keyArtifactstosort/reference/INDEX.md`.
