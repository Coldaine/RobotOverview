# Enumerate the ROS Driver schematic PDF

**Status:** READY FOR EXECUTION - 2026-07-27

**Primary source:**
`keyArtifactstosort/RasperryPIversionofROS_Driver_for_Robots.pdf`

This is a bounded evidence-extraction task. The source is a one-page Waveshare schematic whose
title block reads `ROS Driver for Robots`. Treat the schematic as authoritative for the board's
hardware. Its filename alone does not establish that it is a distinct Raspberry Pi-specific
variant.

## Objective

Produce a complete, reviewable enumeration of what the PDF visibly depicts at the electrical
schematic level:

- functional blocks;
- components and reference designators;
- component pins;
- connector pins;
- printed net names and power symbols;
- visually traceable pin-to-net membership;
- junctions and direct pin-to-pin connections;
- component values, packages, options, and `NC` / `NS` markings;
- schematic notes, including the original Chinese text and an English translation;
- title-block and source metadata; and
- every ambiguity that prevents a reliable reading.

The result describes the board's internal electrical design. It does not describe external
Jetson/robot wiring that is absent from the schematic.

## Scope boundary

Use only:

1. the primary PDF; and
2. other documentation explicitly supplied with the task.

Supplemental documentation may corroborate or challenge a PDF reading, but it must not silently
fill a gap in the PDF. Keep each source's claim separate.

Do **not**:

- inspect or infer external wiring that is not depicted in the schematic;
- mine firmware, binaries, GitHub repositories, vendor websites, or live hardware;
- compare this board with other Waveshare products;
- reconstruct a PCB layout or manufacturable KiCad design;
- create a SPICE model;
- infer cable lengths, wire colors, connector mating orientation, or harness routing;
- change the application, wiring UI, `src/data/wiring.ts`, or operating docs; or
- resolve an uncertainty with a datasheet assumption.

If the PDF does not establish a fact, record `not-determinable-from-source` and move on.

## Deliverables

Create exactly two durable outputs:

1. `content/datacore/ros-driver-schematic-enumeration.yaml` - the normalized extraction.
2. `content/datacore/ros-driver-schematic-enumeration.md` - a concise human review containing
   counts, block summaries, uncertainties, and the validation result. Do not duplicate the full
   YAML as prose.

Temporary renders, crops, OCR output, extracted text spans, and scripts belong under
`.tmp/ros-driver-schematic-extraction/`. They are working aids, not additional authorities.
Do not modify or delete the source PDF or any other file in `keyArtifactstosort/`.

## Claim vocabulary

Every extracted claim must carry one of these evidence states:

| State | Meaning |
| --- | --- |
| `visible` | Directly legible in the rendered PDF. |
| `visually-traced` | Connectivity was followed through visible wires, junctions, or matching labels. |
| `corroborated` | Visible in the PDF and independently supported by a supplied document. |
| `ambiguous` | Two or more readings remain plausible. |
| `not-determinable-from-source` | The requested fact is not established by the available documents. |

Do not use board-level schematic evidence to claim an external cable, port use, or system-level
connection that the schematic does not depict.

## Source locations

Every record must cite a reproducible location with all of:

- PDF filename;
- page number;
- printed sheet zone, using the drawing's row/column grid such as `A1` or `C6`; and
- a bounding box in PDF points using `[x0, y0, x1, y1]`, with the origin convention recorded in
  the YAML metadata.

If an object crosses zones, cite every intersected zone. For a connection, cite the bounding box
covering the traced path rather than only the text label.

## Visual extraction method

### 1. Establish the source

- Calculate SHA-256, byte size, page count, page dimensions, PDF producer, and creation date.
- Record those values before extraction.
- Confirm the visible title block separately from the filename.
- Treat extracted PDF text as a search index only. The file contains dense and potentially
  duplicated internal text; an extracted token is not evidence unless it is visible on the page.

### 2. Render for reading

- Render a full-page orientation image at approximately 300 DPI.
- Render overlapping crops for every printed grid zone (`A1` through `D8`) at 600 DPI or an
  equivalent vector zoom.
- Include 10 percent overlap on each crop so wires crossing a zone boundary remain traceable.
- When a label, junction dot, pin number, or crossing is unclear, inspect the original vector PDF
  at higher zoom. Do not decide from a low-resolution screenshot.
- Keep crops lossless. Do not sharpen or otherwise alter pixels in a way that could create or erase
  a junction dot.

### 3. Inventory visible objects, block by block

Follow the red functional-block boundaries printed on the sheet. For each block:

1. record the printed block name and its zones;
2. enumerate every visible reference designator exactly as printed;
3. record value, part name, package text, and option text exactly as printed;
4. enumerate every visible pin number and pin name;
5. enumerate connectors even when individual pins are repeated or unused;
6. record all visible net labels, power symbols, ground symbols, and test points; and
7. transcribe every engineering note before translating it.

Do not normalize spelling in the raw fields. Put a corrected or normalized form in a separate
field and explain the change.

### 4. Trace connectivity visually

For every component pin, determine only what the drawing visibly establishes:

