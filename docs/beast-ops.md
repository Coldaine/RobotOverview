# BEAST-01 — Operations

Operating facts for the physical **UGV Beast** (`BEAST-01`) — how to reach it, drive it,
read its telemetry, and program it. The catalog entry for the unit lives in
`src/data/hangar.ts` (`id: 'beast'`). Facts below carry the date they were last verified;
re-verify against the live robot before relying on anything stale.

## Quick connect

Live repository/service check (2026-08-03): `beast-01` is reachable; the legacy
`~/beast/ugv_ws` checkout is gone and the monorepo cutover is deployed (workspace at
`~/beast/RobotOverview/robot/beast/ros2_ws`). `beast-ros-base.service` and
`beast-cockpit.service` are both **enabled and active**. `beast-cockpit` serves the
rosbridge on `127.0.0.1:9090`, fronted over the tailnet by
`sudo tailscale serve --https=443 http://127.0.0.1:9090` → `https://beast-01.tyrannosaurus-magellanic.ts.net/`.
Security model: **the tailnet is the perimeter** — no `COCKPIT_ALLOWED_ORIGINS` is set, so the
bridge accepts any browser origin; the topic whitelist (`/ugv/set_allow_motion` service,
`/cmd_vel_ui` publish rung) bounds what a client may do. The DISARM/RE-ARM round trip over
that bridge was verified live (2026-08-03) and `allow_motion` was left `true` (armed).
Network-path details below were
last fully verified 2026-07-31 unless marked newer.

Turn on the chassis switch (it powers the Jetson too), wait ~2 minutes for boot, then:

```bash
ssh beast-01        # mDNS: beast-01.local; currently resolves to Wi-Fi 192.168.0.187
ssh beast-01-ts     # Tailscale: 100.107.16.72
# Direct Wi-Fi fallback when mDNS fails:
ssh -i ~/.ssh/hephastus_ed25519 -o HostKeyAlias=beast-01 beast@192.168.0.187
```

**All documented paths (verified 2026-07-31):**

| # | Path | Address | Notes |
|---|---|---|---|
| 1 | `ssh beast-01` | `beast-01.local` → `192.168.0.187` (mDNS/Wi-Fi) | **Verified working**; Windows may fail to resolve `.local` |
| 2 | Direct Wi-Fi | `192.168.0.187` (`wlP1p1s0`) | **Verified working**; DHCP address and may drift |
| 3 | `ssh beast-01-ts` | `100.107.16.72` (`tailscale0`) | **Verified working**; Tailscale daemon is up |
| 4 | Direct Ethernet | `192.168.0.166` (`enP8p1s0`) | **Verified working**; current wired fallback and preferred route when cable is connected |
| 5 | USB gadget fallback | `192.168.55.1` (`usb0`) | **Not reachable now**; USB gadget interface is down |

The current Wi-Fi association is SSID **`CastleMooseGoose`**. Wi-Fi power save is **disabled**
(persistent, set 2026-07-31 — it caused laggy/flaky Wi-Fi SSH). The old
`beast-staging-wifi` / `MooseGooseIOT` profile was deleted from NetworkManager on 2026-08-02
through the verified Docker-root recovery path; only the corrected profile remains.

Rebuild the SSH aliases on any machine (key: `hephastus_ed25519`; this workstation's matching
public half is in Doppler as `BEAST_JETSON_OPERATOR_SSH_PUBLIC_KEY_DESKTOP`):

```text
Host beast-01
    HostName beast-01.local
    HostKeyAlias beast-01
    User beast
    IdentityFile ~/.ssh/hephastus_ed25519
    IdentitiesOnly yes

Host beast-01-ts
    HostName 100.107.16.72
    User beast
    IdentityFile ~/.ssh/hephastus_ed25519
    IdentitiesOnly yes
```

Both aliases use the `hephastus_ed25519` key. The live Beast accepts this key in
`~/.ssh/authorized_keys` (fingerprint `SHA256:JO1fqfONgHgr5JUCdL1pyN6qHjaRc4dR+v7DDVMEZ6A`),
so no key installation was needed during the 2026-08-02 verification. Host-key fingerprint:
`SHA256:S5qCj4JsuBRSxfXgB//sAyNmDKWNSIOJtA6vUcu1XkI`.

### Credential map (Doppler)

All Beast-related credential records are in Doppler project **`homelab`**, config **`dev`**.
Do not copy their values into this repository, shell history, or chat.

| Need | Doppler secret | Current use |
|---|---|---|
| Routine SSH from this workstation | `BEAST_JETSON_OPERATOR_SSH_PUBLIC_KEY_DESKTOP` | Matching public half for local `~/.ssh/hephastus_ed25519`; this is the key that authenticated successfully |
| Alternate operator key | `BEAST_JETSON_OPERATOR_SSH_PUBLIC_KEY` | Separate operator-key record; it is not this workstation's key, and its installation was not needed for this verification |
| `sudo` and recovery login | `BEAST_JETSON_ADMIN_PASSWORD` | Current password for the Jetson `beast` account; reset and live-verified 2026-08-02; not needed for key-only SSH |
| Current Wi-Fi association | `CASTLEMOOSEGOOSE_WIFI_PSK` | PSK for the live `CastleMooseGoose` SSID |
| Tailnet administration/re-enrollment | `TAILSCALE_API_TOKEN` | Not needed for routine `ssh beast-01-ts`; only for Tailscale API or re-enrollment work |
| Existing Beast access record | `BEAST_JETSON_SSH_ACCESS` | Connection and credential-name reference; not needed by the verified key-based paths |

No token is required for the Ethernet or USB paths themselves. Ethernet is currently working;
the USB path is unavailable because its Beast interface is down, not because SSH credentials are
missing.

