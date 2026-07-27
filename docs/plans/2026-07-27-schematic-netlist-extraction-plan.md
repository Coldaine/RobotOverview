# Extract everything we already hold, and finish the wiring model

**Status:** PROPOSED — 2026-07-27. Written to be executed by an agent that has none of the
conversation that produced it.

**Depends on:** the architecture unification plan for its persistence target. This plan says *what to
extract*; that one says *where it lands*. Do not invent a storage location here.

## Done condition

This plan is finished when **BEAST-01's wiring model is complete and correct in the app** — not when
a file exists.

Concretely, all four:

1. Every cable and rail on the assembled robot is represented in the wiring model with a citation
   that names the *sheet zone or image region* proving it, not just a PDF.
2. The twin view and the console view agree everywhere the two overlap.
3. Every entry in `reference-data.ts` `OPEN_ITEMS` is either closed with a recorded method, or
   restated as a question that genuinely cannot be answered from what we hold.
4. The material an operator needs before touching the robot — the vacated Pi dock, the 40-pin
   numbering, which USB-C is which — is **on screen**, not only in markdown.

An executing agent that produces tooling and data but leaves the app unchanged has not completed
this plan.

---

## Part 1 — The corpus

Everything BEAST-01 documentation currently exists as. **The point of this table is the third
column**: most of these have never been read for what they could tell us.

### Board schematics — `public/datacore/pdfs/`

| File | Bytes | What it can still tell us |
| --- | --- | --- |
| `ROS_Driver_for_Robots.pdf` | 1,023,807 | **The primary source.** Every intra-board net on the driver board: the M2/Q1/Q2 gate topology, what `VDD5V` actually reaches, the AMS1117 and MP8759 supply boundaries, the 40-pin header's rail. This is the sheet that answers the power-trace questions. |
| `General_Driver_for_Robots.pdf` | 1,008,991 | The sibling board. Differences from the ROS Driver are unmapped — worth a structured diff, because most published Waveshare pinout guidance describes *this* board and gets applied to ours by assumption. |
| `Servo_Driver_with_ESP32_Schematic.pdf` | 489,007 | ESP32 peripheral wiring in isolation — cleaner than reading it out of the dense main sheet. |
| `Bus_servo_control_circuit.pdf` | 141,892 | The servo bus half-duplex driver and its supply. Answers what feeds the servo rail. |
| `RPi-Motor-Driver-Board-Schematic.pdf` | 103,369 | Different product. Useful only as a TB6612FNG reference pattern. Low priority. |
| `jetson_orin_nano_carrier_board_spec.pdf` | 979,573 | Already mined for the 9–20 V DC input (pp. 7, 31, 32). **Still unmined:** the 40-pin header's own pin functions, UART electrical levels, and current limits per rail — all of which bear on the Orin↔HAT jumper route. |

### Confirmed duplicates — `keyArtifactstosort/`

| File | Bytes | Verdict |
| --- | --- | --- |
| `RasperryPIversionofROS_Driver_for_Robots.pdf` | 1,023,807 | Byte-identical to `ROS_Driver_for_Robots.pdf`. **Yields nothing new.** The filename asserts a Pi-specific variant that does not exist. |
| `UnclearMaybeforOrinDiagram.pdf` | 1,023,807 | Same bytes again. There is no Orin-specific driver schematic in our holdings. |

Both filenames are wrong in a way that will mislead a future agent. Do not delete them (see
`keyArtifactstosort/agents.md`) — record the finding where it will be read.

### Firmware — never examined, and authoritative