- `direct-wire` - a continuous drawn conductor reaches the destination;
- `junction` - conductors meet at a visible junction dot;
- `same-net-label` - disconnected drawing segments carry the exact same printed net label;
- `power-symbol` - membership is established by the same printed power/ground symbol;
- `no-connect` - explicitly marked unconnected;
- `unresolved` - the line, crossing, label association, or destination cannot be read reliably.

At wire crossings, assume **no connection** unless a junction dot or other explicit schematic
notation is visible. Preserve exact net-label spelling and case. Do not merge similar labels such as
`3V3`, `3V3_OP`, and `VDD3V3` without a visible connection.

Trace in two directions:

1. component pin -> conductor or label -> net; and
2. net -> every occurrence -> every attached component pin.

The second pass is required because it catches omitted pins and mistaken label associations.

### 5. Handle supporting documents

For each supplied supporting document:

- record its filename and source metadata;
- state the exact PDF claim it supports or conflicts with;
- cite its own page/section/image region; and
- keep disagreements in `ambiguities` instead of choosing whichever claim seems more likely.

Datasheets may help identify ordinary pin names, but a datasheet pinout does not prove how this
particular sheet connects the part.

## Required YAML shape

The YAML may add fields, but it must preserve this minimum structure:

```yaml
schema_version: 1
subject: depicted-ros-driver-for-robots-schematic

source:
  path: keyArtifactstosort/RasperryPIversionofROS_Driver_for_Robots.pdf
  sha256: "..."
  bytes: 0
  pages: 1
  visible_title: ROS Driver for Robots
  filename_suggests_pi_specific_variant: true
  visible_content_confirms_pi_specific_variant: false
  coordinate_system: "PDF points, origin top-left"

blocks:
  - id: power-input
    printed_name: PWR-IN
    locations: []

components:
  - ref: U6
    kind: integrated-circuit
    value_as_printed: INA219BIDR(SOP-8)
    normalized_part: INA219BIDR
    block: power-input
    locations: []
    evidence_state: visible

pins:
  - component: U6
    pin_number_as_printed: "3"
    pin_name_as_printed: SDA
    depicted_net: IIC_SDA
    connection_basis: direct-wire
    locations: []
    evidence_state: visually-traced

nets:
  - name_as_printed: IIC_SDA
    normalized_name: IIC_SDA
    occurrences: []
    member_pins: []

connectors: []

notes:
  - original_text: "..."
    language: zh
    english_translation: "..."
    translation_confidence: high
    locations: []

ambiguities:
  - id: ambiguity-001
    question: "..."
    plausible_readings: []
    locations: []
    disposition: not-determinable-from-source

extraction_summary:
  block_count: 0
  component_count: 0
  pin_count: 0
  connector_count: 0
  distinct_printed_net_count: 0
  note_count: 0
  ambiguity_count: 0
```

Connector pin records must retain both the connector reference and printed pin position. Do not
translate a 40-pin symbol into Raspberry Pi physical pin numbering unless the PDF explicitly makes
that mapping.

## Completeness checks

“Complete” means every visible schematic-semantic object has been accounted for, yielding a
board-level electrical description. External system wiring remains outside this task.

Before declaring the extraction complete:

1. **Reference-designator reconciliation:** collect all visibly printed component references from
   the page, then prove that every one appears exactly once in `components`, except explicitly
   documented multi-unit symbols.
2. **Pin reconciliation:** every visible component pin appears in `pins`, including power pins,
   duplicated package pins, unused pins, and `NC` pins.
3. **Net reconciliation:** every visibly printed net label has an occurrence record. Every
   `member_pins` entry resolves to a real component/pin record.
4. **Connector reconciliation:** every connector symbol has a complete ordered pin list or an
   ambiguity explaining why order cannot be established.
5. **Note reconciliation:** every visible free-text engineering note is transcribed. Chinese text
   is preserved before translation.
6. **Two-way connectivity check:** pin-to-net and net-to-pin indexes agree exactly.
7. **Visual second pass:** re-read every zone without using the first-pass checklist and record any
   newly found object. Repeat until a full pass finds nothing new.
8. **Ambiguity audit:** no blank value, guessed pin, or silently merged label remains. Unknowns are
   explicit records.
9. **Spot review:** independently re-trace at least the power-input path, both motor-driver blocks,
   one USB-to-UART block, the IMU/I2C block, and both 40-pin connector symbols.
10. **Source-boundary review:** search the final files for Jetson, cable, harness, port-use, and
    system-level claims. Remove any claim that is not depicted in the supplied schematic or
    explicitly established by a supplied supporting document.

The review Markdown must report the reconciliation totals and list every unresolved ambiguity. A
zero-ambiguity result on a sheet this dense requires an explicit second review; it is not presumed
to be evidence of success.

## Stop conditions

Stop and record an ambiguity instead of continuing when:

- a pin number or label is not legible at vector zoom;
- a wire disappears into overlapping graphics;
- a crossing's junction state cannot be distinguished;
- two printed labels differ but might be typographical variants;
- a component symbol disagrees with supplied documentation; or
- answering the question would require hardware inspection, firmware, web research, or a second
  unsupplied schematic.

## Completion statement

The executor may call the task complete only with language equivalent to:

> The deliverables enumerate all schematic-semantic objects visible in the supplied PDF, subject
> to the listed ambiguities. They are the board-level electrical description and do not attempt to
> describe external Jetson/robot wiring absent from the source.