If neither working alias answers, the robot is off, still booting, Tailscale is down, or Wi-Fi
received a new DHCP lease. Resolve the current Wi-Fi address with `ping beast-01.local` or the
current router lease. Full detail: [Network](#network).

### Wi-Fi failure diagnosis (verified 2026-08-02)

- The retained NetworkManager/syslog history shows the prior Wi-Fi failures were attempts to
  activate the obsolete `beast-staging-wifi` profile for SSID `MooseGooseIOT` on the retired
  `192.168.20.x` network. The access point rejected associations, the supplicant timed out,
  DHCP lost its lease, and NetworkManager retried the same profile.
- The active `CastleMooseGoose` profile is the corrected profile: autoconnect is enabled, no BSSID
  is pinned, and `802-11-wireless.powersave=2` (disabled). It currently uses an Intel AX210 with
  `iwlwifi`, 5 GHz channel 100, and a strong approximately `-31 dBm` signal.
- A Wi-Fi-only test while Ethernet was connected sent 20 gateway pings and 20 workstation pings
  with **0% packet loss**. No current-boot Wi-Fi disconnect, association reject, DHCP loss, or
  firmware reset was observed.
- When both links are up, NetworkManager prefers Ethernet (`enP8p1s0`, route metric 100) over
  Wi-Fi (`wlP1p1s0`, route metric 600). This is intentional and does not disable Wi-Fi; unplugging
  Ethernet leaves Wi-Fi as the default route.
- The Doppler `BEAST_JETSON_ADMIN_PASSWORD` value was reset and live-verified through the existing
  Docker-root path after the old value failed. The new value is synchronized in both
  `homelab/dev` and `homelab/dev_personal`; `sudo` now succeeds without changing key-only SSH.
- A global Doppler audit covered 10 projects and 15 configs. No other secret name containing
  `JETSON`, `ORIN`, `UGV`, `WAVESHARE`, or `NVIDIA` represented an administrator password. The
  only Beast-specific password record is `homelab/dev:BEAST_JETSON_ADMIN_PASSWORD` (mirrored in
  `homelab/dev_personal`). Operator public-key and access-reference records are documented above.

**Ground-truth check — run this before trusting any status claim in this file** (per the
"Robot ground truth" rule in `AGENTS.md`; this doc drifts because hardware sessions happen
outside the repo loop):

```bash
ssh beast-01 'systemctl is-active beast-ros-base.service; cat /etc/beast/ugv.env; \
  ls /dev/ttyACM* /dev/video* 2>/dev/null; ss -tlnp 2>/dev/null | grep LISTEN; lsusb'
```

```bash
ssh beast-01 'source /opt/ros/humble/setup.bash && source ~/beast/ugv_ws/install/setup.bash && \
  timeout 10 ros2 topic list && timeout 12 ros2 topic echo /ugv/voltage --once | head -8 && \
  timeout 10 ros2 topic info /cmd_vel --verbose | grep count'
```

First command: service state, configured serial ports, devices, listening ports. Second:
live topics, battery telemetry (proves the ESP32 link end-to-end), and whether anything is
publishing drive commands. Update this block, dated, whenever a session learns a robot fact.

**Telemetry honesty (`ugv_bringup` — annotated in source 2026-07-31):**

| Topic / field | Trust? | Reality |
|---|---|---|
| `/ugv/voltage` → `voltage` | Real | Pack bus volts from ESP32 `v` |
| `/ugv/voltage` → `percentage` | **Fake** | `V / 12.6` — not SOC; lies under load / while charging |
| `/ugv/voltage` → `current`, `charge`, `capacity`, `temperature`, `power_supply_status` | **Dummy** | Left at ROS defaults (zero / unset) |
| `/imu/raw`, `/imu/mag` scales | Assumed | Waveshare ICM-20948 LSB factors; not calibrated here; `frame_id` is `base_link` (wrong frame) |
| `/odom/odom_raw` | Partial | `odl`/`odr` ÷100 assumed cm→m; `L`/`R` are ESP32 wheel speeds, not fused pose |
| Charging / true SOC | **Missing** | Needs UPS Module 3S I²C telemetry header → Orin (not wired) |

Source: module docstring + inline `FAKE` / `DUMMY` / `ASSUMED` / `HACK` in
[`robot/beast/ros2_ws/src/ugv_main/ugv_bringup/ugv_bringup/ugv_bringup.py`](../robot/beast/ros2_ws/src/ugv_main/ugv_bringup/ugv_bringup/ugv_bringup.py).

**Do we calibrate these?**

| Kind | Action |
|---|---|
| Fake `%` / dummy BatteryState fields | **Do not calibrate** — need UPS I²C (+ SOC model) first |
| IMU/mag vendor LSB scales | **Spot-check only** at rest (≈1 g on Z, gyros ≈0); full bias/mag calibration only if nav needs it |
| Wheel odom / EKF | **Calibrate before mapping/autonomy** if distance/turns disagree with reality |
| Angular deadband / zero-cmd hacks | Behavior quirks — leave or remove; not calibration |

### Syncing robot code to BEAST-01

RobotOverview is one source repository with two deployment targets. The Hangar web app
never deploys to the Jetson; only the sparse-checked-out ROS workspace is built there:

| Piece | Where |
|---|---|
| Source repository | [Coldaine/RobotOverview](https://github.com/Coldaine/RobotOverview) |
| Edit on PC | `D:\_projects\RobotOverview\robot\beast\ros2_ws` |
| On robot after cutover | `~/beast/RobotOverview/robot/beast/ros2_ws` |
| Vendor upstream | [waveshareteam/ugv_ws](https://github.com/waveshareteam/ugv_ws) (fetch directly; no retained fork) |

```bash
# On PC: edit on a RobotOverview branch and merge its PR.
cd D:/_projects/RobotOverview
git switch -c beast/<change>
# edit robot/beast/ros2_ws/...
git push -u origin beast/<change>

# On beast-01 after merge and after the one-time sparse-checkout cutover:
cd ~/beast/RobotOverview
git fetch origin
git checkout main
git pull --ff-only origin main
cd robot/beast/ros2_ws
source /opt/ros/humble/setup.bash
colcon build --packages-select ugv_bringup --symlink-install   # or full workspace
sudo systemctl restart beast-ros-base.service                 # starts motion-enabled; active Ethernet/charging locks disable it
git -C ~/beast/RobotOverview rev-parse --short HEAD            # record in Quick connect
```

There is no automatic deployment to the robot. If a PR does not change
`robot/beast/ros2_ws`, the Jetson does not change.

- **What's on it (repository/service state live-verified 2026-08-03; hardware details
  last verified 2026-07-31):** JetPack 6.2.2 (R36.5), ROS 2 Humble, and
  `beast-ros-base.service` is **active** from the RobotOverview workspace. It starts with
  `use_lidar:=true`, `allow_motion:=true`; the active `ugv_safety_monitor` disables motion
  only after detecting Ethernet or charging. Base driver, LD19 LiDAR, pan-tilt
  `ros2_control`, wheel + rf2o odometry, and EKF are all up; battery/IMU telemetry flows.
- **ESP32 link is USB, not GPIO jumpers:** the driver board talks to the Orin over
  `/dev/serial/by-id/usb-1a86_USB_Single_Serial_5B5E130201-if00` (→ `ttyACM0`); the LiDAR is
  the `…5970075705` sibling (→ `ttyACM1`). Both set in `/etc/beast/ugv.env`. The pins-8/10
  UART-jumper plan in the sections below is **superseded** — keep only its back-feed rule:
  never leave the driver-board USB connected to a powered Jetson with the chassis switch off.
- **✅ OAK-D Lite FIRST LIGHT (live-verified 2026-07-31, evening session):** launched the in-tree
  `ugv_vision/launch/oak_d_lite.launch.py` (depthai-ros 2.12.2 apt packages already installed;
  udev rule already present at `/etc/udev/rules.d/80-movidius.rules`). Camera MXID
  `1944301091FCBE2F00` connected; **`USB SPEED: HIGH` = USB 2.0 live** (the idle-lsusb 480 Mbps
  was bootloader enumeration, but the live session confirms USB2 negotiation — swap to a
  known-USB3 USB-C cable on a direct Orin USB3 port to get SUPER; the in-box Lite cable is
  presumed USB2-only). Measured: RGB preview 640×480 bgr8 @ **~16 FPS**, stereo depth 640×480
  `16UC1` @ **~16.3 FPS**, both stamped `oak_rgb_camera_optical_frame` (depth aligned to RGB).
  TF chain `base_link → oak_rgb_camera_optical_frame` resolves correctly from the URDF's OAK
  macro (translation [0.087, 0, 0.084], standard optical rotation) — no driver/URDF frame
  conflict. **5 MP pan-tilt camera one-frame grab also verified** (`v4l2-ctl`, `/dev/video0`).
  15 s baseline bag (417 MB: scan, TF, odoms, IMU, voltage, OAK RGB+depth+camera_info) at
  `~/beast-acceptance/bags/oak-baseline-20260731`. **rf2o "duplicate node" diagnosed as
  cosmetic:** one process, two same-named in-process rclcpp nodes (upstream quirk); `/odom_rf2o`
  publishes single-rate ~10 Hz (scan-driven). OAK launch stopped after the session; base service
  left active and motion-locked. IMU presence on this Lite revision still unchecked (python3
  `depthai` module not installed; check before ever enabling `i_enable_imu`).
- **⚠️ HEARTBEAT-STOP TEST FAILED (2026-07-31): the ESP32 does NOT auto-stop on command
  silence.** Supervised floor test: after the `/cmd_vel` publisher was killed mid-crawl, the
  ESP32 kept executing the last command (0.02 m/s) for **minutes** — ~1 m of creep — until an
  explicit zero was sent. The documented "3-second stale-command watchdog" does not exist in
  the flashed firmware's current state.
- **cmd_vel-timeout watchdog DEPLOYED (2026-07-31), not yet live re-tested:** `ugv_bringup`
  now has `cmd_vel_timeout` (default 0.5 s) — on silence while `allow_motion` is true it
  sends stop once. Unit tests passed on-robot; supervised crawl+kill re-gate is still
  required before trusting it. Normal startup is motion-enabled; the interlock monitor disables
  motion when charging or Ethernet is detected. Do not command motion while charging / tethered,
  or below ~10.5 V.
- **Brownout 2026-07-31:** pack hit ~8.8 V; Jetson went offline (Tailscale last-seen gap).
  After charger plug-in + chassis power, Wi-Fi SSH at `.187` returned (~2 min uptime).
  Charge before any motion session.
- **Command Deck — implemented, not deployed (2026-07-31):** The Hangar app contains the
  `/cockpit` route, and the reviewed robot-side service is being landed in `ugv_ws`. BEAST-01
  does **not** currently have `beast-cockpit.service` installed/enabled or a Tailscale Serve WSS
  proxy configured for it. Therefore cockpit telemetry and controls are not live. Do not infer
  deployment from repository or image-build state.
- **Planned cockpit boundary:** rosbridge binds `127.0.0.1:9090`; a deliberate future
  `tailscale serve` step will expose WSS only after install/build and the safety prerequisites.
  Existing separate surfaces remain Vizanti `:5100`/`:5001`, `ugv_chat_ai` `:5000`, and
  MediaMTX `:8554`/`:8889`; verify them live before relying on them.
- **LiDAR is off in the boot service (2026-07-31, source-verified):** `beast-ros-base.service`
  runs `bringup_lidar.launch.py use_lidar:=false use_rviz:=false allow_motion:=false`, so `/scan`
  has no publisher until someone relaunches by hand. Any cockpit spatial view — and the Phase 0
  `/scan` ground-truth check — is empty on a stock boot for that reason, not because the LD19
  failed. (An earlier revision of this doc attributed this to `beast-cockpit.service`; that was
  wrong, and that service is not installed at all.)
- **Robot-reported status is not deployed:** `/cockpit/status`, `/ugv/allow_motion` and
  `/ugv/watchdog_state` land with `ugv_ws` PR #10 and are not on the robot yet. Until they are,
  the cockpit's safety strip reads UNKNOWN, drive stays gated (unknown is not permission), and
  the e-stop sits in ASSERTING because nothing echoes the mux lock back.
- **Lesson — a wrong message type is a silent dead control (2026-07-31):** the first cockpit
  build advertised `/ugv/led_ctrl` as `Int32MultiArray` and `/ugv/pt_steady_ctrl` as
  `Float64MultiArray`; `ugv_bringup` subscribes to both as `Float32MultiArray`. DDS simply never
  matches mismatched types — no error, on either side — so the headlights and the steady toggle
  did nothing while the UI looked healthy. Fixed in RobotOverview #148. When adding any control,
  check the subscriber's declared type in `ugv_bringup.py`, not the topic name.

> **Scope (owner statement 2026-07-31 - Updated):** The Hangar app is intended to be a
> **teleop and telemetry cockpit** in addition to an information surface, implementing North Star
> G7 directly inside the Hangar. The `/cockpit` UI is implemented, but the robot transport is not
> deployed; driving and telemetry have therefore **not yet moved** from the existing robot-side
> and terminal surfaces into the Hangar. Onboard fail-safes (stale-command watchdog, explicit
> stop, motor PID) remain mandatory engineering — they are not a ban on self-driving.
> **Dynamics note (operator, 2026-07-22):** the Beast is slow, hard-stops, and **stops in time**
> for terrain/obstacle reactions. Remote closed-loop from CORE-PRIME is fine. Lightweight
> on-device Orin inference for terrain alignment / avoidance is fine. Reject “won’t stop in time”
> and “avoidance must stay classical-only.”

## Hardware chain

> **Cutover status 2026-07-30 — CONTROL SURFACE LIVE (supersedes 2026-07-28 "no control
> surface").** The ESP32 link runs over the driver board's USB-C into the Orin — enumerates as
> `/dev/ttyACM0`, pinned by-id in `/etc/beast/ugv.env`. The pins-8/10 GPIO jumper plan was never
> executed and is **retired** (kept below only as an alternative path). `beast-ros-base.service`
> is enabled and brings up the full stack at boot: base driver, LD19 LiDAR (`/dev/ttyACM1`,
> ~10 Hz scans), pan-tilt `ros2_control`, wheel + rf2o odometry, EKF. Battery/IMU telemetry
> verified flowing. Normal boot is motion-enabled; the Ethernet/charging monitor disables motion
> when either physical interlock is observed. Remaining for full cutover: supervised lifted-track heartbeat-stop test,
> one-frame verification of the 5 MP camera and OAK-D Lite, and the missing host mounting strut.
>
> *Power (2026-07-28, still current):* Orin is powered from the pack through the barrel-jack
> pigtail wired into the UPS Module 3S board — not through the driver board's USB-C, so the
> OP-BEAST-BACKFEED path is not in the power loop. Mechanical: one side of the host mounting
> struts is missing; do not drill the Orin carrier board — see "Mounting" under Open questions.

```
Current (live-verified 2026-07-30):
SSH / ROS 2 tooling  ──LAN/Tailscale──▶  Jetson Orin Nano Super (upper computer)
                                              │  ROS 2 / policy / camera / LiDAR
                                              ▼  JSON @115200 over USB-CDC (/dev/ttyACM0)
                                            ESP32 (lower computer)  ──▶ motors · servos · IMU · voltage

Previous (retired 2026-07-22):
Browser  ──HTTP/WebSocket──▶  Raspberry Pi 5 + ugv_rpi  ──UART──▶  ESP32
```

- **Upper computer (current):** Jetson Orin Nano Super — vision, ROS 2, teleop, on-device and/or
  offboard policy inference. **Fitted, networked, and linked to the ESP32 over USB — live-verified
  2026-07-30** (motion held by `allow_motion:=false` pending the heartbeat-stop test).
- **Upper computer (previous):** Raspberry Pi 5 + Waveshare `ugv_rpi` — removed; kept as spare.
- **Lower computer:** ESP32 — motion (PID), stock pan-tilt servo bus, sensor feedback, stop.
- **Identifying the ESP32 link on the driver board:** the board has two USB-C ports. The **left**
  one — silkscreen `USB`, next to the DC jack, callout 6 on Waveshare's labeled diagram — is the
  ESP32/host port; on the live robot it enumerates as **`/dev/ttyACM0`** (by-id
  `usb-1a86_USB_Single_Serial_5B5E130201-if00`, verified 2026-07-30 — an earlier `ttyUSB0`
  claim was wrong). The right one (silkscreen `LIDAR`, callout 7) is the board's own LiDAR
  UART→USB bridge. The live LiDAR is `/dev/ttyACM1` (by-id `…5970075705`); **which physical
  socket it enters through (driver-board `LIDAR` port vs Audio HAT socket) is unverified** —
  trace before relying on either claim. Diagram:
  `public/datacore/beast-driver-board-callouts.png`, surfaced at Datacore → BEAST Console → Reference.
- **Chassis dynamics:** slow tracked base; hard-stops and stops in time for lightweight
  onboard terrain alignment / obstacle avoidance.

## Power domain — OP-BEAST-BACKFEED

> **Established 2026-07-27** while chasing a ~4 s repeating pop from the HAT's speakers during
> bench bring-up. The finding is bigger than the noise: **with the chassis switch off, the Jetson
> was powering the entire robot stack through one USB cable.** Primary sources are archived under
> `keyArtifactstosort/reference/` — see its `INDEX.md`.

### The back-feed path (netlist-verified)

```
Jetson USB-A ──▶ driver board USB-C (Type_C1, silkscreen "USB")
                   └─▶ VBUS ──▶ D2 (MBR230LSFT1G) ──▶ net "5V"
                                                       ├─▶ P1/P2 40-pin 5V pins ──▶ Audio HAT
                                                       │                              ├─ SSS1629A5 codec
                                                       │                              ├─ APA2068 amp ──▶ speakers
                                                       │                              ├─ FE1.1S hub + CH340
                                                       │                              ├─ FAN-2507
                                                       │                              └─ D500 LiDAR (5V, motor spins)
                                                       ├─▶ AMS1117-3.3 ──▶ VDD3V3 (ESP32, IMU, INA219, OLED)
                                                       ├─▶ H1 pin 4 (driver LiDAR header 5V)
                                                       └─▶ both CH343P VBUS pins
```

Traced from the netlist embedded in `RasperryPIversionofROS_Driver_for_Robots.pdf`. The net labelled
`NL5V` groups `PID202` (D2 pin 2), `PID102` (D1 pin 2), `PIM201/202/203` (M2 pins 1–3 — the **main
5 V** side of the reverse-block MOSFET; the raw buck output sits on M2 pins 5–8), `PIQ202` (Q2
emitter), `PIP101/PIP103` and `PIP201/PIP203` (**both 40-pin headers' 5 V pins**), `PIPWR101`
(the `PWR-IN 5V-5A` port annotated "5V Power for RPi/Jetson nano"), `PIH104`, `PIAMS0103`, and
`PIU309`/`PIU709`. D2 pin **1** sits on the Type_C1 VBUS net.

**Consequence:** the driver board's USB-C is not a data-only control link. Connecting it energises
the whole stack's 5 V rail. This is by design — the board is built to *power the host*, and it
assumes the pack is on.

### Corrections to prior documentation

| Claim | Status |
|---|---|
| "Type_C1 → D2 → AMS1117-3.3 → **3V3 logic**" (extent of back-feed) | ❌ Understated. VBUS lands on net `5V`, which feeds both 40-pin headers and the entire HAT. |
| Hazard 4 "back-feed direction is safe" | ✅ Direction correct (D2 blocks reverse), ❌ extent badly understated. |
| State matrix: FAN-2507, speakers, LiDAR, HAT chips "stay dark until the pack is on" | ❌ All are on the back-fed rail and come up with the pack **off**. |
| "The stack fan not spinning with the pack off is correct, not a failure" | ❌ Backwards. On a back-fed rail the fan should spin. |
| `v4l2-ctl --list-devices` should show two cameras | ❌ Shows one. OAK-D is a MyriadX over DepthAI/XLink, never UVC. |
| Wi-Fi antennas "unverified" | ✅ Confirmed — `wlP1p1s0` is live; current address is `192.168.0.187` (the older `.251` lease is historical). |
| Pan-tilt camera "likely" | ✅ Confirmed — `0abd:8050`, `/dev/video0`. |

### Vendor limits that constrain this

| Fact | Value | Source |
|---|---|---|
| Orin DC jack (J16) | 9–20 V · **centre pin positive (+V)** · **3.5 A max** · 5.5 mm barrel, 2.5 mm pin, 9.5 mm length · Singatron 2DC-0005D206F | NVIDIA carrier spec §3.8 p.30 |
| Alternate power input (J18) | "PoE Backpower Header", 1×2, 2.54 mm pitch, same 9–20 V, **3 A max** — an alternative to the barrel entirely, if populated on the board | Carrier spec §3.9, Table 3-10 |
| Orin 40-pin pins 2 & 4 | **5.0 V, carrier-sourced output** | NVIDIA carrier spec Fig 3-1 |
| Powering Orin *via* 40-pin 5 V | **Blocked** — "it can not be supplied from 5V pins on the expansion header as the blocker circuit exist" | NVIDIA staff, forum 253291 |
| 40-pin header 5 V allocation | 0.5 A | Carrier spec Table 5-3 |
| USB Type-A ×4 allocation | 0.5 A | Carrier spec Table 5-3 |
| `VDD_5V_SYS` total | **2.78 A**, of which SO-DIMM is allocated **2.12 A** | Carrier spec Tables 5-2 / 5-3 |
| Type-A load switch (AP22811AW5-7) trip | **ILIMIT 2.2 / 2.7 / 3.2 A** — will *not* trip at the ~1 A the stack draws | AP22811 datasheet |
| APA2068 amp supply | **4.5 V min** – 5.5 V max | APA2068KAI-TRG datasheet |
| Back-fed rail voltage | ≈ 5.0 V VBUS − D2 forward drop ≈ **4.6 V** | ⚠️ estimated — D2 curve not yet obtained |

The amp's 4.5 V floor against a ≈4.6 V back-fed rail is roughly 0.1 V of margin. That is the
leading explanation for the popping, and it is **not** an overcurrent trip.

### Hypotheses tested and rejected

- **USB port over-current hiccup** — rejected. AP22811 ILIMIT is 2.2 A min; the stack draws ~1 A.
- **PipeWire / ALSA idle-suspend cycling** — rejected. Popping persisted with the HAT's USB-C
  unplugged, so no codec was enumerated and no audio stack was involved.
- **Ground loop through two parallel USB paths** — rejected. Breaking the HAT's cable (removing the
  Jetson→driver→40-pin→HAT→Jetson loop) did not change the popping.
- **D500 LiDAR motor stalling on a collapsing rail** — rejected. LiDAR shows no symptoms.
- **WM8960 / I²S GPIO audio conflict** (proposed externally) — rejected on the premise. This board
  is an **SSS1629A5 USB** codec: "supports USB interface communication, driver-free, plug and play."
  There is no I²S, no GPIO audio, and no shared host bus. The 40-pin is power + UART pass-through only.

### Retired plan: GPIO-UART host link (never executed — live link is USB)

> **Superseded 2026-07-30:** BEAST-01's deployed host↔ESP32 link is the driver board's USB-C
> (`/dev/ttyACM0`). The GPIO-UART analysis below was the planned escape from OP-BEAST-BACKFEED;
> the actual resolution was powering the Orin from the pack's barrel-jack lead instead, which
> keeps the USB back-feed path out of the power loop. Kept as reference for any future jumper
> build — nothing below is a live task.

`ugv_jetson/app.py` opens the lower computer as:

```python
base = BaseController('/dev/ttyTHS0', 115200)
# base = BaseController('/dev/ttyTHS1', 115200)
```

`ttyTHS*` is a **Tegra High-Speed UART** — a hardware serial port on the SoC, exposed on the Orin
Nano dev kit's 40-pin header (UART1: pin 8 TXD, pin 10 RXD). It is *not* a USB device; USB serial
adapters enumerate as `ttyUSB*` / `ttyACM*`. In `base_ctrl.py` the `ttyUSB*` path exists but is
**commented out**.

So Waveshare's official Orin build reaches the ESP32 over **a handful of GPIO jumper wires** — not
over the driver board's USB-C, and not through a mated 40-pin stack (an Orin Nano dev kit cannot
stack onto the driver board the way a Pi does). Minimum set: **TX, RX, GND**. Power cannot ride
these — the Orin's 40-pin 5 V pins are outputs behind a back-power blocker, so its supply must
arrive at the barrel jack separately.

**This is the escape hatch from the back-feed.** The driver board's USB-C is the only proven
back-feed path (Type_C1 VBUS → D2 → net `5V`), and the official design does not use that cable for
control at all. Replacing it with UART jumpers removes the path outright, while leaving the Audio
HAT's USB-C — codec, FE1.1S hub, and the D500 LiDAR's CH340 — untouched.

#### The vendor harness is a 2×5 on pins 1–10 (owner-observed 2026-07-27)

Owner observed a **5×2 (10-way) header** in the assembly video. There is no 10-pin connector on this
board — the schematic's full connector inventory is `P1`/`P2` (40 pins each), `H3`–`H6` (6), and
`H1`/`P3`/`P4` (4). So the 2×5 is a jumper block landing on **pins 1–10 of the 40-pin header**,
which on a Pi-standard pinout is:

| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|----|
| 3V3 | **5V** | SDA | **5V** | SCL | GND | GPIO4 | **TXD** | GND | **RXD** |

That is the complete host interface — power, I²C, UART, grounds — matching the vendor's description
of the 40-pin as *"communicating via serial port or IIC, and powering the host computer."* Nothing
past pin 10 matters to a host.

> ⚠️ **UNRESOLVED (retired plan — academic unless a factory harness piece is ever reused): are
> the two 5 V conductors populated in the *Jetson* harness?**
> If they are, the official Orin build bonds the driver board's buck to the Orin's 40-pin 5 V pins —
> which are **outputs**. That is a second back-feed path, independent of the USB-C one, and removing
> the USB-C would not fix it. NVIDIA's blocker stops current flowing *into* the Orin; it does not
> make the Orin's 5 V output stop sourcing. Until this is settled, **build the harness with TX, RX
> and GND only** (add SDA/SCL only if something needs them) and leave positions 1, 2 and 4 empty.
> Settle it by pausing the assembly video on the connector, or by metering the loomed harness.

⚠️ **Driver-board pin numbering still not confirmed against the schematic.** Altium pads pin numbers
variably (`PIP101` = P1 pin 1, `PIP1010` = P1 pin 10, `PIP1040` = P1 pin 40), and once decoded,
`NLGND` lands on P1 pins 5/10/19/26/29/33/39/40 — which is *not* the Pi's GND set (6/9/14/20/25/30/
34/39). The schematic symbol is evidently not numbered in Pi physical order. **Meter the header
before wiring.** Second source: Waveshare's assembly video, below.

### Independent vector trace — agreements and refinements (2026-07-27)

A second, independent pass over the same PDF using wire-geometry/terminal tracing rather than
netlist-token extraction. Artifacts: `keyArtifactstosort/Artifacts/ros-driver/current/`.
**It agrees with the back-feed finding above** and adds three things worth keeping.

Independently confirmed, matching our token extraction pin-for-pin:

| Item | Both methods agree |
|---|---|
| `Type_C1 VBUS → D2 → main 5V`, `Type_C2 VBUS → D1 → main 5V` | ✅ the back-feed path |
| P1/P2 5 V ↔ main 5 V, **not** diode-isolated, bidirectional | ✅ |
| H1 (LiDAR): pin 1 `CP_RX`, pin 2 NC, pin 3 GND, pin 4 main 5 V, pin 0 mount | ✅ our `NLGND`/`NLNC`/`NL5V` land on exactly those pins |
| M2 pins 1–3 on main 5 V | ✅ |

**1. The back-feed is *confined* to the main 5 V rail.** M2/Q1/Q2 (AO4407 + two MMBT3906) is an
active reverse-block stage, not a passive pass. When main 5 V is externally higher than the raw
buck output, Q2 pulls M2's gate toward its source and turns it off. So a back-fed rail does **not**
propagate to `5V_Vout`, `VIN`, or `DC_IN`. The documented back-feed scope above is therefore right
as written — nothing needs widening.

**2. The INA219 does not measure total battery current.** The sense path is `U6.IN+` = `DC_IN` →
`R21 0.01 Ω` → `VIN` = `U6.IN-`, i.e. it sits on the **buck/logic branch only**. These bypass the
shunt entirely and are invisible to telemetry:

- both TB6612FNG motor drivers (VM tie straight to `DC_IN`)
- H7/H8 servo power
- J1–J4 switched-load power

The schematic text corroborates directly: `R21 0.01R 1% 2512 2W 合金`, drawn between `DC_IN` and
`VIN`. Firmware agrees on the value — `ugv_base_ros/battery_ctrl.h` calls
`setShuntSizeInOhms(0.01)`. (`setBusRange(BRNG_16)` is *consistent* with a pack-side measurement but
does not prove it — a 16 V range works perfectly well on a 5 V rail. The placement is proven by the
topology, not the firmware config.)
**Operational consequence: the reported battery current understates real draw during driving, and
a motor stall will not show up in it at all.** It also explains why telemetry read ≈0 V with the
pack off while the stack was fully alive on the back-fed rail — the INA219 is upstream of the buck,
on a rail that genuinely was dead.

**3. ⚠️ Unverified: M1 may conduct backwards to the input connector.** M1 (AO4407) is a
reverse-*polarity* protection P-MOS with its gate at GND through R15 — not a reverse-*current*
blocker. If `DC_IN` is energised externally (via H7/H8, J1–J4, or motor regeneration through the
TB6612 body diodes), the channel can conduct back toward the DC-IN connector. Physically plausible
and worth knowing before hot-plugging anything on those headers, but **not yet confirmed on the
bench** — treat as a hypothesis.

**4. There is a third logic rail — 1.8 V for the IMU.** Verified visually by rendering the PDF
region at 9× (`page.search_for('RT9193-1.8GB')` → rect ≈ (172, 69), sheet block **"10-DOF-IMU-
Sensor-D"**, upper-left of the A4-landscape sheet):

```
VDD3V3 ─▶ U2  RT9193-1.8GB  ─▶ 1V8 ─┬─▶ U1 ICM-20948   VDDIO (8) + VDD (13)
          (VIN/GND/EN/BP/VOUT)      └─▶ U4 LSF0204PWR  VCCA (1)
3V3 ──────────────────────────────────▶ U4 LSF0204PWR  VCCB (14)

U4 translates ICM_SDA / ICM_SCL (3V3, from ESP32 IO32/IO33)
        ⇄  I2C_SDA_ICM / I2C_SCL_ICM (1V8, to the ICM-20948)
```

The IMU here is an **ICM-20948** (9-axis, on a 1.8 V rail behind a level shifter) — *not* the
QMI8658 + AK09918C pair that the General Driver for Robots wiki lists. One more reason never to read
across between those two boards.

Adjudication of the two claims first disputed here — **both resolved against the trace author, not
against them:**

- *"INA219 A0 unconnected, `0x42` unresolved."* Resolved as **`0x42`**. `battery_ctrl.h` has
  `#define INA219_ADDRESS 0x42`, and the schematic ties `A1→GND`, `A0→SDA`, which is exactly `0x42`
  in TI's address table. Author retracted it as a visual-tracing miss.
- *"RT9193 → 1.8 V."* **Correct — this doc was wrong to reject it.** I had treated RT9193 as a
  single 3.3 V part and assumed contamination from the UPS Module 3S inventory. It is a
  fixed-voltage *family*; the schematic carries the `-1.8GB` variant as `U2` on this board. Retracted.

### Corrections to prior documentation

| Claim | Status |
|---|---|
| "Waveshare's Jetson assembly tutorial is an unpublished stub / no vendor tutorial exists" | ❌ Wrong. It exists as a **video**: *"How to install UGV with Jetson orin & battery"* (Waveshare Electronics, 1:29) — <https://www.youtube.com/watch?v=m_P2LfZAp9Q> — linked as "Assembly tutorial for ugv" from both the Beast and Rover Jetson Orin wikis. The wiki *prose* still describes only the Pi install; the video is the Jetson one. |
| Driver board UART-to-USB bridge is CH343P | ⚠️ Schematic says CH343P; the vendor wiki callouts 25/26 say **CP2102**. Board revision difference — irrelevant to the power path, but do not treat either as authoritative for part-level work. |

### Operating rules

1. **Never run the Jetson with the chassis switch off** while the driver board's USB-C is connected.
   That state has no legitimate use and it is the only state in which the fault appears.
2. **Waveshare's design is one supply, one switch.** The product power switch powers the Jetson too —
   there is no separate host supply in the stock kit. The mains-barrel bench rig is an improvisation.
3. **Mate every cable before applying power.** NVIDIA: "Connecting a device while powered on may
   damage the developer kit carrier board, Jetson Orin Nano, or peripheral device."
4. **Nothing on the Orin's 40-pin *power* pins.** Pins 2/4 (5 V) and 1/17 (3V3) are outputs; bonding
   them to the buck puts two regulated 5 V sources on one node with no protection between them.
   Pins 8/10 + a GND are the exception — that UART link is the vendor-intended connection
   (not used on BEAST-01: the live host↔ESP32 link is USB, `/dev/ttyACM0`).
5. The driver board ↔ Audio HAT 40-pin joint **stays mated** — it is the stack backbone.

### Open questions

- **Does the HAT's USB-C VBUS tie to the 40-pin 5 V?** No schematic exists for the HAT. Settle with a
  continuity meter, HAT unpowered.
- **Where does the HAT's LiDAR socket take its 5 V from?** Same measurement session.
- **D2 forward drop at ~1 A** — needed to turn "≈4.6 V" into a number. onsemi/Mouser block scripted
  download; fetch `MBR230LSFT1G` by hand.
- **Mounting:** one side of the Orin's host-controller mounting struts is missing from the kit.
  Do not drill through the Orin Nano carrier board to improvise a mount point — it is a dense
  multi-layer PCB with unmapped internal traces/vias; a stray hole can sever a trace with no visible
  symptom until it fails under vibration. Use the board's four corner M2.5 mounting holes only. Try
  an adhesive/foam standoff or a small printed bracket landing on those holes first; check whether
  Waveshare sells the missing strut as a spare part (candidate line item for the support email in
  `keyArtifactstosort/reference/` / scratchpad).
- **~~ESP32 UART jumper link not yet wired~~ — RESOLVED 2026-07-30, differently than planned.**
  The live robot runs the ESP32 link over the driver board's USB-C (`/dev/ttyACM0` by-id in
  `/etc/beast/ugv.env`); no GPIO jumpers were ever fitted and none are needed. The back-feed
  operating rule stands: never leave that USB cable connected to a powered Jetson with the
  chassis switch off. The factory 2×5 harness 5 V question stays academic unless someone reuses
  that harness piece.

### Resolved 2026-07-28 — OP-ORIN-POWER

- **The UPS's "free 4th port" was a barrel-jack pigtail, not an XH2.54 socket.** Already wired into
  the UPS Module 3S board — almost certainly the factory Jetson power lead, unused because the
  original build used a Pi 5. Verified before connecting: sleeve/center polarity test read **center
  pin positive relative to sleeve** (matches the Orin J16 spec, center-positive) at **11.5 V**, in
  range for a 3S pack; dry-fit into the Orin's DC jack seated flush with no wobble (2.5 mm pin, not
  the generic 2.1 mm DC5521 size). Connected and the Jetson booted clean — see the cutover status
  banner above for the live SSH readout. This is the answer to the back-feed investigation's
  practical question: **power the Orin from this barrel-jack pack lead, not from the driver board's
  USB-C.** That fully avoids OP-BEAST-BACKFEED rather than requiring any board rework.

