# Extract everything we already hold, and finish the wiring model

**Status:** PROPOSED — 2026-07-27. Written to be executed by an agent that has none of the
conversation that produced it.

**Depends on:** the architecture unification plan for its persistence target. This plan says *what to
extract*; that one says *where it lands*. Do not invent a storage location here.

## Done condition

This plan is finished when **BEAST-01's wiring model is complete and correct in the app** — not when
a file exists.

Concretely, all four:

1. Every cable and rail on the assembled robot is represented in the wiring model with the source
   or observation appropriate to that claim. Document-derived claims name a sheet zone or image
   region; as-built claims name the observation or measurement that established them.
2. The twin view and the console view agree everywhere the two overlap.
3. Every entry in `reference-data.ts` `OPEN_ITEMS` is either closed with a recorded method, or
   restated as a question that genuinely cannot be answered from what we hold.
4. The material an operator needs before touching the robot — the vacated Pi dock, the 40-pin
   numbering, which USB-C is which — is **on screen**, not only in markdown.

An executing agent that produces tooling and data but leaves the app unchanged has not completed
this plan.

---

## Part 1 — The corpus

The inputs currently indexed for this plan. **The point of this table is the third column**: several
have not yet been read specifically for the wiring questions this plan asks.

### Board schematics — `public/datacore/pdfs/`

| File | Bytes | What it can still tell us |
| --- | --- | --- |
| `ROS_Driver_for_Robots.pdf` | 1,023,807 | **The board-level electrical source.** It depicts the M2/Q1/Q2 gate topology, `VDD5V`, the AMS1117 and MP8759 supply boundaries, and the 40-pin header rail. Trace those questions from the drawing rather than assuming the answer. |
| `General_Driver_for_Robots.pdf` | 1,008,991 | The sibling board. Differences from the ROS Driver are unmapped — worth a structured diff where existing repo claims appear to inherit General Driver guidance. |
| `Servo_Driver_with_ESP32_Schematic.pdf` | 489,007 | ESP32 peripheral wiring in isolation — cleaner than reading it out of the dense main sheet. |
| `Bus_servo_control_circuit.pdf` | 141,892 | The servo bus half-duplex driver and its supply. Answers what feeds the servo rail. |
| `RPi-Motor-Driver-Board-Schematic.pdf` | 103,369 | Different product. Useful only as a TB6612FNG reference pattern. Low priority. |
| `jetson_orin_nano_carrier_board_spec.pdf` | 979,573 | Already mined for the 9–20 V DC input (pp. 7, 31, 32). **Still unmined:** the 40-pin header's own pin functions, UART electrical levels, and current limits per rail — all of which bear on the Orin↔HAT jumper route. |

### Confirmed duplicates — `keyArtifactstosort/`

| File | Bytes | Verdict |
| --- | --- | --- |
| `RasperryPIversionofROS_Driver_for_Robots.pdf` | 1,023,807 | Byte-identical to `ROS_Driver_for_Robots.pdf`; it adds no distinct schematic content. The filename may describe intended context, but it does not establish a separate board variant. |
| `UnclearMaybeforOrinDiagram.pdf` | 1,023,807 | Same bytes again. It does not add Orin-specific schematic content. |

Both filenames can invite interpretations that the byte-identical contents do not establish. Do not
delete them (see `keyArtifactstosort/agents.md`); keep the identity finding discoverable.

### Firmware — not yet mined for these wiring questions

| Source | What it can tell us |
| --- | --- |
| `UGV_RoverFACTORY-260706.zip` → `bin/ROS_Driver.ino.bin` and `dl_temp/` image | Compiled ESP32 firmware, two builds that differ (2026-05-08 and 2025-08-27). Current holdings do not establish which, if either, is running on BEAST-01. `strings` may reveal printable protocol tokens and is a discovery aid, not a complete protocol decoder. |
| `linkToOldWSGIT.txt` → `https://github.com/waveshareteam/ugv_ws` | The Waveshare ROS 2 workspace. Its ESP32 firmware source can establish intended GPIO assignments and command handling for that source revision. Compare those claims with the schematic and any flashed-build evidence; they answer different questions. Follow to sibling repos if the `.ino` source lives elsewhere. |
| `combine/SUCCESS.txt`, flashing logs | Flash offsets and partition layout; records what the flashing operation reported writing. |

This is high-value unexploited material. A pin assignment in firmware source is direct evidence of
the software's intended assignment for that revision; the schematic is direct evidence of the
board's electrical connection. Comparing them is more useful than treating either as a global
winner.

