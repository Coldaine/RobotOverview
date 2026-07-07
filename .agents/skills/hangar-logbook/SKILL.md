---
name: hangar-logbook
description: Record durable Hangar mission, Beast operations, inventory, research, and repository updates. Use when preserving what happened in RobotOverview, adding mission after-action notes, recording field insights, adding activity-ticker events, updating Beast runbook facts, or deciding which Hangar surface should hold a durable update.
---

# Hangar Logbook

Turn session work into durable Hangar memory without confusing the delivery mechanism
with the product model.

## Core Rules

- Pick a short uppercase codename before drafting the entry, e.g. `OP-BEAST-CONTACT`,
  `MSN-UNDERCROFT-DRYRUN`, `INTK-BEAST-KIT`, `RND-WIFI-TAIL`, or `REP-DOC-GUARDRAILS`.
- Draft one coherent human record first; map it to storage surfaces after the record makes sense.
- Persist to existing Hangar surfaces. Do not invent a new log file unless the user asks.
- Omit secrets, passwords, tokens, private keys, and raw credential material.
- Keep Hangar supervised: record robot operations and navigation, not unattended control.
- Include next steps only when they exist, and persist them instead of leaving them only in chat.

## Current Persistence

Current persistence is source-backed:

- `src/data/hangar.ts` is the app-visible content spine.
- `src/data/types.ts` defines the TypeScript shape.
- `db/hangar/schema.sql`, `db/hangar/gen-seed.ts`, and `db/hangar/seed.sql` mirror the
  source-backed spine into Postgres.
- Content changes require a branch, commit, and PR because the content ships with the app image.

Postgres already has homes for the three logbook lanes: `insights`, `activity_log`, and
`mission_after_actions`. Before adding DB writes, keep writing through source-backed content and
regenerate the seed when source data changes.

## Storage Router

Use the narrowest durable home that fits:

- `missions[].afterAction`: mission-scoped debrief bullets and next mission steps. Rendered on
  mission detail pages as the after-action log.
- `insights[]`: durable field knowledge, decisions, gotchas, and research lessons. Rendered in
  the Codex page and linkable to units and missions.
- `activity[]`: one-line global timeline events for the command-center ticker.
- `docs/beast-ops.md`: BEAST network, endpoints, control protocol, telemetry, video recovery,
  safety, and operating procedure.
- `docs/NORTH_STAR.md`: only intent, goals, anti-goals, or product philosophy changes.
- `docs/deploy.md`: only verified deployment/runtime facts and gaps.
- `db/hangar/standup.md`: only data/backend shape, seed, migrations, and read-cutover status.
- `AGENTS.md`: only agent operating rules and command/workflow routing.

Do not use `docs/history/` as guidance. It is evidence only after checking current code, manifests,
or live state.

## Draft Shape

Draft this shape before editing files:

```markdown
## <CODENAME>
<Human Title>

Date: YYYY-MM-DD
Kind: beast-mission-update | mission-aar | inventory-update | research-update | repo-update
Unit: <unit id, callsign, or none>
Mission Links: <mission ids or none>
Status: planned | completed | completed-with-followups | blocked

### Signal
One tight paragraph with the important change.

### Timeline
- Factual sequence of the work.

### Outcome
- Current state after the work.

### Evidence
- Commands, endpoints, tests, screenshots, device readings, PRs, or observations that prove it.

### Lessons Learned
- Durable lessons or gotchas useful outside the original chat.

### Next Steps
- Required or optional follow-up, only when follow-up exists.

### Persistence Map
- Mission after-action:
- Insight:
- Activity:
- Runbook/docs:
```

## Apply The Entry

1. Inspect `src/data/types.ts`, `src/data/hangar.ts`, the relevant app page, and any owner doc
   before editing.
2. Add or update only the surfaces needed by the draft.
3. Preserve existing ID and ordering style. Use stable lowercase IDs for new records.
4. If `src/data/hangar.ts` changes, regenerate `db/hangar/seed.sql` with `db/hangar/gen-seed.ts`
   unless the change intentionally does not belong in seed data.
5. Run focused validation:
   - `npm run lint`
   - `npm run test:run` or focused tests touching the changed data/surface
   - `npm run build` when UI, routing, or generated data changed materially
6. Report exactly where the entry landed: mission id and after-action bullet, insight id,
   activity id, runbook/doc section, next-step location, commit hash, and PR link.

## Ask Before Editing

Ask for a quick user check before editing when the entry changes mission status or objectives,
introduces a new mission, records sensitive network/access facts, or the right home is ambiguous
between mission after-action, insight, activity, and runbook.
