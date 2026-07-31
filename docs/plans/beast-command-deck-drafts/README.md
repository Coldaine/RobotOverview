# BEAST-01 cockpit — draft launch set

**Status: DRAFT for review.** Nothing here is wired into `D:\_projects\ugv_ws` or any
installed ROS package, nothing has been run, and nothing has touched the robot. This is
five files in a scratch folder: `twist_mux.yaml`, `teleop_joy_operator.yaml`,
`foxglove_bridge.launch.py`, `cockpit_robot.launch.py`, and this README. Read the inline
`# VERIFY:` comments in each file before trusting a param name blindly — a few things
(exact button indices on your actual gamepad, whether the installed `foxglove_bridge`
.deb has every parameter used here) can only be confirmed on the real hardware.

## Piece list

| Piece | What it does | Lives on |
|---|---|---|
| `ugv_bringup` (existing, untouched) | Owns `/cmd_vel`, `allow_motion` gate, 0.5 s cmd_vel-timeout watchdog, ESP32 link | Robot (Jetson) |
| `twist_mux` | Arbitrates 4 velocity sources + 1 emergency lock down to one `/cmd_vel` | Robot |
| `foxglove_bridge` | The only network-facing node — WebSocket server, port 8765 | Robot |
| `teleop_twist_joy` (operator instance) | Converts `/joy_operator` (Joy) -> `/cmd_vel_joy_operator` (Twist) | Robot |
| `teleop_twist_joy` + `joy_node` (robot instance, optional) | Same, for a BT gamepad paired directly to the Jetson | Robot |
| Foxglove Studio / Lichtblick | Operator's visualization + Joystick connector + Teleop panel | Any client device |
| Vizanti (later, in-tree) | Second operator UI, web-based | Robot (serves its own ports) + any browser |

