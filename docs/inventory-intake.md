---
title: Inventory Intake — Staging
date: 2026-06-25
author: Patrick MacLyman
status: living
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

## INTK-01 — Waveshare Jetson Nano Adapter (C)  · `ready-to-ingest`

- **What it is:** the power/LED breakout board from Waveshare's **Type-C metal case for the
  NVIDIA Jetson Nano dev kit**. Plugs onto the Nano's header (5 right-angle pins) to bring
  the **power button / power LED** out to the closed case exterior. Clearly labeled
  "Waveshare · Jetson Nano Adapter (C)".
- **Belongs to:** a **Jetson Nano** (+ that Type-C case) — *not* the Pi-based Beast it shipped with.
- **Confidence:** High (board is labeled).
- **Why it matters (upgrade-path signal, G4):** `hangar.ts` notes the Beast's Pi 5 has *no
  CUDA*, so learned-policy inference runs offboard. A **Jetson Nano re-host** (which has CUDA)
  would move that inference *onboard*. This bundled adapter hints the Jetson path is viable —
  candidate for the want-list / upgrade tree, not just a loose part.
- **Suggested catalog shape:** bay `robotics` (or `compute`), category `Accessory / Host Adapter`,
  provenance `owner`, acquired `Included in Beast kit (2026)`, tags `['waveshare','jetson-nano','case-accessory','upgrade-path']`.
- **Open:** do you actually have a Jetson Nano + Type-C case on hand, or just this adapter?

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

## INTK-05 — 4-pin ↔ 4-pin adapter cable  · `needs-ID`

- **What it is:** short adapter cable, **4-pin housing on each end but different sizes/pitches**
  (small white connector ↔ larger white connector). A 4-conductor pitch adapter.
- **Best hypothesis:** an **I²C adapter** (`VCC · GND · SDA · SCL`) — the Beast's driver board
  exposes an I²C OLED header and runs IMU/power-monitor on I²C, and 4-pin I²C connectors come
  in many pitches (Qwiic/STEMMA-QT 1.0 mm, Grove 2.0 mm, PH 2.0, 2.54 mm). **Second guess:**
  **UART** (`VCC · GND · TX · RX`), also 4-pin.
- **Confidence:** Low — needs disambiguation.
- **Next:** any text on the housings, or which empty socket on the Beast it drops into, settles
  I²C vs UART.
