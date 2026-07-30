# Finish the wiring model — one spine, two eyes

**Status:** ACTIVE — 2026-07-30. Supersedes and merges
`2026-07-27-architecture-unification.md` (half-executed) and
`2026-07-27-schematic-netlist-extraction-plan.md` (barely started), which were two dependent
halves of one pipeline. The CAD exploration tasks (X1–X6) from
`2026-07-27-cad-assets-usage-and-discoverability.md` are folded in as Phase 2b; that document's
reference half now lives in `docs/hardware-library.md`.

**This plan does not merge The Board and the BEAST Console.** Both views stay — they are
different eyes on the same robot. What unites is the data underneath, so a fact learned once is
written once and appears in both.

## Done condition

All five:

1. A newly learned hardware fact is added in **one** place, and both views reflect it. Divergence
   is not representable, not merely detected.
2. Every cable and rail on the assembled robot is represented with provenance appropriate to the
   claim: document-derived claims name a sheet zone or image region; as-built claims name the
   observation or measurement.
3. The twin view and the console view agree everywhere they overlap; updating one without the
   other fails CI **by name**.
4. Every `reference-data.ts` `OPEN_ITEMS` entry is closed with a recorded method or restated as
   genuinely unanswerable from what we hold.
5. Operator-critical material — the vacated Pi dock orientation, 40-pin numbering, which USB-C is
   which — is **on screen**, not only in markdown. Work that does not reach the screen is not
   finished (North Star G4).

---

## Where things stand (verified 2026-07-30)

Landed and tested — do not redo:

| Landed | Where |
| --- | --- |
| 29-cable loom on a shared surface, with `parentNet` references | `src/data/wiring.ts` |
| `Build` / `PortCategory` in the spine | `src/data/types.ts` |
| Console derives its loom (`EXPECTED_CABLES` projects from `WIRING_LINKS`) | `bench-data.ts` |
| Wiring integrity suite (projection fidelity, label join, orphan count = 7) | `src/__tests__/wiring.test.ts` |
| Twin Type-C bridges corrected CP2102 → CH343P; callouts 6/7 identified | `hangar.ts` |
| Traced connectivity extraction: 108 path edges, JSON + CSV + MD | `keyArtifactstosort/Artifacts/ros-driver/current/ros_driver_traced_connectivity_v1/` |

**The half-fed state (the reason this merged plan exists):** the console is fed from
`wiring.ts`; **The Board is not** — `ConnectedTwin.tsx` still reads `hangar.ts` nets directly.
`grain` was never added to `Net`; `netsAtGrain` exists nowhere. A fact is written once for one
view and separately for the other — the original problem, half-solved, which is worse than
either endpoint. **Phase 1 closes this and goes first. Do not half-land anything further.**

**Already answered but not yet in the app:** the traced connectivity artifact answers Q1 — the
host-header 5 V is on post-M2 `5V_MAIN`. It lives in the artifact store in a format no plan
specified; Phase 3 lands it as `internal`-grain nets.

---

## Phase 1 — Spine: The Board consumes the wiring surface

- **Input:** `src/lib/twin.ts`, `src/data/wiring.ts`, `hangar.ts` `nets[]`.
- **Do:** add `grain` and `parentNet?` to `Net` in `types.ts`. Tag the existing 11 nets
  `module`. Emit `netsAtGrain(grain)` in `wiring.ts`, consumed by both `twin.ts` and the
  console, so neither view reads a wiring collection the other cannot see.
- **Grains:** `module` (board-to-board trunk — The Board), `connector` (one physical cable —
  Live Plug), `internal` (intra-board rail, e.g. `VDD5V`, the M2 gate — net-inspector detail on
  demand). A `connector` net names its parent `module` net.
- **Done when:** The Board renders identically before and after, `wiring.test.ts` asserts both
  views draw from the same call, `task check` passes. **Care:** the only phase that can regress
  a working UI — snapshot both views first.

## Phase 2 — Extract the corpus

Safe to run unattended. T1/T2 are cheap and unblock the rest. Source roles: schematic = depicted
electrical connectivity; firmware source = intended GPIO for that revision; compiled image =
behavior encoded in that build (not proof it is flashed); callout diagram = vendor connector
identity (outranks the schematic for *physical identification*); photograph = as-built state at
capture time; observation = recorded test state only.

- **T1 — Tile the schematics.** Render the board PDFs (`public/datacore/pdfs/`) at high DPI, cut
  along each sheet's own printed zones. Emit `public/datacore/tiles/<board>/<zone>.png` +
  `index.json` (zone → PDF bbox). Verify legibility on M2/Q1/Q2 and the D1/D2/AMS1117 junction —
  a wrong magnification there already produced one wrong power claim.