## Network

| Fact | Value | Verified |
|---|---|---|
| Hostname (Orin) | `beast-01` | ✅ SSH 2026-08-02 |
| Wi-Fi IP (Orin) | `192.168.0.187` (`wlP1p1s0`, DHCP; currently SSID `CastleMooseGoose`) | ✅ SSH 2026-08-02; address may drift |
| Tailscale IP (Orin) | `100.107.16.72` (`tailscale0`), tailnet hostname `beast-01` | ✅ SSH 2026-08-02; alias `beast-01-ts` |
| mDNS path | `beast-01.local` → `192.168.0.187` | ✅ SSH 2026-08-02 |
| Ethernet fallback | `192.168.0.166` (`enP8p1s0`) | ✅ SSH and ICMP working 2026-08-02; route metric 100 |
| USB gadget fallback | `192.168.55.1` (`usb0`) | ❌ TCP/22 failed 2026-08-02; interface is down |
| SSH access | `ssh beast-01`, direct Wi-Fi IP, or `ssh beast-01-ts` | ✅ key-only with local `hephastus_ed25519` |
| Hostname (former Pi) | `beast.local` | Historical — Pi retired |
| IP (former Pi) | `192.168.20.184` | Historical — Pi retired; **not** an Orin target |
| Network policy | **Stay on general LAN `192.168.0.x` + Tailscale** | ✅ Operator decision 2026-07-30 — **robot VLAN `192.168.20.x` rejected** (zero upside; firewall friction and agents chasing a dead identity). Optional UDM reservation only on `192.168.0.x`, never on `20.x`. |

Former Pi endpoints below (`192.168.20.184:*`) are historical and will 404/timeout. Do not migrate
Orin onto the Pi-era robot VLAN. The current Orin path is Wi-Fi or Tailscale; Ethernet and USB are
recovery fallbacks that require the physical link/interface to be brought up first.

## Services & dashboards

| URL | What | Notes |
|---|---|---|
| `wss://beast-01.tyrannosaurus-magellanic.ts.net` | **Command Deck / rosbridge** | Current Orin cockpit transport over Tailscale; proxied from Jetson port `9090`. |
| `http://192.168.20.184:5000` | **Control UI** | Historical Pi endpoint; retired and not an Orin target. |
| `http://192.168.20.184:8888` | **JupyterLab** | Historical Pi endpoint; retired and not an Orin target. |
| `http://192.168.20.184:5000/video_feed` | Raw MJPEG camera stream | Historical Pi endpoint; retired and not an Orin target. |

### Video recovery note — OP-VIDEO-RELOCK

On 2026-06-30 the control UI and telemetry were healthy, but `/video_feed` hung before
sending HTTP headers. Root cause: the USB camera had re-enumerated after reboot/disconnect,
while Waveshare `cv_ctrl.py` hardcoded `cv2.VideoCapture(0)`. The camera was readable at
`/dev/video1` and also exposed a stable by-id path.

Live Beast patch: `/home/ws/ugv_rpi/cv_ctrl.py` now selects the first readable USB camera
from `/dev/v4l/by-id/*video-index0*`, then `/dev/video0..9`. Original backup:
`/home/ws/ugv_rpi/cv_ctrl.py.bak-20260630-OP-VIDEO-RELOCK`.

If video fails again:

```bash
curl -D - --max-time 3 -o /tmp/beast-video.bin http://192.168.20.184:5000/video_feed
ls -l /dev/video* /dev/v4l/by-id 2>/dev/null
v4l2-ctl --list-devices
tail -80 ~/ugv.log
```

Healthy verification from the dev workstation: `/video_feed` returns `HTTP 200` with
`multipart/x-mixed-replace; boundary=frame`, JPEG bytes begin after `--frame`, and `/ctrl`
telemetry reports `video_fps` around 32 fps.

Driving from the dashboard: keyboard (WASD), the on-screen joystick, or a USB/Bluetooth
**gamepad** read through the browser's Gamepad API on whatever machine has the page open.
(The bundled wireless gamepad can also pair straight to the Pi.)

