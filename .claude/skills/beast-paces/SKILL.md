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
(Quick connect block at top). ESP32 serial: always resolve it from `UGV_SERIAL_PORT` in
`/etc/beast/ugv.env` — a stable `/dev/serial/by-id/...` path. It currently enumerates as
`/dev/ttyACM0`, but never hardcode that.

**Safety reality (physically tested 2026-07-31 — `docs/beast-ops.md` is the owner of this
fact):** the ESP32 does **not** auto-stop on command silence. It latches the last velocity
indefinitely; the recorded test saw ~1 m of creep continue for minutes after the publisher
was killed. As of that test `ugv_bringup.py` was purely event-driven with **no** `cmd_vel`
timeout, and the "3-second stale-command watchdog" does not exist in the flashed firmware.
**Assume there is NO automatic stop.**

Phase 2 is the gate that proves a Jetson-side `cmd_vel_timeout` watchdog — but only once one
has actually been added to `ugv_bringup`. Confirm in Phase 0 that such a watchdog is really
implemented before you run Phase 2. If it is not, **stop: do not enable `allow_motion:=true`**
— there is nothing to prove and nothing to catch a runaway. Never enable motion without an
independent operator stop path already staged and running.

Prefer running these commands directly over treating this skill as a slash-command ritual.

## Phase 0 — Preflight (no motion possible)

1. `ssh -o ConnectTimeout=10 beast-01` — confirm reachable, with a bounded timeout so preflight
   cannot hang. If it fails, follow the network recovery steps in `docs/beast-ops.md`. Do not
   expect `ping beast-01.local` to fix addressing: it only tests reachability over mDNS and
   does **not** renew a DHCP lease.
2. Run both ground-truth command blocks from the Quick connect section. Confirm:
   `beast-ros-base.service` active; `/ugv/voltage` publishes a plausible 3S value
   (~9.6–12.6 V — abort below 10.5 V and tell Patrick to charge); `/scan` streaming;
   `/cmd_vel` has 0 publishers.
3. Confirm the **motion lock itself**. Service state and a zero publisher count are only
   snapshots — neither proves motion is locked. Find the bringup node (`ros2 node list`) and
   read its motion flag (`ros2 param get <node> allow_motion`); `false` is the only pass. If
   the parameter cannot be read, or reads anything else, the robot stays locked: report that
   and stop. Do not proceed to Phase 2 and do not report a clean preflight.
4. Confirm whether a `cmd_vel` timeout watchdog is actually implemented in `~/beast/ugv_ws`
   (the source is not in this repo, so it must be checked live). Tell Patrick what you found.
   No watchdog → Phase 2 does not run; say so and stop after the status summary.
5. Report a one-screen status summary before anything else.

## Phase 1 — Position check (ask, don't assume)

Ask Patrick which setup he has:
- **Tracks lifted / robot on a box** → preferred for Phase 2 (first watchdog proof).
- **On the floor, clear runway** → Phase 2 may run on the floor only at ≤0.02 m/s with
  Patrick watching; otherwise ask him to lift it.

## Phase 2 — cmd_vel-timeout gate (the safety test)

Only with Patrick's explicit "go", and only if Phase 0 step 4 confirmed a `cmd_vel` timeout
watchdog actually exists. The runbook's own lifted-track procedure in `docs/beast-ops.md` is
the authority on this test — the steps below are the supervised wrapper around it, not a
second copy of the expected timing. Take the pass/fail threshold from the runbook.

1. **Stage the independent stop path first — before motion is possible at all.** In a third SSH
   session, have this exact command typed and ready, not yet run, and leave that session
   untouched for the whole phase:

   ```bash
   ros2 topic pub /cmd_vel geometry_msgs/msg/Twist \
     '{linear: {x: 0.0, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.0}}' \
     --once -w 1
   ```

   Confirm Patrick also has a hardware cut (chassis power switch) within reach. Do not continue
   until both are true.
2. Restart bringup with motion enabled (stop the service, relaunch in a foreground SSH
   session so Ctrl+C is a kill switch):

   ```bash
   sudo systemctl stop beast-ros-base.service
   export UGV_MODEL=ugv_beast LDLIDAR_MODEL=ld19
   source /opt/ros/humble/setup.bash && source ~/beast/ugv_ws/install/setup.bash
   ros2 launch ugv_bringup bringup_lidar.launch.py \
     serial_port:=$(grep UGV_SERIAL_PORT /etc/beast/ugv.env | cut -d= -f2) \
     use_lidar:=true use_rviz:=false allow_motion:=true
   ```

   From here on, if that launch exits or crashes, or the SSH session drops, the robot is left
   with no boot service and possibly a latched velocity. Fire the staged stop, then run Phase 5
   in a fresh session before anything else.
3. In a second SSH session, publish slow forward motion at 5 Hz:

   ```bash
   ros2 topic pub --rate 5 /cmd_vel geometry_msgs/msg/Twist \
     '{linear: {x: 0.02}, angular: {}}'
   ```

   Start at 0.02 m/s; raise only to overcome deadband, never above 0.05 m/s in this phase.
4. With tracks turning steadily, kill the publisher (Ctrl+C) and have Patrick count out loud
   from zero. The tracks must stop **on their own**, with no stop command sent.
   **Observation deadline: 2 s.** The instant the count passes 2 s — or if you cannot clearly
   see the tracks stop — fire the staged stop from step 1 and call the test FAILED. Never fire
   the zero before the crawl (a prior harness bug). Avoid broad `pkill` patterns that would
   also kill the restore SSH session.
5. Send the staged explicit zero regardless of outcome. Record pass/fail and the observed stop
   delay. **A fail — including a deadline expiry — means motion stays locked: go straight to
   Phase 5 and do not run Phase 3.**

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

Run this even if the launch died on its own or the SSH session dropped — in that case open a
fresh session and start at step 1 anyway.

1. Ctrl+C the foreground launch if it is still running; `sudo systemctl start
   beast-ros-base.service` (this restores the boot-default `allow_motion:=false` lock).
2. Verify, in this order: service active; the bringup node's `allow_motion` parameter reads
   `false` again (same check as Phase 0 step 3); `/cmd_vel` publisher count 0; telemetry
   flowing. If `allow_motion` cannot be confirmed `false`, say so plainly, treat the robot as
   unsafe, and do not report a clean finish.
3. Write results back:
   - Update the Quick connect block in `docs/beast-ops.md` (dated) — watchdog result,
     top speeds tried, camera check outcome, any anomalies.
   - Record a durable insight via the hangar-logbook skill / `append_insight` ingest op.
4. Give Patrick a plain-language debrief: what passed, what didn't, what's unlocked next.
