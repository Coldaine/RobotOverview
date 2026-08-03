# The Hangar

Patrick's command center for his physical tech — inventory, wiki, want list, and a live
portal to the robots it tracks, styled as a base-builder hangar (Next.js 16 / React 19 /
Tailwind 4). Flagship unit: BEAST-01, a Waveshare UGV Beast. **The UI is the product.**

- Intent (nearly frozen): [`docs/NORTH_STAR.md`](docs/NORTH_STAR.md)
- Agent routing: [`AGENTS.md`](AGENTS.md)
- Deploy (live cluster facts): [`docs/deploy.md`](docs/deploy.md)
- Beast access and operating facts: [`docs/beast-ops.md`](docs/beast-ops.md)

## How the pieces fit

1. **Research + facts → ingest → Postgres → screen.** Agents write via op verbs on
   `POST /api/hangar/ingest` ([`AGENTS.md`](AGENTS.md)). The UI reconstructs HangarData
   from normalized tables; Datacore briefings render from the `briefings` table.
2. **Types / fixture.** `src/data/hangar.ts` is a CI fixture and loud offline fallback.
   `db/hangar/` owns schema and migrations ([`db/hangar/standup.md`](db/hangar/standup.md)).
3. **Robot source.** BEAST-01's ROS 2 Humble workspace lives in
   [`robot/beast/ros2_ws`](robot/beast/ros2_ws). It shares this Git repository but remains a
   separate deployable surface from the Hangar web app.
4. **Runtime.** Cluster manifests live in **`coldaine-homelab`**
   (`infra/k8s/apps/hangar/`), reconciled by Flux.

## Where things live

`src/app` routes · `src/components` UI · `src/data` types + fixture · `src/server/hangar`
Postgres/Drizzle · `db/hangar` schema/migrations · `docs` owner docs ·
`robot/beast/ros2_ws` robot-side ROS workspace.

Not here: cluster/runtime manifests (`coldaine-homelab`) and bulk vendor archives
(object storage; indexed in `keyArtifactstosort/reference/INDEX.md`). Research bodies
live in Postgres, not the repo.

There is one source repository and two deployments: the Hangar app deploys to the cluster;
only `robot/beast/ros2_ws` is built and run on the Jetson. Never deploy the Next.js app to
BEAST-01.

## Run it

`npm run dev` · `task check` / `npm run check` ·
`npx tsx db/hangar/gen-seed.ts --out db/hangar/seed.sql` (fixture→seed) ·
`npx tsx db/hangar/ingest-research-corpus.ts` (corpus replay; needs `HANGAR_DB_*`) ·
`npm run beast:probe` (zero-motion robot probe)
