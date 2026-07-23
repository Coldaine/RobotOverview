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

## Live owner docs

- `docs/NORTH_STAR.md` — intent, goals, anti-goals.
- `docs/deploy.md` — verified deployment facts and gaps.
- `docs/beast-ops.md` — BEAST-01 operating facts (network, protocol, telemetry, safety).
- `docs/hardware-library.md` — CAD, schematics, datasheets & firmware to reference when
  designing (the Datacore Hardware Library surface + where the library store lives).
- `db/hangar/standup.md` — data/backend shape, seed, migrations, and read-cutover status.
- `AGENTS.md` — this file.

## Content workflow

Agents ingest items, research, and unit data **directly into `src/data/hangar.ts`** (typed by
`src/data/types.ts`; referential integrity enforced by `hangar-integrity.test.ts`). Content
for static or not-yet-cutover surfaces ships inside the Docker image. Postgres-backed lanes
need the matching seed/migration/data application in addition to an app deploy.
Postgres (`db/hangar/`) follows the TypeScript spine: when shapes change, regenerate
schema/seed, and any live migration must handle data already stored in the database.
If the app serves static-fallback data instead of Postgres, that state must be loudly
visible, never silent.

## Documentation workflow

Nontrivial documentation changes must run this workflow before editing; typo-only edits may
reduce it to "confirmed no ownership or status impact." This section is the workflow; do not
require agents to read another process doc first.

1. Classify the change: intent, deployment/runtime fact, BEAST operation, data/backend shape,
   agent/process rule, or historical evidence.
2. Verify against the real source first: `src/`, `db/hangar/`, `.github/workflows/`, cluster
   manifests, or live state. Then update the owner doc:
   - intent/goals/anti-goals -> `docs/NORTH_STAR.md`
   - verified deploy/runtime facts and gaps -> `docs/deploy.md`
   - BEAST operating facts -> `docs/beast-ops.md`
   - data/backend shape, seed, migrations, and read-cutover status -> `db/hangar/standup.md`
   - agent/process rules and command routing -> `AGENTS.md`
3. Keep dependent docs light when another doc genuinely needs context: one-line summary plus
   link. Do not copy the same current-state paragraph everywhere.
4. Search for stale repeats before finishing when touching status-bearing docs. At minimum check
   the changed phrase across `AGENTS.md`, `docs/`, `db/hangar/`, `.github/`, and `src/`.
5. Leave `docs/history/` historical. Use it as evidence only after checking current code,
   manifests, or live state; do not move its old process machinery back into the live docs.

## Commands

`Taskfile.yml` is the agent/operator front door. Keep `npm` scripts as app-local commands,
and treat `justfile` as optional sugar only.

- Dev: `npm run dev` · Build: `npm run build` · Lint: `npm run lint` · Typecheck: `npm run typecheck` · Test: `npm run test:run`
- Full check: `task check` (lint + typecheck + tests + build)
- Robot probe (safe, zero-motion): `npm run beast:probe`

## Branch workflow

Branch from `main` (or the newest relevant stack tip when stacking), open a PR, keep each PR
scoped to one concern. Never mix repos in one commit.
