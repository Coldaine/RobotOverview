---
title: Inventory Intake — Staging
date: 2026-06-25
author: Patrick MacLyman
status: historical
last_confirmed: 2026-06-25
---

# Inventory Intake — Staging

A holding pen for physical items identified but **not yet ingested** into the live
inventory (`src/data/hangar.ts`). Kept deliberately separate so the authoritative roster
stays clean while items are still being photographed, identified, and confirmed. This is
the concrete answer to the North Star Open Question *"what is the intake from a chat or a
research run into an entry?"* — items land here first, get curated, then graduate.

**Lifecycle:** `needs-photo` / `needs-ID` → `identified` → `ready-to-ingest` → (moved into
`hangar.ts`, then struck from this file).

**This batch provenance:** all items below **shipped in the UGV Beast box** (per operator,
2026-06-25). Waveshare appears to bundle the same accessory kit across UGV host variants
(Pi *and* Jetson), so some items pertain to a Jetson host rather than the Pi-based Beast.

---

## INTK-01 — Waveshare Jetson Nano Adapter (C)  · `orphan / do-not-ingest`

- **What it is:** the power/LED breakout board from Waveshare's **Type-C metal case for the
  *original* NVIDIA Jetson Nano dev kit**. Plugs onto the Nano's button header (5 right-angle
  pins) to bring the **power button / power LED** out to the closed case exterior. Labeled
  "Waveshare · Jetson Nano Adapter (C)".
- **Status: ORPHAN.** The "(C)" case line is for the **classic Jetson Nano**, not the Orin.
  Operator owns **no classic Jetson Nano**, and it would **not** fit a current **Orin Nano**
  either (different board + case). It therefore pairs with no device in the fleet — almost
  certainly generic kit filler Waveshare tossed into the Beast box.
- **Not an upgrade-path signal** *(correction — earlier framing retracted)*: a Jetson re-host
  of the Beast would use an **Orin Nano**, which this classic-Nano case part does not serve.
- **Disposition:** do **not** ingest into the live roster. Keep here as a known loose part, or
  set aside / discard. Re-evaluate only if a classic Jetson Nano + (C) case ever enters the fleet.
- **Confidence:** High (board labeled; classic-Nano-only applicability confirmed).

## INTK-02 — Phone clamp adapter  · `needs-photo`

- **What it is (per operator):** spring/clamp phone holder. Fits a standard iPhone; **too
  small for the iPhone Pro Max**.
- **Belongs to:** FPV / secondary-camera mounting on the Beast (or generic).
- **Confidence:** Medium (from description, not yet photographed).
- **Next:** photo to confirm clamp type + mounting interface (screw thread / arm clip).

## INTK-03 — Extendable phone-mount arm  · `needs-photo`

- **What it is (per operator):** adjustable/extendable arm with **several mounting points**,
  affixes to the robot to hold a phone (likely for an onboard phone-as-camera/FPV setup).
- **Belongs to:** Beast mount accessory.
- **Confidence:** Medium.
- **Next:** photo to confirm mount footprint and how it attaches to the chassis.

## INTK-04 — 2× tiny 2-pin jumpers  · `needs-photo`

- **What it is (per operator):** two very small **2-pin jumper shunts**.
- **Belongs to:** generic spares — often used to bridge a boot/enable/config header
  (e.g. force-recovery, power-enable, or an I²C address select).
- **Confidence:** Medium; function depends on which header they pair with.
- **Next:** low priority; note any board on the Beast with an empty 2-pin header.

## INTK-05 — I²C adapter cable (4-pin ↔ slightly-larger 4-pin)  · `needs-ID (target)`

- **What it is:** short **I²C** adapter cable *(operator-confirmed)* — 4-pin housing on each
  end, **different pitches**: a small white connector ↔ a slightly larger white connector.
  Carries the four I²C wires (`VCC · GND · SDA · SCL`) between two connector standards.
- **Likely pitches:** small = **PH2.0 (2.0 mm)** [poss. SH1.0 / 1.0 mm]; larger = **XH2.54 /
  0.1″ (2.54 mm)**. Measure pin spacing to confirm.
- **What it's for:** connects an I²C peripheral to the Beast driver board's **I²C expansion
  header**. Waveshare's "General Driver for Robots" board calls this port out for **OLED / IMU /
  I²C sensors** — matching the `hangar.ts` "Display Header → 0.91/0.96″ OLED" slot. Most likely
  job: wiring a small **OLED status display** (or a sensor) to the driver board.
- **⚠️ Caution:** I²C pin *order* is not standardized across vendors — verify VCC/GND/SDA/SCL
  labels match on both ends and the device (continuity-check VCC↔VCC, GND↔GND) before powering,
  or a swapped VCC/GND can kill the peripheral.
- **Next:** confirm whether an **OLED / sensor module** is in the Beast box (that's the larger
  end's mate); measure pitches to name the connectors.
