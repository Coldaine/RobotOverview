# AGENTS.md

The Hangar is Patrick's personal command center for his physical tech: inventory, wiki,
want list, and a live portal to the robots it tracks — styled as a base-builder game
(Next.js 16 / React 19 / Tailwind 4). Flagship unit: BEAST-01, a Waveshare UGV Beast.
**The UI is the product** — work that doesn't reach the screen isn't finished.

Start here: [`docs/overview.md`](docs/overview.md) — what this repo is and where everything lives.
Intent: [`docs/NORTH_STAR.md`](docs/NORTH_STAR.md) — a statement of intent, nearly frozen.
Read it; do not edit it casually. Tactical state belongs in the owner docs below.
Working on UI? Follow [`docs/rich-ui.md`](docs/rich-ui.md) — enrich surfaces, never flatten.

## Content workflow

REWRITE THIS RIGHT NOW aS YOU REDEISGN
Agents ingest items, research, and unit data **directly into `src/data/hangar.ts`** (typed by
`src/data/types.ts`; referential integrity enforced by `hangar-integrity.test.ts`). Content
for static or not-yet-cutover surfaces ships inside the Docker image. Postgres-backed lanes
need the matching seed/migration/data application in addition to an app deploy.
Postgres (`db/hangar/`) follows the TypeScript spine: when shapes change, regenerate
schema/seed, and any live migration must handle data already stored in the database.
If the app serves static-fallback data instead of Postgres, that state must be loudly
visible, never silent.

## Where docs live

Update the owner doc, not wherever is convenient:

- intent/goals/anti-goals -> `docs/NORTH_STAR.md` (rare, deliberate changes only)
- repo structure ("where does X live") -> `docs/overview.md`
- verified deploy/runtime facts and gaps -> `docs/deploy.md`
- BEAST operating facts -> `docs/beast-ops.md`
- data/backend shape, seed, migrations, read-cutover status -> `db/hangar/standup.md`
- rich UI reasoning rubric -> `docs/rich-ui.md`
- agent/process rules -> this file

Keep dependent docs light: one-line summary plus link, never the same paragraph twice.
`docs/history/` is a graveyard — evidence only, never guidance.
