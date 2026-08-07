# BEAST-01 — Operations

Operating facts for the physical **UGV Beast** (`BEAST-01`) — how to reach it, drive it,
read its telemetry, and program it. The catalog entry for the unit lives in
`src/data/hangar.ts` (`id: 'beast'`). Facts below carry the date they were last verified;
re-verify against the live robot before relying on anything stale.

## Quick connect

**Hardware identity + power path (verified live 2026-08-07):**

| Fact | Value | How verified |
|---|---|---|
| Jetson | `NVIDIA Jetson Orin Nano Engineering Reference Developer Kit Super` | `cat /proc/device-tree/model` |
| L4T | R36 rev 5.0 (JetPack 6.2 line), built 2026-01-16 | `/etc/nv_tegra_release` |
| Power mode | 15 W (`nvpmodel` id 0) | `nvpmodel -q` |
| Battery telemetry | **INA219 live on `i2c-7` at `0x41`**, responds to reads | `i2cdetect -y -r 7`, `i2cget -y 7 0x41 0x02 w` |
| Other I2C | `i2c-0`: `0x50`/`0x57` (EEPROMs, kernel-claimed) · `i2c-1`: `0x25`, `0x40` (kernel-claimed) · `i2c-4`: `0x3c` | `i2cdetect`, `/sys/bus/i2c/devices/` |

The `0x41` INA219 is the ROS Driver board's battery-voltage sensor (callout 4 on
`public/datacore/beast-driver-board-callouts.png`). Power reaches the Jetson from the
chassis pack via that board's MP8759GD 5 V/5 A buck and the 40-pin header — **not** from any
add-on UPS. The Waveshare **UPS Power Module (C) is not fitted and is not planned**: it
mounts only by Pogo pins against the carrier, which is not how this Jetson is mounted, and
its I2C telemetry would duplicate the INA219 above. Verdict and evidence:
[`keyArtifactstosort/reference/waveshare-ups-power-module-c/README.md`](../keyArtifactstosort/reference/waveshare-ups-power-module-c/README.md).

Bus-voltage words from `0x41` decode with the chip-fixed 4 mV/bit LSB (no calibration
dependency), so those **are** volts. Currents derived from the shunt register still assume
an unverified 0.1 Ω `RSHUNT` (LeoRover default) — treat amps as provisional.

**Power session 2026-08-07 (live):**

- INA219 read end-to-end all session: 12.07–12.17 V. Config register `0x399F` = datasheet
  reset value (genuine, unconfigured part). **Sign convention verified:** connecting the
  charger stepped current +108 mA ⇒ positive = charging; `current_sign: 1.0` is correct.
- `beast` user added to the `i2c` group (was missing; `/dev/i2c-7` is `root:i2c` — any
  service running the sensor needs it too). `smbus2` pip-installed `--user`.
- **`beast_power` ran on hardware for the first time** — bench run via `ros2 run` with
  parameter overrides on shadow topics (`/ugv/power_ina219`, `/ugv/charging_ina219`):
  honest BatteryState at a steady 1.000 Hz, `charge/capacity` NaN, absent-path clean.
  Repo defaults fixed to `0x41`. **Cutover prepared in-repo later that night** —
  `bringup_lidar.launch.py` starts `beast_power` (`use_power`, default true) as sole owner
  of `/ugv/voltage`, `ugv_bringup`'s BatteryState publisher removed, `i2c` added to the
  service unit's groups — **not yet deployed to the robot** (it was shut down overnight to
  charge; deploy steps in `beast_power/README.md`).
- **Dual-source logger running:** `power_log.py` → `/home/beast/power-log.csv`, 5 s cadence,
  INA219 registers + `/ugv/voltage` (ESP32) on one timeline. Open observation for the
  morning readout: with the 12.6 V charger connected, **both** sources drift slowly down
  and the INA219 branch shows steady small discharge (−20…−40 mA) — the charger appears to
  carry the running load but not charge the pack. Unresolved; do not theorize past the CSV.
- On-robot checkout `6ef4a48`, working tree clean, `install/` content-diffed identical to
  `src/`, three commits behind `main`.
- **Fan blocked by the top plate (found 2026-08-07):** with the lid installed, the Jetson
  fan is physically obstructed — 0 RPM at PWM 255/255, idle SoC at ~86–87 °C, and the
  "ugly grinding noise" earlier that night was the blades fighting the cover. The fan
  itself is healthy (verified by hand, uncovered). **Do not run the Orin under sustained
  load until the top is remounted with fan clearance.** After remount, verify:
  `cat /sys/devices/platform/pwm-fan/hwmon/hwmon0/rpm` > 0 and idle CPU < 60 °C.
- **Robot powered off overnight 2026-08-07 with the 12.6 V charger connected** — the
  measured conclusion from the evening: the charger cannot charge the pack with the robot
  running (its whole output feeds the load; shedding software load flipped pack current
  from −11 mA to only +16 mA). Full-off charging is the test in progress; read the pack's
  rested voltage at next power-on.