Everything in the piece list above except the client apps themselves **runs on the
robot**. No cockpit code runs on the workstation — the workstation only runs an ordinary
web browser or the Foxglove desktop app, both of which are plain WebSocket clients of
`foxglove_bridge`. This matches the existing project stance
(`docs/beast-ops.md`: "The Hangar app records the robot and is not planned as its
control surface" / driving happens with ROS 2 tooling) — this cockpit *is* that ROS 2
tooling, just reachable without an SSH session per command.

## What runs where

```
Robot (Jetson Orin Nano, ROS 2 Humble)
├── beast-ros-base.service (existing) ── ugv_bringup, LiDAR, pan-tilt, EKF, odometry
├── cockpit_robot.launch.py (this draft, run alongside the above)
│   ├── foxglove_bridge ─────────────────── binds 0.0.0.0:8765 (LAN + Tailscale)
│   ├── twist_mux ────────────────────────── -> /cmd_vel
│   ├── teleop_twist_joy (operator) ──────── /joy_operator -> /cmd_vel_joy_operator
│   └── [optional] joy_node + teleop_twist_joy (robot gamepad)
│                                             /joy_robot -> /cmd_vel_joy_robot
└── (later) Vizanti ── serves :5000 web UI + :5001 API, its own process(es)

Client device — Windows / Mac / Linux / a phone browser, doesn't matter which
└── Foxglove Studio (desktop app) or app.foxglove.dev (browser)
    connects to ws://<robot-ip>:8765
    ├── Joystick connector reads a USB/BT gamepad plugged into THIS machine,
    │   republishes it as sensor_msgs/Joy on /joy_operator over the WebSocket —
    │   there is no ROS install, no joy_node, nothing ROS-shaped on this machine
    ├── Teleop panel -> geometry_msgs/Twist on /cmd_vel_ui
    ├── Panels showing /scan, /odom, /imu, /oak/*, /diagnostics, etc. (read-only)
    └── (future) an e-stop button -> std_msgs/Bool on /cmd_vel_estop_lock
```

`<robot-ip>` is whatever's live per `docs/beast-ops.md`'s Network table — LAN
`192.168.0.x` or the Tailscale address `100.107.16.72`. Both already work without
touching this cockpit; foxglove_bridge doesn't care which interface the client arrived
on, it's bound to all of them (`address: 0.0.0.0`).

## The single open port

**8765**, TCP, WebSocket, plaintext (`tls: false`). That is the entire network surface
this draft adds. Nothing else here listens on anything. Firewall guidance (apply on the
robot, out of band — nothing in this repo touches Jetson firewall config):

```bash
sudo ufw allow from 192.168.0.0/24 to any port 8765 proto tcp
# Tailscale traffic is already scoped by tailnet ACLs; no extra ufw rule needed for it
# unless the tailnet itself is opened up beyond this robot's current ACL.
```

Do not expose 8765 beyond LAN + tailnet (no port-forward, no public IP). See the
security-posture comment block at the top of `foxglove_bridge.launch.py` for the full
reasoning, including why the client-publish whitelist is a short exact list rather than
a wildcard.

## Where Vizanti fits later

Vizanti is a separate, self-hosted web UI (ports **5000** web + **5001** API by
Vizanti's own convention) meant to run **in-tree on the robot**, not through
foxglove_bridge's WebSocket protocol — it talks to ROS 2 more directly (its own
node(s) subscribing/publishing like any other ROS node) and serves its own HTTP/WS
ports to a browser. It is not part of this draft; when it lands, the integration point
is exactly the same pattern already established here:

- Vizanti's click-to-drive output publishes `geometry_msgs/Twist` — point it at
  `/cmd_vel_ui`, the same topic the Foxglove Teleop panel already uses, so it inherits
  twist_mux's existing priority-50 slot for free. **Do not** add a new twist_mux source
  entry for Vizanti; reuse `cmd_vel_ui` so the two UI surfaces can never both think
  they have the floor at different priorities.
- Vizanti's pan-tilt / LED controls (if it grows them) should target the same
  `/pt_joint_position_controller/commands` and `/ugv/led_ctrl` topics already in
  `foxglove_bridge.launch.py`'s `client_topic_whitelist` — again, reuse, don't
  duplicate.
- Vizanti will need its own 5000/5001 firewall allowance on LAN + tailnet when it's
  actually deployed, same pattern as the 8765 rule above.
- Net effect: Vizanti becomes a second window onto the exact same arbitrated command
  path, not a second, competing command path. That's the whole point of putting
  twist_mux in front of everything instead of letting each UI talk to `/cmd_vel`
  directly.

## Safety preconditions — read before ever setting `allow_motion:=true`

1. **The `beast-paces` cmd_vel-timeout watchdog re-gate must pass first, on its own,
   with no cockpit code involved.** Per `docs/beast-ops.md` (verified 2026-07-31): the
   ESP32 firmware does **not** auto-stop on command silence — it was physically tested
   and latched a nonzero command for over a minute. `ugv_bringup`'s own 0.5 s
   `cmd_vel_timeout` watchdog is deployed but **not yet live re-tested**
   (`beast-paces` Phase 2 exists specifically to prove it: publish a slow crawl, kill
   the publisher, confirm the tracks stop on their own within ~0.5-1 s with **no**
   stop command sent). Nothing in this cockpit draft changes that requirement or
   substitutes for it — twist_mux and foxglove_bridge sit entirely upstream of
   `ugv_bringup` and have no opinion on whether the watchdog itself works. Run
   `beast-paces` Phase 2 (or re-confirm it already passed) before this cockpit is ever
   used with `allow_motion:=true`.

2. **The deadman here is soft; the Jetson-side watchdog is the real backstop.**
   `require_enable_button: true` in `teleop_joy_operator.yaml` only stops
   *teleop_twist_joy* from emitting a nonzero Twist while the enable button isn't held
   — it protects against a stray stick input, nothing more. It cannot protect against
   the operator's whole client disappearing: a closed laptop lid, a dropped Wi-Fi
   connection, a crashed browser tab, or a network partition on either the LAN or
   Tailscale hop all look identical to twist_mux and to `ugv_bringup` — command
   messages simply stop arriving. twist_mux's own timeouts (0.5 s per source, see
   `twist_mux.yaml`) only decide *arbitration* (whether a lower-priority source can
   take over); they do not send a stop themselves — nothing in twist_mux proactively
   publishes on silence. The only thing in this entire chain that is guaranteed to
   notice silence and act on it is `ugv_bringup`'s `cmd_vel_timeout` watchdog, running
   on the robot, independent of every network path above it. Treat every piece in this
   draft as convenience/arbitration layered on top of that one backstop, never as a
   replacement for it.

3. **The emergency lock (`cmd_vel_estop_lock`, twist_mux priority 255) has no publisher
   yet.** This draft only wires the topic through; nothing currently sits behind a
   Foxglove panel button, a Vizanti control, or any other UI to actually publish
   `std_msgs/Bool` on it. Until something does, that lock is inert — see the detailed
   comment in `twist_mux.yaml` (`locks.estop`) for exactly how it activates once wired,
   and why it's currently configured `timeout: 0.0` (manual toggle only, not a
   heartbeat) specifically so this draft doesn't ship in an accidentally-always-locked
   state before that publisher exists.

4. **`allow_motion` itself lives entirely in `ugv_bringup`, not here.** This cockpit
   never sets it, reads it, or has any way to check its current value. Confirm it via
   the ground-truth commands in `docs/beast-ops.md`'s Quick connect block before
   assuming anything about whether commanded motion will actually move the tracks.
