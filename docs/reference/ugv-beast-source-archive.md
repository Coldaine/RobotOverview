---
title: BEAST-01 Source Archive / Provenance Digest
audience: AI agents preserving BEAST-01 hardware provenance
status: reference
last_updated: 2026-07-01
---

# BEAST-01 Source Archive / Provenance Digest

Terminology note: in this repo, "archive" means preserved authoritative source material and provenance, not deprecated or historical content. Superseded material belongs under `docs/history/`; this digest is an active reference for Hangar's BEAST-01 hardware model and future source-document storage.

Patrick assembled an offline Waveshare UGV Beast source bundle on 2026-06-27 from official Waveshare file-server downloads and wiki pages. The raw local folder is `UGV-Beast-Archive/` and remains the authoritative local cache, but that folder is intentionally gitignored because it contains large PDFs, ZIPs, CAD, firmware, and raw staging copies. Those binaries belong in object storage and should be referenced from the app/database by URL, not embedded in this repository or Docker image.

## What the source bundle contains

The curated source bundle digest reported:

- official schematics, CAD, and firmware for the Waveshare UGV Beast and subsystems;
- 24 binary files plus 7 captured wiki pages;
- roughly 72 MB in the curated set, with additional staging/raw copies locally;
- all ZIPs tested with `unzip -t` and all PDFs checked for valid `%PDF` headers;
- curated copies matched their staging originals byte-for-byte.

Major folders:

| Area | Contents |
|---|---|
| Driver board | General Driver for Robots schematic, dimensions, STEP, ROS driver schematic. |
| Power / UPS | UPS Module 3S schematic, STEP, dimensions, sample code. |
| Servos | ST3215 manual, protocol manual, control-circuit schematic, CAD, firmware. |
| Chassis CAD | UGV Beast PI4B and PT AI Kit 3D/STEP models. |
| Jetson Orin | Jetson Orin PT kit model/drawing for Orin mounting work. |
| Code / firmware | CP210x driver, ROS driver demo, ESP32 base firmware, downloaded repository snapshots. |
| Wiki pages | Offline markdown/html copies for Beast, driver board, UPS, ST3215, Orin kit, and ROS2 pages. |

## Key hardware findings to preserve

- BEAST-01 has a dual-controller architecture: host computer for vision/web/high-level behavior, ESP32 lower controller for motors, servos, IMU, telemetry, and LEDs.
- The driver board includes an ESP32-WROOM-32, TB6612FNG motor driver, INA219 voltage/current monitor, QMI8658 + AK09918C IMU/compass, CP2102N USB-UART bridges, and an MP8759 5V buck rail.
- The UPS Module 3S provides a 3S Li-ion battery rail around 9.0–12.6V plus regulated 5V/5A and 3.3V/300mA rails.
- The board's 5V host rail is appropriate for Raspberry Pi-style host power, but **not** for Jetson Orin Nano Developer Kit barrel input.
- Jetson Orin Nano Developer Kit carrier-board DC input should be cited from the current NVIDIA carrier-board specification before wiring. The current citation to check is the DC jack / backpower input range, listed as 9-20V in the carrier-board spec, so the Orin path should use the 3S battery rail / barrel input only after voltage headroom is confirmed; never use the 5V host header rail.
- Orin comms still use TX/RX/GND jumpers between the driver board header and Orin header.
- The useful Waveshare Orin pages are `UGV_Beast_PT_Jetson_Orin_AI_Kit` and `UGV_Beast_Jetson_Orin_ROS2`; the bare `UGV_Beast_Jetson_Orin` slug was a placeholder.

## Storage boundary

Until object storage exists, keep raw source files local and ignored. Once an S3/RGW-compatible bucket exists, upload the binaries there and store source rows/URLs in the Hangar database. App code should consume object URLs and metadata, not local paths.

Related docs:

- `docs/beast-ops.md` — live/supervised operation runbook.
- `docs/components/connected-twin.md` — how the wiring model should use source provenance.
- `docs/deploy/storage-and-twin-pivot-plan.md` — storage/object-store migration plan.
- `docs/reference/beast-source-evidence-manifest.md` — URL, local-path, byte-size, hash, and future object-key manifest for source payloads.
- NVIDIA Jetson Orin Nano Developer Kit Carrier Board Specification — https://developer.nvidia.com/downloads/assets/embedded/secure/jetson/orin_nano/docs/jetson_orin_nano_devkit_carrier_board_specification_sp.pdf
