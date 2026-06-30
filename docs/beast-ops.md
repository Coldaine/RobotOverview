---
title: BEAST-01 Operations Runbook
date: 2026-06-25
author: Patrick MacLyman
status: living
last_confirmed: 2026-06-30
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
| Hostname | `beast.local` | ✅ resolves to the IP below |
| IP | `192.168.20.184` | ✅ HTTP 200, ~8 ms ping |
| Cross-VLAN reach | reachable from the dev workstation (different VLAN) | ✅ measured |
| DHCP reservation | fixed IP held on the UDM | ⚠️ per setup — confirm on the UDM |
| Source VLAN | CastleMooseGoose → robot VLAN (`192.168.20.x`) | ⚠️ per setup — confirm |

If `beast.local` ever fails to resolve, fall back to the raw IP. After a Beast reboot or a
DHCP renew, re-confirm it returns to `192.168.20.184` (that's what the reservation is for).

## Services & dashboards

| URL | What | Notes |
|---|---|---|
| `http://beast.local:5000` | **Control UI** (drive, FPV, arm, gimbal) | Use Google Chrome. Open in a normal browser — works fine. |
| `http://beast.local:8888` | **JupyterLab** | Interactive lesson notebooks (302 → login). The programming on-ramp. |
| `http://beast.local:5000/video_feed` | Raw MJPEG camera stream | `multipart/x-mixed-replace`. Pull frames directly without the UI. |

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
curl -D - --max-time 3 -o /tmp/beast-video.bin http://beast.local:5000/video_feed
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

Commands are JSON sent to the ESP32 via the Pi. Two transports, same payloads:

- **HTTP (simplest for scripting):** `GET http://beast.local:5000/js?json=<URL-encoded JSON>`
- **Socket.IO:** namespace `/json`, event `json`, e.g. `socketJson.emit('json', {"T":1,"L":0,"R":0})`

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

Example — gentle forward nudge then stop. The JSON is URL-encoded in the query string.

**bash (Git Bash):**

```bash
curl -s 'http://beast.local:5000/js?json=%7B%22T%22%3A1%2C%22L%22%3A0.2%2C%22R%22%3A0.2%7D'  # {"T":1,"L":0.2,"R":0.2}
sleep 0.5
curl -s 'http://beast.local:5000/js?json=%7B%22T%22%3A1%2C%22L%22%3A0%2C%22R%22%3A0%7D'      # stop
```

**PowerShell:**

```powershell
Invoke-RestMethod 'http://beast.local:5000/js?json=%7B%22T%22%3A1%2C%22L%22%3A0.2%2C%22R%22%3A0.2%7D'  # forward
Start-Sleep -Milliseconds 500
Invoke-RestMethod 'http://beast.local:5000/js?json=%7B%22T%22%3A1%2C%22L%22%3A0%2C%22R%22%3A0%7D'       # stop
```

## Telemetry

Live feedback streams over Socket.IO namespace `/ctrl`: connect, emit `request_data`,
then read `update` events. (`/jsfb` is **not** exposed on this build — use `/ctrl`.) The
feed comes *from* the ESP32, so receiving it proves the lower controller and the Pi↔ESP32
serial link are both alive. Fields arrive as numeric keys; decoded values observed
2026-06-25 (verify the key→name map against the Pi's `config.yaml` before trusting labels):

| Key | Reading | Value seen | Healthy? |
|---|---|---|---|
| `108` | Battery voltage | **11.7 V** | ✅ 3S Li-ion, ~60% (11.1 V nominal) |
| `111` | Wi-Fi RSSI | **−37 dBm** | ✅ excellent |
| `107` | CPU temp | ~53 °C | ✅ normal for Pi 5 |
| `104` / `105` | Track speed L / R | 0.0 / 0.0 | stationary |
| `114` | feedback-OK flag | `true` | ✅ |

## Operating progression (Waveshare's recommended on-ramp)

1. **Web app (`:5000`)** — teleop, FPV, arm/gimbal. Drive it manually. *(done — it drives)*
2. **JupyterLab (`:8888`)** — official lesson notebooks: motion, camera/CV (face/object/line/
   gesture), arm kinematics. This is where you learn to program it.
3. **JSON command API** — `/js?json=` or the `/json` socket. Script motion/arm; this is also
   the integration point if the Hangar ever gains a (supervised) command view.
4. **ROS2 stack** (optional, separate install, port `:5100`) — SLAM, mapping, nav, even
   LLM-driven natural-language control. Bigger jump.

## References

- Waveshare UGV Beast — https://www.waveshare.com/ugv-beast.htm
- `ugv_rpi` (Pi upper-computer code) — https://github.com/waveshareteam/ugv_rpi
- `ugv_base_general` / `ugv_base_ros` (ESP32 lower-computer code) — https://github.com/waveshareteam