| Source | What it can tell us |
| --- | --- |
| `UGV_RoverFACTORY-260706.zip` → `bin/ROS_Driver.ino.bin` and `dl_temp/` image | Compiled ESP32 firmware, two builds that differ (2026-05-08 and 2025-08-27). One of them is probably what is running on BEAST-01 right now. `strings` on these yields **the JSON command vocabulary directly** — the actual protocol, not a wiki's description of it. |
| `linkToOldWSGIT.txt` → `https://github.com/waveshareteam/ugv_ws` | The Waveshare ROS 2 workspace. Its ESP32 firmware source defines **GPIO-to-function mapping in code** — which outranks schematic inference for every pin question, including the ones currently open. Follow to sibling repos if the `.ino` source lives elsewhere. |
| `combine/SUCCESS.txt`, flashing logs | Flash offsets and partition layout; confirms which image was actually written. |

**This is the highest-value unexploited material we hold.** A pin assignment read out of firmware
source is a fact; the same assignment inferred from a dense schematic raster is a guess. An earlier
version of this plan spent five phases inferring what one repository states outright.

### Photographs — `keyArtifactstosort/`

None of these have been examined. Filenames are the owner's own, and describe intent.

| File | Bytes | What it should be read for |
| --- | --- | --- |
| `imageShowingRaspberryPIInvertedandconnectedOnTop(justshowsraspberrypis).png` | 365,244 | **Highest safety value.** The vacated Pi dock — mirrored, downward-facing, beside a live 5 V rail — is where the Orin UART jumpers are supposed to go, and we have no verified pin reference for it. Read for dock orientation and pin-1 marking. |
| `audioDriverBoard.png` | 289,977 | The Audio HAT, for which **no schematic exists anywhere** (`OPEN_ITEMS`). Read for connector complement, silkscreen labels, visible ICs, and header orientation. |
| `correctbutincompleteimageofaudioBoard.jpg` | 160,720 | Second view of the same board. The owner flags it incomplete — use it to cross-check the above, not alone. |
| `imagesortofshowingthe stackandhowitworksforraspberrypi.png` | 530,653 | Stack order and standoff heights — the geometry the Jetson has to fit into. |
| `rawDriverBoardshot.jpg` | 160,296 | Unannotated driver board. Cross-check against the annotated callout PNG; look for silkscreen the annotated version covers. |
| `imageoftopcutoutsandfrontcutouts(cleannothingmounted).png` | 102,049 | Chassis cutouts with nothing mounted — the clearest view of available mounting real estate. |
| `UGV-Beast-details-size-1.jpg` | 352,019 | Name suggests a dimensioned drawing. If so, chassis dimensions without opening the CAD. |
| `UGV-Beast-details-25/73/83.jpg` | 179K/156K/108K | Vendor product photos. Read for cable routing and connector positions as-shipped. |
| `possiblebatteryexpansion.jpg` | 42,079 | Battery mounting options — feeds the V-mount mass/balance question. |
| `threeQuarterImageofBeastwithuselessmarkup.jpg` | 164,099 | Owner rates the markup useless; the underlying photo may still show routing. Low priority. |

### Already in the app

| File | Role |
| --- | --- |
| `public/datacore/beast-driver-board-callouts.png` | The 19-callout vendor legend. **Outranks the schematic for physical identification** — which connector is which. Source of the verified connector-6 finding. |
| `public/datacore/beast-schematic-annotated.png` | Annotated schematic view already wired into the console. |

### CAD — `data/hardware-cad-assets` branch (LFS)

Covered separately in
[2026-07-27-cad-assets-usage-and-discoverability.md](2026-07-27-cad-assets-usage-and-discoverability.md).
**X1 there gates drilling and should run before anything in this plan touches mounting.** Do not
duplicate that work here.

---

## Part 2 — Where extracted facts land

**Do not create a new netlist store.** The repo already carries two wiring models and the owner has
decided both stay. A third would guarantee three-way drift. The architecture unification plan owns
this question; this section states only the constraints extraction imposes on it.

- **Intra-board rails are not top-level nets.** The inter-module model describes board-to-board
  wiring. `VDD5V`, `3V3_OP`, and the M2 gate are *answers* that resolve `OPEN_ITEMS` and sharpen
  existing net descriptions — they do not each become a net. Adding hundreds of internal nodes
  destroys the model's usefulness. If intra-board detail needs a home, it is a **separate grain**
  that references the spine, not more rows in it.