### Photographs — `keyArtifactstosort/`

These have been identity-indexed, but still need a wiring-focused visual pass. Filenames are the
owner's own and describe why they were retained, not necessarily what each image can prove.

| File | Bytes | What it should be read for |
| --- | --- | --- |
| `imageShowingRaspberryPIInvertedandconnectedOnTop(justshowsraspberrypis).png` | 365,244 | **Highest safety value.** The vacated Pi dock — mirrored, downward-facing, beside a live 5 V rail — is where the Orin UART jumpers are supposed to go, and we have no verified pin reference for it. Read for dock orientation and pin-1 marking. |
| `audioDriverBoard.png` | 289,977 | The Audio HAT. No schematic is present in the current holdings. Read for connector complement, silkscreen labels, visible ICs, and header orientation; the image cannot establish hidden internal routing. |
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
| `public/datacore/beast-driver-board-callouts.png` | The 19-callout vendor legend. Use it for vendor connector names and visual identification; use the schematic for depicted electrical connectivity. Source of the connector-6 identification currently recorded in the app. |
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
- **Do not silently reconcile a disagreement by editing one side to match.** State the exact claims,
  what each source establishes, and the follow-up that would distinguish them. Keep the conflict in
  `OPEN_ITEMS` until it is resolved, then update the canonical fact once.
- **New generated assets are permitted only for tiles** — `public/datacore/tiles/<board>/<zone>.png`
  plus an index. Tiles are a reading aid, not a source of truth.

### How to interpret sources

Do not assume a global source ranking for this plan. Match the source to the claim:

| Source | What it usually supports |
| --- | --- |
| Board schematic | Depicted component and electrical connectivity for this board. |
| Firmware source | Intended GPIO use, command handling, and behavior for that source revision. |
| Compiled image | Behavior encoded in that build, to the extent analysis can recover it; not proof that the build is flashed. |
| Flash log or manifest | What a particular flashing operation reports writing. |
| Callout diagram | Vendor connector names and visual identification. |
| Photograph | Visible assembly state, orientation, and routing at the time photographed. |
| Runtime observation or measurement | What happened under the recorded test conditions. |
| Owner statement | Project-specific fact within the scope the owner states. |

When sources differ, do not collapse the disagreement into “X wins.” Record the claim under
examination, each source's scoped statement, plausible explanations, and the smallest follow-up
that would distinguish them.

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
- **Done when:** every ESP32 pin claim in the repo states whether it concerns electrical routing,
  intended firmware configuration, a compiled build, or observed runtime behavior, and cites the
  relevant source. Disagreements remain explicit until a targeted follow-up resolves them.
- **Note:** this task can answer several `OPEN_ITEMS` outright and costs a clone. Do it early.

### T3 — Read the photographs

- **Input:** the photograph table in Part 1, in the priority order given there.
- **Do:** for each, describe what is actually visible — connectors, silkscreen text, orientation,
  cable routing. Distinguish *read from the image* from *inferred*. State when an image is too low
  resolution to support a claim; that is a useful result, not a failure.
- **Emit:** wiring findings into the persistence target selected by the architecture plan;
  non-wiring hardware facts into `docs/hardware-library.md`; and unresolved questions into
  `OPEN_ITEMS`. Leave the identity register in `docs/history/` historical.
- **Done when:** the Audio HAT's connector complement and the vacated Pi dock's orientation are
  described from images, or recorded as not determinable from what we hold (→ Part 6).

### T4 — Extract the driver-board netlist

- **Input:** T1 tiles; `ROS_Driver_for_Robots.pdf`.
- **Do:** dump every text span with bbox and rotation, and every vector path with its point list
  (PyMuPDF). **No interpretation in this step.** Group labels by normalised value and use proximity
  to propose candidate path endpoints or component pins. Confirm each accepted association against
  the rendered schematic; proximity alone is not a connection rule.
- **Emit:** intermediate working data — **intermediate, not a persisted model.** Record the source
  PDF's SHA-256 alongside it; `reference-data.ts` `INTEGRITY_NOTE` records these PDFs being silently
  corrupted once by LFS deduplication, so invalidation needs to be possible.
- **Review rather than silently drop:** single-member nets, labels matching no geometry, geometry
  with no nearby label, and nets spanning multiple zones. Each may be legitimate or may expose a
  parse problem; classify it after visual inspection.
