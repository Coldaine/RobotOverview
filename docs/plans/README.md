# Plans

Proposed work, written to be executed by an agent that was not present when the plan was written.
A plan here is a work order, not a record of reasoning: it names inputs, what to do, what to emit,
and how to tell when it is done.

**Code is truth.** A plan describes intended work; it never governs. If a plan and the code
disagree, the code is right and the plan is stale.

## Active — BEAST-01 Jetson conversion

Read in this order. The first two are coupled; the third is independent and time-critical.

| Plan | What it covers | Blocking? |
| --- | --- | --- |
| [Architecture unification](2026-07-27-architecture-unification.md) | One wiring spine, two views (The Board + BEAST Console). Grain-tagged nets so a fact is written once. **Owns the persistence question** for the plan below. | S1 fixes live contradictions between the two views |
| [Extract everything we hold](2026-07-27-schematic-netlist-extraction-plan.md) | Full corpus inventory — schematics, firmware, photographs — what each can still tell us, and how to finish the wiring model. | Q1/Q2 are safety-relevant: wrong 40-pin numbering puts 5 V into a Jetson UART pin |
| [CAD assets](2026-07-27-cad-assets-usage-and-discoverability.md) | Where the CAD lives, three filename traps, and what it is for. | **X1 gates drilling.** Run before making holes |

## Active — source enumeration

| Plan | What it covers |
| --- | --- |
| [Enumerate the ROS Driver schematic PDF](2026-07-27-ros-driver-pdf-enumeration.md) | One bounded extraction: turn the supplied board schematic into a single canonical YAML file, then stop. |

## Reference

| Plan | Status |
| --- | --- |
| [Robot control LLMs briefing](2026-07-22-robot-control-llms-briefing.md) | Background research; cited from `hangar.ts` unit records |
| [BEAST NVMe storage — design](2026-07-11-beast-nvme-storage-design.md) | Shipped |
| [BEAST NVMe storage — implementation](2026-07-11-beast-nvme-storage-implementation.md) | Shipped |

## Related, outside this directory

- `docs/history/keyartifacts-intake-2026-07-27.md` — identity index for `keyArtifactstosort/`
  (what each file *is*; the extraction plan covers what each file *contains*)
- `keyArtifactstosort/agents.md` — **nothing in that directory may be deleted**