- **Provenance gets sharper, not broader.** Citations currently name whole PDFs. Extend them to name
  the sheet zone (`doc-ros-driver#C6`) or image region. A citation pointing at a 1 MB PDF is not
  proof of anything.
- **Never reconcile a disagreement by editing one side to match.** If the schematic and the console
  disagree, both stay, and the conflict goes into `OPEN_ITEMS` with both claims stated. Silent
  convergence is how a wrong fact becomes two wrong facts.
- **New generated assets are permitted only for tiles** — `public/datacore/tiles/<board>/<zone>.png`
  plus an index. Tiles are a reading aid, not a source of truth.

---

## Part 3 — The work

Tasks are independently valuable. **T1 and T2 are cheap, unblock everything, and should go first.**
Do not run them in numbered order out of habit — T1, T2 and T3 are independent.

### T1 — Tile the schematics into their own printed zones

- **Input:** the four board PDFs above.
- **Do:** render each page at high DPI; cut along the sheet's *own* printed border zones (columns
  1–8 across the top, rows A–D down the side). Using the sheet's native grid means an agent, the
  operator, and the printed page all name the same region identically.
- **Emit:** `public/datacore/tiles/<board>/<zone>.png` and `index.json` mapping zone → source bbox in
  PDF points. Tooling in `tools/`; Node ESM matches existing precedent (`beast-probe.mjs`), and
  PyMuPDF 1.28.0 on Python 3.13 is confirmed available if Python suits the render better.
- **Done when:** requesting "zone C6 of the ROS Driver" returns an image where reference designators
  and net labels are legible without further zoom. Verify specifically on **M2 / Q1 / Q2** and the
  **D1 / D2 / AMS1117 junction** — those are the regions where reading a raster at the wrong
  magnification produced a wrong power claim once already.

### T2 — Mine the firmware for pin assignments and protocol

- **Input:** both ESP32 images in `UGV_RoverFACTORY-260706.zip`; `github.com/waveshareteam/ugv_ws`
  and any sibling repo holding the `.ino` source.
- **Do:** `strings` both binaries and diff them — the two builds differ and the delta is informative.
  Clone the upstream repo and read the pin definitions and command dispatch out of source.
- **Emit:** a GPIO-to-function table and the JSON command vocabulary, written into
  `docs/beast-ops.md` (existing owner doc — do not create a new one).
- **Done when:** every ESP32 pin claim in the repo cites either firmware source or a schematic zone.
  **Firmware source wins where they disagree**, and the disagreement is recorded.
- **Note:** this task can answer several `OPEN_ITEMS` outright and costs a clone. Do it early.

### T3 — Read the photographs

- **Input:** the photograph table in Part 1, in the priority order given there.
- **Do:** for each, describe what is actually visible — connectors, silkscreen text, orientation,
  cable routing. Distinguish *read from the image* from *inferred*. State when an image is too low
  resolution to support a claim; that is a useful result, not a failure.
- **Emit:** append to [keyartifacts-intake-2026-07-27.md](../history/keyartifacts-intake-2026-07-27.md),
  which already indexes these files by identity — this adds what they *contain*.
- **Done when:** the Audio HAT's connector complement and the vacated Pi dock's orientation are
  described from images, or recorded as not determinable from what we hold (→ Part 6).

### T4 — Extract the driver-board netlist

- **Input:** T1 tiles; `ROS_Driver_for_Robots.pdf`.
- **Do:** dump every text span with bbox and rotation, and every vector path with its point list
  (PyMuPDF). **No interpretation in this step.** Then group labels by normalised value and associate
  each with the nearest path endpoint or component pin.
- **Emit:** intermediate working data — **intermediate, not a persisted model.** Record the source
  PDF's SHA-256 alongside it; `reference-data.ts` `INTEGRITY_NOTE` records these PDFs being silently
  corrupted once by LFS deduplication, so invalidation needs to be possible.
