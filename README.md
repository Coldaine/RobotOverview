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
3. **Runtime.** Cluster manifests live in **`coldaine-homelab`**
   (`infra/k8s/apps/hangar/`), reconciled by Flux.
4. **Beast control.** Hangar proposes; the Jetson disposes. Dual-repo map, authority
   stack, topic map, and machine topology:
   [`docs/beast-control-topology.md`](docs/beast-control-topology.md). Live SSH /
   boot / voltage facts stay in [`docs/beast-ops.md`](docs/beast-ops.md).

## Where things live

`src/app` routes · `src/components` UI · `src/data` types + fixture · `src/server/hangar`
Postgres/Drizzle · `db/hangar` schema/migrations · `docs` owner docs.

**Not in this folder (sibling / other repos):**

| What | Where |
| --- | --- |
| Robot ROS brain (`ugv_ws`) | `D:\_projects\ugv_ws` + worktrees `D:\_projects\.worktrees\ugv_ws-*` → [Coldaine/ugv_ws](https://github.com/Coldaine/ugv_ws) |
| On-robot checkout | `beast@beast-01:~/beast/ugv_ws` (same GitHub remote) |
| Cluster / Flux manifests | `coldaine-homelab` |
| Bulk vendor archives | object storage; index in `keyArtifactstosort/reference/INDEX.md` |

Research bodies live in Postgres, not the repo. Full dual-repo map:
[`docs/beast-control-topology.md`](docs/beast-control-topology.md).

## Run it

`npm run dev` · `task check` / `npm run check` ·
`npx tsx db/hangar/gen-seed.ts --out db/hangar/seed.sql` (fixture→seed) ·
`npx tsx db/hangar/ingest-research-corpus.ts` (corpus replay; needs `HANGAR_DB_*`) ·
`npm run beast:probe` (zero-motion robot probe)
