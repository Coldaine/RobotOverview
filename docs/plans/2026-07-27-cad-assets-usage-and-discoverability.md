# BEAST-01 CAD assets — where they live, and what they are for

**Status:** PROPOSED — 2026-07-27. Records a storage decision already taken, and proposes
exploration work not yet started.

## Why this document exists

Six Waveshare CAD archives were committed into the working tree on 2026-07-27, then removed again
once intake verification showed they were byte-identical to LFS objects already stored on the
`data/hardware-cad-assets` branch. Removing a duplicate is only safe if the surviving copy is
genuinely findable. **This document is the discoverability contract that makes that removal safe**,
and it records what the CAD is actually good for so it stops being treated as dead weight.

The failure mode being guarded against is specific: an agent working in `main` sees no CAD, concludes
the project has none, and either re-downloads it, re-derives geometry by hand, or — worst — states
that a dimension is unknown when the repo has held the answer all along. `reference-data.ts`
`OPEN_ITEMS` already contains at least two entries of exactly that shape.

## Where the CAD actually lives

| Archive | Contents | Location |
| --- | --- | --- |
| `UGV_Beast_PI4B_AI_Kit_3D.zip` | **2D drawings** (despite the name) | `data/hardware-cad-assets` (LFS) |
| `UGV_Beast_PI4B_AI_Kit_step.zip` | STEP geometry | `data/hardware-cad-assets` (LFS) |
| `UGV_Beast_PT_AI_Kit_3D.zip` | **2D drawings** (despite the name) | `data/hardware-cad-assets` (LFS) |
| `UGV_Beast_PT_AI_Kit_step.zip` | STEP geometry | `data/hardware-cad-assets` (LFS) |
| `UGV_Rover_Jetson_Orin_ROS2_Kit_2D.zip` | 2D drawings — **Rover, not Beast** | `data/hardware-cad-assets` (LFS) |
| `UGV_Rover_PT_Jetson_Orin_ROS2_Kit_STEP.zip` | STEP geometry — **Rover, not Beast** | `data/hardware-cad-assets` (LFS) |
| `UGV_Beast_PT_Jetson_Orin-3D.zip` | Beast Orin CAD, LFS oid `56615c77…` | `data/hardware-cad-assets` (LFS) — **not in the 2026-07-27 intake** |

Per-file SHA-256 values, verified archive contents, and duplicate status are in
[INTAKE-REGISTER.md](../../keyArtifactstosort/INTAKE-REGISTER.md). Upstream hashes
are independently recorded in
[EVIDENCE-MANIFEST.md](../../keyArtifactstosort/reference/EVIDENCE-MANIFEST.md) — two
independent records of the same hashes, which is what makes the in-tree copies redundant rather than
load-bearing.

To fetch:

```bash
git fetch origin data/hardware-cad-assets
git checkout data/hardware-cad-assets -- <path>
```

**Three naming traps, all verified 2026-07-27.** An agent that trusts these filenames will reach the
wrong file:

1. Both `_3D.zip` archives contain **2D drawings**. The actual 3D geometry is in the `_step.zip`
   files.
2. Both archives whose names say **Jetson Orin** are **UGV Rover** kits, not Beast. The Beast Orin
   CAD is a separate archive that was absent from the intake collection entirely.
3. `UGV_Beast_PI4B_AI_Kit_3D.zip`'s enclosed drawing carries a title block reading **"UGV Beast PT"**
   — an upstream labelling error. The contents are still genuinely distinct from the PT archive
   (different hashes, different dimension values, different author field), so this is mislabelling,
   not duplication.

One archive uses non-ASCII internal paths (`尺寸图纸`) which breaks naive extraction tooling. Extract
with explicit UTF-8 handling.

## What the CAD is for

These are not archival curiosities. Each maps to a question the project currently answers by
guessing, by hand-measuring, or not at all.

### U1 — Jetson mounting hole pattern *(highest value)*

`reference-data.ts` `OPEN_ITEMS` records that the Jetson carrier's mounting-hole XY coordinates are
unpublished — NVIDIA gates them inside login-walled P3768 design files — and `MOUNT_LAYERS`
instructs the operator to *press the dev kit onto paper, mark through its holes, and drill*.

The Beast Orin CAD (`UGV_Beast_PT_Jetson_Orin-3D.zip`) is Waveshare's own Orin-variant assembly. If
it contains the host-bay plate, **it contains the hole pattern Waveshare drilled** — which removes
the drill-and-hope step from the conversion entirely. This should be checked before anyone drills.

