# Plans

Proposed work, written to be executed by an agent that was not present when the plan was written.
A plan here is a work order, not a record of reasoning: it names inputs, what to do, what to emit,
and how to tell when it is done. Executed plans are deleted, not archived — git history is the
archive. Research briefings are not plans; they live in the Datacore `briefings` table.

**Code is truth.** A plan describes intended work; it never governs. If a plan and the code
disagree, the code is right and the plan is stale.

## Live work orders

| Plan | What it covers | Blocking? |
| --- | --- | --- |
| [BEAST immobile-session execution](2026-08-02-beast-immobile-execution.md) | Session work order while BEAST-01 is powered/plugged/immobile: Wave 0 ground truth → parallel motion-locked landings → on-robot prove (`/scan`, dynamic gate, bridge) → disarmed agent path. Hard-bans arming, crawl+kill, UPS I²C. | Gate A (reachable + motion locked) blocks Waves 1–3; crawl+kill remains deferred |
| [BEAST-01 Agent Architecture (master)](2026-08-02-beast-agent-architecture.md) | Typed NL → offboard LLM → bounded Jetson skills; consolidated architecture + sequencing ladder. Subplans: [safety spine](2026-08-02-beast-agent-pr1-safety-spine.md) · [power](2026-08-02-beast-agent-pr2-power-telemetry.md) · [lidar/slam/nav](2026-08-02-beast-agent-pr3-lidar-slam-nav.md) · [agent command](2026-08-02-beast-agent-pr4-agent-command.md) · [hygiene](2026-08-02-beast-agent-pr5-hygiene.md). Absorbs the Command Deck workstream's remaining ugv_ws phases; its [cockpit spec](archived/2026-07-31-beast-command-deck-spec.md) stays the approved contract (archived, pending extraction). | Set 1 watchdog re-gate blocks all motion-bearing work |

## Archived (pending extraction, then deletion)

Everything not in the accepted 2026-08-02 set was moved to [`archived/`](archived/) on
2026-08-02 — currently the Command Deck cockpit spec and the wiring-model plan. See
[`archived/README.md`](archived/README.md) for what still matters in each and where it
gets extracted to. They are not live work orders and will be deleted after extraction.

## Related, outside this directory

- Datacore briefings `artifact-intake` / `beast-evidence-manifest` — identity index and
  evidence register for `keyArtifactstosort/` (formerly markdown registers; read in Datacore)
- `keyArtifactstosort/Artifacts/ros-driver/` — traced-connectivity extraction outputs
  (the executed work of the deleted enumeration plan; Phase 3 of the wiring plan lands it)
- `keyArtifactstosort/agents.md` — binaries-only retention for that tree
- Robot-control LLM research (RND-ROBOT-LLM) lives as a Datacore briefing in Postgres,
  not as repo markdown
- Cockpit future enhancements (optics / spatial / teleop idea bank) —
  Datacore [`/datacore/briefing/beast-cockpit-future-roadmap`](/datacore/briefing/beast-cockpit-future-roadmap);
  thin pointer [`docs/beast-cockpit-future-roadmap.md`](../beast-cockpit-future-roadmap.md)
  (not a live work order under this directory)
