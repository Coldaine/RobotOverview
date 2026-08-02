# Worksheet: BEAST UPS I2C wiring diagram

## Question
Which three pins on the UPS Module 3S 2x4 header connect to which Jetson Orin Nano J12 pins to expose UPS battery telemetry without creating a second power path?

## Route
Explain. Primary surface: annotated cable-interconnect diagram, because the task is a physical three-wire connection between two headers.

## Medium and stack
Fixed SVG artifact. It is the smallest medium that preserves physical pin placement, color-coded signal paths, and a printable safety warning.

## Tier
1; default boundaries overridden: no.

## Unit of analysis
One physical I2C lead at a time: ground, clock, and data.

## Page map
| Page | Question it answers | Visual form | Visible at rest | On hover/select | Evidence kept inspectable |
| --- | --- | --- | --- | --- | --- |
| Single wiring sheet | Which pins receive each lead? | Header-to-header cable interconnect | Both headers, three colored paths, unused power pins, safety rule | None | Source strip in-sheet |

## Dimensions / columns
- UPS 2x4 physical pin number: identifies the source terminal.
- Signal: identifies electrical role.
- Jetson J12 physical pin number: identifies the destination terminal.
- Connection status: separates the three required signal wires from prohibited power wiring.

## Chart & diagram manifest
| Artifact | The one sentence: what structure this reveals that a table/prose cannot |
| --- | --- |
| UPS to Jetson I2C interconnect | Shows the exact wire paths, pin positions, and intentionally unconnected power pins in one inspection view. |

## Visual thesis
References examined (verified, not assumed): Waveshare UPS Module 3S interface drawing; NVIDIA Jetson Orin Nano carrier-board specification; NASA electrical integration documentation standard.

What they do structurally: identify connectors by physical pin number, use left-to-right signal flow, and separate power paths from control/signal paths.

Metaphor: field-service cable interconnect sheet.

Derived: mono-spaced pin labels, left-to-right cable paths, blue/green/black signal colors, red power prohibition, and a visible source/safety strip.

## Data requirements
- UPS expansion header is 2x4 and exposes 5V, GND, 3V3, EXT_SCL, EXT_SDA.
- UPS pin assignment: 1/2 5V, 3/4 GND, 5/6 3V3, 7 EXT_SCL, 8 EXT_SDA.
- Jetson J12 assignment: pin 3 SDA, pin 5 SCL, pin 6 GND.
- Required wires: UPS 3 to Jetson 6, UPS 7 to Jetson 5, UPS 8 to Jetson 3.
- No UPS 5V or 3V3 wire connects to Jetson.
- UPS I2C level selection must be 3.3V.

## Dossier
| Subject | Field | Value | Tier | Source | Retrieved |
| --- | --- | --- | --- | --- | --- |
| UPS Module 3S | Expansion header geometry | 2x4 header | direct | Waveshare `Ups01.pdf` schematic, header 4X2 | 2026-07-31 |
| UPS Module 3S | Pins 1/2 | 5V | direct | Waveshare `Ups01.pdf` schematic | 2026-07-31 |
| UPS Module 3S | Pins 3/4 | GND | direct | Waveshare `Ups01.pdf` schematic | 2026-07-31 |
| UPS Module 3S | Pins 5/6 | 3V3 | direct | Waveshare `Ups01.pdf` schematic | 2026-07-31 |
| UPS Module 3S | Pin 7 | EXT_SCL | direct | Waveshare `Ups01.pdf` schematic | 2026-07-31 |
| UPS Module 3S | Pin 8 | EXT_SDA | direct | Waveshare `Ups01.pdf` schematic | 2026-07-31 |
| UPS Module 3S | I2C selector | 3.3V default, 5V alternate | direct | Waveshare UPS Module 3S product page | 2026-07-31 |
| Jetson Orin Nano J12 | Pin 3 | SDA | direct | NVIDIA Jetson Orin Nano carrier-board specification | 2026-07-31 |
| Jetson Orin Nano J12 | Pin 5 | SCL | direct | NVIDIA Jetson Orin Nano carrier-board specification | 2026-07-31 |
| Jetson Orin Nano J12 | Pin 6 | GND | direct | NVIDIA Jetson Orin Nano carrier-board specification | 2026-07-31 |
| Jetson Orin Nano J12 | Header signal voltage | 3.3V logic | direct | NVIDIA Jetson Orin Nano carrier-board specification | 2026-07-31 |
| BEAST-01 | Existing Jetson supply | UPS barrel pigtail supplies Jetson; not the data link | direct | `docs/beast-ops.md` lines 191-194 | 2026-07-31 |

## Verification

### Build
Command: `magick public/beast-ups-i2c-wiring.svg C:\Users\pmacl\AppData\Local\Temp\kilo\beast-ups-i2c-wiring.png`; clean: yes; page rendered and visually inspected: `public/beast-ups-i2c-wiring.svg`.

### Gates
G1 Data integrity: all rendered pin labels and relationships trace to the dossier rows above. Sampled: UPS 3 → J12 6 (GND), UPS 7 → J12 5 (SCL), UPS 8 → J12 3 (SDA), and the four disconnected UPS power pins.

G2 Interactivity honesty: no controls or implied interaction.

G3 Proportionality: Tier 1 single-sheet diagram for a single three-wire choice.

G4 Recency: board/interface claims retrieved from vendor and NVIDIA sources on 2026-07-31; live robot availability is not represented as a claim.

### Actionability
1. Decision-relevant information in less than five seconds: central `CONNECT` box and three colored wire paths.
2. Every hover adds beyond the overview: no hover behavior exists.
3. Labels self-explanatory to a first-time viewer: every endpoint has physical pin number and signal label.
4. Every data point traces to the dossier: UPS pin 7 to J12 pin 5 is traced to Waveshare and NVIDIA dossier rows.

### Failures found and fixed
The initial title-strip subtitle was too low contrast against the dark background; corrected by using the dedicated light `header-sub` class and rerendered.