## Control protocol (reverse-engineered from `control.js`)

Commands are JSON sent to the ESP32 via the Pi. The current build exposes Socket.IO as the
working control transport; the older HTTP helper route is no longer available.

- **Socket.IO:** namespace `/json`, event `json`, e.g. `socketJson.emit('json', {"T":1,"L":0,"R":0})`
- **Legacy HTTP route:** `GET /js?json=...` returned HTTP 404 on 2026-07-01; do not use it
  unless a future Pi build restores it.

Key payloads:

| Intent | JSON | Notes |
|---|---|---|
| Drive (differential) | `{"T":1,"L":<left>,"R":<right>}` | `L`/`R` = track speeds. **Magnitude scaling not yet characterized** — start small (≤0.2) and increase once measured. Capped server-side by `max_speed`/`slow_speed` in the Pi's `config.yaml`. |
| Stop | `{"T":1,"L":0,"R":0}` | App fires this on load. |
| Gimbal | `{"T":<cmd_gimbal_ctrl>,"X":..,"Y":..,"SPD":0,"ACC":128}` | T-code from `config.yaml`. |

**Safety:** ~~a stale-command watchdog on the Beast auto-stops the tracks if no command
arrives within its timeout, so a single nudge then silence is self-safing~~ — **FALSE.
Physically tested 2026-07-31: the watchdog did not fire.** The ESP32 latched the last
non-zero command for minutes after command silence. Treat the platform as having NO
lower-level failsafe until one is implemented and re-tested. Always have an explicit stop
path live before any motion command, and send an explicit stop after.

Repeatable safe probe from this repo:

```powershell
npm run beast:probe
```

The default probe loads the robot's bundled Socket.IO client, connects to `/json` and `/ctrl`,
sends only `{"T":1,"L":0,"R":0}`, then prints decoded telemetry. It proves command-channel
control without moving the tracks.

Optional supervised nudge, only when physically with the robot and the runway is clear:

```powershell
npm run beast:probe -- --nudge --i-am-with-the-robot --clear-runway-confirmed
```

## Telemetry

Live feedback streams over Socket.IO namespace `/ctrl`: connect, emit `request_data`,
then read `update` events. (`/jsfb` is **not** exposed on this build — use `/ctrl`.) The
feed comes *from* the ESP32, so receiving it proves the lower controller and the Pi↔ESP32
serial link are both alive. Fields arrive as numeric keys; decoded values observed
2026-07-01 from `/config` and `npm run beast:probe`:

| Key | Reading | Value seen | Healthy? |
|---|---|---|---|
| `112` | Battery voltage | raw `1203` → **12.03 V** | ✅ 3S Li-ion |
| `111` | Wi-Fi RSSI | **-60 dBm** | ✅ usable |
| `107` | CPU temp | 54.3 °C | ✅ normal for Pi 5 |
| `106` | CPU load | 0.1 | ✅ low |
| `108` | RAM usage | 11.4 | ✅ normal |
| `113` | Video FPS | 30.5 | ✅ camera pipeline alive |
| `104` / `105` | Track speed L / R | 0.0 / 0.0 | stationary |
| `114` | feedback-OK flag | `true` | ✅ |

## Operating progression (Waveshare's recommended on-ramp)

1. **Web app (`:5000`)** — teleop, FPV, and pan-tilt gimbal. Drive it manually. *(done — it drives)*
2. **JupyterLab (`:8888`)** — official lesson notebooks: motion, camera/CV (face/object/line/
   gesture), and gimbal control. This is where you learn to program it.
3. **JSON command API** — `/json` Socket.IO. Script motion and gimbal control; this is also
   the integration point for the Hangar command portal (teleop and autonomy).
4. **ROS2 stack** (optional, separate install, port `:5100`) — SLAM, mapping, nav, and
   LLM / VLA-driven control including closed-loop autonomy. Bigger jump. Research brief:
   [robot-control LLMs briefing](../content/datacore/robot-control-llms.md) (also surfaced in
   the Datacore as `RND-ROBOT-LLM`).

## NVMe storage policy — PLANNED, NOT APPLIED

**Measured 2026-07-11:** the installed Micron 2400 has a 1.9 TiB ext4 `APP` partition with 28 GB
used and approximately 1.8 TiB available. SMART reported 44 °C, 1% lifetime used, 100% available
spare, and zero media errors. The existing unsafe-shutdown (62) and error-log (91) counters are
comparison baselines; weekly TRIM is already enabled.

Keep the 2 TB drive and leave the partition, Docker, journald, mount options, and filesystem
unchanged. A 512 GB replacement would offer no useful weight or power reduction, would cut rated
endurance from 600 TBW to 150 TBW, and would unnecessarily constrain sensor recording.
`/data/beast` will be the stable data interface for recordings, datasets, maps, models, and
recovery staging. It initially resides on `APP`; it may become a distinct mount later without
changing recorder, dataset, map, model, or recovery consumers. Proposed recording budgets are
150 GiB black-box, 900 GiB missions, a 300 GiB minimum free floor, and 350 GiB target free.
Automated retention is limited to eligible closed recordings and never deletes datasets, maps,
models, recovery staging, Docker data, or unrelated paths. Onboard recovery staging is not an
independent backup.

Planned layout and maintenance policy:

```text
/data/beast/
├── recordings/blackbox/        rolling telemetry and sensor context
├── recordings/missions/        operator-started full-sensor captures
├── datasets/  maps/  models/   never automatically pruned
└── recovery-staging/           recovery transfer area, not a backup
```

Maintenance first skips active advisory locks and `.keep` recordings, never follows symlinks,
caps black box then missions oldest-first, and below the floor restores the target by pruning
black box before missions. If protected or eligible data cannot restore the floor, recording
stops or is rejected. SMART is `unknown` when absent or malformed; `warning` at 65 °C, 80%
lifetime used, 10% or less spare, or a counter increase; `critical` for a critical-warning bit,
70 °C, 100% lifetime used, exhausted spare, or increased media errors. Illustrative planning
rates (not measurements): black box 1–5 GiB/hour, full camera/depth mission 30–100 GiB/hour;
actual rates must be measured after the physical topic graph is known.

Rejected approaches, recorded so they are not re-litigated: repartitioning now (flash/recovery
risk without a present capacity benefit), dual-root / A-B rootfs (complexity unrelated to
retention; reconsider only as a separate recovery project), quotas or Docker relocation
(adds behavior to a healthy filesystem while leaving retention unsolved; the directory-level
policy has a smaller blast radius). Offload selected missions and recovery artifacts before any
destructive device work; a future separate-volume mount at `/data/beast` requires a reviewed
maintenance window and a tested rollback.

Do not provision or enable storage units from this section yet. Follow the [command-level implementation plan](plans/2026-07-11-beast-nvme-storage-implementation.md). Once that implementation plan is approved and its dry-run checks pass, only `beast-storage-maintenance.timer` may be enabled. Keep black-box, mission, and motion storage units disabled until the documentation PR is merged, the stacked workspace change is reviewed, and physical recording/replay validation succeeds. An interactive [storage dossier](../design/beast-storage/index.html) walks the same policy visually.

### ROS workspace provenance

