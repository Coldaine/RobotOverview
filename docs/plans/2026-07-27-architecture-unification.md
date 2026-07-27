# Unite the wiring architecture — one spine, two eyes

**Status:** PARTIALLY EXECUTED — 2026-07-27. Read Part 3 before starting; some of this has landed.

**This plan does not merge The Board and the BEAST Console.** Both views stay. They are different
eyes on the same robot and the owner has decided both are worth keeping. What unites is the *data
underneath them*, so that a fact learned once is written once and appears in both.

---

## Done condition

1. A newly learned hardware fact is added in **one** place, and both views reflect it.
2. Neither view can contradict the other, because neither holds its own copy of the facts. Not
   "divergence is detected" — divergence is **not representable**.
3. The console's data is typed and integrity-checked to the same standard as the spine.
4. There is no half-built infrastructure left ambiguous — every table either has a read path or is
   explicitly marked unread.

---

## Part 1 — What is actually there

**Five wiring surfaces, four join keys.** An earlier version of this plan said three; that was wrong,
and the error came from inventorying the data files without reading the consumption layer.

| Surface | Route | Data source | Joins on |
| --- | --- | --- | --- |
| The Board | `/board` | `hangar.ts` nets → `twin.ts` | terminal id |
| Live Plug | `/datacore` | `bench-data.ts` | port / peripheral id |
| DriverBoardSchematic | `/datacore/[docId]` | own `BOARD_PORTS` + loadout | **slot name string** |
| RoverSchematic | unit page | `beast.hotspots` | hotspot id |
| WiringDiagram | inside RoverSchematic | **5 hardcoded SVG paths** | hotspotId booleans |

**Data flow:** `hangarData` is static and immutable → `HangarProvider` (`src/lib/store.tsx`) layers
user overrides → `useHangar()`. Four surfaces go through it. **Live Plug bypassed the store
entirely**, which is why it drifted furthest.

### The problems

**P1 — A fact has no single home.** The verified 2026-07-27 findings went into the console because
that was the file open at the time. The twin contradicted all three for two days.

**P2 — Grain mismatch.** The spine models 11 inter-module nets; the console models 29
connector-level cables. Same robot, ~2.5× resolution. Neither is wrong and neither contains the
other.

**P3 — The richer model was the ungoverned one.** The console had 39 ports and 16 peripherals against
the spine's 25 terminals, and the spine has **no Audio HAT terminals at all**. Folding the console
into the spine would have meant folding the better model into a coarser one that is missing a board.

**P4 — The twin's Postgres tables are built and unread.** Migration `2026-07-03-connected-twin.sql`
created `terminals`, `nets`, `net_terminals`, `documents`, `net_documents`; `gen-seed.ts` emits rows
for all of them; `readWithStaticFallback` is the proven pattern. No repository, no route. Dead weight
that looks alive.

---

## Part 2 — The design

**One net collection, tagged by grain. Each view filters to the grain it renders.**

| Grain | Meaning | Rendered by |
| --- | --- | --- |
| `module` | Board-to-board / subsystem trunk | The Board |
| `connector` | One physical cable between two named ends | Live Plug |
| `internal` | Intra-board rail (`VDD5V`, the M2 gate) | Net inspector detail, on demand |

A `connector` net names its parent `module` net, so "which cables make up this trunk?" is a filter,
not a guess. Adding a fact is one operation: write one net at the right grain.

### What each view keeps

Unification is at the data layer only.

| Stays with the view | Why |
| --- | --- |
| `PortDef` x/y/side, `BoardDef` chips, `palette.ts` | Diagram layout — presentation, not fact |
| Plug state (`console-store.ts`) | Session state |
| `CONVERSION_STEPS` | An ordered procedure, not a wiring model |
| `buildBoardLayout` / `buildIsoLayout` / `buildBusLayout` | View projections |

**A coordinate is not a fact. A voltage is.**

### Alternative considered and rejected

*Keep both models separate; add a consistency test asserting overlapping claims agree.*

**Rejected outright.** It is a second linter guarding two copies of the same truth. You still write
every fact twice; the test only says when you forgot. The correspondence map it needs is the same map
the migration needs — so write the map once, as the thing that unites them.

---

## Part 3 — What is already done

