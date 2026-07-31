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

Facts and research persist to Postgres via `POST /api/hangar/ingest` (Bearer
`HANGAR_INGEST_TOKEN` from Doppler `homelab`/`dev`). **Never edit `src/data/hangar.ts`
for content** — it is a CI fixture and loud offline fallback only. Types:
`src/data/types.ts`. Schema/migrations: [`db/hangar/standup.md`](db/hangar/standup.md).
Deploy facts: [`docs/deploy.md`](docs/deploy.md).

```http
POST /api/hangar/ingest
Authorization: Bearer $HANGAR_INGEST_TOKEN
Content-Type: application/json

{ "op": "<verb>", "input": { … } }
```

Research packs/briefings render at `/datacore` from the `briefings` table; the repo holds
code, tests, plans, and docs — never research bodies.

### Op verbs

| Op | Input shape |
| --- | --- |
| `append_insight` | `{ id, title, body, confidence: "high"\|"medium"\|"low", source?, bay?, capturedAt?, units?, missions?, tags? }` |
| `append_activity` | `{ id, kind: "acquired"\|"price-drop"\|"shipped"\|"insight"\|"mission"\|"researched", text, at? }` |
| `patch_status` | `{ target: "unit"\|"item"\|"wishlist", id, status }` |
| `assign_loadout` | `{ hostAssetId, slot, assetId: string\|null }` |
| `link_insight` | `{ insightId, units?, missions? }` |
| `land_unit` | Strict full unit record (`id`, `name`, `bay`, `class`, `status`, `summary`, `specs`, …) |
| `land_item` | Strict full inventory item (`id`, `name`, `bay`, `category`, `status`, `summary`, `description`, `specs`, …) |
| `land_wishlist` | Strict full wishlist (`id`, `name`, `category`, `rationale`, `price`, `status`, …) |
| `land_mission` | Strict full mission (`id`, `code`, `name`, `status`, `objective`, `requisitionedUnits`, `requiredLoadout`, `wishlist`, `objectives`, `constraints`, …) |
| `land_document` | Strict full document (`id`, `title`, `kind`, `libraryPath`, `url?`, `units?`, `note?`) |
| `land_briefing` | `{ id, title, kind: "research", summary, tags?, aliases?, packId?, capturedAt?, href?, bodyMarkdown }` — markdown body in `bodyMarkdown`; **never** write research markdown into the repo |
| `land_pack` | `{ id, title, code, summary, hubBriefingId?, topics: string[] }` |

Common path — `append_insight`:

```json
{
  "op": "append_insight",
  "input": {
    "id": "ins-beast-uart-5v-hazard",
    "title": "40-pin 5 V on UART pins will kill the Orin",
    "body": "Jetson Orin NX UART pins are 1.8 V. Do not land kit 5 V UART wiring on those pads.",
    "confidence": "high",
    "source": "Waveshare UGV Beast schematic + Jetson Orin NX pinmux",
    "bay": "robotics",
    "units": ["beast-01"],
    "missions": ["msn-orin-cutover"],
    "tags": ["wiring", "safety", "orin"]
  }
}
```

### Errors

Agents must read the response and fix the payload — do not retry blind.

- **400** — Zod validation (`issues` lists field errors)
- **401 / 503** — auth (`Unauthorized` / `HANGAR_INGEST_TOKEN` not configured) or DB unavailable
- **404** — missing entity (named `id` / `insightId` in body)
- **409** — bad refs or invalid status (named ids in `missingUnits`, `missingMissions`, `missingAssets`, `allowed`, …)

## Where docs live

Update the owner doc, not wherever is convenient:

- intent/goals/anti-goals -> `docs/NORTH_STAR.md` (rare, deliberate changes only)
- repo structure ("where does X live") -> `README.md`
- verified deploy/runtime facts and gaps -> `docs/deploy.md`
- BEAST operating facts -> `docs/beast-ops.md`
- data/backend shape, migrations, corpus + cutover status -> `db/hangar/standup.md`
- rich UI reasoning rubric -> `docs/rich-ui.md`
- agent/process rules -> this file

Keep dependent docs light: one-line summary plus link, never the same paragraph twice.
