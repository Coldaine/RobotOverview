# The Hangar

Patrick's command center for his physical tech — inventory, wiki, want list, and a live
portal to the robots it tracks, styled as a base-builder hangar (Next.js 16 / React 19 /
Tailwind 4). Flagship unit: BEAST-01, a Waveshare UGV Beast. **The UI is the product.**

- Intent (nearly frozen): [`docs/NORTH_STAR.md`](docs/NORTH_STAR.md)
- Agent routing: [`AGENTS.md`](AGENTS.md)
- Deploy (live cluster facts): [`docs/deploy.md`](docs/deploy.md)

## How the pieces fit

1. **UI ↔ Postgres.** The Hangar app reads the fleet spine from Postgres
   (`content_snapshots` / Drizzle). Agents and operators **ingest** facts via
   `POST /api/hangar/ingest`. `src/data/hangar.ts` is a fixture/fallback, not the write path.
2. **Research → intake.** Notes in `artifactIntake/` and vendor artifacts in
   `keyArtifactstosort/` inform entries; durable Hangar facts still go through ingest.
3. **Normalized schema** in `db/hangar/` supports inventory queries, migrations, and
   preflight. Runtime hosting manifests live in **`coldaine-homelab`**
   (`infra/k8s/apps/hangar/`), reconciled by Flux.

## Where things live

`src/app` routes · `src/components` UI · `src/data` types + fixture · `src/server/hangar`
Postgres/Drizzle · `db/hangar` schema/migrations · `content` longform · `docs` owner docs.

Not here: cluster/runtime manifests (`coldaine-homelab`) and bulk vendor archives
(object storage; indexed in `keyArtifactstosort/reference/INDEX.md`).

## Run it

`npm run dev` · `task check` / `npm run check` · `npm run hangar:seed-spine` (DB bootstrap) ·
`npm run beast:probe` (zero-motion robot probe)
