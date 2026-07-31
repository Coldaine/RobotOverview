# BEAST-01 Command Deck — cockpit specification

**Status:** SPEC (approved direction) — 2026-07-31. The visual direction was signed off by the
owner against the design-study mockup (see [Visual language](#visual-language)). Implementation
is sequenced in the companion plan:
[`2026-07-31-beast-command-deck-plan.md`](2026-07-31-beast-command-deck-plan.md).

**Scope decision (owner, 2026-07-31 - Updated):** The Command Deck is a route inside the
Hangar app (`/cockpit`) with on-screen teleop controls implemented in its initial release. The
robot remains motion-locked until the physical safety gates pass and the transport is deliberately
deployed. This decision supersedes the previous "standalone" stance. It implements the Hangar
side of North Star G7; the live portal is not operational until the robot-side deployment lands.

**Device-agnostic by requirement:** the operator seat is *any* device — Windows/Mac/Linux desktop, tablet, or phone on the tailnet. Mobile piloting is a core use case for crawling undercroft spaces.

---

## Architecture

```
                       ┌────────────────────────────── BEAST-01 (Jetson Orin) ─────────────────────────────┐
 Hangar /cockpit ──────┼──▶ rosbridge_websocket :9090 (loopback only; Tailscale Serve terminates WSS)       │
 desktop/tablet/phone  │  ▶ telemetry: scan, odom, voltage, IMU, diagnostics, OAK RGB/depth (jpeg)         │
                       │  ◀ publish globs only: /cmd_vel_ui, PT, LED, e-stop; no services or actions       │
 Vizanti (optional) ───┼──▶ vizanti_server :5000/:5001 (separate surface, same mux)                        │
                       │                                                                                    │
                       │  cmd sources ──▶ twist_mux ──▶ /cmd_vel ──▶ ugv_bringup                            │
                       │                 (priorities +      (allow_motion gate + 0.5 s cmd_vel watchdog)    │
                       │                  0.5 s timeouts)          │                                        │
                       │                                           ▼  JSON @115200 /dev/ttyACM0             │
                       │                                    ESP32 (NO firmware heartbeat — standing gap)    │
                       └────────────────────────────────────────────────────────────────────────────────────┘
```

The cockpit bridge binds only to `127.0.0.1:9090`; Tailscale Serve is the deliberate external
WSS boundary. In this deployment, DDS stays on the robot and rosbridge carries the cockpit
traffic. The bridge admits exact telemetry-subscribe and command-publish globs and removes
rosbridge service/action capabilities; it does not rely on `client_topic_whitelist`.

## Command functions

| Group | Function | Wire |
| --- | --- | --- |
| Safety | E-stop (outranks everything) | twist_mux lock topic, priority 255 — engaged intent republishes every 500 ms; release sends a bounded burst |
| Safety | Motion arm/disarm (deliberate re-gate, never a casual toggle) | `allow_motion` state surfaced; arming gated on beast-paces Phase 2 |
| Safety | Current in-app speed caps | 0.20 m/s linear, 0.40 rad/s angular; no turbo mode |
| Drive | Robot-paired BT gamepad (survives network loss) | `joy_node` on Jetson → `/cmd_vel_joy_robot`, priority 150 |
| Drive | Remote operator keyboard/gamepad rung | existing robot-side tools → `/cmd_vel_joy_operator`, priority 100; `/joy_operator` is not admitted by the current browser bridge |
| Drive | In-app on-screen teleop | `/cmd_vel_ui`, priority 50 |
| Drive | nav2 (Phase F) | `/cmd_vel_nav`, priority 10 |
| Gimbal | Pan/tilt aim (pan ±3.14, tilt −0.523…+1.571 rad) | `Float64MultiArray` → `/pt_joint_position_controller/commands` |
| Gimbal | Steady mode + tilt bias | `/ugv/pt_steady_ctrl` `[mode, y_bias]` |
| Aux | LED brightness ×2 | `/ugv/led_ctrl` `[IO4, IO5]` 0–255 |
| Data | Bag record start/stop (mission / blackbox) | rosbag; storage per the NVMe plan when applied |
| Data | Map save | slam_toolbox serialize + map_saver (Phase E) |
| Autonomy | Click-to-goal, waypoints, cancel, initial pose | deferred cross-repo gap; current topic-only bridge does not expose actions/services or goal topics |

**cmd_vel quirks the cockpit must respect** (from `ugv_bringup.py`, verified in source): after 5
consecutive zero Twists further zeros are dropped; small yaw commands are force-boosted to
±0.2 rad/s — UI sliders must not send tiny non-zero corrections.

## Displays

| Zone | Contents | Source of truth |
| --- | --- | --- |
| Safety strip (always visible, never scrolls) | E-stop; MOTION state; reconstructed active mux source + cmd age + `/cmd_vel` publisher count; watchdog state; pack volts with 10.5 V floor and 8.8 V brownout marks | `/ugv/voltage.voltage` (volts only), `/cockpit/status` observer |
| Spatial | Current: `/scan` with LD19's real 225–315° rear crop and `/odom` pose trail. Deferred: TF, robot model, wheel-vs-rf2o comparison, map, costmaps, path, goals | current `/scan`, `/odom`; deferred topics are outside the closed bridge contract |
| Optics | OAK RGB (jpeg-compressed), OAK depth colorized, 5 MP PT cam; FPS + link-speed chips; later NN detections overlay | `/oak/*`, PT cam launch (gap) |
| Telemetry | Current: voltage sparkline, IMU traces (labeled uncal), diagnostics. Deferred: ops log (`/rosout`) | current `/ugv/voltage`, `/imu/raw`, `/diagnostics`; `/rosout` is outside the closed bridge contract |
| Ops | Recording state + disk free; node/service health; bridge/link health (direct-vs-DERP) | gap publishers, below |
| Honesty rail | SOC% fake (hidden by design) · PT joint feedback = commanded, not measured · IMU uncalibrated, not fused · ESP32 no firmware heartbeat | permanent; per rich-ui rubric, absence must be visible |

## Current topic contract (bridge publish/subscribe globs)

- **Subscribe (out, exhaustive):** `/ugv/voltage`, `/scan`, `/odom`, `/imu/raw`,
  `/cockpit/overhead_clearance`, `/cockpit/status`, `/diagnostics`,
  `/oak/rgb/image_raw/compressed`, `/cockpit/depth/compressed`.
- **Client publish (in, exhaustive):** `/cmd_vel_ui`,
  `/pt_joint_position_controller/commands`, `/ugv/pt_steady_ctrl`, `/ugv/led_ctrl`,
  `/cmd_vel_estop_lock`. Nothing else. Raw image topics are never subscribed uncompressed
  over the bridge (hundreds of Mbps stalls the WebSocket). TF, map, additional odometry,
  robot-description, and browser gamepad topics remain planned gaps and are not implied by
  this closed contract.

## Safety model

1. ESP32 has **no firmware heartbeat** (physically proven 2026-07-31) — the Jetson-side 0.5 s
   `cmd_vel_timeout` watchdog is the only lower backstop and **must pass the beast-paces Phase 2
   live re-gate before any cockpit teleop**.
2. Every command source has a 0.5 s twist_mux timeout; a dead client stops commanding within
   one tick even before the watchdog acts.
3. Network deadman is *soft* — the deadman prevents accidental commands; it does not guarantee
   stop on link loss. The watchdog does.
4. The e-stop lock uses `timeout: 0.0` in twist_mux, while the browser continuously republishes
   engaged intent at 2 Hz and sends a bounded release burst. A disconnected browser cannot claim
   robot confirmation; the UI must distinguish local intent from the separate cockpit-status
   observer's reconstruction of mux state.
5. Motion preconditions, in order: pack ≥ 10.5 V → watchdog re-gate passed → runway confirmed →
   `allow_motion:=true` for the supervised session only → explicit stop + relock afterward.

## Sensor spine (verified 2026-07-31)

OAK-D Lite first light closed the camera cutover gate: RGB 640×480 bgr8 ~16.0 FPS, stereo depth
640×480 `16UC1` ~16.3 FPS aligned to RGB, `USB SPEED: HIGH` (USB 2.0 — a known-USB3 cable into
a direct Orin USB3 port is the pending unlock to SUPER), TF correct from the URDF OAK macro,
5 MP PT cam frame verified, 417 MB baseline bag at `~/beast-acceptance/bags/oak-baseline-20260731`.
Fusion verdict (researched 2026-07-31): **2D SLAM owns the map** (slam_toolbox + LD19 + EKF
odom), **depth owns obstacles** (depthimage_to_laserscan → nav2 obstacle layer; STVL only if
band-scan proves insufficient). RTAB-Map is an offline-on-bags experiment; Isaac ROS is
rejected for this 8 GB board.

## Visual language

The cockpit uses the Hangar's Engineering-HUD system verbatim (`src/app/globals.css` tokens):
void/hull/panel grounds, cyan `#36e0e0` telemetry accent, amber `#ffb020` command/warning
accent, signal ok/warn/crit, JetBrains Mono labels, blueprint grid. Approved design study:
mockup file at [`beast-command-deck-drafts/beast-command-deck.html`](beast-command-deck-drafts/beast-command-deck.html)
(artifact: <https://claude.ai/code/artifact/2876c73f-4e76-44ca-8d41-e32458aefd04>). The mockup
is the blueprint for the in-app `/cockpit` surface.

## Gaps to build (small robot-side publishers)

- tegrastats → CPU/GPU/RAM/temps/power topic (compute panel)
- Wi-Fi RSSI + Tailscale direct-vs-DERP link-health topic
- Recording start/stop service + status topic
- 5 MP PT cam launch integration (v4l2_camera exists in `ugv_vision`, not in default bringup)
- IMU presence probe on this OAK revision (python `depthai`; keep `i_enable_imu: false` until proven)