- **Done when:** the anomaly list is reviewed and each entry is explained or escalated. **A sheet
  this dense reporting zero anomalies receives a deliberate second review rather than automatic
  acceptance or rejection.**

### T5 — Diff the ROS Driver against the General Driver

- **Input:** both PDFs, tiled.
- **Do:** establish what actually differs. Most published Waveshare pinout guidance describes the
  General Driver and gets applied to ours by assumption — including, possibly, the 65×65 / 49×58
  mounting figures currently in `MOUNT_LAYERS`.
- **Done when:** every place the repo cites General Driver documentation for a ROS Driver fact is
  either confirmed transferable or flagged.

### T6 — Land the facts in the model

- **Input:** everything from T2, T3, T4, T5.
- **Do:** update the wiring model with zone-level citations. Re-evaluate the current claims about
  connector 6, the D500 route, and the Orin DC input against the scoped sources above; retain,
  revise, or flag each claim based on that comparison.
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

Prefer the least invasive method that answers the specific question. A controlled observation may
answer an operational question without probing live rails; a meter may be necessary for voltage,
polarity, continuity, or to distinguish explanations that look identical in operation. Record the
test state and what the result actually establishes.

**Useful first operational observation — narrows Q1 without an instrument:**

> Jetson powered from its mains barrel adapter, battery pack **off** at the chassis switch, USB cable
> in driver-board connector 6 (silkscreen `USB`).
>
> - **FAN-2507 spins** → the fan received power in this test state; compare the schematic to
>   identify the path rather than inferring it from the fan alone.
> - **Audio codec and USB hub appear in `lsusb`** → the HAT's USB devices were powered and reached
>   the host in this test state.
> - **D500 appears as a serial device** → the tested LiDAR data path was operational; record which
>   connector route was present.

Record each result as `method: "observation"` with the test configuration. Treat it as evidence of
the observed behavior, not automatically as proof of a unique internal power or data route.

Two particularly useful metering cases are:

1. **Disambiguating a negative.** "The fan did not spin" does not separate *no voltage* from *dead
   fan or unpopulated header*. Probe pin 2 to pin 6: ≈0 V is consistent with the rail not being
   energized at that point; ≈4.5–5 V is consistent with the rail being energized and shifts the
   investigation downstream. Interpret the result with the schematic and test configuration.
2. **Before inserting any conductor into a socket whose pinout is inferred — Q2.** Visual inspection
   may not distinguish a power pin from a signal pin. Identify the 5 V holes with an appropriate
   measurement, mark them, power down, and re-check orientation before inserting the conductor.

Also worth capturing while the robot is in a known state: a baseline of the driver board's rails, so
future changes have something to compare against.

---

## Part 6 — Real gaps

Things we genuinely do not hold. Record here when closed.

- **No Audio HAT schematic is present in the current holdings, and the searches recorded so far did
  not locate one.** Waveshare documents it component-level (SSS1629A5, FE1.1S, CH340, APA2068).
  Photographs can establish visible connector information but not hidden internal routing. If Q6
  survives T3, physical continuity testing is one possible follow-up.
- **Waveshare's wiki returned HTTP 403 to the recorded automated fetches.** A later fetch or a human
  browser session may have different access; record the date and method when retrying.
- **The recorded NVIDIA access path put the P3768 carrier mounting-hole coordinates behind a
  login.** The CAD plan's X1 is another route; direct measurement remains an option if the design
  files are unavailable.

---

## Execution notes

- T1–T5 are safe to run unattended. T6 and T7 change shipped data — run `task check`
  (the front door: lint, typecheck, tests, build) before committing, not individual npm scripts.
- Apply the claim-specific source roles in Part 2. Callouts support vendor connector identity, the
  schematic supports depicted electrical connectivity, firmware supports intended software
  behavior for its revision, and observation supports the recorded as-built test state. A conflict
  prompts comparison and follow-up, not an automatic winner.
- Do not create new documentation files. Owner docs are `docs/NORTH_STAR.md`, `docs/deploy.md`,
  `docs/beast-ops.md`, `docs/hardware-library.md`, `db/hangar/standup.md`, `AGENTS.md`. Findings go
  into those, or into `OPEN_ITEMS`, or on screen.
- `docs/history/` is an archive, not guidance. Read it for facts; do not adopt its process machinery.
- Nothing in `keyArtifactstosort/` may be deleted — see `keyArtifactstosort/agents.md`. Copy and
  extract freely.
