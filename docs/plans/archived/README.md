# Archived plans — pending extraction, then deletion

These files were moved out of the live plan set on 2026-08-02 when the
[BEAST-01 Agent Architecture](../2026-08-02-beast-agent-architecture.md) master plan
became the single accepted plan set. They are kept here **temporarily** so anything
still valuable can be reviewed and extracted into the live plans or owner docs.

**After review and extraction, they will be deleted.** Git history is the long-term
archive; do not treat this directory as permanent storage, and do not link to these
files from new work.

| File | What still matters in it | Extraction target |
| --- | --- | --- |
| [2026-07-31-beast-command-deck-spec.md](2026-07-31-beast-command-deck-spec.md) | Approved cockpit contract: closed topic globs, loopback bridge + Tailscale Serve WSS, safety model (capability vs permission), visual language, sensor-spine verdict | Master plan Set 1b subplan + the future `docs/beast-control-topology.md` (PR-0); then delete |
| [2026-07-30-wiring-model-completion.md](2026-07-30-wiring-model-completion.md) | Wiring workstream work order (The Board / BEAST Console): Phases 2–5, Q1–Q8 open questions, X1–X6 CAD gates. Also mirrored as the Datacore `wiring-model-completion` briefing | This is a **separate active workstream**, not part of the agent architecture. Extract remaining phases into a fresh work order when the workstream resumes; then delete |

Note: the wiring plan is corpus-tracked (`db/hangar/research-corpus-registry.ts`
`source` field and the briefings parity test point here). Any further move or deletion
must update the registry, the parity test constant, and regenerate the corpus/seed.