- **Must flag rather than silently drop:** single-member nets (a label connecting to nothing is a
  parse failure), labels matching no geometry, geometry with no nearby label, and any net spanning
  multiple zones without an intervening port symbol.
- **Done when:** the anomaly list is reviewed and each entry is explained or escalated. **A sheet
  this dense reporting zero anomalies is wrong and must be distrusted.**

### T5 — Diff the ROS Driver against the General Driver

- **Input:** both PDFs, tiled.
- **Do:** establish what actually differs. Most published Waveshare pinout guidance describes the
  General Driver and gets applied to ours by assumption — including, possibly, the 65×65 / 49×58
  mounting figures currently in `MOUNT_LAYERS`.
- **Done when:** every place the repo cites General Driver documentation for a ROS Driver fact is
  either confirmed transferable or flagged.

### T6 — Land the facts in the model

- **Input:** everything from T2, T3, T4, T5.
- **Do:** update the wiring model with zone-level citations. Backfill the findings the twin view
  currently does not know: **connector 6 is the ESP32 host link**, **the D500 rides the Audio HAT's
  LiDAR socket**, **the Orin DC input is 9–20 V**.
- **Done when:** integrity tests pass and no net cites a bare PDF where a zone exists.

### T7 — Reconcile the two views

- **Do:** assert that overlapping claims agree between the twin and the console. The pairs that
  describe the same physical thing: `gdb-usb-esp32` ↔ `drv-esp32-usb`, `orin-dc-in` ↔ `jet-barrel`,
  `net-d500-lidar` ↔ the HAT lidar route, `net-5v-host` ↔ `drv-5v`.
- **Done when:** updating one view without the other fails CI **by name**, saying which fact drifted.
  This is what lets both stay independent without silently diverging.
- **Note:** the architecture plan may supersede the mechanism here. The requirement — divergence is
  loud — stands either way.

### T8 — Put it on screen

- **Do:** surface what an operator needs before touching hardware. At minimum the vacated Pi dock
  orientation and the 40-pin numbering, since that is where a mistake puts 5 V into a UART pin.
  Zone tiles become the citation target when inspecting a net.
- **Done when:** an operator can answer "where do the UART jumpers go" from the running app.
- **Why this task is not optional:** `AGENTS.md` — *"The UI is the product... docs exist to serve the
  visible experience, never the other way around."* T1–T7 all produce data. This is the one that
  makes it product.

### T9 — Emit derived views

- **Do:** generate a Mermaid power tree from the settled model. Mermaid renders natively in this
  repo's artifacts and in GitHub markdown, so it needs no toolchain. Optionally emit SPICE as a
  portability escape hatch so the work is never trapped in a bespoke schema.
- **Must:** render unverified relationships visually distinctly, or refuse to include them. A diagram
  that draws inferred and confirmed nets identically recreates the original problem in a new format.

---

## Part 4 — Questions to close

These are live entries in `reference-data.ts` `OPEN_ITEMS`. **When one closes, update it in the same
change** so the open-questions list stays honest.

| # | Question | Answerable by | Priority |
| --- | --- | --- | --- |
| Q1 | Which 5 V net reaches the 40-pin host header — pre- or post-M2? Determines whether the HAT and its fan are live from USB VBUS alone, with the battery pack off. | T4, confirmed by observation (Part 5) | **Blocking** — this is the claim that was asserted without tracing |
| Q2 | 40-pin pin numbering on the HAT's vacated dock. | T2 firmware + T3 photos + T4 | **Blocking and safety-critical** — wrong numbering puts 5 V into a Jetson UART pin |
| Q3 | M2's gate topology (Q1/Q2 MMBT3906, R18 100K / R19 470K) — what actually switches the P-MOS. | T4 | High |
| Q4 | Is `3V3_OP` the same net as `3V3`? | T4 | Medium |
| Q5 | What supplies the bus servo rail? | T4 + `Bus_servo_control_circuit.pdf` | Medium |
| Q6 | Audio HAT USB uplink — how the CH340/FE1.1S/codec reach the host. | T3 photos only; no schematic exists | High, and may be undecidable from documents |
| Q7 | Does a spare usable 40-pin header (callout 14) exist on the assembled board? The callout diagram names two host headers; owner inspection found one. | T3 + physical look | Medium — likely two footprints for one bus |
| Q8 | Are the 65×65 / 49×58 mounting figures valid for the ROS Driver, or inherited from the General Driver? | T5, or CAD plan X2 | Medium — precedes drilling |