Robot source and Hangar source share one Git history. The Jetson uses a sparse checkout so
it receives the ROS subtree without checking out the web application. Sync recipe:
[Syncing robot code](#syncing-robot-code-to-beast-01) above.

| Fact | Value |
|---|---|
| Source of record | [Coldaine/RobotOverview](https://github.com/Coldaine/RobotOverview), `robot/beast/ros2_ws` |
| Vendor upstream | [waveshareteam/ugv_ws](https://github.com/waveshareteam/ugv_ws) |
| Branch | `main` after reviewed RobotOverview PRs |
| Local clone | `D:\_projects\RobotOverview` |
| On-robot path after cutover | `~/beast/RobotOverview/robot/beast/ros2_ws` |
| Last live-checked | **`2d1eab7` in legacy `~/beast/ugv_ws` (2026-08-03)** — monorepo cutover pending |

Hangar docs are not proof of on-robot state. Always check the robot before asserting commit or
behavior. Before applying the [NVMe storage implementation plan](plans/2026-07-11-beast-nvme-storage-implementation.md),
reconcile against the **live on-robot** tree.

## Jetson migration and flash runbook — OP-JETSON-FLASH

> **Status: SOFTWARE PROVISIONING COMPLETE; PHYSICAL HOST SWAP IN PROGRESS — updated
> 2026-07-22.** The initial Intel Raptor Lake run flashed QSPI and the 2 TB NVMe. The later
> credential-safe external-only restore rewrote the NVMe but deliberately left the already-valid
> QSPI untouched; that restored image is the current `beast-01` system on Jetson Linux R36.5.
> Key-based SSH and Doppler-backed sudo both pass. JetPack 6.2.2 and the NVIDIA Docker runtime are
> installed and verified. ROS 2 Humble and all 29 packages in the Jetson-adapted Waveshare
> workspace build on the Orin; its zero-motion systemd unit is installed but disabled.
> **2026-07-22:** Raspberry Pi 5 has been **removed** from BEAST-01; the host mount is empty and
> the Orin is being fitted. Remaining gates are mechanical install plus onboard UART, power,
> telemetry, camera, LiDAR, and stop-behavior validation on the robot — not flash/ROS rebuild.

### Target and non-goals

- Flash **JetPack 6.2.2 / Jetson Linux 36.5** to the Jetson Orin Nano developer kit's NVMe.
  The prepared release must report `R36, REVISION: 5.0` and an Ubuntu 22.04 root filesystem.
- The directly sold NVIDIA developer kit contains the development module **P3767-0005**, not the
  production P3767-0003 module. Use `BOARDID=3767`, `BOARDSKU=0005`, and `FAB=300` if a manual
  identity override is required.
- Use the supported `jetson-orin-nano-devkit-super` configuration so the finished system has the
  Super power profiles available; select a conservative power mode during stationary bench work.
- Flash QSPI/UEFI boot firmware and the NVMe root filesystem together from one clean BSP tree.
- Continue directly through JetPack compute, Docker/NVIDIA Container Runtime, ROS 2 Humble, and
  the official Waveshare workspace. The migration is not minimally viable at "Ubuntu boots."
- Do **not** install JetPack 7. JP7 remains out of scope until the JP6 Beast path is working,
  backed up, and deliberately reopened for experimentation.
- Do **not** burn fuses to enable USB 3 recovery, modify EEPROM contents, enable Secure Boot, or
  add rootfs A/B or encryption during this recovery. Those are separate, irreversible or
  complexity-increasing changes.
- Do **not** use the current Pi/Flask service as proof that the Jetson path works. The cutover is
  complete only after the ROS workspace, zero-motion telemetry, and physical stop behavior pass.

### What the audit established

- Recovery mode is proven: the host has repeatedly enumerated `0955:7523 NVIDIA Corp. APX`.
- The module reports T234 chip SKU `D5` and RAM code `2`, consistent with an 8 GB Orin Nano.
- NVIDIA's automatic detector received a 256-byte EEPROM response but parsed no board ID, FAB,
  SKU, or revision. That proves a parsing/read problem, not yet that every EEPROM byte is blank.
- The downloaded `Jetson_Linux_R36.5.0_aarch64.tbz2` and
  `Tegra_Linux_Sample-Root-Filesystem_R36.5.0_aarch64.tbz2` match NVIDIA's published SHA-1 hashes.
- A generated package from the failed path selected the production-module kernel DTB
  `p3767-0003`; that was wrong for this NVIDIA developer kit. No package from that tree is reusable.
- The formatted override `RAMCODE_ID=00:00:00:02` caused a local Python conversion failure.
  More importantly, overriding RAM code was unnecessary because the chip supplied numeric `2`.
- NVIDIA's R36.5 Quick Start ends the Orin Nano Super NVMe command in `internal`, while the
  general flashing guide shows `external`. The bundled R36.5 tooling explicitly supports both
  with `--external-device` and generates an external-storage PARTUUID in either case. This runbook
  follows the board-specific Quick Start command exactly and verifies the generated UUID artifacts.
- The Podman image contained the correct NVIDIA user-space packages, but still used Nobara's
  kernel USB stack, device namespace, network interfaces, and NFS facilities. Container NFS and
  the raw USB `-110` timeout therefore do not implicate the downloaded JetPack release.
- Before the successful Intel flash, no failed attempt had reached a QSPI or NVMe partition write;
  those failures stopped while building images, starting container NFS, sending an RCM blob, or
  querying target storage. The later successful flash and credential-safe external restore are
  recorded separately below.

The original `USBDEVFS_CONTROL ... -110` symptom was ambiguous. The corrected signed-payload
captures assigned it below Docker, QEMU, VFIO, and the guest kernel; the later Intel control closed
the remaining boundary by transferring the same payload successfully. That evidence identifies the
EVO AMD controller/physical path, not the cable or Jetson, as the failed transport.

### Attempt ledger — 2026-07-11 EVO whole-controller run

This is the chronological record of the first run against the native Ubuntu VM. Keep failed
boundaries here as evidence; do not summarize them later as a successful flash.

1. Refetched and read the live `coldaine-k8cluster` configuration, then connected to
   `pve-evo-x2` and gathered host facts before allocation. The host reported Proxmox VE 9.2.2,
   kernel `7.0.2-6-pve`, 32 CPU threads, 30 GiB host-visible RAM, and active guests 112, 113,
   and 1202. The reduced host-visible RAM is the EVO iGPU carve-out, not missing DIMMs.
2. Confirmed exactly one recovery device: `0955:7523 NVIDIA Corp. APX`. Sysfs mapped it to PCI
   function `c8:00.4`, an AMD Strix Halo xHCI controller isolated by itself in IOMMU group 31.
   An earlier in-session statement called this group 32; the sysfs recheck corrected it to 31.
   The controller carried no Proxmox management NIC, storage, or other USB device.
3. Left the EVO control plane (VM 113) and observability guest (CT 1202) running. Gracefully
   stopped the EVO Talos worker (VM 112) to free physical memory for the attended flash window.
4. Downloaded the current Ubuntu 22.04 release cloud image from Ubuntu and created temporary VM
   900, `evo-jetson-flasher-r365`: q35/OVMF, host CPU, 8 vCPU, 12 GiB fixed RAM, 140 GiB disk on
   `vmdata`, VLAN 30 VirtIO networking, and `hostpci0=0000:c8:00.4,pcie=1`. The Proxmox host then
   showed `c8:00.4` bound to `vfio-pci`; Ubuntu 22.04.5 with kernel `5.15.0-185-generic` showed
   the same controller at guest PCI `01:00.0` using `xhci_hcd` and APX on guest USB bus 9.
5. Installed the BSP prerequisites, complete kernel modules, QEMU guest agent, RNDIS/CDC modules,
   rpcbind, and the NFS server. Disabled the guest firewall for the attended session, enabled
   IPv6, set USBFS memory to 2048 MiB, and disabled global USB autosuspend.
6. Copied only the two R36.5 archives into the clean VM. Their SHA-1 values matched NVIDIA:
   `96e691a6d2d618e22dd6cb0630ee17faaa4733e9` for the BSP and
   `7844cfc00ef92eeb85d699d17bcb787a1560d486` for the sample root filesystem. Extracted a new
   `Linux_for_Tegra`, ran `l4t_flash_prerequisites.sh` and `apply_binaries.sh`, and verified the
   staged target reports `R36, REVISION: 5.0`.
7. Pre-created headless user `beast`, hostname `beast-01`, and an SSH authorized key in the staged
   rootfs. NVIDIA's helper printed its generated temporary password to the terminal; that password
   was immediately replaced with a new discarded random credential. Key-based SSH is the intended
   first-boot path and the printed credential is invalid.
   **This is historical failure evidence, not a reusable instruction.** The mandatory credential
   gate below now prohibits package generation until the staged password matches Doppler and the
   staged operator key fingerprint matches the persisted public key.
8. Generated `bootloader/readinfocmd.txt` using the known NVIDIA developer-kit package identity
   `BOARDID=3767`, `BOARDSKU=0005`, and `FAB=300`. The first read-only probe read ECID
   `0x80012344705E021D2C00000003008240`, then timed out while sending `bct_br`. It created no fresh
   `cvm.bin`; therefore no three-dump stability claim can be made. No QSPI or NVMe write occurred.
9. Applied the complete community mitigation rather than only its global half: fully stopped and
   restarted VM 900 to reset the passed controller, restored USBFS 2048 MiB and global autosuspend
   `-1`, set every USB device and root hub `power/control` to `on`, and set every
   `autosuspend_delay_ms` to `-1`. APX re-enumerated normally. The second read-only probe read the
   same ECID and failed at the same `Sending bct_br` boundary. It again created no `cvm.bin` and
   wrote nothing to QSPI or NVMe.
10. Started offline package generation with the bounded known identity plus the independently
    established chip values `CHIP_SKU=00:00:00:D5` and numeric `RAMCODE_ID=2`. The first offline
    invocation omitted those chip values and correctly stopped at chip-info parsing; its output
    was discarded. The corrected invocation selected kernel/UEFI DTB
    `tegra234-p3768-0000+p3767-0005-nv-super.dtb`, the expected P3767-0003 BPMP DTB, QSPI layout
    `flash_t234_qspi.xml`, NVMe layout `flash_l4t_t234_nvme.xml`, and external APP UUID generation.
    It exited successfully with `Finish generating flash package`. Inspection confirmed a 2.4 GiB
    external package, 11 MiB internal QSPI package, 2,282,183,740-byte sparse `system.img`, and
    matching image SHA-1 `15cda47639be08efa6e214c7d59fb6129dc343c3`. `abootimg` showed the
    external boot command line uses `root=PARTUUID=a08cd0ca-4707-4e72-bc04-8691205bb435`, exactly
    matching `bootloader/l4t-rootfs-uuid.txt_ext`; the saved parameters target `nvme0n1p1` and end
    in `jetson-orin-nano-devkit-super internal`. A scan of the saved command and generated package
    found no fuse-burn command. Exactly one APX device remained attached. The package is ready for
    `--flash-only` after the physical transport variable and recovery state are changed.
11. Upgraded VM 900 from Ubuntu's 5.15 GA kernel to the 6.8 HWE kernel and repeated the read-only
    probe. It read the same ECID and failed at the same first `bct_br` transfer, so the result is not
    specific to the older guest kernel.
12. Captured the failed VM transaction with `usbmon`. Descriptor reads completed, then
    `tegrarcm_v2` submitted one 8,192-byte bulk OUT transfer beginning
    `42435442 f76f0ad8 ee33a8f2`. After about ten seconds it completed as `-2` with actual length
    zero: userspace cancelled an URB for which the host stack had reported no transferred bytes.
13. Removed VM and VFIO from the transaction. Stopped VM 900, rebound `c8:00.4` to the Proxmox
    7.0 host's `xhci_hcd`, and ran the complete generated NVIDIA read-info environment directly on
    `pve-evo-x2`. The host generated and submitted the same signed 8,192-byte payload, including the
    same leading bytes, and again completed zero bytes before cancellation. This is a valid native
    control; an earlier standalone `tegrarcm_v2` test that sent a zero-filled BCT was incomplete and
    is not evidence. No storage write occurred in either native test.

The Intel control below closed this diagnosis: the same signed BCT completed immediately on Intel,
so the Jetson, cable, recovery sequence, and payload were not the cause of the EVO timeout. Do not
reuse the EVO Strix Halo controller for Jetson recovery flashing unless a later firmware or kernel
change passes the read-only BCT control first.

### Successful local Intel flash — 2026-07-11

1. Moved the same cable and recovery-mode Jetson to the Nobara workstation. APX enumerated on the
   Intel Alder Lake PCH xHCI controller `8086:51ed` at PCI `00:14.0`, USB path `3-2`, using Nobara
   kernel `7.1.3-200.nobara.fc44.x86_64`.
2. Ran the exact signed read-only environment. The first 8,192-byte BCT beginning
   `42435442 f76f0ad8 ee33a8f2` completed `8192/8192`, followed by MB1, PSC, MB2, fuse, and EEPROM
   operations. This assigns the EVO failures to its AMD Strix Halo USB path rather than the Jetson.
3. Streamed the prepared Ubuntu-generated R36.5 tree locally, preserving the rootfs and generated
   QSPI/NVMe images while excluding only obsolete large intermediate images. Reverified external
   `system.img` SHA-1 `15cda47639be08efa6e214c7d59fb6129dc343c3`, the R36.5 release line, and
   the `jetson-orin-nano-devkit-super` `nvme0n1p1` parameters.
4. Adapted Nobara's service name at runtime from NVIDIA's expected `nfs-kernel-server` to Fedora's
   `nfs-server`; NFS, rpcbind, IPv6, and host firewall restoration passed preflight. The firewall
   was stopped only for the attended flash and restored afterward; NVIDIA's temporary exports were
   removed.
5. The first two write attempts stopped before storage access. `usbmon` proved the copied
   `bootloader/br_bct_BR.bct` had been reset to a zero template by later `--read-info` probes even
   though the immutable internal QSPI BCT remained valid. The Jetson accepted the 8 KiB transfer,
   reset, and cancelled MB1 with `-108`. This was a generated-tree lifecycle error, not USB loss.
6. Regenerated only the RCM-boot artifacts with `BOARDID=3767`, `BOARDSKU=0005`, `FAB=300`,
   `CHIP_SKU=00:00:00:D5`, and `RAMCODE_ID=2`. Nobara OpenSSH no longer supports NVIDIA's legacy
   DSA host-key generation, so the local recovery-ramdisk script skipped only that obsolete key and
   retained RSA, ECDSA, and Ed25519. The regenerated boot BCT SHA-1
   `063ef50bfb883fd1bb8daece5ac01e9302f778a0` then matched `images/internal/flash.idx` exactly.
7. Ran `l4t_initrd_flash.sh --flash-only --showlogs --network usb0`. RCM boot reported
   `last_boot_error: 0`, sent the 104.6 MB blob, exposed `0955:7035`, brought SSH up at
   `fc00:1:1:0::2`, and identified the target as a 2 TB Micron 2400 NVMe.
8. NVIDIA reported `Successfully flashed the external device`, `Successfully flashed the QSPI`,
   `Flashing success`, and `Flash is successful` after 4 minutes 15 seconds. Every programmed QSPI
   payload reported a matching SHA-1. The host firewall returned active and the NFS export list
   returned empty after cleanup.
9. Normal boot enumerated `0955:7020 NVIDIA L4T`, and key-based SSH reached `beast@192.168.55.1`.
   Verified hostname `beast-01`, Jetson Linux `R36, REVISION: 5.0`, root filesystem
   `/dev/nvme0n1p1` as ext4, APP PARTUUID `a08cd0ca-4707-4e72-bc04-8691205bb435`, and APP expanded
   to 1.9 TiB.

### Credential-recovery incident and external restore — 2026-07-11

The first image contained the intended key and `sudo` membership but an intentionally discarded
random password. That was the sole reason another recovery boot was required. The correction and
its unexpected storage boundary were handled as follows:

1. Verified APX `0955:7523` on the Intel USB path and the signed RCM BCT SHA-1
   `063ef50bfb883fd1bb8daece5ac01e9302f778a0` before booting the retained initrd package.
2. Booted that package with `l4t_initrd_flash.sh --flash-only --initrd`, expecting a recovery shell.
   The initrd reached SSH, but the NVMe GPT and APP filesystem read as zeroes. Kernel accounting
   showed 477 discard operations covering 4,000,797,360 sectors and no block writes.
3. Inspected the running target rather than guessing: `/initrd_flash.cfg` contained `erase_all=1`,
   and `/bin/nv_enable_remote.sh` runs `blkdiscard -f "${external_device}"` during startup. The
   retained package had originally been generated with `--erase-all`; the discard therefore
   happened before recovery SSH. This is the destructive-initrd rule recorded above.
4. Started retained flasher VM 900 and attempted plaintext `chpasswd --root`. It failed safely with
   `pam_chauthtok() failed: Module is unknown` because x86 PAM cannot load the ARM64 target modules.
   No password change was accepted.
5. Generated a salted SHA-512 crypt value from `BEAST_JETSON_ADMIN_PASSWORD` over stdin, applied it
   with `chpasswd --encrypted --root`, and independently verified `crypt(password, shadow_hash)`,
   `passwd -S`, `sudo` membership, and the Doppler operator-key fingerprint.
6. Regenerated the external package without `--erase-all`. The external `system.img` SHA-1 is
   `92fcc7e6960e4daf38dad61d1048de670db628c0`; `boot0.img` is
   `5105f75ccc1dbb4553282d7ad53df807fa081d37`; the signed BCT remained
   `063ef50bfb883fd1bb8daece5ac01e9302f778a0`. Extraction of `boot0.img` proved no
   `erase_all` assignment in `/initrd_flash.cfg`.
7. Mounted the generated APP image read-only and reverified R36.5, the encrypted Doppler password,
   `sudo` membership, and operator key. Synced that verified package into the local flash tree.
8. Used the still-running recovery environment to mount the host images read-only, independently
   verified the same external-image hash from the target, and ran
   `nv_flash_from_network.sh --external-only`. It reported `Successfully flashed the external
   device`, `Flashing success`, and `Flash is successful`; QSPI was not rewritten.
9. Mounted the restored APP read-only before reboot and repeated the credential/key checks. Normal
   boot then verified `beast-01`, R36.5, ext4 on `/dev/nvme0n1p1`, APP PARTUUID
   `d83cba59-4f9d-4b41-88cc-8beb1ba40a48`, and 1.8 TiB usable root capacity.
10. The restored system generated a new SSH host key and machine ID. The recorded Ed25519
    fingerprint is `SHA256:S5qCj4JsuBRSxfXgB//sAyNmDKWNSIOJtA6vUcu1XkI`; machine ID is
    `6d5535d5455a47f19012d4f62a13d9ac`. A fresh SSH session successfully authenticated
    `sudo -S -k` with the Doppler value, and both `dpkg --audit` and `apt-get check` were clean.

The credential repair is complete; another recovery boot is not expected. Never grant blanket
`NOPASSWD:ALL`. If robot automation later needs privilege, allowlist only the required commands in
a separate sudoers rule.

### First-boot configuration and persistence inventory

Audited after the successful flash on 2026-07-11:

- `beast` accepts the local `hephastus_ed25519` Ed25519 key with fingerprint
  `SHA256:JO1fqfONgHgr5JUCdL1pyN6qHjaRc4dR+v7DDVMEZ6A`. This workstation's public half is
  persisted in Doppler as `BEAST_JETSON_OPERATOR_SSH_PUBLIC_KEY_DESKTOP`; the working private
  key remains only on the local workstation. The separate `BEAST_JETSON_OPERATOR_SSH_PUBLIC_KEY`
  record is an alternate operator key and is not the key used by this workstation.
- The current Jetson's ED25519 SSH host-key fingerprint is
  `SHA256:S5qCj4JsuBRSxfXgB//sAyNmDKWNSIOJtA6vUcu1XkI`; machine ID is
  `6d5535d5455a47f19012d4f62a13d9ac`. A reflash or restored root filesystem can legitimately
  regenerate both. Accept a changed key only over the physically controlled point-to-point USB
  link, then immediately persist the new fingerprint in `known_hosts` and this runbook.
- Doppler contains the Beast access records in project **`homelab`/`dev`**: `BEAST_JETSON_ADMIN_PASSWORD`,
  `BEAST_JETSON_OPERATOR_SSH_PUBLIC_KEY`, `BEAST_JETSON_OPERATOR_SSH_PUBLIC_KEY_DESKTOP`,
  `BEAST_JETSON_SSH_ACCESS`, and `TAILSCALE_API_TOKEN`. The live Wi-Fi PSK is
  `CASTLEMOOSEGOOSE_WIFI_PSK` for SSID `CastleMooseGoose`. No secret value belongs in this runbook,
  logs, shell history, or process output. `BEAST_JETSON_ADMIN_PASSWORD` is the current
  `beast`-account sudo/recovery password, reset and verified 2026-08-02; routine SSH uses the
  local private key. `TAILSCALE_API_TOKEN` is for API/re-enrollment work, not routine tailnet SSH.
- Current live network state (verified 2026-08-02): `wlP1p1s0` is up at `192.168.0.187`,
  `tailscale0` is up at `100.107.16.72`, `enP8p1s0` is up at `192.168.0.166`, and `usb0` is down.
  The normal
  L4T USB gadget address remains the historical fallback `192.168.55.1`, but it was not reachable
  in this boot. The network-map identity `beast` / `192.168.20.184` still belongs to the retired
  Pi-hosted BEAST-01. **Do not** move that VLAN identity onto the Orin — operator policy (2026-07-30)
  keeps Orin on general LAN `192.168.0.x` + Tailscale (`beast-01-ts`).
- Timezone is `America/Chicago`, NTP is active, and `System clock synchronized` reports `yes` after
  reboot.
- R36.5's local `/etc/nvpmodel.conf` proves mode 0 is `15W`, mode 1 is `25W`, and mode 2 is
  `MAXN_SUPER`. Stationary staging uses mode 0, and reboot verification still reports `15W`.
- `nvidia-jetpack` 6.2.2+b24, CUDA 12.6, TensorRT 10.3.0, cuDNN 9.3.0, VPI 3.2.4, Docker Engine
  29.6.1, and NVIDIA Container Toolkit 1.16.2 are installed. Native package health, reboot, Docker's
  default `nvidia` runtime, and an NGC `l4t-cuda:12.6.11-runtime` CUDA probe all pass; the container
  reports one device named `Orin`.
- ROS 2 Humble is installed and `rosdep check` reports every workspace dependency satisfied.
  `ugv_ws` commit `ad274d6371195da7181df406e4ca19660eb522fc` builds all 29 packages on the
  Orin. Four Jetson interface/motion-gate tests and five costmap tests pass. The selected vendor
  `colcon test` set reports 16 tests, zero errors, and four inherited copyright/formatting failures;
  all undefined-name findings that could crash the camera demos were repaired and the remaining
  failures are non-runtime vendor lint debt. The launch graph parses with `ros2 launch --show-args`.
- `/etc/systemd/system/beast-ros-base.service` and `/etc/beast/ugv.env` are installed from that
  commit, root-owned, syntax-verified, disabled, and inactive. The unit hard-codes
  `allow_motion:=false`, `use_lidar:=false`, and `use_rviz:=false`; no process currently owns
  `/dev/ttyTHS1`.
- The validated local flash tree and logs are under `/home/coldaine/jetson-r365-flash` (about
  11 GiB). The credential-safe external image SHA-1 is
  `92fcc7e6960e4daf38dad61d1048de670db628c0`; restore log is
  `local-restore-credential.log`.
- An independent sparse-preserving archive is stored at
  `gdrive:backups/beast-01/jetson-r365-flash-r36.5-2026-07-11/jetson-r365-flash-r36.5-2026-07-11.tar.zst`.
  Size is 5,568,536,046 bytes; stream and Google Drive MD5 both equal
  `8fd3cc081a5fd076cc06f58def885a9c`, and SHA-256 is
  `4267e2c0bc2ce826acd6cd21e7b14e718035d591b9e57dd20cfe968111c6dc32`. Sidecar checksum files
  are stored beside the archive.
- A second generated tree remains on Proxmox VM 900 at
  `/home/ubuntu/jetson-flash/Linux_for_Tegra` (about 24 GiB), with the same external image hash and
  internal BCT index. VM 900 is stopped with its 142 GB virtual disk retained; VM 112 remains
  running, and the passed `c8:00.4` controller is rebound to host driver `xhci_hcd` with no driver
  override. A VM disk on the same fleet is a useful working copy, not the independent backup above.
- The local Nobara-only DSA compatibility edit lives inside the local BSP tree, and the temporary
  service-name wrapper lives under `/tmp/jetson-flash-bin`; neither is a reusable repository tool.
  Their required behavior is recorded in the successful-flash ledger above.
- Durable source documentation and the corrected ACCE inventory model merged to `main` in
  RobotOverview PR #117 (`d832d26484104b497163934b473117c004b1181e`).

### Flash-host architecture — prove the physical controller first

The successful path was a native x86_64 Linux host on an Intel Raptor Lake xHCI controller. A
native Ubuntu 22.04 host remains the least surprising supported choice; the successful Nobara host
proves that distribution identity was not the failed boundary. The controller must first complete
the read-only `bct_br` transfer. Do not start an image write on a controller that fails it.

A disposable Ubuntu 22.04 x86_64 VM on Proxmox is also valid when the **entire** physical xHCI
controller is passed as a PCI device with VFIO. Do **not** configure `usb0: host=0955:7523`, USB
vendor/product filters, SPICE USB redirection, an LXC, Docker, or Podman.

This distinction matters: the VM's Ubuntu kernel must own the controller and every transition
from APX to the L4T initrd composite device and USB network interface. Individual USB forwarding
asks QEMU or Proxmox to reacquire each new USB identity; whole-controller PCI passthrough does not.

Whole-controller passthrough removes USB identity handoff from QEMU, but it cannot repair the
physical controller. The 2026-07-11 native-host control proved that rebuilding VM 900 could not
resolve the EVO AMD Strix Halo failure: the same transfer failed below the VM boundary on that
controller. Do not use EVO function `c8:00.4` for another Jetson flash unless a later kernel or
firmware change first passes the read-only control.

On the Proxmox host, verify IOMMU and inventory the controllers:

```bash
dmesg | grep -Ei 'DMAR|IOMMU|AMD-Vi|interrupt remapping'
find /sys/kernel/iommu_groups -type l
lspci -nnk | sed -n '/USB controller/,+3p'
lsusb -t
```

Map the physical port to its PCI controller and inspect the complete IOMMU group. The selected
controller must not carry the Proxmox boot disk, management NIC, keyboard, UPS, or other required
USB devices. If no onboard controller is isolated, install a dedicated PCIe USB controller; do
not use ACS override to manufacture unsafe isolation.

Create the temporary VM with these minimums:

```text
Ubuntu 22.04 x86_64
q35 machine
4-8 vCPUs
8 GiB RAM or more
120 GiB or larger ext4 guest filesystem
VirtIO network with internet access
the complete xHCI PCI function as hostpci
```

Attach the verified controller, substituting the real VM ID and PCI address:

```bash
qm set <vmid> --machine q35
qm set <vmid> --hostpci0 0000:<bus:device.function>,pcie=1
```

With the VM running, the Proxmox host must show that PCI function bound to `vfio-pci`, while the
Ubuntu guest must show the same controller using `xhci_hcd`:

```bash
lspci -nnk -s <bus:device.function>
lsusb -t
```

### Prepare the Ubuntu guest

Do not install or run Docker in the flashing VM. Install the complete Ubuntu kernel modules and
the BSP's own prerequisite list, then verify the services that initrd flashing actually uses:

```bash
sudo apt update
sudo apt install -y linux-modules-extra-"$(uname -r)" rpcbind nfs-kernel-server
sudo modprobe rndis_host
sudo modprobe cdc_ether
sudo modprobe cdc_ncm
sudo modprobe cdc_subset

sudo systemctl enable --now rpcbind nfs-kernel-server
test "$(sysctl -n net.ipv6.conf.all.disable_ipv6)" = 0
systemctl is-active rpcbind nfs-kernel-server
rpcinfo -p localhost
```

Temporarily disable the guest firewall and any guest VPN during the flash, or explicitly allow
the initrd IPv6, SSH, and NFS traffic. Apply the proven USB timeout mitigations **inside the
Ubuntu guest**, because that guest now owns the USB kernel stack:

```bash
sudo ufw disable
echo 2048 | sudo tee /sys/module/usbcore/parameters/usbfs_memory_mb
echo -1 | sudo tee /sys/module/usbcore/parameters/autosuspend
for control in /sys/bus/usb/devices/*/power/control; do
  echo on | sudo tee "$control"
done
```

The 2048 MB USBFS value is a successful community workaround for the same large-blob timeout,
not an NVIDIA release requirement. Keep it because the failed host logged `-110` during RCM.
This VM is a dedicated flash appliance: stop it after the attended session and return its controller
to the host. Retain its disk only when it contains a deliberately preserved working tree or evidence;
otherwise destroy it. Never reuse it for general workloads or save it as a template with its
firewall disabled and USB power policy altered.

### Build one clean R36.5 BSP

Transfer only the two verified NVIDIA archives into `~/jetson-r36.5-clean` in the VM. Do not copy
the old extracted tree, `system.img`, `tools/kernel_flash/images`, SDK Manager containers, or
generated flash packages.

Verify the official SHA-1 values inside the VM:

```bash
mkdir -p ~/jetson-r36.5-clean
cd ~/jetson-r36.5-clean
sha1sum -c <<'SHA1SUMS'
96e691a6d2d618e22dd6cb0630ee17faaa4733e9  Jetson_Linux_R36.5.0_aarch64.tbz2
7844cfc00ef92eeb85d699d17bcb787a1560d486  Tegra_Linux_Sample-Root-Filesystem_R36.5.0_aarch64.tbz2
SHA1SUMS
```

Extract and stage the BSP:

```bash
tar -xpf Jetson_Linux_R36.5.0_aarch64.tbz2
sudo tar -xpf Tegra_Linux_Sample-Root-Filesystem_R36.5.0_aarch64.tbz2 \
  -C Linux_for_Tegra/rootfs
cd Linux_for_Tegra
sudo ./tools/l4t_flash_prerequisites.sh
sudo ./apply_binaries.sh
head -1 rootfs/etc/nv_tegra_release
```

The release line must contain `R36` and `REVISION: 5.0`.

#### Mandatory credential gate — before generating or flashing any package

The administrator credential and operator public key must be durable **before** the headless user
is created. Never flash a generated/discarded password and plan to change it after boot: key-only
SSH does not satisfy `sudo`, and that mistake requires an otherwise unnecessary recovery boot.

From the authenticated operator shell, preserve an existing administrator credential or create it
once, then record the exact public key that will be installed. The project slug below is the live,
intentionally misspelled Doppler slug:

```bash
set -euo pipefail
export DOPPLER_PROJECT=secrets_managment
export DOPPLER_CONFIG=dev
export BEAST_OPERATOR_PUBLIC_KEY="$HOME/.ssh/id_ed25519.pub"

test -s "$BEAST_OPERATOR_PUBLIC_KEY"
if ! doppler secrets get BEAST_JETSON_ADMIN_PASSWORD \
  --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --plain >/dev/null 2>&1; then
  openssl rand -hex 32 | doppler secrets set BEAST_JETSON_ADMIN_PASSWORD \
    --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" \
    --no-interactive --silent
fi
doppler secrets set BEAST_JETSON_OPERATOR_SSH_PUBLIC_KEY \
  --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" \
  --no-interactive --silent < "$BEAST_OPERATOR_PUBLIC_KEY"

test "$(doppler secrets get BEAST_JETSON_ADMIN_PASSWORD \
  --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --plain \
  | tr -d '\r\n' | wc -c)" -ge 32
```

NVIDIA's helper accepts its password only as a command-line argument. Give it a disposable random
bootstrap value, then overwrite the staged rootfs immediately from Doppler over stdin; the
disposable value must never be the password that is flashed:

```bash
set -euo pipefail
BEAST_BOOTSTRAP_PASSWORD="$(openssl rand -hex 32)"
sudo ./tools/l4t_create_default_user.sh \
  -u beast -p "$BEAST_BOOTSTRAP_PASSWORD" -n beast-01 --accept-license
unset BEAST_BOOTSTRAP_PASSWORD

{
  printf 'beast:'
  doppler secrets get BEAST_JETSON_ADMIN_PASSWORD \
    --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --plain \
    | openssl passwd -6 -stdin
} | sudo chpasswd --encrypted --root "$PWD/rootfs"

beast_uid="$(sudo awk -F: '$1 == "beast" { print $3 }' rootfs/etc/passwd)"
beast_gid="$(sudo awk -F: '$1 == "beast" { print $4 }' rootfs/etc/passwd)"
sudo install -d -m 0700 -o "$beast_uid" -g "$beast_gid" rootfs/home/beast/.ssh
doppler secrets get BEAST_JETSON_OPERATOR_SSH_PUBLIC_KEY \
  --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --plain \
  | sudo tee rootfs/home/beast/.ssh/authorized_keys >/dev/null
sudo chown "$beast_uid:$beast_gid" rootfs/home/beast/.ssh/authorized_keys
sudo chmod 0600 rootfs/home/beast/.ssh/authorized_keys
```

Verify the staged password against Doppler without printing either the password or hash, verify
`beast` is a sudo member, and compare the staged and persisted public-key fingerprints:

```bash
set -euo pipefail
stored_hash="$(sudo awk -F: '$1 == "beast" { print $2 }' rootfs/etc/shadow)"
test -n "$stored_hash"
case "$stored_hash" in
  '!'*|'*'*) exit 1 ;;
esac
doppler secrets get BEAST_JETSON_ADMIN_PASSWORD \
  --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --plain \
  | perl -e '
      my $hash = shift;
      chomp(my $password = <STDIN>);
      exit(crypt($password, $hash) eq $hash ? 0 : 1);
    ' "$stored_hash"
unset stored_hash

sudo awk -F: '
  $1 == "sudo" && $4 ~ /(^|,)beast(,|$)/ { found = 1 }
  END { exit(found ? 0 : 1) }
' rootfs/etc/group

doppler_key_fingerprint="$(
  doppler secrets get BEAST_JETSON_OPERATOR_SSH_PUBLIC_KEY \
    --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --plain \
    | ssh-keygen -lf - | awk '{ print $2 }'
)"
staged_key_fingerprint="$(
  sudo ssh-keygen -lf rootfs/home/beast/.ssh/authorized_keys | awk '{ print $2 }'
)"
test "$doppler_key_fingerprint" = "$staged_key_fingerprint"
unset doppler_key_fingerprint staged_key_fingerprint beast_uid beast_gid
```

Any failure above is a hard stop: do not generate a flash package and do not put the Jetson into
recovery. This bypasses interactive OEM setup while leaving a known, durable sudo credential and
key-only SSH on the image. The disposable helper password is briefly visible to other local
processes, so use a dedicated flash host/VM and overwrite it before package generation. First boot
must still verify that the APP partition expanded to the NVMe's usable capacity.

Do not replace the encrypted pipeline with plaintext `chpasswd --root`. The Ubuntu x86 flash host
cannot load the ARM64 target's PAM modules, and the observed result was
`pam_chauthtok() failed: Module is unknown`. Hashing from stdin on the host and using
`chpasswd --encrypted --root` avoids target PAM while still verifying the resulting shadow entry
cryptographically against the Doppler value.

Before connecting the recovery session, record:

```text
Developer-kit product/order number:
Module/carrier markings visible without disassembly:
NVMe manufacturer and model:
Proxmox node, xHCI PCI address, and physical USB port:
VM ID and Ubuntu kernel version:
USB cable or hub used:
```

### Enter Force Recovery

J14 is the small 2x6 button header, not the 40-pin GPIO header. Pin 9 is ground; pin 10 is
`FORCE_RECOVERY`.

1. Connect a known-good USB-C data cable between the Jetson recovery port and host.
2. Disconnect barrel power and wait 10 seconds.
3. Short J14 pins 9 and 10.
4. Reconnect barrel power while the pins remain shorted.
5. Wait 2-3 seconds, then remove the jumper.
6. Expect the power LED but no normal display or fan behavior; the host USB result is the proof.
7. Verify on the host:

```bash
lsusb -d 0955:7523
```

Expected: `NVIDIA Corp. APX`. If APX is absent, do not run a flash command. If the kit is already
powered, hold 9-10, momentarily short J14 reset pins 7-8, release 7-8, wait 2-3 seconds, then
release 9-10.

### Read identity before generating images

Use the official read-info path; do not infer "blank EEPROM" from SDK Manager's summary. Generate
the read-only command using the known developer-kit package identity. The terminal `internal`
argument below belongs only to `flash.sh` command generation and does not configure NVMe boot:

```bash
sudo env BOARDID=3767 BOARDSKU=0005 FAB=300 \
  ./flash.sh --read-info --no-flash jetson-orin-nano-devkit-super internal
```

Run the generated probe three times, preserving each raw CVM dump. Wait for APX to return between
runs instead of sleeping for an assumed duration:

```bash
cd bootloader
set -euo pipefail
sudo rm -f cvm.bin
rm -f ../cvm-{1,2,3}.bin ../read-info-{1,2,3}.log ../chkbdinfo-*.log

for attempt in 1 2 3; do
  sudo rm -f cvm.bin
  sudo bash readinfocmd.txt 2>&1 | tee "../read-info-${attempt}.log"
  sudo test -s cvm.bin || { echo 'read-info did not create a fresh cvm.bin'; exit 1; }
  sudo cp cvm.bin "../cvm-${attempt}.bin"
  sudo test -s "../cvm-${attempt}.bin"
  timeout 30 bash -c 'until lsusb -d 0955:7523 >/dev/null; do sleep 1; done' || {
    echo 'APX did not return after read-info'; exit 1;
  }
done
sha256sum ../cvm-*.bin
cmp -s ../cvm-1.bin ../cvm-2.bin && cmp -s ../cvm-1.bin ../cvm-3.bin || {
  echo 'EEPROM dumps are not stable'; exit 1;
}

parse_failed=0
for dump in ../cvm-{1,2,3}.bin; do
  for mode in i f k r; do
    if ! sudo ./chkbdinfo "-${mode}" "$dump" 2>&1 | \
      tee "../chkbdinfo-$(basename "$dump" .bin)-${mode}.log"; then
      parse_failed=1
    fi
  done
done
echo "chkbdinfo parse_failed=${parse_failed}"
cd ..
```

Interpret the result narrowly:

- Different dumps or read timeouts mean the USB path is not yet trustworthy; do not override it.
- Stable dumps that parse as `3767 / 300 / 0005` need no manual EEPROM override.
- Stable dumps with missing identity fields support a bounded software override using the known
  NVIDIA developer-kit identity. Preserve the dumps for NVIDIA support; do not write the EEPROM.
- Chip SKU D5 and RAM code 2 are read independently from the chip. Let an online generation read
  them when that path succeeds. For offline regeneration after those values have been captured,
  pass the exact observed `CHIP_SKU=00:00:00:D5` and numeric `RAMCODE_ID=2`; never infer either
  value from another module.

### Generate the exact QSPI plus NVMe package

If the CVM parser remains malformed, generate with only the necessary identity override:

```bash
sudo env \
  SKIP_EEPROM_CHECK=1 \
  BOARDID=3767 \
  BOARDSKU=0005 \
  FAB=300 \
  CHIP_SKU=00:00:00:D5 \
  RAMCODE_ID=2 \
  ./tools/kernel_flash/l4t_initrd_flash.sh \
    --no-flash \
    --external-device nvme0n1p1 \
    -p "-c ./bootloader/generic/cfg/flash_t234_qspi.xml" \
    -c ./tools/kernel_flash/flash_l4t_t234_nvme.xml \
    --showlogs \
    --network usb0 \
    --erase-all \
    jetson-orin-nano-devkit-super \
    internal
```

#### Destructive initrd boundary — verify before every recovery boot

`--erase-all` is not merely a later flash option. Package generation writes `erase_all=1` into
the recovery ramdisk's `/initrd_flash.cfg`; when that ramdisk starts,
`/bin/nv_enable_remote.sh` executes `blkdiscard -f` against the external device before host SSH is
available. Consequently, booting an erase-all package with `--initrd` can discard the entire NVMe
even when no host-side flash command follows. This happened once on 2026-07-11 and required an
external-image restore.

Treat an initrd generated with `--erase-all` as a single-purpose destructive flasher. Boot it only
when erasing the selected target is the explicit operation. `--initrd` does **not** mean read-only.

For inspection or credential recovery, build a separate clean package with the same command but
without `--erase-all`, then inspect the ramdisk before attaching the target:

```bash
set -euo pipefail
boot0="$PWD/bootloader/boot0.img"
inspect_dir="$(mktemp -d)"
trap 'rm -rf "$inspect_dir"' EXIT
cd "$inspect_dir"
abootimg -x "$boot0" >/dev/null
mkdir root
unmkinitramfs initrd.img root
test -f root/initrd_flash.cfg
if grep -Rqs '^erase_all=' root; then
  echo 'Refusing to boot destructive recovery initrd' >&2
  exit 1
fi
```

Only the erase-free package may be used for an inspection boot such as
`l4t_initrd_flash.sh --flash-only --initrd`. Keep destructive and recovery trees separate, record
their image hashes, and re-run this inspection after every regeneration.

If all EEPROM fields parse correctly and the connected target supplies chip information during
generation, run the same command without the six `env` assignments.
Require a clean generation and verify all of the following before any write:

- Board ID `3767`, FAB `300`, SKU `0005`, chip SKU D5, and RAM code 2.
- Kernel/UEFI DTB `tegra234-p3768-0000+p3767-0005-nv-super.dtb`.
- QSPI layout `bootloader/generic/cfg/flash_t234_qspi.xml`.
- External layout `tools/kernel_flash/flash_l4t_t234_nvme.xml` and `nvme0n1p1`.
- The external image uses the UUID in `bootloader/l4t-rootfs-uuid.txt_ext` and a
  `root=PARTUUID=...` command line that resolves to the NVMe APP partition.

The P3767-0005 configuration intentionally reuses a P3767-0003 **BPMP** DTB. That one BPMP name
is expected; a P3767-0003 kernel/UEFI DTB is not.

Return the board to APX if necessary, verify only one recovery device is attached, and flash the
already generated package:

```bash
lsusb -d 0955:7523
sudo ./tools/kernel_flash/l4t_initrd_flash.sh \
  --flash-only --showlogs --network usb0
```

In separate guest terminals, monitor `dmesg -wH`, `udevadm monitor --kernel --udev`, `lsusb`, and
`ip -6 -br addr`. The expected transition is APX `0955:7523`, then L4T initrd `0955:7035`, then a
USB network interface and SSH/NFS over IPv6, followed by QSPI and NVMe writes. Keep barrel power
and USB connected until completion. The recovery jumper must already be absent.

### Stop conditions and fault isolation

Use the transition point to choose the next investigation; do not stack unrelated workarounds:

| Last proven boundary | Investigate next |
|---|---|
| APX never appears in Ubuntu | recovery sequence, physical port, cable, VFIO assignment |
| EEPROM dumps differ | controller/cable/USB transport; do not conclude EEPROM corruption |
| Blob timeout; UART shows BPMP/DRAM fatal | generated identity/config or target hardware |
| APX disappears; `0955:7035` never appears | initrd boot or USB gadget failure |
| `0955:7035` appears; no network interface | Ubuntu RNDIS/CDC modules |
| USB network exists; SSH fails | guest IPv6/interface configuration |
| SSH works; NFS fails | guest NFS service, firewall, VPN, or exports created by the tool |
| Initrd runs; `nvme0n1` is absent | NVMe seating, slot, model compatibility, or target PCIe |

Stop immediately if generation names P3767-0003 as the kernel DTB, the external image does not
use the external PARTUUID, a write target is not QSPI plus `nvme0n1p1`, or any fuse command
appears. If the corrected package still times out before initrd, capture the Jetson debug UART at
115200 8N1 on the next attempt;
that distinguishes a host USB timeout from target-side BPMP/DRAM failure.

### First-boot acceptance

After a successful flash and normal power cycle without the recovery jumper, prove both key SSH
and the persisted sudo credential from the authenticated operator workstation **before** package
installation. For the current image, require the recorded fingerprint above. On the first boot of
a deliberately reflashed image, OpenSSH generates a new host key; establish trust only across the
physically controlled point-to-point USB link, record that fingerprint immediately, and require
strict checking on every subsequent connection. Set the common operator variables first:

```bash
set -euo pipefail
export DOPPLER_PROJECT=secrets_managment
export DOPPLER_CONFIG=dev
export JETSON_USB_HOST=192.168.55.1
export BEAST_SSH_IDENTITY="$HOME/.ssh/id_ed25519"
```

For a deliberately reflashed image only, bootstrap its newly generated Ed25519 host key now over
the physically controlled, point-to-point USB cable. Do not use
`StrictHostKeyChecking=no` or silently accept a LAN key. Capture the scan, print and record its
fingerprint in this runbook, then set `EXPECTED_JETSON_HOST_FINGERPRINT` to that recorded value
before installing the key:

```bash
set -euo pipefail
scan_file="$(mktemp)"
trap 'rm -f "$scan_file"' EXIT
ssh-keyscan -T 5 -t ed25519 "$JETSON_USB_HOST" 2>/dev/null >"$scan_file"
test "$(wc -l <"$scan_file")" -eq 1
scanned_fingerprint="$(ssh-keygen -lf "$scan_file" | awk '{ print $2 }')"
printf 'Record Jetson USB Ed25519 fingerprint: %s\n' "$scanned_fingerprint"
: "${EXPECTED_JETSON_HOST_FINGERPRINT:?record the printed fingerprint, then export it}"
test "$scanned_fingerprint" = "$EXPECTED_JETSON_HOST_FINGERPRINT"

install -d -m 0700 "$HOME/.ssh"
ssh-keygen -R "$JETSON_USB_HOST" -f "$HOME/.ssh/known_hosts" >/dev/null 2>&1 || true
tee -a "$HOME/.ssh/known_hosts" <"$scan_file" >/dev/null
chmod 0600 "$HOME/.ssh/known_hosts"
unset scanned_fingerprint EXPECTED_JETSON_HOST_FINGERPRINT
```

For the current image, skip that bootstrap and require the fingerprint already recorded above.
Then prove key login and the Doppler-backed sudo credential with strict checking:

```bash
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes \
  -i "$BEAST_SSH_IDENTITY" "beast@$JETSON_USB_HOST" true
doppler secrets get BEAST_JETSON_ADMIN_PASSWORD \
  --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --plain \
  | ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes \
      -i "$BEAST_SSH_IDENTITY" "beast@$JETSON_USB_HOST" \
      'sudo -S -k -p "" true && sudo -k'
```

If either command fails, provisioning stops. Do not install packages, add blanket passwordless
sudo, or declare first boot accepted. Repair the staged credential before flashing when possible;
for an already-flashed target, use the non-destructive recovery repair described above.

Then run on the Jetson:

```bash
set -euo pipefail
mkdir -p ~/beast-acceptance
head -1 /etc/nv_tegra_release | tee ~/beast-acceptance/nv-tegra-release.txt
findmnt -no SOURCE,TARGET / | tee ~/beast-acceptance/root-mount.txt
findmnt -no SOURCE / | grep -q nvme
lsblk -o NAME,MODEL,SIZE,FSTYPE,MOUNTPOINTS | tee ~/beast-acceptance/lsblk.txt
grep '^TNSPEC ' /etc/nv_boot_control.conf | tee ~/beast-acceptance/tnspec.txt
tr -d '\0' </proc/device-tree/compatible \
  | tee ~/beast-acceptance/device-tree-compatible.txt
grep -q 'p3767-0005-super' ~/beast-acceptance/device-tree-compatible.txt
sudo nvbootctrl dump-slots-info | tee ~/beast-acceptance/nvbootctrl.txt
dpkg --audit
sudo apt update
sudo apt-get check
sudo apt install nvidia-jetpack=6.2.2+b24
dpkg --audit
sudo apt-get check

dpkg-query -W nvidia-jetpack 'cuda-*' 'libnvinfer*' 'libcudnn*' 'libnvvpi*' \
  | tee ~/beast-acceptance/jetpack-packages.txt
nvcc --version | tee ~/beast-acceptance/cuda.txt
python3 -c 'import tensorrt as trt; print(trt.__version__)' \
  | tee ~/beast-acceptance/tensorrt.txt
sudo nvpmodel -q --verbose | tee ~/beast-acceptance/nvpmodel.txt
set +e
sudo timeout --signal=INT 5 tegrastats --interval 1000 \
  | tee ~/beast-acceptance/tegrastats.txt
tegrastats_status=${PIPESTATUS[0]}
set -e
test "$tegrastats_status" -eq 0 || test "$tegrastats_status" -eq 124
test -s ~/beast-acceptance/tegrastats.txt
```

Acceptance requires:

- The operator key succeeds with strict host-key checking and the Doppler administrator credential
  successfully authenticates sudo after invalidating any cached credential, without exposing its
  value.
- Jetson Linux reports `R36, REVISION: 5.0`.
- `/` is mounted from the NVMe and the APP filesystem has expanded to the expected capacity.
- The live device-tree compatibility string contains `p3767-0005-super`. This unit's current
  `TNSPEC` is `----1-0-jetson-orin-nano-devkit-super-` because NVIDIA's EEPROM parser did not
  populate board ID/FAB/SKU; that known metadata gap is recorded, not treated as a boot failure.
  Package-generation logs, selected kernel DTB, and the live device tree must all agree on
  P3767-0005. Do not write EEPROM merely to make `TNSPEC` prettier.
- QSPI/UEFI boots repeatedly without APX or a manual boot override.
- `apt-get check`, `dpkg --audit`, the regular Jammy upgrade, and the pinned
  `nvidia-jetpack=6.2.2+b24` install complete successfully. Do not run `do-release-upgrade`, switch
  the NVIDIA source away from R36.5, or use an unreviewed `full-upgrade`.
- The package capture contains installed CUDA, TensorRT (`libnvinfer`), cuDNN, and VPI packages;
  `nvcc` and the TensorRT Python import print versions without errors.
- `nvpmodel` prints the selected profile, and at least three `tegrastats` samples show live CPU,
  memory, temperature, and GPU fields.
- The later zero-motion ESP32 probe captures voltage, IMU, and raw odometry before any motion test.

Install Docker Engine and NVIDIA Container Toolkit only **after** the native JetPack package state
is healthy. Use Docker's Ubuntu repository rather than Ubuntu's older `docker.io` package, then
use the `nvidia-container-toolkit` supplied by the pinned R36.5 JetPack repository. Do not add a
second generic NVIDIA toolkit repository unless the JetPack package is genuinely unavailable.
After Docker's vendor repository is configured, install and prove the runtime:

```bash
sudo apt install docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
sudo nvidia-ctk runtime configure --runtime=docker
sudo apt install -y jq
sudo jq '. + {"default-runtime": "nvidia"}' /etc/docker/daemon.json \
  | sudo tee /etc/docker/daemon.json.tmp >/dev/null
sudo mv /etc/docker/daemon.json.tmp /etc/docker/daemon.json
sudo systemctl daemon-reload
sudo systemctl restart docker
docker info --format '{{.DefaultRuntime}} {{json .Runtimes}}'
```

Do not use `nvidia-smi` as the acceptance test: Jetson's integrated GPU is not managed like a
desktop PCIe card. A generic `ubuntu:22.04` image also does not carry the L4T metadata that activates
Jetson's CSV device mounts, so absence of `/dev/nvhost-*` there is not a runtime verdict. Use
NVIDIA's matching L4T CUDA image and execute a CUDA Runtime API probe. The validated image and
result are:

```bash
docker pull nvcr.io/nvidia/l4t-cuda:12.6.11-runtime
docker run --rm --runtime=nvidia \
  -v /var/lib/beast/container-smoke/cuda-smoke:/cuda-smoke:ro \
  nvcr.io/nvidia/l4t-cuda:12.6.11-runtime /cuda-smoke
# CUDA_DEVICE_COUNT=1
# CUDA_DEVICE_0=Orin
```

The tiny `cudaGetDeviceCount`/`cudaGetDeviceProperties` source and host-compiled binary are retained
at `/var/lib/beast/container-smoke/`. Rebuild the binary with `/usr/local/cuda/bin/nvcc` after a
CUDA major-version change rather than copying it from another architecture.

### Jetson UART gate and Beast software

> **Superseded 2026-07-30:** the deployed ESP32 link is the driver board's **USB-C**
> (`UGV_SERIAL_PORT` by-id → `/dev/ttyACM0`), not `/dev/ttyTHS1`. The GPIO-UART material below
> (loopback test, DMA regression, nvgetty) applies only if someone later builds the jumper
> alternative. The ROS install, workspace, and acceptance-test procedures below remain valid —
> substitute the USB serial port, and note the service is now **enabled and running**, not staged.

The current Waveshare architecture already puts wheel control, encoders, IMU, battery telemetry,
servo handling, and the motor stop on the ESP32 lower computer. Do not port Raspberry Pi GPIO,
I2C, PWM, or motor-control code that the Beast does not use. The Jetson replaces the Pi as the ROS
upper computer and talks to the same ESP32 at 115200 baud.

On the NVIDIA carrier board's **40-pin expansion header**, pin 8 is UART TX, pin 10 is UART RX,
and pin 6 is ground. These are unrelated to J14 recovery pins 9-10. The Linux device is
`/dev/ttyTHS1`, not the Pi workspace's `/dev/ttyAMA0`. Before connecting the Beast:

```bash
sudo systemctl disable --now nvgetty.service
sudo usermod -aG dialout "$USER"
# Log out and back in before the following checks.
ls -l /dev/ttyTHS1
```

With the Jetson powered off, loop pin 8 to pin 10, boot, and run a 115200-baud transmit/receive
loopback. Remove the loop only after powering off. R36.5 has a reported Orin Nano/NX DMA regression
on `serial@3100000`: if bytes do not loop back, first test the community-confirmed PIO workaround
that removes `dmas` and `dma-names` from that node. The narrower NVIDIA-proposed fix adds the
missing GPCDMA IOMMU property. Preserve the stock DTB and record which fix is necessary before
deploying either one. Do not lower the ESP32 protocol baud or invent a USB-UART replacement until
this test determines whether the onboard UART is actually affected.

Install ROS 2 Humble from the official Jammy ARM64 apt repository, including
`ros-humble-ros-base`, `python3-rosdep`, and `python3-colcon-common-extensions`. Initialize `rosdep`
once, then use the prepared Jetson adaptation branch instead of Waveshare's unmodified Pi defaults:

```bash
set -euo pipefail
ROS_APT_SOURCE_VERSION=1.2.0
curl -fsSL \
  "https://github.com/ros-infrastructure/ros-apt-source/releases/download/${ROS_APT_SOURCE_VERSION}/ros2-apt-source_${ROS_APT_SOURCE_VERSION}.jammy_all.deb" \
  -o /tmp/ros2-apt-source.deb
sudo apt install -y /tmp/ros2-apt-source.deb

# The 2026 Humble ARM64 index carries Ignition Gazebo 6.18 but an older
# sensors binary; the official OSRF stable repository supplies compatible 6.8.1.
curl -fsSL https://packages.osrfoundation.org/gazebo.gpg \
  | sudo tee /usr/share/keyrings/pkgs-osrf-archive-keyring.gpg >/dev/null
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/pkgs-osrf-archive-keyring.gpg] https://packages.osrfoundation.org/gazebo/ubuntu-stable jammy main" \
  | sudo tee /etc/apt/sources.list.d/gazebo-stable.list >/dev/null
sudo apt update
sudo apt install -y git git-lfs ros-humble-ros-base ros-dev-tools \
  python3-rosdep python3-colcon-common-extensions python3-vcstool

mkdir -p ~/beast
cd ~/beast
git clone --filter=blob:none --sparse https://github.com/Coldaine/RobotOverview.git
cd RobotOverview
git sparse-checkout set robot/beast/ros2_ws
git checkout main
ROBOTOVERVIEW_COMMIT="$(git rev-parse HEAD)"
cd robot/beast/ros2_ws

source /opt/ros/humble/setup.bash
export GZ_VERSION=fortress
if [[ ! -f /etc/ros/rosdep/sources.list.d/20-default.list ]]; then
  sudo rosdep init
fi
rosdep update
rosdep install --from-paths src --ignore-src --rosdistro humble -r -y
colcon build --symlink-install --parallel-workers 2
```

That branch is based on Waveshare `ros2-humble-develop-251125` at `037dfca`. It makes the ESP32 and
LiDAR ports launch arguments, permits LiDAR-free base bring-up, corrects `rclcpy` to `rclpy`, uses
`/dev/ttyTHS1` on Jetson, discovers predictable Wi-Fi/Ethernet interface names, removes the stale
ROS 1 `cmake_modules` dependency, declares OAK-D Lite and V4L2 runtime dependencies, and defaults
`allow_motion` to false. It also carries the JetPack OpenCV 4.8 compatibility methods required by
the vendored costmap converter, fixes invalid fallback names in the vision demos, and supplies a
disabled zero-motion systemd unit. Do not blindly run `build_first.sh` on the Jetson: it installs wildcard
desktop, simulation, vision, and debug-symbol packages, pins conflicting Python wheels, and
hard-codes its build path. `rosdep` plus declared hardware dependencies is the reproducible path.

For this Humble build, `GZ_VERSION=fortress` selects the installed Ignition Gazebo 6 ABI. The full
workspace compilation does not validate Waveshare's optional Harmonic simulation launch, which is
not part of the physical Beast cutover. Do not install a second simulator stack merely to turn that
optional demo into an acceptance gate.

Set `UGV_MODEL=ugv_beast` and `LDLIDAR_MODEL=ld19`; the ACCE D500 uses the STL-19P/LDS19 protocol
at 230400 baud. Use a stable `/dev/serial/by-id/...` path for USB LiDAR once the fitted device is
attached and observed. Keep the vendor `ugv_jetson` Flask service disabled while ROS is running
because both attempt to own `/dev/ttyTHS1` and camera devices.

No RoArm is fitted. The vendor workspace contains optional RoArm programs because it supports other
Waveshare configurations, but no RoArm node or service belongs in BEAST-01's launch path. The
physical kit is the ACCE base, stock pan-tilt 5 MP camera, OAK-D Lite, and D500 LiDAR only.

> **Historical install recipe (2026-07 cutover staging) — do not run blindly.**
> On the live robot (verified 2026-07-30+), `beast-ros-base.service` is **enabled and
> active at boot**. The `systemctl disable --now` line below would kill the running stack.
> Use only when intentionally reinstalling from a blank Jetson image; otherwise skip to
> the ground-truth checks in Quick connect.

```bash
sudo install -d -m 0755 /etc/beast
sudo install -m 0644 deploy/systemd/ugv.env.example /etc/beast/ugv.env
sudo install -m 0644 deploy/systemd/beast-ros-base.service \
  /etc/systemd/system/beast-ros-base.service
sudo systemctl daemon-reload
# LIVE ROBOT: do NOT disable — service is enabled at boot and starts motion-enabled.
# sudo systemctl disable --now beast-ros-base.service
systemd-analyze verify /etc/systemd/system/beast-ros-base.service
# After a blank-image install only:
# systemctl is-enabled beast-ros-base.service  # expect disabled until first enable
# systemctl is-active beast-ros-base.service   # expect inactive until first start
# Live robot expect: enabled + active
```

For the first hardware session, lift and secure the tracks, leave LiDAR and autonomous nodes off,
and start only base bring-up:

```bash
export UGV_MODEL=ugv_beast
export LDLIDAR_MODEL=ld19
source /opt/ros/humble/setup.bash
source ~/beast/RobotOverview/robot/beast/ros2_ws/install/setup.bash
ros2 launch ugv_bringup bringup_lidar.launch.py \
  serial_port:=/dev/ttyTHS1 use_lidar:=false use_rviz:=false allow_motion:=false
```

With no `/cmd_vel` publisher running, capture one message from each zero-motion telemetry lane:

```bash
set -euo pipefail
mkdir -p ~/beast-acceptance/ros
rm -f ~/beast-acceptance/ros/*.txt
ros2 topic info /cmd_vel --verbose | tee ~/beast-acceptance/ros/cmd-vel-info.txt
grep -q '^Publisher count: 0$' ~/beast-acceptance/ros/cmd-vel-info.txt
timeout 15 ros2 topic echo /ugv/voltage --once \
  | tee ~/beast-acceptance/ros/voltage.txt
timeout 15 ros2 topic echo /imu/raw --once \
  | tee ~/beast-acceptance/ros/imu-raw.txt
timeout 15 ros2 topic echo /odom/odom_raw --once \
  | tee ~/beast-acceptance/ros/odom-raw.txt
test -s ~/beast-acceptance/ros/voltage.txt
test -s ~/beast-acceptance/ros/imu-raw.txt
test -s ~/beast-acceptance/ros/odom-raw.txt
```

The voltage must be finite and plausible for the connected Beast battery; IMU and odometry arrays
must be populated and update when the chassis is moved by hand. Stop if any lane times out or the
`/cmd_vel` topic already has an unexpected publisher.

Once the fitted LiDAR is identified, relaunch with `use_lidar:=true` and its stable `lidar_port`.
For the heartbeat test, keep the tracks lifted and clear, start exactly one publisher in a second
terminal, explicitly relaunch with `allow_motion:=true`, and begin at 0.02 m/s. Enabling motion is
for this physically supervised gate only. Increase only enough to overcome motor deadband, never
above 0.05 m/s during this test:

```bash
ros2 topic pub --rate 5 /cmd_vel geometry_msgs/msg/Twist \
  '{linear: {x: 0.02, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.0}}'
```

While the lifted tracks are turning steadily, press Ctrl+C in that publisher terminal and start a
timer. With no other publisher and without sending zero first, the ESP32 must stop the tracks
within its configured three-second heartbeat interval. After observing and recording that stop,
send an explicit zero with a subscriber wait:

```bash
ros2 topic pub /cmd_vel geometry_msgs/msg/Twist \
  '{linear: {x: 0.0, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.0}}' \
  --once -w 1
```

**Status (2026-07-31):** The Jetson-side `cmd_vel_timeout` watchdog is implemented in `ugv_bringup`
(historical commit `a1b2822`, preserved in this repository), but a physical crawl+kill
safety check has not yet been witnessed by the operator. Motion is currently disabled 
by default until the owner confirms a live shakedown.

### Remaining physical cutover record

**Live-verified 2026-07-30:** the Orin is seated, powered from the pack's barrel-jack lead, and
linked to the ESP32 over USB. `beast-ros-base.service` is enabled and runs the full stack at
boot; battery voltage, IMU, wheel odometry, and LD19 LiDAR scans all flow; the D500's stable
by-id path is recorded in `/etc/beast/ugv.env` (`usb-1a86_USB_Single_Serial_5970075705-if00`).
The on-robot workspace is `a1b2822` (`beast/jetson-orin-nano-adaptation`, includes cmd_vel
watchdog). Charge the pack before the next motion session (brownout at ~8.8 V on 2026-07-31).

Still open before the cutover is complete:

1. **Live re-gate of cmd_vel-timeout watchdog** (crawl+kill; expect self-stop ≤1 s) — required
   before trusting `allow_motion:=true`. Firmware ESP32 heartbeat still absent.
2. ~~**One-frame verification** from the 5 MP pan-tilt camera (`/dev/video0`) and OAK-D Lite~~ —
   **DONE 2026-07-31**: both verified live (OAK RGB ~16 FPS + depth ~16.3 FPS over USB2, 5 MP
   frame grabbed via v4l2-ctl). See the OAK first-light bullet in Quick connect. Remaining OAK
   nice-to-have: USB3 cable swap for SUPER speed, and an IMU-presence check.
3. **Mounting strut** — one side missing; bracket/standoff on the M2.5 corner holes, no drilling.

Keep network identity on general LAN `192.168.0.x` + Tailscale — do **not** reclaim the Pi
robot-VLAN address `192.168.20.184`.

### Research references

- NVIDIA JetPack 6.2.2 — https://developer.nvidia.com/embedded/jetpack-sdk-622
- NVIDIA Jetson Linux 36.5 release — https://developer.nvidia.com/embedded/jetson-linux-r365
- NVIDIA Jetson Linux 36.5 flashing support — https://docs.nvidia.com/jetson/archives/r36.5/DeveloperGuide/SD/FlashingSupport.html
- NVIDIA R36.5 Quick Start (Orin Nano Super NVMe command) — https://docs.nvidia.com/jetson/archives/r36.5/DeveloperGuide/IN/QuickStart.html
- NVIDIA R36.5 supported modules — https://docs.nvidia.com/jetson/archives/r36.5/DeveloperGuide/index.html
- NVIDIA EEPROM layout — https://docs.nvidia.com/jetson/archives/r35.6.2/DeveloperGuide/HR/JetsonEepromLayout.html
- Proxmox PCI passthrough administration — https://pve.proxmox.com/pve-docs/pve-admin-guide.pdf
- Successful Orin Nano Proxmox whole-controller flash — https://git.ericxliu.me/eric/ericxliu-me/src/commit/3b723ecfad7d7f64f02d2e496c97fb79b29c8b61/content/posts/flashing-jetson-orin-nano-in-virtualized-environments.md
- NVIDIA forum: containerized external-storage flash limitations — https://forums.developer.nvidia.com/t/flashing-orin-from-inside-docker-container/352106
- NVIDIA forum: EEPROM override recovery — https://forums.developer.nvidia.com/t/cannot-flash-jetson-nano-orin-devkit-eeprom-error/278033
- NVIDIA forum: USBFS timeout workaround — https://forums.developer.nvidia.com/t/fix-for-error-might-be-timeout-in-usb-write-increase-usbfs-memory-mb-to-2048/360581
- NVIDIA forum: matching AMD-controller timeout resolved on Intel — https://forums.developer.nvidia.com/t/jetson-agx-orin-64gb-usb-timeout-on-flash-gui-broken-after-flash-sh-sdk-manager-no-sdks-on-windows/363988
- Linux usbmon documentation — https://docs.kernel.org/usb/usbmon.html
- NVIDIA forum: R36.5 Orin Nano/NX UART DMA fixes — https://forums.developer.nvidia.com/t/solved-uart-serial-port-not-working-after-upgradint-to-jetpack-6-2-2-orin-nano-nx/363837
- NVIDIA Container Toolkit install guide — https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html
- Docker Engine on Ubuntu — https://docs.docker.com/engine/install/ubuntu/
- ROS 2 Humble Ubuntu packages — https://docs.ros.org/en/humble/Installation/Ubuntu-Install-Debs.html
- Waveshare UGV Beast Jetson Orin ROS 2 — https://www.waveshare.com/wiki/UGV_Beast_Jetson_Orin_ROS2
- Imported Jetson adaptation head — `3dd122e` (preserved in this repository's history)
- Reddit: recovery-mode jumper and cable lessons — https://www.reddit.com/r/JetsonNano/comments/1lqzjhu
- Reddit: NVMe model compatibility report — https://www.reddit.com/r/JetsonNano/comments/1hth1vo/booting_jetson_orin_nano_super_from_ssd/

## References

- Waveshare UGV Beast — https://www.waveshare.com/ugv-beast.htm
- `ugv_rpi` (Pi upper-computer code) — https://github.com/waveshareteam/ugv_rpi
- `ugv_base_general` / `ugv_base_ros` (ESP32 lower-computer code) — https://github.com/waveshareteam
- Robot control LLMs / VLA / Cosmos 3 Edge research brief — [content/datacore/robot-control-llms.md](../content/datacore/robot-control-llms.md)
- Introducing Cosmos 3 Edge (Hugging Face) — https://huggingface.co/blog/nvidia/cosmos3edge
