# ugv_cockpit — BEAST-01 Command Deck bridge

Robot-side half of the [Hangar Command Deck](https://hangar.moosegoose.xyz/cockpit).
Exposes BEAST-01's live telemetry and OAK-D optics to the browser cockpit over a
single rosbridge WebSocket, and adds the three derived topics the cockpit needs
that no stock topic provides.

This package adds **no motion path of its own**, but it does stand up the
rosbridge WebSocket the cockpit uses to *publish* command topics (`/cmd_vel_ui`,
gimbal, LED, e-stop lock) — so it owns the boundary that keeps a browser on the
priority-50 mux rung and off `/cmd_vel` entirely. There is no authentication on
that socket. Motion safety rests on four things, in order:

1. the **loopback bind + topic whitelist** in `launch/rosbridge.launch.py`,
2. `twist_mux` arbitration ([Command Arbitration](../../../docs/command_arbitration.md)),
3. `ugv_bringup`'s `allow_motion` gate, and
4. `ugv_bringup`'s 0.5 s `cmd_vel` timeout watchdog.

The full security model, the rosbridge enforcement details, and the
commissioning check that proves the whitelist is live are in
[docs/cockpit.md](../../../docs/cockpit.md). Read that before changing a glob:
every way of getting one wrong fails **silently**.

## What it publishes

| Node | Topic | Purpose |
|---|---|---|
| `depth_colorizer` | `/cockpit/depth/compressed` (`CompressedImage`, JPEG ~6 Hz) | Raw 16UC1 depth (~614 KB/frame) is unusable in a browser; clip → TURBO colormap → JPEG. |
| `overhead_clearance` | `/cockpit/overhead_clearance` (`Float32`, m) | "Will I fit under this duct?" — image-space min on the top depth band. Mission Undercroft's defining question. |
| `cockpit_status` | `/cockpit/status` (`DiagnosticArray`) | Active mux source and command age, `/cmd_vel` publisher count, arming + watchdog state, disk free, Jetson temps, Wi-Fi RSSI. |

`/scan`, `/odom`, `/ugv/voltage`, `/imu/raw`, `/diagnostics`, and
`/oak/rgb/image_raw/compressed` come from `beast-ros-base` + the OAK launch and
are simply carried on the same bridge.

> **`/imu/raw`, not `/imu/data`.** `ugv_bringup` publishes `sensor_msgs/Imu` on
> `imu/raw`; its `imu/data_raw` publisher is commented out and no filter node
> republishes as `imu/data`. Nothing on this robot publishes `/imu/data`.

`cockpit_status` also consumes two topics `ugv_bringup` publishes at 2 Hz —
`/ugv/allow_motion` (`Bool`) and `/ugv/watchdog_state` (`DiagnosticStatus`, keys
`armed` / `fired` / `watching` / `timeout`) — so the cockpit's drive gate reflects
what the robot enforces rather than what the UI last sent. Both are aged out
after 3 s, so a dead `ugv_bringup` decays to "motion locked" instead of latching
a stale "armed".

## Transport

`rosbridge_websocket` on **127.0.0.1:9090** — loopback only, `authenticate: false`,
`use_compression: true`, with an explicit publish/subscribe topic whitelist and
no `rosapi_node`. `tailscale serve` fronts it and is the only path in; it also
provisions the real Let's Encrypt cert so an HTTPS page can open a valid `wss://`
(a plain `ws://` is blocked as mixed content):

```bash
# One-time: enable HTTPS certs for the tailnet in the admin console, then:
sudo tailscale serve --bg --https=443 http://127.0.0.1:9090
# Confirm it survives reboot:
tailscale serve status
```

The cockpit app then points `BEAST_COCKPIT_WS_URL` at
`wss://beast-01.tyrannosaurus-magellanic.ts.net`.

**Do not widen the bind address or a glob without reading
[docs/cockpit.md](../../../docs/cockpit.md).** An unset glob is allow-all, a
double-quoted entry matches nothing, and rosbridge denies publishes *silently* —
the browser's button still looks like it worked. `test/test_cockpit_bridge.py`
is the merge gate on all of it.

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
`beast-ros-base.service`. It ships **disabled**: installing the workspace must
not open a control socket. Install it, then decide separately whether to enable
it.

```bash
sudo install -D -m 0644 deploy/systemd/beast-cockpit.service \
  /etc/systemd/system/beast-cockpit.service
sudo systemctl daemon-reload

sudo systemctl start beast-cockpit.service          # this session only
sudo systemctl enable --now beast-cockpit.service   # every boot — a decision
sudo systemctl disable --now beast-cockpit.service  # close it again

systemctl status beast-cockpit.service
ros2 topic list | grep cockpit   # expect the three /cockpit/* topics
```

Then run the commissioning check in
[docs/cockpit.md](../../../docs/cockpit.md#commissioning-check-prove-the-boundary-is-live):
a broken whitelist is invisible from the browser, so this is the only thing that
distinguishes "enforced" from "looks enforced".

## Dependencies

`rosbridge_server` is an apt package (`ros-humble-rosbridge-suite`) pulled by
`build_first.sh` — confirm it is installed (`ros2 pkg list | grep rosbridge`).
`cv_bridge`, `depthai_ros_driver`, OpenCV, and NumPy are already on the robot.
