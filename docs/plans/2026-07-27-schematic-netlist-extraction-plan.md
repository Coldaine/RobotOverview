# Schematic netlist extraction — plan and evidence register

**Status:** PROPOSED — 2026-07-27. No tooling written, no repo data changed by this document.
Written for handoff: an executing agent should need nothing from the conversation that produced it.

## Why this exists

On 2026-07-27, while tracing BEAST-01's power domains for the Jetson Orin cutover, an assistant
asserted that the Audio HAT's FAN-2507 cannot run without the battery pack. The reasoning chain was
"MP8759GD buck → 40-pin 5 V → HAT". Closer inspection of the ROS Driver schematic found an
**AO4407 P-channel MOSFET (M2), gated by Q1/Q2**, sitting between the buck output net and `VDD5V` —
and found that `VDD5V` shares a node with the D1/D2 Schottky cathodes fed from USB VBUS. Depending
on which side of M2 the 40-pin header sits, Jetson USB may or may not back-power the HAT. The claim
was stated as fact and could not be checked, because **the repository has no representation in which
an intra-board net claim can live, be cited, or be falsified.**

`src/components/datacore/beast-console/bench-data.ts` models the loom *between* boards — connector
to connector. That model is good and should not be disturbed. It simply cannot express "what is on
net `VDD5V` inside the ROS Driver board", which is where the error occurred and where several
remaining cutover questions live.

The reasoning surface is also wrong. `public/datacore/beast-schematic-annotated.png` is a raster
derivative. Reading connectivity off it requires guessing pixel coordinates and squinting at
1-pixel-wide traces. The authoritative artifact — the vector PDF — is not currently inspectable at
useful magnification by any tool in the repo.

## Decision: the interchange format question

There is a "universal text-based way to express these diagrams," and there are several. Assessed
honestly against this project's actual need:

| Format | What it is | Verdict here |
| --- | --- | --- |
| **SPICE netlist** (`.cir`) | The de-facto lingua franca. Components + nets, plain text, read by everything since the 1970s. | **Adopt as an emitted output.** Trivial to generate, gives a universal escape hatch for free. |
| **KiCad S-expression** (`.kicad_sch`, `.net`) | Text, git-diffable, best-supported modern EDA ecosystem, round-trips to a real editor. | Reject as the source of truth. Round-tripping to a schematic editor is a cost with no payoff — we are reverse-engineering a board we did not design and will never fabricate. |
| **EDIF 2 0 0** | The ISO-era universal interchange. Verbose LISP-like. | Reject. Legacy, and nothing in our path consumes it. |
| **atopile** (`.ato`) | Modern text-based hardware description language, git-native. | Reject for now. Designed for authoring new boards; young ecosystem. Worth revisiting if this project ever designs a carrier. |
| **Graphviz DOT / Mermaid** | Not circuit formats — general graph languages. Mermaid renders natively in this repo's artifacts and in GitHub markdown. | **Adopt as an emitted output** for derived views (power tree, signal chain). This is what humans should read. |

**The decision: do not adopt an EDA format as the source of truth.** Use a small project-local JSON
netlist, and emit SPICE and Mermaid from it.

The reason is that the single most important field in our data is one that **no EDA format has**:
how we know. Every net in this project needs provenance and a confidence level, because our nets
come from reading a PDF, not from a design database. A KiCad file asserts connectivity flatly; it
has no way to say "this net is label-matched but visually unconfirmed, and a power claim depends on
it." The repository's existing discipline — facts carry the date they were verified, and stale facts
are re-verified before use, per `docs/beast-ops.md` — must extend to nets or this failure recurs.

## The extraction insight that makes this tractable

Full geometric schematic reverse-engineering is hard and should not be attempted. It is not
necessary here.

**Waveshare's schematic connects most things by named net ports, not by drawn wire.** Labels like
`VDD5V`, `VDDUSB`, `USBD_P`, `USBD_N`, `D_P`, `D_N`, `DC_IN`, `P_TX`, `P_RX`, `IO4`, `IIC_SDA`,
`3V3_OP`, `CP_RX` appear repeatedly across the sheet, and two pins carrying the same label are the
same net regardless of distance. That reduces most of the netlist to a **text-grouping problem**.

