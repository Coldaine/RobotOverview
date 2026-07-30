# BEAST-01 reference library

Primary sources pulled 2026-07-27 while diagnosing the ~4 s speaker pop during the
Pi 5 → Jetson Orin cutover. Each entry notes **what question it answers**, so nobody
has to re-derive from summaries again.

## Vendor specifications

| File | Answers |
|---|---|
| `NVIDIA_Jetson_Orin_Nano_DevKit_Carrier_Board_Spec_SP-11324-001.pdf` | 40-pin pinout (Fig 3-1: **pins 2 & 4 = 5.0 V**), Table 5-1 power rails + part numbers, Table 5-2 rail current caps (**VDD_5V_SYS max 2.78 A**), Table 5-3 per-connector caps (**40-pin header 0.5 A · USB Type-A ×4 0.5 A · SO-DIMM 2.12 A**). Also the p.1 caution to mate everything **before** applying power. |
| `AP22811_load_switch_Diodes_DS39135.pdf` | The load switch gating the Jetson's USB Type-A VBUS (per carrier spec Table 5-1). **ILIMIT 2.2 / 2.7 / 3.2 A** (min/typ/max), short-circuit limit 0.3 A, overcurrent/short/thermal all with **auto recovery**, FLG blanking 6 ms. |
| `APA2068KAI-TRG_amp_Anpec.pdf` | The Audio HAT's speaker amp (callout 6). **Supply voltage 4.5 V min – 5.5 V max**, abs-max 6 V. Has depop circuitry for turn-on/shutdown transients. |
| `FE1.1S_usb_hub_Terminus.pdf` | The HAT's USB hub (callout 2). Use for predicting enumeration when the HAT's USB-C is reconnected. |
| `MBR230LSFT1G_onsemi_LANDING_PAGE_ONLY.html` | **GAP** — onsemi/Mouser/alldatasheet all block scripted download. Only the landing page was captured. Still needed: forward-voltage vs current curve for D1/D2, which sets how far the stack's 5 V rail droops when back-fed. Fetch by hand. |

## Web snapshots (sources that rot or block direct fetch)

| File | Answers |
|---|---|
| `nvidia_forum_backpower_blocker_253291.html` | NVIDIA staff: *"No, it can not be supplied from 5V pins on the expansion header as the blocker circuit exist."* Confirms the 40-pin 5 V is output-only. |
| `waveshare_UGV_Beast_PT_Jetson_Orin_AI_Kit.html` | Our exact kit. States the **product power switch powers the Jetson** — one battery, one switch, no separate supply in the stock design. |
| `waveshare_UGV_Beast_Jetson_Orin_ROS2.html` | Same architecture statement; recovery-mode procedure is "turn on the product power switch," then connect USB. |
| `waveshare_General_Driver_for_Robots.html` | Driver board: 40-pin header "connects **and powers** the host computer", DC 7–13 V in, 5 V buck out. |

## Vendor source code

| File | Answers |
|---|---|
| `waveshareteam_ugv_jetson_main.zip` | Jetson host software. Contains `asound.conf` and `audio_ctrl.py` — the audio device configuration, relevant to any remaining pop once the power path is fixed. |
| `waveshareteam_ugv_base_ros_ESP32_firmware.zip` | ESP32 firmware. Defines the JSON telemetry schema — including what the `"v"` field in `{"T":1001,...,"v":2}` actually means and its units. |
| `waveshareteam_ugv_ws_ros2-humble-develop.zip` | ROS 2 workspace (branch `ros2-humble-develop`, not `main`). |

## Known permanent gaps

- **The "ROS Driver for Robots" board has no wiki page.** <https://www.waveshare.com/wiki/ROS_Driver_for_Robots>
  returns only the placeholder: *"Our Wiki resources are under urgent production."* This is the
  actual source of that stub message — it was previously mis-attributed to the Jetson assembly
  tutorial. The board on BEAST-01 is silkscreened **ROS Driver for Robots**, which is *not* the same
  as the documented **General Driver for Robots**; treat the General Driver wiki as an analogue, not
  as this board's spec. The schematic PDF is the only first-party source for this board.

- **No Audio HAT schematic exists.** Waveshare documents it component-level only
  (SSS1629A5 / FE1.1S / CH340 / APA2068). Confirmed again today. Internal nets —
  notably whether the USB-C VBUS ties to the 40-pin 5 V — can only be settled with
  a continuity meter.
- **The Jetson assembly tutorial is a video, not a wiki page.** Corrected 2026-07-27:
  *"How to install UGV with Jetson orin & battery"* (Waveshare Electronics, 1:29,
  <https://www.youtube.com/watch?v=m_P2LfZAp9Q>), linked as "Assembly tutorial for ugv"
  from both the Beast and Rover Jetson Orin wikis. The wiki prose still describes only
  the Pi 4B/5 install, which is why this was first read as a gap. Still no vendor
  *diagram* for the pack → Jetson power lead — that remains derived.

## Derived extractions

Active path-trace for the ROS Driver schematic:
[`../Artifacts/ros-driver/current/`](../Artifacts/INDEX.md).
An earlier inventory dump is retained under `Artifacts/ros-driver/superseded/` only — not for
catalog use.
