---
name: beast-paces
description: Put BEAST-01 through its paces — supervised, staged shakedown of the live robot. Use when Patrick says the robot is placed and ready (e.g. "/beast-paces", "put the robot through its paces", "shakedown the beast"). Runs ground-truth checks, the cmd_vel-timeout safety gate, then supervised driving, then returns the robot to its safe locked state and writes results back to the docs.
---

# BEAST-01 shakedown — supervised paces

You are driving a real, physical tracked robot in Patrick's home. He is present and watching.
Every motion step needs his explicit go in chat before you send it. Never skip a phase.
If anything looks wrong at any point — unexpected motion, no telemetry, weird voltage —
**stop commands first, questions second**: send the stop, then investigate.

Connection facts, ground-truth commands, and safety rules live in `docs/beast-ops.md`
(Quick connect block at top). ESP32 serial: `/dev/ttyACM0` by-id in `/etc/beast/ugv.env`.

**Safety reality (physically tested 2026-07-31):** the ESP32 does **not** auto-stop on
command silence — it latches the last velocity indefinitely. The Jetson-side
`ugv_bringup` `cmd_vel_timeout` watchdog (~500 ms → `send_stop_command`) is the gate.
Phase 2 exists to prove that watchdog before any floor driving. Do not enable
`allow_motion:=true` without an active operator stop path.

Prefer running these commands directly over treating this skill as a slash-command ritual.

## Phase 0 — Preflight (no motion possible)

1. `ssh beast-01` — confirm reachable; if not, `ping beast-01.local` for a fresh DHCP lease.
2. Run both ground-truth command blocks from the Quick connect section. Confirm:
   `beast-ros-base.service` active; `/ugv/voltage` publishes a plausible 3S value
   (~9.6–12.6 V — abort below 10.5 V and tell Patrick to charge); `/scan` streaming;
   `/cmd_vel` has 0 publishers.
3. Report a one-screen status summary before anything else.

## Phase 1 — Position check (ask, don't assume)

Ask Patrick which setup he has:
- **Tracks lifted / robot on a box** → preferred for Phase 2 (first watchdog proof).
- **On the floor, clear runway** → Phase 2 may run on the floor only at ≤0.02 m/s with
  Patrick watching; otherwise ask him to lift it.

## Phase 2 — cmd_vel-timeout gate (the safety test)

Only with Patrick's explicit "go":

1. Restart bringup with motion enabled (stop the service, relaunch in a foreground SSH
   session so Ctrl+C is a kill switch):
   ```bash
   sudo systemctl stop beast-ros-base.service
   export UGV_MODEL=ugv_beast LDLIDAR_MODEL=ld19
   source /opt/ros/humble/setup.bash && source ~/beast/ugv_ws/install/setup.bash
   ros2 launch ugv_bringup bringup_lidar.launch.py \
     serial_port:=$(grep UGV_SERIAL_PORT /etc/beast/ugv.env | cut -d= -f2) \
     use_lidar:=true use_rviz:=false allow_motion:=true
   ```
2. In a second SSH session, publish slow forward motion at 5 Hz:
   ```bash
   ros2 topic pub --rate 5 /cmd_vel geometry_msgs/msg/Twist \
     '{linear: {x: 0.02}, angular: {}}'
   ```
   Start at 0.02 m/s; raise only to overcome deadband, never above 0.05 m/s in this phase.
3. With tracks turning steadily, kill the publisher (Ctrl+C) and have Patrick count:
   tracks must stop **on their own within ~0.5–1 s** with no stop command sent
   (Jetson watchdog). Keep an explicit zero **armed to fire after** the observation
   window — never before the crawl (a prior harness bug). Avoid broad `pkill` patterns
   that also kill the restore SSH session.
4. Send an explicit zero afterward (`--once`). Record pass/fail and the observed
   stop delay. **A fail means motion stays locked — return to Phase 5 immediately.**

## Phase 3 — Driving (Patrick's session)

On the floor, runway confirmed clear, Phase 2 passed, Patrick's go given:

- Keyboard teleop from his terminal (or yours, relaying his instructions):
  ```bash
  ros2 run teleop_twist_keyboard teleop_twist_keyboard
  ```
  Reduce speed first (`z` lowers the scale; start ≤0.1 m/s). Short forward/back/turn passes.
- Exercise the pan-tilt through its controller topic (small angles first).
- While driving, sanity-watch `/odom` and `/scan` — odometry should track real motion.

## Phase 4 — Sensor spot-checks (optional, robot stationary)

- One frame from the 5 MP camera (`/dev/video0`) — e.g. `v4l2-ctl --stream-mmap
  --stream-count=1 --stream-to=/tmp/frame.raw` or a cv2 grab; record success/failure.
- OAK-D Lite: note that DepthAI stream verification is still an open item; attempt only if
  time permits.

## Phase 5 — Return to safe state (ALWAYS, even after failures)

1. Ctrl+C the foreground launch; `sudo systemctl start beast-ros-base.service`
   (this restores the boot-default `allow_motion:=false` lock).
2. Verify: service active, `/cmd_vel` publisher count 0, telemetry flowing.
3. Write results back:
   - Update the Quick connect block in `docs/beast-ops.md` (dated) — watchdog result,
     top speeds tried, camera check outcome, any anomalies.
   - Record a durable insight via the hangar-logbook skill / `append_insight` ingest op.
4. Give Patrick a plain-language debrief: what passed, what didn't, what's unlocked next.