Geometric path tracing is needed only for **local junctions** where components connect by drawn wire
with no intervening label — precisely the D1/D2/`VDD5V`/AMS1117 node, and the M2 bridge between the
buck output and `VDD5V`. That is a small, bounded set.

Hence two tiers, and the plan below separates them:

- **Tier A — label matching.** Automatable, high yield, covers most nets.
- **Tier B — local geometry, assisted.** Low volume, applied only where Tier A leaves a gap or where
  a load-bearing claim depends on the answer.

A claim is **load-bearing** if being wrong about it could damage hardware or produce a wrong
power-on decision. Load-bearing nets may never reach `verified` on Tier A evidence alone.

## Non-goals

- Do not attempt fully automatic schematic reverse-engineering.
- Do not adopt KiCad, atopile, or EDIF as a source of truth.
- Do not modify `bench-data.ts`, `power-data.ts`, or `reference-data.ts` during Phases 0–3. The
  console's inter-board loom model is correct and orthogonal.
- Do not write inferred nets into `docs/beast-ops.md` or any console data module at `verified`
  confidence.
- Do not re-derive facts already carried in the repo; cite them and mark their origin.

---

## Evidence register

Each item is a discrete, falsifiable question. **E1, E2, and E7 are load-bearing.** An executing
agent should treat each as a unit of work with a definite answer, not a topic to discuss.

Nets and reference designators below are quoted from the ROS Driver for Robots schematic
(`public/datacore/pdfs/ROS_Driver_for_Robots.pdf`). Sheet zone references use the drawing's own
printed border grid (columns 1–8 across the top, rows A–D down the side).

### E1 — Which 5 V net reaches the 40-pin host header? *(load-bearing, blocking)*

