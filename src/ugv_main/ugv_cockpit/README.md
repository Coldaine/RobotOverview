# ugv_cockpit — BEAST-01 Command Deck bridge

Robot-side half of the [Hangar Command Deck](https://hangar.moosegoose.xyz/cockpit).
Exposes BEAST-01's live telemetry and OAK-D optics to the browser cockpit over a
single rosbridge WebSocket, and adds the three derived topics the cockpit needs
that no stock topic provides.

This package adds **no motion path**. Drive arbitration (twist_mux) and the
arming service live in their own safety-isolated packages/PRs. It does, however,
stand up the rosbridge WebSocket the cockpit uses to *advertise* command topics
(`/cmd_vel_ui`, gimbal, LED, e-stop lock); motion safety therefore rests on the
base arming gate + the cmd_vel-timeout watchdog and on Tailscale ACLs gating the
bridge — never on this package alone.

## What it publishes

| Node | Topic | Purpose |
|---|---|---|
| `depth_colorizer` | `/cockpit/depth/compressed` (`CompressedImage`, JPEG ~6 Hz) | Raw 16UC1 depth (~614 KB/frame) is unusable in a browser; clip → TURBO colormap → JPEG. |
| `overhead_clearance` | `/cockpit/overhead_clearance` (`Float32`, m) | "Will I fit under this duct?" — image-space min on the top depth band. Mission Undercroft's defining question. |
| `cockpit_status` | `/cockpit/status` (`DiagnosticArray`) | Active mux source, `/cmd_vel` publisher count, disk free, Jetson temps, Wi-Fi RSSI. |

The RADAR (`/scan`), odom, `/ugv/voltage`, `/imu/data`, `/diagnostics`, and
`/oak/rgb/image_raw/compressed` come from `beast-ros-base` + the OAK launch and
are simply carried on the same bridge.

## Transport

`rosbridge_websocket` on **port 9090** (`authenticate: false`,
`use_compression: true`). Bind LAN/tailnet only — **never expose publicly**;
Tailscale ACLs are the access control.

`tailscale serve` provisions the real Let's Encrypt cert so an HTTPS page can
open a valid `wss://` (a plain `ws://` is blocked as mixed content):

```bash
# One-time: enable HTTPS certs for the tailnet in the admin console, then:
sudo tailscale serve --bg --https=443 tcp://localhost:9090
# Confirm it survives reboot:
tailscale serve status
```

The cockpit app then points `BEAST_COCKPIT_WS_URL` at
`wss://beast-01.tyrannosaurus-magellanic.ts.net`.

## Run it

```bash
# Cockpit only (camera + bridge + derived topics); beast-ros-base supplies the rest.
ros2 launch ugv_cockpit cockpit.launch.py use_camera:=true use_bridge:=true

# Bridge alone (telemetry-only, no camera):
ros2 launch ugv_cockpit cockpit.launch.py use_camera:=false
```

The OAK camera is launched **here**, not in `beast-ros-base.service`, so its USB
bandwidth and power are only spent when someone is actually watching.

## Service

`deploy/systemd/beast-cockpit.service` runs the full cockpit `Wants=`/`After=`
`beast-ros-base.service`. Install:

```bash
sudo cp deploy/systemd/beast-cockpit.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now beast-cockpit.service
systemctl status beast-cockpit.service
ros2 topic list | grep cockpit   # expect the three /cockpit/* topics
```

## Dependencies

`rosbridge_server` is an apt package (`ros-humble-rosbridge-suite`) pulled by
`build_first.sh` — confirm it is installed (`ros2 pkg list | grep rosbridge`).
`cv_bridge`, `depthai_ros_driver`, OpenCV, and NumPy are already on the robot.