- **T2 — Mine the firmware.** `strings`-diff both ESP32 images in `UGV_RoverFACTORY-260706.zip`;
  read pin definitions and command dispatch from `github.com/waveshareteam/ugv_ws` source. Emit
  a GPIO-to-function table and JSON command vocabulary into `docs/beast-ops.md`. Answers several
  OPEN_ITEMS for the cost of a clone — do early.
- **T3 — Read the photographs** (`keyArtifactstosort/`, priority: the vacated Pi dock image —
  highest safety value — then the Audio HAT pair, stack geometry, raw driver board). Distinguish
  *read from image* from *inferred*; "too low resolution" is a useful result. Non-wiring
  hardware facts go to `docs/hardware-library.md`.
- **T4 — Driver-board netlist.** From T1 tiles, dump text spans + vector paths (PyMuPDF), no
  interpretation; propose connections by proximity, confirm visually. Intermediate working data
  only, with the source PDF's SHA-256 recorded (these PDFs were silently corrupted by LFS
  dedup once). Review anomalies (single-member nets, unmatched labels/geometry, zone-spanning
  nets); **zero anomalies on a sheet this dense gets a deliberate second review.** Note: the
  off-spec `ros_driver_traced_connectivity_v1` artifact already covers much of this — consume it
  before re-deriving.
- **T5 — Diff ROS Driver vs General Driver.** Every place the repo cites General Driver guidance
  for a ROS Driver fact (possibly including the 65×65 / 49×58 mounting figures) is confirmed
  transferable or flagged.

### Phase 2b — CAD geometry (X1 gates drilling — run it before anything touches mounting)

Archives live on the `data/hardware-cad-assets` LFS branch; locations, fetch commands, and the
three verified filename traps are in `docs/hardware-library.md`. Do not trust filenames.

| # | Task | Why / output |
| --- | --- | --- |
| **X1** | Extract `UGV_Beast_PT_Jetson_Orin-3D.zip`; determine if it holds the host-bay plate with the Jetson hole pattern. | NVIDIA gates the P3768 hole XY behind a login; `MOUNT_LAYERS` currently says drill-and-hope. **Gates a physical, irreversible operation.** |
| **X2** | Extract driver-board outline + hole spacing from Beast STEP; compare 65×65 / 49×58. | Confirms or corrects `MOUNT_LAYERS`; retires the calipers caveat (= Q8). |
| **X3** | Extract mast + Picatinny rail geometry; check Mid-360S and OAK-D Pro fit and FOV clearance. | Mount feasibility for the future loadout. |
| **X4** | Diff PI4B vs PT drawing dimension sets. | Settles which archive applies to BEAST-01. |
| **X5** | Establish whether a Beast-specific Orin 2D drawing exists upstream. | Blocked: Waveshare wiki 403s automated fetches — needs a human browser. |
| **X6** | Assess STEP → mesh → URDF feasibility and cost. | Go/no-go for a dimensionally accurate robot description (TF, Nav2 collision). |

## Phase 3 — Land the facts in the model

- **Do:** consume T2–T5 and the traced-connectivity artifact into the wiring model. Only
  `visible` / `visually-traced` claims become `internal`-grain nets; `ambiguous` /
  `not-determinable` become `OPEN_ITEMS` entries, never silent omissions. Carry zone-level
  citations (`doc-ros-driver#C6`, not a bare 1 MB PDF). Re-evaluate the current claims about
  connector 6, the D500 route, and the Orin DC input against scoped sources; retain, revise, or
  flag each.
- **Conflicts:** never resolve a source disagreement by editing one side to match. Record both
  claims and escalate to `OPEN_ITEMS` naming both.
- **Done when:** Q1 is answerable on screen with a zone citation; integrity tests pass; no net
  cites a bare PDF where a zone exists.

## Phase 4 — On screen

- **Reconcile the views (W3 + T7):** state the line between **installed** (loadout slot filled)
  and **cabled** (which wire runs where). `WiringDiagram.tsx` currently makes wiring claims from
  five hardcoded SVG paths gated on loadout state; `DriverBoardSchematic` joins on a
  human-readable label (test-pinned). Bring them onto the wiring surface or document them as
  loadout-only views. Then assert the twin/console overlap pairs agree (`gdb-usb-esp32` ↔
  `drv-esp32-usb`, `orin-dc-in` ↔ `jet-barrel`, `net-d500-lidar` ↔ HAT lidar route,
  `net-5v-host` ↔ `drv-5v`) — divergence fails CI by name.
- **Operator-critical (T8):** the vacated Pi dock orientation and 40-pin numbering on screen —
  that is where a mistake puts 5 V into a Jetson UART pin. Zone tiles become the citation target
  when inspecting a net. Done when "where do the UART jumpers go" is answerable from the running
  app.