- **Retraction:** the `~8.8 V brownout 2026-07-31` previously recorded in this doc was
  unsourced — the battery I²C was not wired until 2026-08-07, so no pack voltage could have
  been logged then. Removed repo-wide; do not calibrate against it.

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
ssh beast-01        # mDNS: beast-01.local; CURRENTLY resolves to Ethernet 192.168.0.166 (both ifaces up)
ssh beast-01-ts     # Tailscale: 100.107.16.72 — STABLE, use this for automation
# Direct Wi-Fi fallback when mDNS fails:
ssh -i ~/.ssh/hephastus_ed25519 -o HostKeyAlias=beast-01 beast@192.168.0.187
```

!!! warning "LAN IPs drift — use the Tailscale path for automation"
    As of 2026-08-03 the robot has **both** `enP8p1s0` (Ethernet, `192.168.0.166`) and
    `wlP1p1s0` (Wi-Fi, `192.168.0.187`) up, and `beast-01.local` mDNS resolves to whichever
    interface the OS prefers — currently the **Ethernet** IP, not the Wi-Fi IP older docs
    list. Both are DHCP and can change. `ssh beast-01-ts` and the bridge URL
    `wss://beast-01.tyrannosaurus-magellanic.ts.net/` are stable regardless of interface;
    agents/automation should use those, never a hardcoded `192.168.0.x`.

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
- **Brownout claim retracted 2026-08-07:** a `~8.8 V brownout on 2026-07-31` was recorded
  here with no measurement source. The UPS I²C was not wired until 2026-08-07, so no pack
  voltage could have been logged, and `reference-data.ts` had already recorded on 2026-07-24
  that the earlier brownout framing was a misreading. Do not calibrate against it.
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

Retired Pi-era surfaces (Control UI/JupyterLab on `192.168.20.184`, the Socket.IO
control protocol, the `/ctrl` telemetry key table, and the OP-VIDEO-RELOCK note) moved
2026-08-07 to [`beast-jetson-flash-runbook.md`](beast-jetson-flash-runbook.md) — the Pi
was removed 2026-07-22 and none of those ports listen on the Orin (checked 2026-08-07).

Two facts from those sections remain live and stay here:

- **The ESP32 JSON T-code protocol is still the wire format** — `ugv_bringup` speaks it
  to the ESP32 over USB serial today (`robot/beast/ros2_ws/.../ugv_bringup/base_ctrl.py`).
  Only the Pi Socket.IO transport around it is dead. `tools/beast-probe.mjs` still speaks
  the protocol but requires an explicit `--host`; there is no default target.
- **The ESP32 has NO stale-command failsafe** (physically tested 2026-07-31; details in
  Quick connect above). An explicit stop path must be live before any motion command.

## NVMe storage — planned, not applied

Policy, budgets, and rejected alternatives moved 2026-08-07 to the
[NVMe storage implementation plan](plans/2026-07-11-beast-nvme-storage-implementation.md).

**Live state, checked 2026-08-07:** `/data/beast/{datasets,maps,models,recordings,recovery-staging}`
exist on the 1.9 TB NVMe (1.8 TB free); `beast-storage-prepare.service` is active;
`beast_record` and the topic allowlists are installed at `/usr/local/lib/beast-storage/`
and `/etc/beast/recording/`. **No recording unit is enabled** and
`/data/beast/recordings/` holds no bags.

## ROS workspace provenance

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
| Last live-checked | **`6ef4a48` at `~/beast/RobotOverview` (2026-08-07)** — monorepo cutover COMPLETE; legacy `~/beast/ugv_ws` is gone. Working tree clean; `install/` content-diffed identical to `src/`; three commits behind `main`. |

Hangar docs are not proof of on-robot state. Always check the robot before asserting commit or
behavior. Before applying the [NVMe storage implementation plan](plans/2026-07-11-beast-nvme-storage-implementation.md),
reconcile against the **live on-robot** tree.

## Jetson migration and flash runbook

Moved 2026-08-07 to [`beast-jetson-flash-runbook.md`](beast-jetson-flash-runbook.md):
the completed Pi-to-Orin migration record, the credential-recovery incident, and the
reflash procedure. History and reference — not current state.

## References

- Waveshare UGV Beast — https://www.waveshare.com/ugv-beast.htm
- `ugv_rpi` (Pi upper-computer code) — https://github.com/waveshareteam/ugv_rpi
- `ugv_base_general` / `ugv_base_ros` (ESP32 lower-computer code) — https://github.com/waveshareteam
- Robot control LLMs / VLA / Cosmos 3 Edge research brief — [content/datacore/robot-control-llms.md](../content/datacore/robot-control-llms.md)
- Introducing Cosmos 3 Edge (Hugging Face) — https://huggingface.co/blog/nvidia/cosmos3edge
