# BEAST ROS 2 — custom-drift notepad

Scratch pad for tracking what's ours vs Waveshare's in `robot/beast/ros2_ws` while the
strip-down is executed. Not a plan. Decisions get appended at the bottom as one-liners.

## Baseline

- Vendor baseline (last Waveshare commit, author DUDULRX): `037dfca`
- Fork tip at subtree import: `af1dedd` — 45 custom commits (`git log --oneline --reverse 037dfca..af1dedd`)
- Post-import custom commits on main: `e9c093f`, `179db1b`, `1e65a91`+`feaaeca`, `6ef4a48`, `53cad7d`+`247e4d5` (= `2b691c2`), `f01fa83`
- Drift at import: 132 files, +10,497/−203. Re-audit any time:
  `git diff --stat 037dfca af1dedd` (fork era) · `git log --oneline 1e8a167..HEAD -- robot/beast/ros2_ws` (post-import)

## What's custom (composition)

| Area | Files | ±Lines | What |
|---|---|---|---|
| `ugv_main/ugv_cockpit` (new pkg) | 31 | +5,654 | rosbridge wrapper+globs, twist_mux spine, cockpit_status, safety_monitor interlocks, wire contract, ~2.7k lines tests |
| `ugv_main/beast_power` (new pkg) | 18 | +1,175 | INA219 driver/node, SoC curve, telemetry, tests |
| `ugv_bringup.py`+`base_ctrl.py` (vendor, mod) | 2 | ~+360 | watchdog, allow_motion gate + SetBool service, safety-state pubs, vendor hacks pinned by tests |
| Launch plumbing (vendor, mod) | ~10 | ~+250 | bringup includes mux/monitor/power; nav/slam forward allow_motion; ldlidar port env; gazebo ros_gz |
| Velocity retarget (vendor, mod) | ~16 | ~+200 | joy/keyboard autorepeat + rungs; 10 vision/slam demos → `/cmd_vel_nav`; vizanti teleop JS patch |
| `deploy/` (new) | 15 | +1,071 | 8 systemd units, ugv.env.example, storage env+tests, power_log.py |
| `docs/` (ros2_ws) | 13 | +724 | cockpit.md, command_arbitration.md, BEAST.md, 10 vendor edits |
| CI/build | 6 | +147 | 3 workflows, build scripts |

## Hardware facts (keep regardless of what gets stripped)

1. ESP32 latches last velocity; **no firmware timeout** (stock behavior; no watchdog on our side either — see decisions).
2. ESP32 JSON: `T:13` vel/stop, `T:900` model (`ugv_beast`→3), `T:1001` feedback; IMU scales 8192 LSB/g, 16.4 LSB/dps, 0.15 µT/LSB; odom cm; `v` centivolts (~1.2 % low).
3. Serial `/dev/ttyTHS1` @115200; LD19 on the CP2102 by-id symlink (see `ugv.env.example`).
4. INA219 at `0x41` on `/dev/i2c-7` (verified 2026-08-07). `RSHUNT=0.1 Ω` UNVERIFIED → all current/charging values provisional. smbus2 install status contradictory (README says installed, power_log says absent) — verify live.
5. Two power rails disagree ~0.14 V; moved opposite directions during one charge session (`power_log.py` docstring). Charging detection untrustworthy.
6. rosbridge 2.0.7: unset glob = allow-all; force-appends `/rosapi/*`; glob strings bracketed/single-quote/bare; denials silent to client.
7. twist_mux: output hard-coded `cmd_vel_out`; lock topics VOLATILE (one-shot pub can lose race; lock dies on restart); `timeout: 0.0` = manual toggle.
8. TF: EKF owns `odom→base_footprint`; rf2o `publish_tf: false`; odom_publisher `pub_odom_tf` false. Never two publishers on one transform.

## Defects (2026-08-07 review)

- **H1 crash-runaway**: unguarded callbacks (`led_ctrl`, `pt_steady`, `joint_states`) + bare `main()`; boot stop conditional on `allow_motion` since `179db1b`; `/ugv/led_ctrl` is browser-reachable → remote crash.
- **H2 vizanti landmine**: `vizanti_server.launch.py` = stock rosbridge `0.0.0.0:5001`, no globs, +rosapi. One launch bypasses all cockpit controls.
- **H3 interlocks fail-open**: safety_monitor is a client request; no respawn/heartbeat; bringup doesn't know if it exists.
- **M4** CHARGING_LOCK untrustworthy (facts 4–5). **M5** smbus2 contradiction. **M6** stale comments: twist_mux.yaml (estop glob), rosbridge.launch.py ("five topics", "/imu/data does not exist"), beast-ros-base.service ("zero-motion staging"), power_log.py (voltage "from ugv_bringup").
- **L7** origin allowlist accepts missing Origin; base_ctrl T:13 writes bypass own lock; no respawn on power/monitor nodes.

## Decisions log

- 2026-08-07 — **watchdog: OUT** (owner, emphatic). Robot returns to stock latch behavior; boot stop stays unless owner says otherwise. Autorepeat/mux-starvation hacks become unnecessary.
- 2026-08-07 — "UI is the product" applies to the Hangar web app; the rich cockpit stays. Browser driving, telemetry, and camera are intentional product surfaces.
- 2026-08-07 — `ugv_safety_monitor` and its automatic Ethernet/charging interlocks were removed. The cockpit keeps reporting those states; they do not block motion.
- open — fate of: `beast_power` calibration/trim-down (after M5), vizanti deletion (H2), storage units (separate plan).