---

## Part 5 — What no document can answer

**Observe first. Meter only where observation cannot answer, or where guessing damages hardware.**
This ordering must not be reversed. Powering the robot into a known state and recording what comes
alive answers the operational question directly, needs no probes near live rails, and cannot short
two pins with a slipped tip. A voltage reading is a proxy for behaviour; behaviour is the thing we
need.

**The primary test — resolves Q1 with no instrument:**

> Jetson powered from its mains barrel adapter, battery pack **off** at the chassis switch, USB cable
> in driver-board connector 6 (silkscreen `USB`).
>
> - **FAN-2507 spins** → the 40-pin 5 V rail is live from USB VBUS; the HAT is powered without the pack.
> - **Audio codec and USB hub appear in `lsusb`** → same conclusion, independently.
> - **D500 appears as a serial device** → answers Q6 in the same observation.

A positive on any of those is conclusive. Record as `method: "observation"`.

Metering is justified in exactly two cases:

1. **Disambiguating a negative.** "The fan did not spin" does not separate *no voltage* from *dead
   fan or unpopulated header*. Only then probe pin 2 to pin 6: ≈0 V means M2 blocks reverse flow and
   the HAT genuinely needs the pack; ≈4.5–5 V means the rail is live and the fault is downstream.
2. **Before inserting any conductor into a socket whose pinout is inferred — Q2.** No observational
   substitute exists, because here the observation *is* the damage. Identify the 5 V holes with a
   meter, mark them, power down, then insert.

Also worth capturing while the robot is in a known state: a baseline of the driver board's rails, so
future changes have something to compare against.

---

## Part 6 — Real gaps

Things we genuinely do not hold. Record here when closed.

- **The Audio HAT has no schematic anywhere.** Waveshare documents it component-level only
  (SSS1629A5, FE1.1S, CH340, APA2068). T3 photographs are the only route to its connector map, and
  photographs cannot show internal routing. If Q6 survives T3, it needs physical continuity testing.
- **Waveshare's wiki returns HTTP 403 to automated fetches.** Enumerating kit download pages —
  needed to confirm whether a Beast-specific Orin schematic exists at all — requires a human with a
  browser.
- **NVIDIA gates the P3768 carrier mounting-hole coordinates** behind a login. The CAD plan's X1 is
  the way around this; if it fails, measurement is the only route.

---

## Execution notes

- T1–T5 are safe to run unattended. T6 and T7 change shipped data — run `task check`
  (the front door: lint, typecheck, tests, build) before committing, not individual npm scripts.
- **The callout diagram outranks the schematic for physical identification** (which connector is
  which). **The schematic outranks the callout diagram for connectivity** (what is wired to what).
  **Firmware source outranks both for pin function.** They answer different questions; none
  substitutes for another.
- Do not create new documentation files. Owner docs are `docs/NORTH_STAR.md`, `docs/deploy.md`,
  `docs/beast-ops.md`, `docs/hardware-library.md`, `db/hangar/standup.md`, `AGENTS.md`. Findings go
  into those, or into `OPEN_ITEMS`, or on screen.
- `docs/history/` is an archive, not guidance. Read it for facts; do not adopt its process machinery.
- Nothing in `keyArtifactstosort/` may be deleted — see `keyArtifactstosort/agents.md`. Copy and
  extract freely.
