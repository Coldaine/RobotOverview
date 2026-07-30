# AGENTS.md

The Hangar is Patrick's personal command center for his physical tech: inventory, wiki,
want list, and a live portal to the robots it tracks — styled as a base-builder game
(Next.js 16 / React 19 / Tailwind 4). Flagship unit: BEAST-01, a Waveshare UGV Beast.
**The UI is the product** — work that doesn't reach the screen isn't finished.

Start here: [`README.md`](README.md) — what this repo is and where everything lives.
Intent: [`docs/NORTH_STAR.md`](docs/NORTH_STAR.md) — a statement of intent, nearly frozen.
Read it; do not edit it casually. Tactical state belongs in the owner docs below.
Working on UI? Follow [`docs/rich-ui.md`](docs/rich-ui.md) — enrich surfaces, never flatten.

## Content workflow

**Postgres is canonical.** Facts that appear in the Hangar UI are written through the
ingest API against the live app / database — not by editing TypeScript.

```http
POST https://hangar.moosegoose.xyz/api/hangar/ingest
Authorization: Bearer $HANGAR_INGEST_TOKEN
Content-Type: application/json

{ "entity": "<kind>", "record": { "id": "…", … } }
```

Kinds: `unit` · `item` · `mission` · `wishlist` · `capability` · `insight` ·
`activity` · `terminal` · `net` · `document`. Token lives in Doppler
(`homelab`/`dev` → `HANGAR_INGEST_TOKEN`). See [`docs/deploy.md`](docs/deploy.md).

`src/data/hangar.ts` is a **fixture / offline fallback** and bootstrap source for
`npm run hangar:seed-spine`. Do not treat it as the agent write mouth. Types live in
`src/data/types.ts`; integrity tests still guard the fixture shape. Schema/migrations
live in `db/hangar/`. If the UI is on static fallback, that state must be loudly visible.

Research notes may still land in `content/` or intake dirs; **Hangar facts go through ingest.**

## Where docs live

Update the owner doc, not wherever is convenient:

- intent/goals/anti-goals -> `docs/NORTH_STAR.md` (rare, deliberate changes only)
- repo structure ("where does X live") -> `README.md`
- verified deploy/runtime facts and gaps -> `docs/deploy.md`
- BEAST operating facts -> `docs/beast-ops.md`
- data/backend shape, seed, migrations, read-cutover status -> `db/hangar/standup.md`
- rich UI reasoning rubric -> `docs/rich-ui.md`
- agent/process rules -> this file

Keep dependent docs light: one-line summary plus link, never the same paragraph twice.