### U2 — Verify the driver board mounting figures

`MOUNT_LAYERS` carries 65 × 65 mm outline and 49 × 58 mm hole spacing, sourced from the *General
Driver* product page with the caveat "the ROS Driver appears identical, but verify with calipers
before drilling." The STEP geometry settles this without calipers.

### U3 — Sensor mast planning for the future loadout

Two planned upgrades have real geometric constraints and no verified mounting plan:

- **Livox Mid-360S** — 65 × 65 × 60 mm, 265 g, wants the highest point with a clear 360° × 59°
  horizon. Needs a flat plate at the mast tip with nothing intruding into the field of view.
- **OAK-D Pro** — 111 × 40 × 31 mm, 184 g, noticeably heavier than the Lite it replaces on the same
  rail claws.

Both are answerable from the mast and rail geometry rather than by trial fitting.

### U4 — Mass and balance with the split-rail battery

The recommended power plan mounts a 99 Wh V-mount battery on the rear T-slot rails. That is
significant mass, high and rearward, on a tracked chassis that climbs. The assembly geometry gives a
basis for estimating the centre-of-mass shift before committing to that mounting position.

### U5 — URDF / robot description for ROS 2

The Jetson runs ROS 2 Humble with the Waveshare workspace built. A dimensionally accurate robot
description would support visualisation, TF frames for sensor extrinsics, and collision geometry for
Nav2. STEP → mesh decimation → URDF is a well-trodden pipeline, and sensor extrinsics in particular
are currently unmeasured.

### U6 — Feed the Hangar's connected-twin surfaces

The Board's connected-twin surfaces were built against modelled geometry. Real dimensions
from the vendor CAD would replace estimates with measurements.

## Proposed exploration

Not started. Each item is independently useful; **X1 gates a physical, irreversible operation and
should go first.**

| # | Task | Output |
| --- | --- | --- |
| **X1** | Extract `UGV_Beast_PT_Jetson_Orin-3D.zip` and determine whether it contains the host-bay plate with the Jetson mounting pattern. If yes, extract hole XY and record it. | Resolves the `OPEN_ITEMS` entry; replaces "drill and hope" in `MOUNT_LAYERS` with real coordinates |
| **X2** | Extract driver-board outline and hole spacing from the Beast STEP; compare against the 65 × 65 / 49 × 58 figures. | Confirms or corrects `MOUNT_LAYERS`; retires the calipers caveat |
| **X3** | Extract mast and Picatinny rail geometry; check Mid-360S and OAK-D Pro fit and FOV clearance. | Mount feasibility for the future loadout in `PERIPHERALS` |
| **X4** | Diff the PI4B and PT drawing dimension sets to establish what actually differs between the kits. | Settles which archive applies to BEAST-01 |
| **X5** | Establish whether a Beast-specific Orin **2D** drawing exists upstream, given both intake "Orin" archives were Rover. | Closes the gap the intake exposed |
| **X6** | Assess STEP → URDF feasibility and cost. | Go/no-go for U5 |

**Blocked, not scheduled:** Waveshare's wiki returns HTTP 403 to automated fetches, so enumerating
kit download pages — needed for X5 and for confirming whether a distinct Pi- or Orin-specific driver
schematic exists at all — requires a human with a browser. Record findings here when done.

## Pruning record — 2026-07-27

Removed from the working tree after verification, with rationale. **Nothing here is unrecoverable.**

| Removed | Why safe |
| --- | --- |
| Six CAD archives listed above | Byte-identical to LFS objects on `data/hardware-cad-assets`; hashes independently recorded in two places; fetch command above |
| `flash_download_tool_3.9.5.exe` (19.6 MB) from the factory archive | Espressif's freely published flashing tool, permanently available from the vendor. Version and SHA-256 recorded in the intake index. The one file in the collection that cannot meaningfully be lost — and the one least appropriate for a public repository, being a redistributed third-party binary. |

**Retained deliberately:** both ESP32 application images from the factory archive (`bin/`
2026-05-08 and `dl_temp/` 2025-08-27 — they differ, and one of them is probably what is running on
BEAST-01's ESP32 today), the release notes, the flashing logs, and every image and drawing.

The complete unmodified originals remain at
`D:\_projects\_artifact-backups\RobotOverview-keyArtifactstosort-2026-07-27\`, hash-verified. That is
on the same physical volume as the repository, so it is deletion protection, **not** a backup — an
off-volume copy is still outstanding.