- **Derived views (T9):** generate a Mermaid power tree from the settled model (renders natively
  here and on GitHub); optionally SPICE as a portability escape hatch. Unverified relationships
  render visually distinctly or not at all.

## Phase 5 — Hygiene

- **W2 — Close the 7 orphan strands** (`orphanLinks()`: speaker, spotlight, ESP32 antenna, HAT
  USB uplink on both builds, Jetson Wi-Fi, Mid-360S Ethernet). Each gets its module-grain trunk
  or a recorded reason. Count is pinned in `wiring.test.ts`; lowering it is a deliberate edit.
- **W5 — Resolve the dead Postgres twin tables.** Migration `2026-07-03-connected-twin.sql`
  created `terminals`/`nets`/`net_terminals`/`documents`/`net_documents`; the seed emits rows;
  nothing reads them. Add a nets/terminals repository following `src/server/hangar/items.ts` +
  `readWithStaticFallback`, or record in `db/hangar/standup.md` that they are seeded-but-unread
  by design, with the reason. Recommended: the former — the pattern exists and the seed is
  already generated.
- **W6 — Rewrite the AGENTS.md content workflow** (the operator's `REWRITE THIS` note). After
  Phase 1, "ingest directly into `hangar.ts`" is incomplete: wiring facts land in `wiring.ts`,
  briefings are records in `datacore-briefings.ts` pointing at markdown that stays where it was
  authored. Done when an agent following that section alone puts a new fact in the right place.

---

## Questions to close

Live entries in `reference-data.ts` `OPEN_ITEMS`. When one closes, update it in the same change.

| # | Question | Answerable by | Priority |
| --- | --- | --- | --- |
| Q1 | Which 5 V net reaches the 40-pin header — pre- or post-M2? | **Answered in artifact** (post-M2 `5V_MAIN`); Phase 3 lands it, observation confirms | Blocking — the claim once asserted without tracing |
| Q2 | 40-pin numbering on the HAT's vacated dock | T2 + T3 + T4 | **Blocking, safety-critical** — wrong numbering puts 5 V into a Jetson UART pin |
| Q3 | M2 gate topology (Q1/Q2 MMBT3906, R18 100K / R19 470K) | T4 | High |
| Q4 | Is `3V3_OP` the same net as `3V3`? | T4 | Medium |
| Q5 | What supplies the bus servo rail? | T4 + `Bus_servo_control_circuit.pdf` | Medium |
| Q6 | Audio HAT USB uplink route | T3 only; **no HAT schematic exists** — may be undecidable from documents | High |
| Q7 | Does a spare 40-pin header (callout 14) exist on the assembled board? | T3 + physical look — likely two footprints, one bus | Medium |
| Q8 | Are 65×65 / 49×58 valid for the ROS Driver or inherited from the General Driver? | T5 or X2 | Medium — precedes drilling |

## What no document can answer

Prefer the least invasive method. First operational observation (narrows Q1, no instrument):
Jetson on mains barrel, battery pack **off**, USB in driver-board connector 6 — fan spins /
codec+hub in `lsusb` / D500 as serial device each establish what was powered and reachable in
that test state. Record as `method: "observation"` with the configuration. Two metering cases:
disambiguating a negative (probe pin 2 → pin 6: ≈0 V vs ≈4.5–5 V separates dead rail from dead
fan); and **before inserting any conductor into a socket whose pinout is inferred (Q2)** —
identify the 5 V holes with a meter, mark them, power down, re-check orientation. Also capture a
baseline of the driver board's rails while the robot is in a known state.

Real gaps: no Audio HAT schematic in holdings (searches so far found none; continuity testing is
the follow-up if Q6 survives T3); Waveshare wiki 403s automated fetches; NVIDIA's P3768 hole
coordinates are login-walled (X1 is the other route).

---

## Rules for whoever picks this up

- **A wiring fact is a net.** Pick the grain, write one record, cite the zone or image region.
- **Layout coordinates are not facts.** They live with the view that draws them.
- **Intra-board rails are not top-level nets.** They are `internal` grain or OPEN_ITEMS answers —
  hundreds of internal nodes would destroy the model's usefulness.
- **Source precedence:** firmware source > schematic > vendor callout diagram > wiki > inference —
  except physical identification, where the callout diagram outranks the schematic.
- **New views are new projections, not new stores.** A third eye is welcome; a third copy is not.
- Phases 1, 3, 4 change shipped data: run `task check` (lint + typecheck + tests + build) before
  committing.
- Findings go into owner docs (`docs/beast-ops.md`, `docs/hardware-library.md`,
  `db/hangar/standup.md`), into `OPEN_ITEMS`, or on screen — not into new docs.
- Nothing in `keyArtifactstosort/` may be deleted — see `keyArtifactstosort/agents.md`. Copy and
  extract freely.
