# Enumerate the ROS Driver schematic PDF

**Status:** READY FOR EXECUTION - 2026-07-27

## Goal

Turn `keyArtifactstosort/RasperryPIversionofROS_Driver_for_Robots.pdf` into one complete,
machine-readable description of the board schematic.

Treat the PDF as authoritative for the board hardware. This task covers the circuitry shown in the
PDF, not cables between the board and a Jetson or the rest of the robot.

## Inputs

- Required: `keyArtifactstosort/RasperryPIversionofROS_Driver_for_Robots.pdf`
- Optional: documentation the owner explicitly provides for interpreting the PDF

Do not add web research, firmware analysis, hardware inspection, other board schematics, app work,
or KiCad reconstruction to this task.

## Output

Create one canonical file:

`content/datacore/ros-driver-schematic.yaml`

Temporary renders and extraction scripts go in `.tmp/ros-driver-schematic/`. Do not create a
second hand-maintained summary or another connectivity model.

## Data model

Use this basic shape. It may be extended when the PDF requires it, but do not duplicate facts in
multiple sections.

```yaml
source:
  file: keyArtifactstosort/RasperryPIversionofROS_Driver_for_Robots.pdf
  sha256: "..."
  visible_title: ROS Driver for Robots

blocks:
  - id: power-input
    label: PWR-IN
    zone: B1

components:
  - ref: U6
    block: power-input
    kind: ic
    value: INA219BIDR
    package: SOP-8
    zone: B1
    pins:
      - number: "3"
        name: SDA
        connection: IIC_SDA
      - number: "4"
        name: SCL
        connection: IIC_SCL

notes:
  - zone: B1
    original: "..."
    translation: "..."

unresolved:
  - zone: C4
    item: "..."
    reason: unreadable
```

Rules:

- A component pin's `connection` is the sole authority for pin-to-net membership.
- Use the printed net name exactly when one exists.
- For a visibly connected but unnamed conductor, assign `N$001`, `N$002`, and so on.
- For an explicit no-connect pin, use `connection: NC`.
- For a pin whose connection cannot be read, use `connection: unclear` and add one `unresolved`
  entry.
- Model connectors as ordinary components with `kind: connector` and an ordered pin list.
- Preserve printed component values and note text. Put translations or normalized names in separate
  fields only when useful.
- Use the schematic's printed grid zone (`A1` through `D8`) as the location. Add a more precise crop
  or bounding box only for something genuinely hard to find.

## Procedure

### 1. Prepare the source

1. Record the PDF's SHA-256, byte size, page count, page dimensions, and visible title.
2. Render one full-page image at about 300 DPI.
3. Render higher-resolution crops for each populated functional block. Crop by the red block
   boundaries visible on the drawing; do not mechanically render every empty grid zone.
4. Extract PDF text with coordinates as a search aid. Do not treat extracted text as present unless
   it is also visible on the page.

### 2. Enumerate blocks and components

Work across the page from top-left to bottom-right, one printed functional block at a time.

For each block:

1. Add the block label and zone.
2. Add every visible component reference.
3. Record its printed value or part number, package when printed, and component kind.
4. Add every visible pin in printed order.
5. Include connectors, jumpers, buttons, LEDs, test points, power symbols, and parts marked `NC` or
   `NS`.

Maintain a temporary checklist of reference designators while working. The checklist is disposable;
the YAML is the authority.

### 3. Trace each pin

For every pin in every component:

1. Follow the visible conductor from the pin.
2. Stop at a printed net label, power symbol, explicit no-connect mark, or another pin.
3. Record the printed net name. If no label exists, assign one synthetic `N$` name to the entire
   connected conductor.
4. A crossing is not a connection unless the schematic shows a junction dot.
5. Reuse a printed net name wherever that exact label appears elsewhere on the sheet.
6. If the path cannot be read reliably, record `unclear`; do not infer it from a datasheet.

### 4. Capture notes

Transcribe every visible engineering note and warning. Preserve the original Chinese text and add
an English translation. Record the grid zone so the translation can be checked against the PDF.

### 5. Run the completeness pass

Review the PDF a second time, block by block, against the finished YAML.

The extraction is complete only when:

- every visible reference designator has one component record;
- every visible component pin is present;
- every pin has a connection value, `NC`, or `unclear`;
- every printed net label appears on at least one pin or is listed as unresolved;
- every connector has an ordered pin list;
- every visible engineering note has been captured;
- every synthetic `N$` name is used by all pins on that conductor;
- all `unclear` values have matching unresolved entries; and
- the YAML parses successfully.

Report the final counts of blocks, components, pins, connectors, printed nets, synthetic nets,
notes, and unresolved items in the commit message or execution response. Do not create another file
just to hold the counts.

## Stop condition

Commit the completed YAML after the completeness pass. Stop there. Do not fold the extracted data
into the app, external wiring model, operating documentation, or a reconstructed schematic as part
of this task.