Headers **P1** and **P2** (callouts 14 "Host controller 40PIN extended header" and 15 "Host
controller connection header") tie their 5 V pins to a net rendered as `5V`. The buck output is
rendered as `5V` / `Vout`, and **M2 (AO4407)** sits between that and `VDD5V`.

Determine whether the 40-pin 5 V pins are on the **buck side (pre-M2)** or the **diode-OR node
(post-M2, shared with USB VBUS)**.

- Pre-M2 → M2 blocks reverse flow; Jetson USB cannot power the Audio HAT; the FAN-2507 requires the
  battery pack.
- Post-M2 → Jetson USB VBUS reaches the 40-pin 5 V rail and the HAT is partially live on USB alone.

Consequence: decides whether the stack fan and possibly the D500 LiDAR appear before or after the
chassis switch, and therefore what "the fan isn't spinning" means during bring-up.

### E2 — What is M2's gate topology? *(load-bearing)*

**M2 (AO4407, P-channel)** is driven by **Q1** and **Q2** (MMBT3906 PNP) with **R18 100 K** and
**R19 470 K**. Establish whether this is a reverse-current-blocking ideal-diode arrangement, a
simple enable-controlled load switch, or a soft-start. Determine the permitted direction of current
flow between the buck output net and `VDD5V`.

Consequence: this is the mechanism that either does or does not protect the buck and the 40-pin from
USB back-feed. E1's answer is only trustworthy alongside E2's.

### E3 — Is the ESP32 supply pin on the AMS1117 output?

Confirm that **ESP32-WROOM-32UE (M3)** pin `VDD33` sits on `VDD3V3` / `3V3` from **AMS-1
(AMS1117-3.3)**, and not on a separate regulator.

Consequence: underwrites the claim that the board's logic — and therefore the JSON telemetry link —
comes alive on Jetson USB power with the pack off. Currently believed but not traced.

### E4 — Is `3V3_OP` the same net as `3V3`?

**U7 (CH343P)** takes `3V3_OP` on its `VIO` and `VDD5` pins, not a plainly-labelled `3V3`. The LiDAR
bridge CH343 shows the same `3V3_OP`. Determine whether `3V3_OP` is identical to `VDD3V3`/`3V3`, a
separately switched rail, or an alternate label for the same node.

Consequence: decides whether the USB-UART bridges enumerate with the pack off. If `3V3_OP` is
switched from the pack, the control link would not come up on USB alone — which would contradict
observed behaviour and must be reconciled.

### E5 — What supplies the bus servo bus?

`bench-data.ts` asserts the ST3215 servo bus is "powered at pack voltage". This was never traced.
Trace the power pin of the 5264-3P servo headers (**H7**, **H8**, callout 12) to a named net.

Consequence: a stated fact in shipped repo data currently has no evidence behind it.

### E6 — Which 5 V net feeds the LiDAR UART header?

Header **H1** (callout 11, "Lidar UART interface", 4-pin `5V`/`GND`/`NC`/`RX`) has a 5 V pin.
Identify its net and its relationship to E1's answer.

Consequence: determines LiDAR power behaviour if the D500 is ever moved from the Audio HAT socket to
the driver board's own socket.

### E7 — Ground-truth the 40-pin pin numbering *(load-bearing)*

`reference-data.ts` `PINS40` states pin 2 and pin 4 are `5V`, pin 8 is `P_TX`, pin 10 is `P_RX`, and
pin 6 is `GND`. Its own `OPEN_ITEMS` array already flags this as "high-confidence, but the wiki never
states the pins explicitly." A raster reading on 2026-07-27 appeared to show 5 V on pins **1 and 3**
of P1/P2 — which is either a misreading of the schematic's mirrored column numbering, or an error in
`PINS40`.

Resolve definitively. Record which of the two is wrong.

Consequence: the documented Orin UART jumper route (HAT hole 8 → Jetson pin 10, hole 10 → Jetson
pin 8, hole 6 → pin 6) depends entirely on this numbering, and the operator is instructed to insert
jumpers into a **mirrored, downward-facing socket**. A pin-numbering error here puts 5 V into a
Jetson UART pin.

### E8 — Audio HAT internals *(no schematic exists — cannot be extracted)*

`reference-data.ts` `OPEN_ITEMS` already records that Waveshare publishes no schematic for the RPI
Audio HAT for Robots; it is documented component-level only (SSS1629A5 USB codec, FE1.1S USB hub,
CH340, APA2068 amplifier). Unresolved:

- **E8a** — What feeds the FAN-2507 fan header: the 40-pin 5 V, or the HAT's own USB VBUS?
- **E8b** — What supplies the D500 on the HAT's LiDAR socket?
- **E8c** — Does the HAT's USB-C uplink carry the codec *and* the CH340 LiDAR bridge through the
  FE1.1S hub, and is that uplink required for either to reach the host? *(Disputed between assistant
  and owner as of 2026-07-27. The assistant's position: the Pi 40-pin carries no USB lines, and all
  three HAT chips are USB devices, so a USB uplink must exist. Unresolved — record the outcome
  rather than assuming either side.)*

**This item cannot be closed by any PDF work.** It requires physical measurement or new
documentation. See "Documentation and scan gaps".

---

## Documentation and scan gaps

Things no amount of tooling can extract, because the source does not exist or is not good enough.

### G1 — Audio HAT has no schematic at all *(largest hole)*

Blocks E8 entirely, and E8a/E8b sit directly on the bring-up path. Three ways to close it, in
descending order of value:

1. **Request it from Waveshare.** Cheapest if it works. No evidence it has been asked for.
2. **Physical measurement protocol** (see Phase 5). Answers E8a and E8b for *this* robot without
   answering them in general — which is sufficient.
3. **High-resolution photographs of both faces of the HAT**, flat, even lighting, with the 40-pin
   header and every connector legible. Sufficient to identify chips and trace short runs; not
   sufficient for buried layers.

### G2 — Vector PDF is not inspectable at magnification

We have the authoritative artifact but no way to look at it closely. `pdftoppm` is not installed;
the only rendered form in the repo is a raster PNG derivative. **Phase 0 closes this.**

### G3 — No physical-identification reference for the Audio HAT or the mounted Jetson

`driverBoarddiagram.png` (Waveshare's numbered callout diagram, 19 callouts) is an excellent
physical-identification reference for the driver board and resolved the USB-C ambiguity immediately.
There is no equivalent for the Audio HAT or for the Jetson carrier as mounted in the chassis.

### G4 — The HAT's vacated Pi dock is undocumented *(safety-relevant)*

The Orin UART jumper route requires finding pins 6, 8, and 10 on a **downward-facing, mirrored**
40-pin socket, currently by metering for the 5 V holes. Needed: a photograph of that socket in situ
with pin 1 unambiguously marked. This is the highest-consequence undocumented physical detail on the
robot — it is the one place an operator is asked to insert conductors next to a live 5 V rail using
inference rather than a reference.

### G5 — No captured baseline of the driver board's rails

No recorded meter readings for `DC_IN`, `VDD5V`, `3V3`, or the 40-pin 5 V under either power
condition. Phase 5 produces the first.

---

## Tooling plan

Phases are independently valuable and ordered so each unblocks the next. **Phase 0 alone resolves
most of the immediate pain and should not wait for the rest.**

All new tooling goes in `tools/`. Existing precedent there is Node ESM (`beast-probe.mjs`,
`postinstall-bootstrap.mjs`); PyMuPDF 1.28.0 on Python 3.13 is confirmed available on the workstation,
so Python is acceptable for extraction specifically. Generated data goes in `data/schematics/`.

### Phase 0 — Tile the vector PDF for inspection

**Deliverable:** `tools/schematic-tiles.mjs` (or `.py`), plus generated tiles and an index.

Render each PDF page at high DPI and cut it into a labelled grid. **Align the grid to the drawing's
own printed border zones** — the sheet already numbers columns 1–8 across the top and rows A–D down
the side. Using the sheet's native zones means an agent, a human, and the printed schematic all
refer to the same region by the same name.

Emit `data/schematics/<board>/tiles/<zone>.png` and an `index.json` mapping each zone to its source
bounding box in PDF points, so a reader can convert between zone, tile pixel, and PDF coordinate.

**Acceptance:** an agent can request "zone C6 of the ROS Driver schematic" and receive an image in
which component reference designators and net labels are legible without further zooming. Verify
specifically that M2/Q1/Q2 and the D1/D2/AMS1117 junction are readable.

**Why first:** it makes every later verification step cheap, and it immediately fixes the failure
mode that caused the original error — reasoning from a raster at the wrong magnification.

### Phase 1 — Raw extraction

**Deliverable:** `tools/schematic-extract.py`, emitting `data/schematics/<board>.raw.json`.

Using PyMuPDF: dump every text span with its bounding box, rotation, and page, and every vector
drawing path with its point list and stroke properties. **No interpretation.** Record the source
PDF's SHA-256 in the output so downstream data can be invalidated if the PDF is ever replaced —
`reference-data.ts` `INTEGRITY_NOTE` records that these PDFs have been silently corrupted once
before by LFS deduplication, so this is not hypothetical.

**Acceptance:** deterministic and re-runnable — two runs on the same PDF produce byte-identical
output. Known labels (`VDD5V`, `USBD_P`, `AMS1117-3.3`, `AO4407`) are present in the dump.

### Phase 2 — Tier A label-matched netlist draft

**Deliverable:** `tools/schematic-netlist.mjs`, emitting `data/schematics/<board>.netlist.draft.json`.

Group text spans by normalised value; associate each label with the nearest path endpoint or
component pin; emit nets with `confidence: "draft"` and `method: "label-match"`.

Must explicitly flag, rather than silently drop:

- nets with only one member (a label that connects to nothing is a parse failure, not a net)
- labels matching no geometry
- geometry with no nearby label
- any net whose members span more than one sheet zone without an intervening port symbol

**Acceptance:** the flagged-anomaly list is reviewed and each entry is either explained or becomes a
Tier B item. A draft that reports zero anomalies on a sheet this dense is wrong and must be
distrusted.

### Phase 3 — Verification pass

**Deliverable:** `data/schematics/<board>.netlist.json` — the verified netlist.

A net is promoted from draft only with `verified_by`, `verified_on`, `method`, and an `evidence`
string citing the sheet zone or measurement. Schema:

```json
{
  "board": "ros-driver-for-robots",
  "source": { "pdf": "public/datacore/pdfs/ROS_Driver_for_Robots.pdf", "sha256": "…" },
  "components": [
    { "ref": "M2", "type": "AO4407", "desc": "P-channel MOSFET", "zone": "B5" }
  ],
  "nets": [
    {
      "name": "VDD5V",
      "members": [
        { "ref": "D1", "pin": "K" },
        { "ref": "D2", "pin": "K" },
        { "ref": "AMS-1", "pin": "Vi" }
      ],
      "confidence": "verified",
      "method": "tile-visual",
      "verified_by": "<agent or operator>",
      "verified_on": "2026-07-27",
      "evidence": "zone B5: D1/D2 cathodes, the VDD5V port, PWR1, PWR2 and AMS1117 Vi share one junction",
      "loadBearing": true
    }
  ]
}
```

Confidence values: `verified` · `probable` · `draft` · `disputed`.
Method values: `label-match` · `tile-visual` · `meter` · `vendor-doc`.

**Rule:** a net with `loadBearing: true` may not reach `verified` on `label-match` alone. It needs
`tile-visual` or `meter`. This rule is the entire point of the schema — it is what would have caught
the original error.

**Acceptance:** E1 through E7 each have an answer at `verified` or an explicit record of why they
could not be closed. E8 is expected to remain open here and pass to Phase 5.

### Phase 4 — Emitters

**Deliverable:** `tools/netlist-emit.mjs`.

From the verified netlist, generate:

- **SPICE `.cir`** — the universal-format escape hatch, so this work is never trapped in a bespoke
  JSON schema.
- **Mermaid power-tree** — for `docs/` and for artifacts. Mermaid renders natively in both.
- **A typed TypeScript module** the BEAST Console can import, so the Live Plug view can finally
  answer intra-board questions ("what else is on this rail?") instead of only inter-board ones.

Emitters must **refuse to emit** nets below `verified`, or emit them into a visually distinct
"unverified" section. Confidence must survive the transformation — a Mermaid diagram that renders
draft and verified nets identically reintroduces the original problem in a new format.

**Acceptance:** the emitted SPICE parses in any SPICE tool. The emitted Mermaid renders. Neither
silently launders a draft net into an apparent fact.

### Phase 5 — Physical measurement protocol

**Deliverable:** `docs/beast-rail-measurements.md` — a checklist, and the recorded results.

For everything no PDF can answer: E8a, E8b, E8c, confirmation of E1 on the actual board, and the G5
baseline. Each entry states the probe points, the power condition, the expected value, and **what
each possible outcome implies** — so the operator is executing a decision procedure, not collecting
numbers to be interpreted later.

The first and most valuable measurement, which resolves E1 empirically regardless of how the PDF
work goes:

> Jetson powered from its mains barrel adapter, battery pack **off** at the chassis switch, USB cable
> in driver-board connector 6. Measure DC volts on the driver board's 40-pin header between pin 2 and
> pin 6.
> **≈0 V** → M2 blocks reverse flow; the Audio HAT and its fan need the pack.
> **≈4.5–5 V** → Jetson USB back-feeds the 40-pin; the HAT rail is live on USB alone.

Results feed back into the netlist at `method: "meter"`.

---

## Execution notes for the implementing agent

- Phases 0 and 1 are mechanical and safe to run unattended. Phase 3 requires judgement and must not
  be rushed — it is the phase whose whole purpose is to not assert things.
- Do not "fix" a disagreement between the draft netlist and existing repo data by editing either to
  match. Record the conflict and escalate. `reference-data.ts` `OPEN_ITEMS` is the established place
  for unresolved hardware questions and already contains several.
- The 19-callout legend in `driverBoarddiagram.png` is vendor documentation and outranks inference
  from the schematic for **physical identification** (which connector is which). The schematic
  outranks the callout diagram for **connectivity** (what is wired to what). They answer different
  questions; neither is a substitute for the other.
- When an item closes, update the corresponding entry in `reference-data.ts` `OPEN_ITEMS` in the same
  change, so the open-questions list stays honest.

## References

- ROS Driver for Robots schematic (vector) — `public/datacore/pdfs/ROS_Driver_for_Robots.pdf`
- Waveshare 19-callout board diagram — `driverBoarddiagram.png` *(pending relocation into `public/datacore/`)*
- Annotated raster derivative — `public/datacore/beast-schematic-annotated.png` *(not authoritative for connectivity)*
- Inter-board loom model — `src/components/datacore/beast-console/bench-data.ts`
- 40-pin map, provenance, open items — `src/components/datacore/beast-console/reference-data.ts`
- Cutover status and UART gate — `docs/beast-ops.md`
- PDF integrity incident (LFS deduplication) — `reference-data.ts` `INTEGRITY_NOTE`
