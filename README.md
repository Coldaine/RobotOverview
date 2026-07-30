# The Hangar

Patrick's command center for his physical tech — inventory, wiki, want list, and a live
portal to the robots it tracks, styled as a base-builder hangar (Next.js 16 / React 19 /
Tailwind 4). Flagship unit: BEAST-01, a Waveshare UGV Beast. **The UI is the product.**

- Intent (nearly frozen): [`docs/NORTH_STAR.md`](docs/NORTH_STAR.md)
- Agent routing: [`AGENTS.md`](AGENTS.md)

## How the pieces fit

Two flows run through the repo:

1. **Research -> content.** Notes in `artifactIntake/` and vendor artifacts in
   `keyArtifactstosort/` (register: `reference/INDEX.md`) become entries in
   `src/data/hangar.ts`, shaped by `src/data/types.ts` and integrity-checked by
   `hangar-integrity.test.ts` — then reach the screen in `src/app/`.
2. **Types -> database.** The TypeScript spine drives `db/hangar/` (`schema.sql`,
   `gen-seed.ts` -> `seed.sql`, `migrations/`). Static content ships in the Docker image;
   Postgres lanes ship via `src/server/hangar/` + `src/app/api/hangar/`. Static-fallback
   state must be loudly visible in the UI.

## Where things live

`src/app` routes · `src/components` UI (Shell, Board twin, Datacore console) ·
`src/data` content spine · `src/lib` state & helpers · `db/hangar` Postgres ·
`content` longform · `docs` owner docs (`deploy`, `beast-ops`, `rich-ui`, `hardware-library`,
`plans/`) · `db/hangar/standup.md` data status.

Not here: cluster/runtime manifests (`coldaine-k8cluster` repo) and bulk vendor archives
(object storage; indexed in `keyArtifactstosort/reference/INDEX.md`).

## Run it

`npm run dev` · `task check` (lint + typecheck + tests + build) ·
`npm run beast:probe` (zero-motion robot probe)
