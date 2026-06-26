---
name: hangar-logbook
description: Record durable Hangar mission, Beast operations, inventory, research, and repository updates. Use when reporting what happened in RobotOverview, preserving a Beast mission/update, converting chat work into Hangar state, adding mission log entries, preserving lessons learned, tracking next steps, updating the Beast runbook, or distinguishing current source-backed persistence from future database-backed persistence.
---

# Hangar Logbook

Use this workflow to turn session work into durable Hangar memory without confusing the delivery mechanism with the product model.

## First Principles

- Pick a short codename before drafting the entry.
- Write one coherent logbook entry first; map it to storage surfaces after the human record makes sense.
- Persist to the existing Hangar surfaces; do not invent a new log location unless the user asks.
- Treat PRs as the current delivery mechanism, not the conceptual logbook.
- Omit secrets, passwords, tokens, private keys, and raw credential material.
- Keep Hangar as supervised memory and navigation; do not turn it into unattended robot control.
- Include next steps only when they exist. If they exist, persist them instead of leaving them in chat.

## Current vs Future Persistence

Current alpha persistence is source-backed:

- `src/data/hangar.ts` is the app-visible data source.
- Durable content changes usually require a commit and PR because storage is code.
- `docs/beast-ops.md` is the Beast operating runbook.

Future persistence should be database-backed:

- Mission logs, insights, activity, and runbook-like records should become rows.
- A PR should only be needed for schema, UI, seed, migration, or workflow changes.
- Do not describe the PR itself as the logbook entry.

## Hangar Surfaces

Use the narrowest durable home that fits. Do not expose these implementation names as the user's logbook format unless helpful.

- `missions[].afterAction`: mission-specific log entries, after-action notes, and next mission steps.
- `insights[]`: the app's Codex knowledge records: distilled lessons, decisions, gotchas, and field knowledge linked by `units` and `missions`.
- `activity[]`: one-line global timeline events for the command-center ticker.
- `docs/beast-ops.md`: Beast endpoints, network facts, control protocol, telemetry, safety notes, programming progression, and other operating details.
- `docs/NORTH_STAR.md`: only intent, goals, anti-goals, or product philosophy changes.
- `docs/architecture.md`: only model, storage, data-flow, or system architecture changes.
- `AGENTS.md`: only agent operating rules. Do not edit it for ordinary logbook entries.

## Codename Rules

Use uppercase, hyphenated names. Prefix by work type when useful:

- `OP-...` for operations or Beast bring-up.
- `MSN-...` for mission work.
- `INTK-...` for inventory intake.
- `RND-...` for research.
- `REP-...` for repository maintenance.

Examples: `OP-HOTSPOT-ANCHOR`, `OP-AUDIO-PING`, `MSN-UNDERCROFT-DRYRUN`, `INTK-BEAST-KIT`.

## Draft Format

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

A tight one-paragraph readout of the most important change. This should make sense when scanned from a mission log months later.

### Timeline

- Factual sequence of the work.
- Include endpoints, components, decisions, and observed behavior when relevant.

### Outcome

- Current state after the work.
- What is now possible that was not possible before.

### Evidence

- Commands, endpoints, tests, screenshots, device readings, repo checks, or direct observations that prove the result.
- Never include secrets, passwords, tokens, private keys, or raw credential material.

### Lessons Learned

- Durable lessons, decisions, gotchas, or operating rules.
- Write these so they are useful outside the original chat.

### Next Steps

- Only include this section when follow-up work exists.
- Separate required next steps from optional exploration when needed.
- Include blockers or validation still needed.

### Persistence Map

- Mission log:
- Field notes:
- Activity:
- Runbook:
```

## Apply The Entry

After the draft is approved, translate it into the current storage surfaces:

- Mission log: concise bullets in `missions[].afterAction`.
- Field notes: one or more records in `insights[]` for lessons learned. The app may render these under "Codex", but the user-facing artifact should call them lessons learned or field notes.
- Activity: one one-line `activity[]` event.
- Runbook: update `docs/beast-ops.md` only for durable operating facts.

Use this storage mapping:

1. Inspect current `src/data/types.ts`, `src/data/hangar.ts`, `docs/beast-ops.md`, and relevant pages before editing.
2. Add or update only the surfaces needed by the draft.
3. Preserve existing IDs and ordering style. Use stable lowercase IDs for new insights and activity events.
4. Run focused validation:
   - `npm run lint`
   - `npm run build`
   - focused data/integrity tests if available
5. Report exactly where the entry landed:
   - mission id and `afterAction` bullets
   - insight id
   - activity id
   - runbook section if changed
   - next steps location if any were persisted
   - commit hash and PR link while source-backed
   - database row ids once DB-backed

## If Unsure

Prefer a draft for user review before editing when:

- the entry changes mission status or objectives,
- the entry introduces a new mission,
- the entry records sensitive network or access details,
- the correct home is ambiguous between mission AAR, Codex, activity, and runbook.
