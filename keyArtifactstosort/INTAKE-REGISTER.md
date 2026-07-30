# keyArtifactstosort — intake verification register

**Status:** VERIFIED SNAPSHOT — 2026-07-27, 05:22 local. Descriptive index only. Every entry below was
produced by opening the file and reading its contents, not by reading its name. No file in
`keyArtifactstosort/` was deleted, moved, renamed, re-compressed, or otherwise modified; git was not
touched.

## Why this exists

`keyArtifactstosort/` is a hand-collected staging folder guarded by its own `agents.md` ("DO NOT DELETE
FILES FROM HERE …"). Its filenames have proven unreliable — two PDFs named for different products are
byte-identical — so contents were verified independently of names. This register records what each file
actually is.

It lives in `keyArtifactstosort/` alongside the artifacts it describes (moved from
`docs/history/` on 2026-07-30 when the history graveyard was deleted). It follows the register
convention used by `docs/plans/*.md`: plain markdown, `**Status:**` line, dated facts.
The companion hash register is `reference/EVIDENCE-MANIFEST.md`.

**Scope limit.** This document describes artifacts. It does not assess what engineering questions any
artifact might answer; that analysis belongs to
`docs/plans/2026-07-27-schematic-netlist-extraction-plan.md`.

**This is a snapshot of a live folder.** It grew from 12 files to 23 during the verification run
(05:10 → 05:22 on 2026-07-27). Re-verify the count before relying on it.

Totals as measured 2026-07-27: **23 files, 65.98 MB.**

## Register

"Duplicate of" is checked against the other 22 files in the folder, `public/datacore/`, and branch
`data/hardware-cad-assets`. "Name accurate?" compares the filename to the verified contents.

### Documents

| File | Bytes | SHA-256 | What it is (verified) | Duplicate of | Name accurate? |
|---|---:|---|---|---|---|
| `agents.md` | 157 | `498e4bff61a32c3eb5b9a1514e26af6306f611b36a9725b5f21888203b74e929` | Plain text, one line: a preservation directive forbidding deletion from this folder | — | Yes |
| `linkToOldWSGIT.txt` | 39 | `888834ba2f5e727bcc88e0cab2600ceeff01fa0f4255e4ed2ac9cab6b0326152` | Plain text, one URL: `https://github.com/waveshareteam/ugv_ws` | — | Yes. Note the URL is the `ugv_ws` ROS 2 workspace repo, a different repo from the `ugv_jetson` snapshot recorded in the source-evidence manifest |
| `RasperryPIversionofROS_Driver_for_Robots.pdf` | 1,023,807 | `b8ccd10fdb738af05436e118429cfedab9dda072401d2b3a45dfb3b6fd9b8dd5` | 1-page vector schematic, Altium Designer export, created 2024-02-24. Title block reads "waveshare / ROS Driver for Robots". Extracted text includes `MP8759GD`, `INA219BIDR`, `5V_Vout` | `UnclearMaybeforOrinDiagram.pdf` (same folder); `public/datacore/pdfs/ROS_Driver_for_Robots.pdf`; LFS objects on the CAD branch | **NO.** Not a Raspberry-Pi-specific variant. It is the ROS Driver for Robots schematic |
| `UnclearMaybeforOrinDiagram.pdf` | 1,023,807 | `b8ccd10fdb738af05436e118429cfedab9dda072401d2b3a45dfb3b6fd9b8dd5` | Byte-identical to the row above — same 1-page ROS Driver for Robots schematic | Same set as above | **NO.** Not an Orin diagram |

### Archives

All seven archives open cleanly (`testzip` reports no bad entry), contain no encrypted entries, and are
neither empty nor password-protected.

| File | Bytes | SHA-256 | Verified contents | Duplicate of | Name accurate? |
|---|---:|---|---|---|---|
| `UGV_Beast_PI4B_AI_Kit_3D.zip` | 272,014 | `cb7d51373314daa966dff26a30cb04d05adcf7c8d57e03341516f6b0f6e74259` | 1 entry: `UGV Beast_PI4B_AI_Kit.pdf`, 275,341 B. Fusion 360 Drawings export, 2384×1684 pt, dated 2024/4/3. **Title block reads "UGV Beast PT"**, author field "gu nian" | LFS object `cb7d5137…` at `assets/hardware/pi/` on the CAD branch; manifest row `beast-pi4b-3d` | **Partly.** The zip is a 2D dimension drawing, not a 3D model — "3D" is Waveshare's product-page label. Its internal title block also says PT, not PI4B |
| `UGV_Beast_PI4B_AI_Kit_step.zip` | 11,096,497 | `b52f72922132568b8728d14c39c783edca1bb13bd1b5f0c694bde3e15c577f27` | 1 entry: `UGV Beast PI4B.step`, 97,519,128 B uncompressed | LFS object `b52f7292…`; manifest `beast-pi4b-step` | Yes |
| `UGV_Beast_PT_AI_Kit_3D.zip` | 307,341 | `33db3df8d1ad24a92a1a74ce0d5360ec78950fa421e48bc5e780acc76e038c9a` | 1 entry: `UGV Beast_PT_AI_Kit.pdf`, 311,424 B. Fusion 360 Drawings export, 2384×1684 pt, 2024/4/3, title block "UGV Beast PT", author "WaveShare". Dimension values differ from the PI4B drawing | LFS object `33db3df8…`; manifest `beast-pt-3d` | **Partly.** Same "3D" mislabel — contents are a 2D drawing |
| `UGV_Beast_PT_AI_Kit_step.zip` | 12,303,971 | `bf649936f7663c7e4520fe4e45aa02d0b5ae588e5c200229a1f2cbfdcd9b7631` | 1 entry: `UGV Beast PT.step`, 106,833,093 B uncompressed | LFS object `bf649936…`; manifest `beast-pt-step` | Yes |
| `UGV_Rover_Jetson_Orin_ROS2_Kit_2D.zip` | 1,817,387 | `dbbeac8d878252ea0333ad6c2e96f3fd42d8fc03c65b3421c938c41deac31bf2` | 3 entries under `UGV Rover Jetson Orin ROS2 Kit_尺寸图纸/` ("dimension drawings"): a Fusion 360 PDF (721,879 B, 3370×2384 pt, 2024/10/25) and `UGV Rover PT Jetson Orin ROS2 Kit_DXF.dxf` (7,872,912 B; AutoCAD AC1027, extents 1189×841, `$LASTSAVEDBY` = "jaswalh") | LFS object `dbbeac8d…` at `assets/hardware/orin/` on the CAD branch. Not in the manifest | Yes for "2D". **Note it is a UGV *Rover* kit, not UGV *Beast*** |
| `UGV_Rover_PT_Jetson_Orin_ROS2_Kit_STEP.zip` | 16,007,240 | `eaa50ebdd9a648da45f1b0b54321167efa6540411a908e44e8c80d40e33b01ff` | 1 entry: `UGV Rover PT Jetson Orin ROS2 Kit v2.step`, 105,536,920 B uncompressed | LFS object `eaa50ebd…`. Not in the manifest | Yes. **UGV *Rover*, not Beast** |
| `UGV_RoverFACTORY-260706.zip` | 22,722,509 | `b7ec5600d45c181c1f6985b612956fa98f40aa8dda6274f3520e2af14a15e1ae` | 62 entries — an Espressif `flash_download_tool_3.9.5` distribution with a Waveshare ESP32 payload preloaded. Detail below | No duplicate anywhere in the repo | Yes, with the caveat that entry timestamps run 2023-06-12 → 2026-07-06, so `260706` matches the newest entry, not the whole contents |

#### `UGV_RoverFACTORY-260706.zip` contents

Single top-level folder `UGV_RoverFACTORY-260706/`, then
`flash_download_tool_3.9.5/flash_download_tool_3.9.5/`. File types present: 8 `.bin`, 5 `.bin_rep`,
15 `.txt`, 8 `.conf`, 2 `.pdf`, 1 `.exe`. Uncompressed total 24,851,816 B.

| Member | Bytes | SHA-256 (first 16) | What it is |
|---|---:|---|---|
| `bin/ROS_Driver.ino.bin` | 1,240,320 | `dc800e0a16bc783d` | ESP32 application image. Embedded strings include `UGV Beast`, `UGV Rover`, `ugv_base_ros.git`, ESP-IDF `v5.1.4-972-g632e0c2a9f-dirty`, compile date `May 8 2026` |
| `bin/ROS_Driver.ino.bootloader.bin` | 24,896 | `b22f373e6194a625` | ESP32 bootloader |
| `bin/ROS_Driver.ino.partitions.bin` | 3,072 | `148b959cbff1c38a` | Partition table |
| `bin/boot_app0.bin` | 8,192 | `f94c5d786a7a8fab` | OTA boot selector |
| `dl_temp/bin_tmp/downloadPanel1/ROS_Driver.ino.bin` | 1,238,928 | `c2fd02f59a5945ad` | **A second, different application image** — compile date `Aug 27 2025`, entry timestamp 2025-09-03 |
| `combine/target.bin` | 896,192 | `3d5a7534c7c700f8` | Merged image; embedded build dates 2020–2021, entry timestamp 2023-07-29 |
| `configure/esp32/multi_download.conf` | 2,109 | — | Flash offsets: `0x1000` bootloader, `0x8000` partitions, `0xe000` boot_app0, `0x10000` application |
| `doc/Flash_Download_Tool__en.pdf` / `__cn.pdf` | 797,366 / 844,590 | — | Espressif tool manuals, EN and CN |
| `doc/release_note.txt` | 333 | — | Espressif tool changelog, versions 3.9.2–3.9.5 |
| `flash_download_tool_3.9.5.exe` | 19,636,965 | — | Third-party Espressif Windows executable — 86% of the archive by size |
| `logs/*.txt` (12 files) | 1,078–8,657 | — | Flashing session logs containing ESP32 MAC addresses; timestamps 2023-07-29 |
| `dl_temp/_temp_by_dltool/…` (4 `.bin_rep`) | 17,104–24,896 | — | Tool scratch copies, incl. one named `RoArm-M2_example.ino.bootloader.bin_rep` (a different Waveshare product) |

### Images

None of these is a photograph of the owner's own hardware; all are Waveshare-authored renders, product
diagrams, or web-page captures.

| File | Bytes | SHA-256 | What it is (verified) | Duplicate of | Name accurate? |
|---|---:|---|---|---|---|
| `audioDriverBoard.png` | 289,977 | `41a857270dc3141a83b9522341bc58aef0af24212e9159a2a95e71fed17cf999` | 847×637 PNG, page capture on white. Product diagram: front and back faces of a PCB silkscreened "RPI Audio HAT for Robots", numbered leader lines 1–10, with a printed two-column legend below naming each callout. Rendered text, not photographic | No byte-duplicate. Same underlying diagram as `UGV-Beast-details-83.jpg` at different size and crop | Yes |
| `UGV-Beast-details-83.jpg` | 107,714 | `86641ec51ac8e3c9aebd98e6bda3b9d709b874303bd62ebd3524ec8719239416` | 960×~490 JPEG. The same front/back "RPI Audio HAT for Robots" diagram with numbered leaders 1–10. **Legend text is absent**; the board renders larger | Not byte-identical to `audioDriverBoard.png` | Opaque but not wrong — a Waveshare gallery index number |
| `correctbutincompleteimageofaudioBoard.jpg` | 160,720 | `b0be81522217b00fd15b07bda8049423c6ecaa701c35b25a54f4bb2e3c153b2c` | 960×750 JPEG marketing composite. Greyscale chassis render with a small PCB and two black box enclosures picked out in colour; leader labels "Onboard Microphone", "3.5mm Audio Jack", "Dual-track Speaker", "Audio Driver Board". Two insets: a photo of a gold/black speaker, and a screenshot of a text-to-speech input box. Board connectors on the far edge are not legible | — | Yes. Owner's "incomplete" qualifier matches what is visible |
| `rawDriverBoardshot.jpg` | 160,296 | `0cb3bac7bf88511cdcb4795949381d640890aac3bb1357a6c2ce679b2618acff` | 960×520 JPEG. Product diagram: front and back faces of the "ROS Driver for Robots" board, numbered leader lines 1–19, no legend text. Silkscreen legible at full size (`USB`, `LIDAR`, `IIC`, `IO4`, `IO5`) | Not byte-identical, but the same diagram as `public/datacore/beast-driver-board-callouts.png` (926×742 PNG, 4-channel). This JPEG is smaller and lossy | **Partly.** "raw…shot" implies a photograph; it is a rendered diagram |
| `UGV-Beast-details-size-1.jpg` | 352,019 | `6e557aea09b70c61e63afcf75445d93f6812390723b4270026a8283e7458d341` | 960×2477 JPEG. Dimensioned three-view engineering drawing (front, side, top) of the tracked robot, blue dimension lines and figures. Header "UGV Beast PT PI4B AI Kit / UGV Beast PT PI5 AI Kit", footer "Unit: mm". Values include 230.42, 231.46, 231.54, 251.78, 159.96, 156.22, 132.59, 120.88, 91.25, 85.80 | — | Yes — "size" is accurate |
| `imageShowingRaspberryPIInvertedandconnectedOnTop(justshowsraspberrypis).png` | 365,244 | `7a04ff3df38d9d97d922b5a4802625f2067b5fb7d9d4e7567c9d406c9d54f37d` | 812×615 PNG page capture headed "Based On Raspberry Pi". Two renders captioned "Connecting with Raspberry Pi 4B" and "Connecting with Raspberry Pi 5"; each shows a green single-board computer mounted solder-side-up on standoffs above a dark chassis, its USB-A and Ethernet connectors facing outward and unoccupied. A dark 2×20 connector body is visible beneath the board's left edge | — | Yes — it does show Pi boards and the parenthetical caveat is accurate |
| `imagesortofshowingthe stackandhowitworksforraspberrypi.png` (note the space in the filename) | 530,653 | `68ee10c2372f95a1c7fd2eb45cb7b2261dcab4e7273fc9395343b72f1f746942` | 866×796 PNG page capture. Heading text about a Raspberry Pi host controller and an ESP32 sub-controller, a greyscale robot render with two blue pointer arrows, product photos labelled "Host controller: Raspberry Pi 4B/Pi 5" and "Sub controller: ESP32", each with a bulleted capability list | — | Yes, including the "sort of" hedge |
| `imageoftopcutoutsandfrontcutouts(cleannothingmounted).png` | 102,049 | `a2283d14716adc7c3e169c373ec8b6ae22f70d7349b55f1d3b11bee9abaadcfe` | 806×390 PNG. Two black-on-white outline drawings of flat sheet-metal parts: a large plate with slots, round holes and a square four-hole pattern, and a narrow bracket. No dimensions, no title block, no annotation | Not byte-identical, but is the same pair of drawings that appears as the lower half of `UGV-Beast-details-25.jpg` | Yes |
| `UGV-Beast-details-25.jpg` | 179,211 | `f9b4f278a615767f5898b24aa878611ee28781b6a957d9c2ae799a9e98fb81fa` | 960×1300 JPEG. Render of the tracked robot with leader labels "LIDAR" and "Camera", above the same two outline part drawings. Footnote: "The Lidar is NOT included in the package. Please refer to the part list for detailed package content." | Superset of `imageoftopcutoutsandfrontcutouts…png` | Opaque but not wrong |
| `UGV-Beast-details-73.jpg` | 155,812 | `6ce43872997f7687430c3844fe64a0d0b47056b559bf61dbe75494e4ebf9d51e` | 960×638 JPEG. Dark render looking down into the chassis between the tracks, with a green wireframe rectangular box overlaid on an interior volume. No text, no dimensions | — | Opaque but not wrong |
| `possiblebatteryexpansion.jpg` | 42,079 | `c93e0152ec6cbe2729d3688b7796106f04467e60ec2386ff991384e97c817276` | 420×394 JPEG. Small render: a blue multi-cell cylindrical battery pack sitting on the robot's top deck, rest of the chassis ghosted grey, a black lead routed off the deck edge. No text or labels | — | Descriptive of the subject; "possible" is the owner's own hedge |
| `threeQuarterImageofBeastwithuselessmarkup.jpg` | 164,099 | `fa43d0a0fe8491abb9876bc8e47def432887a5147b12be4aeb0b776b1a5d2880` | 960×760 JPEG. Three-quarter render of the robot with two blue leader labels, "Antenna connector" and "4G/5G Module\*", and a dashed rectangle outlining an area of the top deck | — | **Partly.** The three-quarter framing is accurate; the markup is present and legible, so "useless" is a judgement the image does not bear out |

## Duplicates

Checked by SHA-256 across all 23 files, `public/datacore/`, `public/datacore/pdfs/`, and the nine LFS
pointers on `data/hardware-cad-assets`.

**Inside the folder — exactly one byte-identical pair:**

- `RasperryPIversionofROS_Driver_for_Robots.pdf` == `UnclearMaybeforOrinDiagram.pdf` (`b8ccd10f…`)

All 21 other files are mutually distinct. In particular, **`UGV_Beast_PI4B_*` and `UGV_Beast_PT_*` are
genuinely different content**, not the same kit twice — distinct hashes for both the `_3D` and `_step`
pairs, and the two enclosed drawings carry different dimension values and different author fields.

**Against the repo — eight files are already present elsewhere, byte-for-byte:**

| Folder file | Also exists as |
|---|---|
| `RasperryPIversionofROS_Driver_for_Robots.pdf` | `public/datacore/pdfs/ROS_Driver_for_Robots.pdf`; LFS oid `b8ccd10f…` |
| `UnclearMaybeforOrinDiagram.pdf` | same object as above |
| `UGV_Beast_PI4B_AI_Kit_3D.zip` | LFS oid `cb7d5137…`, `assets/hardware/pi/` |
| `UGV_Beast_PI4B_AI_Kit_step.zip` | LFS oid `b52f7292…`, `assets/hardware/pi/` |
| `UGV_Beast_PT_AI_Kit_3D.zip` | LFS oid `33db3df8…`, `assets/hardware/pi/` |
| `UGV_Beast_PT_AI_Kit_step.zip` | LFS oid `bf649936…`, `assets/hardware/pi/` |
| `UGV_Rover_Jetson_Orin_ROS2_Kit_2D.zip` | LFS oid `dbbeac8d…`, `assets/hardware/orin/` |
| `UGV_Rover_PT_Jetson_Orin_ROS2_Kit_STEP.zip` | LFS oid `eaa50ebd…`, `assets/hardware/orin/` |

The six CAD zip hashes additionally match the upstream hashes recorded in
`reference/EVIDENCE-MANIFEST.md` (rows `beast-pi4b-3d`, `beast-pi4b-step`,
`beast-pt-3d`, `beast-pt-step`) or, for the two Rover Orin zips, appear on the CAD branch without a
manifest row.

**Near-duplicates, not byte-identical** — same underlying artwork at different size, crop, or format:

| Pair | Relationship |
|---|---|
| `audioDriverBoard.png` ↔ `UGV-Beast-details-83.jpg` | Same Audio HAT diagram. The PNG carries the legend text; the JPEG has a larger board and no legend |
| `rawDriverBoardshot.jpg` ↔ `public/datacore/beast-driver-board-callouts.png` | Same driver-board diagram. The repo copy is 926×742 PNG with alpha; the folder copy is 960×520 lossy JPEG |
| `imageoftopcutoutsandfrontcutouts…png` ↔ `UGV-Beast-details-25.jpg` | The PNG is the lower portion of the JPEG |

**Redundancy note.** Of the 23 files, eight are exact duplicates of bytes already stored in the repo and
three more are lower-fidelity or cropped variants of another file present here or in `public/datacore/`.
Within `UGV_RoverFACTORY-260706.zip`, `flash_download_tool_3.9.5.exe` (19.6 MB, 86% of the archive) is a
redownloadable third-party Espressif binary, and `dl_temp/` and `combine/` hold tool scratch copies. If
the folder is ever pruned, those are the candidates; nothing in this register is unique-and-at-risk
except the factory archive's `bin/`, `configure/`, and `logs/` members and the eleven images.

## Anomalies

1. **Both PDFs are misnamed.** Neither is a Raspberry-Pi variant nor an Orin diagram; both are the ROS
   Driver for Robots schematic (title block "waveshare / ROS Driver for Robots", Altium export,
   2024-02-24), byte-identical to each other and to `public/datacore/pdfs/ROS_Driver_for_Robots.pdf`.
2. **`data/hardware-cad-assets` carries two differently-named LFS pointers with the same oid.**
   `assets/hardware/pi/DriverBoardsRaspberryPiBeast.pdf` and
   `assets/hardware/orin/DriverBoardBeastOrin.pdf` both point at `b8ccd10f…`. This is stated here as a
   duplicate fact only. It is worth noting that `reference-data.ts` `INTEGRITY_NOTE` describes this as
   having "lost the ROS Driver original", whereas the manifest's independently recorded upstream hash
   for `ros-driver-schematic` is also `b8ccd10f…`. Resolving that wording is out of scope for this index.
3. **`UGV_Beast_PI4B_AI_Kit_3D.zip` contains a drawing whose title block reads "UGV Beast PT"**, not
   PI4B, with author field "gu nian" rather than "WaveShare". The drawing content is nonetheless
   distinct from the PT zip's. This is an upstream labelling inconsistency, not a duplicate.
4. **Both `_3D.zip` archives contain 2D drawings, not 3D models.** The actual 3D geometry is in the
   separate `_step.zip` archives. "3D" is Waveshare's product-page label.
5. **Both Orin archives are UGV *Rover* kits**, not UGV *Beast*. The Beast-specific Orin CAD
   (`UGV_Beast_PT_Jetson_Orin-3D.zip`, oid `56615c77…`, 15,378,700 B) exists on the CAD branch and in the
   manifest but **is absent from this folder**.
6. **`UGV_RoverFACTORY-260706.zip` contains two different ESP32 application images** — `bin/` holds a
   2026-05-08 build (`dc800e0a…`), `dl_temp/` a 2025-08-27 build (`c2fd02f5…`). "The firmware" is
   therefore ambiguous without specifying which.
7. **The same archive contains a 19.6 MB third-party Espressif `.exe`** and 12 flashing logs holding
   ESP32 MAC addresses from 2023-07-29 factory sessions.
8. **`threeQuarterImageofBeastwithuselessmarkup.jpg` has legible, substantive markup** ("Antenna
   connector", "4G/5G Module\*", dashed deck outline). The filename's "useless" is not borne out.
9. **`rawDriverBoardshot.jpg` is not a photograph** despite "shot" in the name — it is a rendered
   product diagram.
10. **One archive uses non-ASCII internal paths** (`…_尺寸图纸/`, "dimension drawings"). Harmless, but it
    breaks naive extraction tooling under Windows default code pages; this was encountered and worked
    around during verification.
11. **The folder is live.** It grew 12 → 23 files during the 12 minutes of this verification run. Any
    count here is a snapshot.

## Safe interim copy

A verified copy was taken on 2026-07-27 to a location outside the repo working tree:

```
D:\_projects\_artifact-backups\RobotOverview-keyArtifactstosort-2026-07-27\
```

23 files, 65.98 MB, **all 23 SHA-256 values verified identical to source**. The source folder was
unmodified by the copy (newest write time unchanged at 05:22:06). This is a plain copy on the same
physical volume — it guards against accidental deletion, not against drive failure. It is not a backup.

## Not determined

- **Download provenance for the two identical PDFs.** No source URL was captured with either file, so
  whether Waveshare publishes one schematic under two product links, or the same link was followed
  twice, cannot be distinguished from the files alone.
- **Upstream URLs for the two Rover Orin zips and for the factory archive.** None appear in
  `reference/EVIDENCE-MANIFEST.md`, and the archives carry no source metadata.
- **Whether a distinct Pi-specific or Orin-specific driver-board schematic exists upstream at all.**
  Not resolved: `waveshare.com/wiki` returns HTTP 403 to automated fetches, so the kit pages' download
  lists could not be enumerated.
- **How `UGV_RoverFACTORY-260706.zip` was obtained.** The 2023-07-29 production logs suggest a
  Waveshare factory workstation origin, but nothing in the archive states it.
- **Why the Beast-specific Orin CAD is absent** from this folder while its Rover counterparts are
  present.

## Pruning applied — 2026-07-27

Verified against the hash-checked backup at
`D:\_projects\_artifact-backups\RobotOverview-keyArtifactstosort-2026-07-27\` (all 23 files confirmed
hash-identical) **before** any removal. Rationale and fetch instructions are in
[CAD assets — usage and discoverability](../plans/2026-07-27-cad-assets-usage-and-discoverability.md).

| Removed | Recoverable from |
| --- | --- |
| `UGV_Beast_PI4B_AI_Kit_3D.zip` | `data/hardware-cad-assets` (LFS) |
| `UGV_Beast_PI4B_AI_Kit_step.zip` | `data/hardware-cad-assets` (LFS) |
| `UGV_Beast_PT_AI_Kit_3D.zip` | `data/hardware-cad-assets` (LFS) |
| `UGV_Beast_PT_AI_Kit_step.zip` | `data/hardware-cad-assets` (LFS) |
| `UGV_Rover_Jetson_Orin_ROS2_Kit_2D.zip` | `data/hardware-cad-assets` (LFS) |
| `UGV_Rover_PT_Jetson_Orin_ROS2_Kit_STEP.zip` | `data/hardware-cad-assets` (LFS) |
| `flash_download_tool_3.9.5.exe`, from inside `UGV_RoverFACTORY-260706.zip` | Espressif, freely published |

The removed executable was Espressif's flash download tool, version 3.9.5, 19,636,965 bytes,
SHA-256 `146db73596dda2865e409a611e1f31737cf1feac3817fd4ebd619f8e97b9c273`. The factory archive was
repacked with the other 61 entries intact and shrank from 22,722,509 to 3,631,566 bytes.

**Retained deliberately:** both ESP32 application images (`bin/` 2026-05-08 and `dl_temp/`
2025-08-27 — they differ, and one is likely what runs on BEAST-01 today), the release notes, all
flashing logs, both PDFs (byte-identical to a repo file, so they cost no additional stored bytes,
and they preserve the record of what was downloaded under those misleading names), and every image.

Folder went from 23 files / 65.98 MB to 17 files / 8.0 MB.
