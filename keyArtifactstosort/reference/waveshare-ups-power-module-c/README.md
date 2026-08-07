# Waveshare UPS Power Module (C) capture

Captured from [the Waveshare wiki page](https://www.waveshare.com/wiki/UPS_Power_Module_(C)) on 2026-07-27.

## VERDICT — NOT USED ON BEAST-01. Settled 2026-08-07, no decision pending.

The question this folder left open ("is this module relevant to BEAST?") is closed.
It is **not on the robot and is not the power path**, on three checks:

1. **Board compatibility: yes, and irrelevant.** BEAST-01 is a
   `NVIDIA Jetson Orin Nano Engineering Reference Developer Kit Super` (read from
   `/proc/device-tree/model`, L4T R36.5.0, 15 W nvpmodel — live 2026-08-07), so the
   module's "compatible with Jetson Orin series boards" claim does apply at board level.
   That was never the blocker.
2. **Mounting: no.** The module attaches *only* by Pogo pins pressing against the
   carrier board — the wiki's own wording is "Adopts Pogo pins connector design". BEAST-01's
   Jetson is not mounted that way (owner-confirmed 2026-08-07). There is no second
   attachment method on this module, so it cannot be fitted without re-mounting the Jetson.
3. **Its one unique function is already covered.** The module's selling point over a plain
   pack is I2C battery telemetry via an onboard INA219. BEAST-01 already has an **INA219
   live on `i2c-7` at `0x41`** (verified responding 2026-08-07) — the ROS Driver board's
   battery-voltage sensor, callout 4 on `beast-driver-board-callouts.png`. Power comes from
   the chassis pack through that board's MP8759GD 5 V/5 A buck. Fitting the UPS would
   duplicate monitoring the robot already does.

**Keep the archive as vendor reference** — the INA219 / HY2120 / HY2213 datasheets and the
interface diagram are useful on their own merits, and `agents.md` forbids deleting binaries
from this tree. Just do not read the folder's existence as a plan.

Everything below is the original 2026-07-27 capture record, unchanged.

Captured from the Waveshare wiki page. Do not delete source artifacts from
`keyArtifactstosort/`.

## Contents

- `UPS_Power_Module_C.wiki.html` — page capture.
- `UPS_Power_Module_C.zip` — vendor demo archive; contains `ina219.py`.
- `INA219.pdf`, `DS-HY2120_EN.pdf`, `DS-HY2213_EN.pdf` — linked component datasheets.
- `UPS_Power_Module_C.rar` — linked vendor 2D/3D archive.
- `UPS-Power-Module-C-details-15.jpg` — full-resolution interface diagram.
- `UPS-Power-Module-C-1.jpg` — original 540×405 product image.
- `UPS-Power-Module-C-1-preview.jpg` — 360 px product preview as rendered by the wiki.
- `UPS-Power-Module-C-2.png` — demo output image.
- `UPS-Power-Module-C-4.jpg` — rear face, straight-on: the three 21700 bays with ⊕/⊖
  polarity marks printed per bay. Cells alternate orientation (bay 1 ⊖-left, bay 2 ⊕-left,
  bay 3 ⊖-left). This is the battery-installation diagram.
- `UPS-Power-Module-C-5.jpg` — front face, straight-on product view. Bottom-edge silkscreen
  reads `OUTPUT · PWR ACT · BOOT · ON/OFF · PWR · CHRG DONE · 15V-19V`. Not a precaution
  diagram (corrected 2026-08-06).

## Browser-verified page facts

- The module is for Jetson Orin-series boards, uses pogo-pin mounting, supports
  three series 21700 cells, accepts 15–19 V input, and exposes I2C monitoring.
- The demo instructions install `python3-smbus`, then run `INA219.py` from the
  linked archive.
- The page warns that a reverse-battery indication prohibits charging; initial
  battery installation may require the BOOT button or charging to activate its
  protection circuit.

## Source URLs

- Demo: `https://files.waveshare.com/wiki/UPS%20Power%20Module%20(C)/UPS_Power_Module_C.zip`
- Datasheets: `Ina219.pdf`, `DS-HY2120_EN.pdf`, and `DS-HY2213_EN.pdf` under the same directory.
- CAD: `https://files.waveshare.com/wiki/UPS%20Power%20Module%20(C)/UPS_Power_Module_C.rar`

The ZIP was listed successfully after download and contains the expected
`UPS_Power_Module_C/ina219.py`. The RAR carries the standard RAR 5 signature;
its contents were preserved unmodified but not extracted because no RAR reader
is installed on this workstation.