**Read this before starting.** A partial refactor landed 2026-07-27 (PR #130). It is real, tested,
and pushed. Do not redo it, and do not assume the design above is unstarted.

| Landed | Where | Commit |
| --- | --- | --- |
| The 29-cable loom moved to a shared surface | `src/data/wiring.ts` | `e6dec6f` |
| `Build` and `PortCategory` moved to the spine | `src/data/types.ts` | `ecf8414` |
| **The console derives its loom** — `EXPECTED_CABLES` projects from `WIRING_LINKS` | `bench-data.ts` | `ecf8414` |
| Wiring integrity suite: projection fidelity, the `DriverBoardSchematic` label join, orphan count | `src/__tests__/wiring.test.ts` | `ecf8414` |
| One generic briefing route; bespoke per-doc page deleted | `/datacore/briefing/[slug]` | `d15502f` |
| Twin's Type-C bridges corrected `CP2102` → CH343P; callouts 6 / 7 identified | `hangar.ts` terminals | `ea4411e` |

**The state this leaves:** the console is fed from the shared surface. **The Board is not** — it still
reads `hangar.ts` nets directly. `parentNet` on each link is a *reference*, not a feed. So a fact is
written once for one view and separately for the other: the original problem, half-solved, which is a
worse resting state than either end.

`grain` was never added to `Net`. The tasks below assume it does not exist yet.

---

## Part 4 — The work

Each task states input, what to do, what to emit, and how to know it is done. **W1 closes the
half-finished state and goes first.**

### W1 — The Board consumes the wiring surface *(closes the partial refactor)*

- **Input:** `src/lib/twin.ts`, `src/data/wiring.ts`, `hangar.ts` `nets[]`.
- **Do:** add `grain` and `parentNet?` to `Net` in `types.ts`. Tag the existing 11 nets `module`.
  Have the twin's net list come from one exported selector rather than reading `hangarData.nets`
  directly, so both views draw from the same call.
- **Emit:** `netsAtGrain(grain)` in `wiring.ts`, consumed by both `twin.ts` and the console.
- **Done when:** neither view reads a wiring collection the other cannot see, `wiring.test.ts`
  asserts it, `task check` passes, and The Board renders identically before and after.
- **Care:** the only task here that can regress a working UI. Snapshot both views first.
- **Do not half-land this.** A surface feeding one view and not the other is worse than either
  endpoint, because the next reader cannot tell which is authoritative. If it cannot be finished,
  do not start it.

### W2 — Close the 7 orphan strands

- **Input:** `orphanLinks()` — speaker, spotlight, ESP32 antenna, the HAT USB uplink on both builds,
  Jetson Wi-Fi, the Mid-360S Ethernet run.
- **Do:** for each, add the module-grain trunk it belongs to, or record why the subsystem has none.
- **Done when:** every remaining orphan has a stated reason rather than an absence. The count is
  pinned in `wiring.test.ts`; lowering it is a deliberate edit.

### W3 — Decide what the loadout surfaces are

- **Input:** `WiringDiagram.tsx`, `RoverSchematic.tsx`, `DriverBoardSchematic.tsx`.
- **The problem:** these draw connection lines from *installation* state, not wiring data.
  `WiringDiagram` holds five connections as literal SVG path strings gated on whether a loadout slot
  is filled. `DriverBoardSchematic` joins to the spine on a human-readable label. Nothing states the
  line between **installed** (is a module slotted) and **cabled** (which wire runs where) — which is
  how a path string became a wiring claim.
- **Do:** state that line, then either bring these onto the wiring surface or document them as
  loadout views that deliberately do not model cables.
- **Done when:** no surface makes a wiring claim from data that does not describe wiring.
- **Note:** the label join is already pinned by a test, so it cannot break silently meanwhile.

### W4 — Consume the schematic enumeration *(the missing link)*

**Nothing currently covers this.** The enumeration plan deliberately stops at YAML and forbids
touching the app. Something must carry it the rest of the way.

- **Input:** `content/datacore/ros-driver-schematic-enumeration.yaml`, produced by
  [the enumeration plan](2026-07-27-schematic-netlist-extraction-plan.md).
- **Do:**
  1. Read the YAML. **Do not re-derive anything from the PDF** — that plan owns extraction, this one
     owns consumption.
  2. Map its claim states onto the model. Only `visible` and `visually-traced` claims may become
     `internal`-grain nets. `ambiguous` and `not-determinable-from-source` become `OPEN_ITEMS`
     entries, never silent omissions.
  3. Carry the source location through. A net derived from zone `C6` cites `C6`, not the whole PDF.
  4. Where the enumeration contradicts an existing record, **record both and escalate.** Do not edit
     either side to agree.
- **Emit:** `internal`-grain nets, updated `OPEN_ITEMS`, and a view of the driver board's internal
  rails reachable from the app.
- **Done when:** the question that started all of this — *which 5 V net reaches the 40-pin header,
  pre- or post-M2* — is answerable on screen with a zone citation, or recorded as not determinable.
- **Why it matters:** extraction that lands in a YAML file nothing reads is the same failure as a
  plan that lands in `docs/` nothing renders.

### W5 — Resolve the dead Postgres tables

- **Do:** either add a nets/terminals repository following `src/server/hangar/items.ts` and wire it
  through `readWithStaticFallback`, or record in `db/hangar/standup.md` that the twin tables are
  seeded-but-unread by design, with the reason.
- **Done when:** no reader has to guess whether the Postgres twin path works.
- **Recommendation:** the former. The pattern exists, `items.ts` proves it, the seed is already
  generated — what remains is one repository and one route.

### W6 — Rewrite the AGENTS.md content workflow

- **Input:** the `## Content workflow` section, carrying the operator's note
  `REWRITE THIS RIGHT NOW aS YOU REDEISGN`.
- **Do:** it says agents ingest "directly into `src/data/hangar.ts`". After W1 that is incomplete —
  wiring facts land in `wiring.ts`, and briefings are records in `datacore-briefings.ts` pointing at
  markdown that stays where it was authored. Describe what is true once W1 lands.
- **Done when:** an agent following that section alone puts a new fact in the right place.

---

## Part 5 — Rules for whoever picks this up

- **A wiring fact is a net.** Pick the grain, write one record, cite the zone or image region proving
  it.
- **Layout coordinates are not facts.** They live with the view that draws them.
- **A disagreement between sources is never resolved by editing one to match.** Both claims stay; the
  conflict goes to `OPEN_ITEMS` naming both. Silent convergence turns one wrong fact into two.
- **Source precedence:** firmware source > schematic > vendor callout diagram > wiki > inference. For
  *physical identification* — which connector is which — the callout diagram outranks the schematic.
  They answer different questions.
- **New views are new projections, not new stores.** A third eye is welcome; a third copy is not.
- **Work that does not reach the screen is not finished** (North Star G4). A data model with no view
  is unfinished work.

---

## Companion plans

- [Enumerate the ROS Driver schematic PDF](2026-07-27-schematic-netlist-extraction-plan.md) — bounded
  visual extraction into YAML. **W4 is its consumer**; that plan deliberately does not touch the app.
- [CAD assets](2026-07-27-cad-assets-usage-and-discoverability.md) — the archives, three filename
  traps, U1–U6 uses. **X1 gates drilling** and is independent of this work.
