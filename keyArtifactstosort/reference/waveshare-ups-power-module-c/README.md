# Waveshare UPS Power Module (C) capture

Captured from [the Waveshare wiki page](https://www.waveshare.com/wiki/UPS_Power_Module_(C)) on 2026-07-27.

This is a preservation copy of the page-visible technical material. It is not a
claim that the module is installed in, compatible with, or approved for BEAST.
Do not delete source artifacts from `keyArtifactstosort/`.

## Contents

- `UPS_Power_Module_C.wiki.html` — page capture.
- `UPS_Power_Module_C.zip` — vendor demo archive; contains `ina219.py`.
- `INA219.pdf`, `DS-HY2120_EN.pdf`, `DS-HY2213_EN.pdf` — linked component datasheets.
- `UPS_Power_Module_C.rar` — linked vendor 2D/3D archive.
- `UPS-Power-Module-C-details-15.jpg` — full-resolution interface diagram.
- `UPS-Power-Module-C-1.jpg` — original 540×405 product image.
- `UPS-Power-Module-C-1-preview.jpg` — 360 px product preview as rendered by the wiki.
- `UPS-Power-Module-C-2.png` — demo output image.
- `UPS-Power-Module-C-4.jpg`, `UPS-Power-Module-C-5.jpg` — battery/installation precaution diagrams.

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
