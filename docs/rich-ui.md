---
title: Rich UI quality bar
date: 2026-07-30
author: Patrick MacLyman
status: living
source: GitHub issue #115 (2026-07-08 browser audit)
---

# Rich UI quality bar

The Hangar's UI is the product. Plumbing and docs serve the visible command-center
experience — they do not replace it. This bar exists so agents do not treat visual work
as decoration, or "fix" a product gap by flattening a bespoke surface into generic cards.

Compact routing for agents lives in `AGENTS.md` (Rich UI quality bar). This document is
the working rubric.

## Reasoning checklist

Before changing a rich UI surface, write down or explain:

1. **Live object** — What real unit, mission, item, capability, bay, or cluster/runtime
   state is represented?
2. **Operator question** — What should Patrick understand or decide from this screen?
3. **Data source** — Which code/data/API fields back the display? If data is missing, how
   is that absence made visible?
4. **Domain metaphor** — What visual shape belongs to this thing specifically? Rover
   schematic, wiring board, off-board brain, operations wall, capability graph, sourcing
   ledger, bay map, etc.
5. **Interaction proof** — What can the user click, select, filter, inspect, or navigate
   that proves the surface is wired to the model?
6. **Preservation check** — What existing useful UI or behavior did the agent preserve
   while improving the surface?
7. **Mobile equivalent** — How does the same concept work on phone width without becoming
   a stack of generic cards?
8. **Verification story** — Which screenshots/interactions prove the screen is nonblank,
   legible, data-backed, and still on-brand?

## Anti-patterns

- Ripping out a rich surface because one condition or data path is wrong.
- Replacing a bespoke system view with plain cards.
- Adding process/docs while leaving the visible product weaker.
- Calling a page a graph, board, command center, or control surface when it does not
  visually express relationships or state.
- Hiding critical mobile navigation behind invisible horizontal scrolling without an
  affordance.
- Treating placeholder/future capacity as normal deployed hardware.
- Copying BEAST-specific rover visuals onto non-rover units.

## Reinforce on every nontrivial UI change

- UI-first product priority (see North Star G3/G4).
- Data-backed visual surfaces — absences loud, never silent.
- Bespoke domain metaphors per station/unit class.
- Preserve and upgrade; do not flatten.
- Verify desktop and mobile with screenshots for nontrivial UI work.

## Calibration (positive)

What "rich" means here — data-backed, domain-specific, visually alive:

- Dashboard and Board (wiring twin) — strong baselines from the 2026-07-08 audit.
- BEAST unit page (`RoverSchematic`, `ConnectedTwin`) and `/datacore` Beast Console —
  current high-water marks for systems surfaces.

Screenshot evidence from the audit (not frozen designs):
[`docs/assets/rich-gui-audit/2026-07-08/README.md`](./assets/rich-gui-audit/2026-07-08/README.md).

## Related backlog

Filed from the same audit; still open as of 2026-07-30:

| Issue | Surface |
| --- | --- |
| [#109](https://github.com/Coldaine/RobotOverview/issues/109) | Workstation off-board brain |
| [#110](https://github.com/Coldaine/RobotOverview/issues/110) | Missions operations board |
| [#111](https://github.com/Coldaine/RobotOverview/issues/111) | Tech Tree capability graph |
| [#112](https://github.com/Coldaine/RobotOverview/issues/112) | Inventory item detail |
| [#113](https://github.com/Coldaine/RobotOverview/issues/113) | Bay-specific systems views |
| [#114](https://github.com/Coldaine/RobotOverview/issues/114) | Mobile nav / first viewport |
