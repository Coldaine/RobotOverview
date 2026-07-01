---
title: BEAST-01 Operations Runbook
date: 2026-06-25
author: Patrick MacLyman
status: living
last_confirmed: 2026-07-01
---

# BEAST-01 — Operations Runbook

Operational knowledge for the physical **UGV Beast** (`BEAST-01`) — how to reach it,
drive it, read its telemetry, and program it. This is the "don't lose it to a chat log"
record the North Star asks for (G1, G5). The catalog entry for the unit lives in
`src/data/hangar.ts` (`id: 'beast'`); this file is the *operating* counterpart.

> Scope note: the Hangar app **catalogs and links out to** the Beast; it does not (yet)
> operate it. See NORTH_STAR `AG2` — supervised teleop via the robot's own tools is fine;
> unsupervised autonomous control is the line. The dashboard below is the control surface.

## Hardware chain

```
Browser / HTTP client  ──HTTP/WebSocket──▶  Raspberry Pi 5 (upper computer)
                                              │  Flask web app `ugv_rpi`, camera, strategy
                                              ▼  JSON over UART @115200
                                            ESP32 (lower computer)  ──▶ motors · servos · IMU · voltage
```

- **Upper computer:** Raspberry Pi 5 — vision, web UI, command relay. No CUDA; learned-policy
  inference lives offboard.
- **Lower computer:** ESP32 — motion (PID), servo bus (RoArm-M2), sensor feedback.
- **Software stack:** Waveshare `ugv_rpi` (standard, not ROS2). Server is Werkzeug / Python 3.11.

## Network

| Fact | Value | Verified |
|---|---|---|
| Hostname | `beast.local` | ⚠️ did not resolve from `icarus-laptop` on 2026-07-01 |
| IP | `192.168.20.184` | ✅ HTTP 200, 8-14 ms ping |
| Cross-VLAN reach | reachable from the dev workstation (different VLAN) | ✅ measured 2026-07-01 |
| DHCP reservation | fixed IP held on the UDM | ⚠️ per setup — confirm on the UDM |
| Source VLAN | CastleMooseGoose → robot VLAN (`192.168.20.x`) | ⚠️ per setup — confirm |

Use the raw IP as the operator path until mDNS/DNS is fixed. After a Beast reboot or a DHCP
renew, re-confirm it returns to `192.168.20.184` (that's what the reservation is for).

## Services & dashboards

| URL | What | Notes |
|---|---|---|
| `http://192.168.20.184:5000` | **Control UI** (drive, FPV, arm, gimbal) | Use Google Chrome. Open in a normal browser — works fine. |
| `http://192.168.20.184:8888` | **JupyterLab** | Interactive lesson notebooks (302 → `/lab?`). The programming on-ramp. |
| `http://192.168.20.184:5000/video_feed` | Raw MJPEG camera stream | Long-lived stream; inspect headers/frames with a client that can abort cleanly. |

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
| Arm (RoArm-M2) | `{"T":<cmd_arm_ctrl_ui>,"E":..,"Z":..,"R":..}` | T-code from `config.yaml`. |
| Gimbal | `{"T":<cmd_gimbal_ctrl>,"X":..,"Y":..,"SPD":0,"ACC":128}` | T-code from `config.yaml`. |

**Safety:** a stale-command watchdog on the Beast auto-stops the tracks if no command
arrives within its timeout, so a single nudge then silence is self-safing. Still: lift the
tracks or ensure clear runway before any motion command, and send an explicit stop after.

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

1. **Web app (`:5000`)** — teleop, FPV, arm/gimbal. Drive it manually. *(done — it drives)*
2. **JupyterLab (`:8888`)** — official lesson notebooks: motion, camera/CV (face/object/line/
   gesture), arm kinematics. This is where you learn to program it.
3. **JSON command API** — `/json` Socket.IO. Script motion/arm; this is also
   the integration point if the Hangar ever gains a (supervised) command view.
4. **ROS2 stack** (optional, separate install, port `:5100`) — SLAM, mapping, nav, even
   LLM-driven natural-language control. Bigger jump.

## Jetson OS experimentation

JetPack 7 dual-boot research is tracked outside this live ops page:

- `docs/reference/beast-jetson-dualboot-evidence.md` — evidence and risk decision.
- `docs/reference/beast-jetson-dualboot-runbook.md` — operator steps, recovery gate, and destructive restore path.

JP6 remains the Beast-control default. Do not begin a JP7 install until the runbook's
recovery gate is complete and a JP6 restore path has been tested.

## References

- Waveshare UGV Beast — https://www.waveshare.com/ugv-beast.htm
- `ugv_rpi` (Pi upper-computer code) — https://github.com/waveshareteam/ugv_rpi
- `ugv_base_general` / `ugv_base_ros` (ESP32 lower-computer code) — https://github.com/waveshareteam
