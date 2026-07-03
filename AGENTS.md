# AGENTS.md

## Identity

The Hangar is a video-game-grade command center for Patrick's physical tech — inventory,
wiki, want list, and a live portal to the robots it catalogs, styled as a base-builder
hangar ("Dark Engineering HUD": blueprint grids, cyan/amber accents). Next.js 16 / React 19 /
Tailwind 4. The flagship unit is BEAST-01, a Waveshare UGV Beast.

**The UI is the product.** Prefer work that changes what's on screen. Plumbing, process, and
docs exist to serve the visible experience, never the other way around.

## Truth rules

- **Code is truth. Docs describe; they never govern.** Verify any doc claim against `src/`,
  `db/hangar/`, `.github/workflows/`, cluster manifests, or live state before building on it.
  No doc may require reading another doc before making a change.
- **Refetch before reading.** `git fetch --all --prune --tags` this repo and any sibling repo
  (especially `coldaine-k8cluster`) before reasoning about it; read against `origin/<branch>`
  if the local tree is stale or dirty.
- **Cluster truth lives in `coldaine-k8cluster`** (manifests + live `kubectl`), not in prose.
  This repo owns app code, `Dockerfile`, and content; the cluster repo owns runtime.
- `docs/history/` is a graveyard, not guidance. Do not resurrect its process machinery
  (evidence manifests, doc-ownership workflows, mandatory-read regimes).

## The four live docs

- `docs/NORTH_STAR.md` — intent, goals, anti-goals.
- `docs/deploy.md` — verified deployment facts and gaps.
- `docs/beast-ops.md` — BEAST-01 operating facts (network, protocol, telemetry, safety).
- `AGENTS.md` — this file.

## Content workflow

Agents ingest items, research, and unit data **directly into `src/data/hangar.ts`** (typed by
`src/data/types.ts`; referential integrity enforced by `hangar-integrity.test.ts`). Content
ships to production inside the Docker image — deploying the app is deploying the content.
Postgres (`db/hangar/`) follows the TypeScript spine: when shapes change, regenerate
schema/seed, and any live migration must handle data already stored in the database.
If the app serves static-fallback data instead of Postgres, that state must be loudly
visible, never silent.

## Commands

- Dev: `npm run dev` · Build: `npm run build` · Lint: `npm run lint` · Test: `npm run test:run`
- Full check: `task check` (lint + tests + build)
- Robot probe (safe, zero-motion): `npm run beast:probe`

## Branch workflow

Branch from `main` (or the newest relevant stack tip when stacking), open a PR, keep each PR
scoped to one concern. Never mix repos in one commit.
