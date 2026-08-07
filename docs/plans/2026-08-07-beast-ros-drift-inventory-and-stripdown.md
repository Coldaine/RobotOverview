# BEAST ROS 2 custom drift — strip-down work order (Phase 1–3)

Status: **Phase 2 partial.** The safety apparatus and the cmd_vel watchdog were stripped
in place by [#174](https://github.com/MooseGooseConsulting/RobotOverview/pull/174)
(squashed as `7e86feb`, merged 2026-08-07). Vizanti is **neutralized, not deleted**; the
Phase 1 `beast_base` extraction and the Phase 2 deletion of the remaining vendor surface are
still open. Written: 2026-08-07, after a full skeptical review of the ROS 2 stack (defects
in §3).

This is a **work order**, not a record of reasoning: it names inputs, what to do, what to
emit, and how to tell when each phase is done. **Code is truth** — if this document and the
code disagree, the code is right and this document is stale; update it, don't preserve it.

This plan supersedes the robot-side parts of
[2026-07-31-beast-command-deck-plan.md](2026-07-31-beast-command-deck-plan.md): the cockpit
safety spine it built was largely unwanted (owner decisions, §4) and has been removed or
neutralized, not further gated.

## 0. What this is

The Waveshare vendor workspace (`waveshareteam/ugv_ws`, vendored as a subtree at
`robot/beast/ros2_ws`) accumulated custom commits before and after its import into this
monorepo. The owner's goal: every custom change **documented** (inventory below), the
unwanted ones **stripped**, and only the hardware-forced minimum **re-implemented** — in a
controlled, verifiable sequence, not a bonfire.

The in-place trim (#174) proved the keep-set. The remaining work:

- **Phase 1 (this plan's next PR):** extract the keep-set out of the vendor `ugv_bringup.py`
  into a new `beast_base` package so `ugv_bringup.py` can revert to stock `037dfca`, and
  remove the web/cockpit consumers of the deleted `/ugv/watchdog_state` topic.
- **Phase 2:** delete `vizanti` (266 files, 5 packages) and `ugv_web_app`, revert the 12
  demo retargets to vendor, fix the references, and update the surviving tests.
- **Phase 3:** drift audit + robot ground-truth checklist; promote lasting facts; **delete
  this plan** (executed plans are not archived — git is the archive).

Each phase ships as its own PR. Every robot-facing merge is deployed the same day via
`robot/beast/ros2_ws/deploy/deploy-to-beast.sh` (user runs it; it needs robot sudo), and the
Quick connect block in `docs/beast-ops.md` is updated, dated, at the end of any phase that
touches the robot (AGENTS.md rule).

## 1. Baseline and how to re-derive the inventory

- Vendor baseline (last Waveshare commit, author DUDULRX): **`037dfca`** — tree lives at
  the **repo root** of that commit, *not* under `robot/beast/ros2_ws`. This is why
  subtree-prefixed pathspecs against `037dfca` silently no-op (see §5 Phase 2).
- Fork tip at subtree import: **`af1dedd3d828ca39d530f4ff7f8e90b5bfb23fd4`** (45 custom
  commits: `git log --oneline --reverse 037dfca..af1dedd`)
- Subtree import commit: **`1e8a167`**
- Post-import custom commits on `main`: `e9c093f`, `179db1b`, `1e65a91`+`feaaeca`,
  `6ef4a48`, `53cad7d`+`247e4d5` (squashed as `2b691c2`), `f01fa83` (pip bump),
  `7e86feb` (#174, the in-place strip)
- Pre-strip tag: **`beast-pre-strip`** (rollback point, §6)

Drift at import: **132 files, +10,497 / −203 lines** (`git diff --stat 037dfca af1dedd`).
To audit the drift at any later time:

```bash
# fork-era drift (tree lived at repo root then — no pathspec):
git diff --stat 037dfca af1dedd3d828ca39d530f4ff7f8e90b5bfb23fd4
# post-import drift (subtree path):
git log --oneline 1e8a167..HEAD -- robot/beast/ros2_ws
```

Current custom surface vs vendor ≈ **10.5k lines**, composed of:

| Area | Files | ±Lines | What it is |
|---|---|---|---|
| `src/ugv_main/ugv_cockpit` (new package) | 31 | +5,654 | rosbridge wrapper + globs, `twist_mux` spine config/launch, `cockpit_status`, wire contract, ~2.7k lines of tests |
| `src/ugv_main/beast_power` (new package) | 18 | +1,175 | INA219 driver/node, SoC curve, telemetry, tests |
| `ugv_bringup.py` + `base_ctrl.py` (vendor file, modified) | 2 | ~+360 | **Phase 1 moves the keep-set out of here**; watchdog/zero-drop/yaw-deadband already deleted in #174 |
| Launch plumbing (vendor, modified) | ~10 | ~+250 | `bringup_lidar` includes mux/power; nav/slam forward `allow_motion`; ldlidar port env knobs; gazebo ros_gz deps |
| Velocity-source retarget (vendor, modified) | ~16 | ~+200 | ugv_tools joy/keyboard autorepeat + rung topics (**KEPT**, D7); 12 demo retargets to `/cmd_vel_nav` (**REVERT in Phase 2**, D7); vizanti teleop JS spine migration |
| `deploy/` (new) | 15 | +1,071 | 8 systemd units (ros-base, cockpit, storage×4, blackbox/mission record), `ugv.env.example`, storage env + tests, `diagnostics/power_log.py` |
| `docs/` (ros2_ws) | 13 | +724 | `cockpit.md` (417), `command_arbitration.md` (174), `BEAST.md`, 10 vendor doc edits |
| CI / build | 6 | +147 | `.github/workflows` ×3, build script + requirements edits |

## 2. Hardware facts that must survive any strip

Tagged `[code-verified]` if supported by source/config in this repository or vendored
upstream, `[doc-claim-unverified]` if inherited from documentation or stale observations and
still needs live verification. Only `[code-verified]` items are ground truth.

1. `[live-verified]` **ESP32 latches its last velocity; no firmware timeout.**
   Proven 2026-08-07 evening (`.tmp/beast_latch_test.py`): crawl at 0.15 m/s,
   publisher killed mid-crawl with no zero burst (mux timed out, `beast_base`
   sent nothing) → `/odom/odom_raw` accumulated **+0.81 m during 5 s of command
   silence**, and the owner physically watched the robot keep driving into a
   wall until an explicit zero burst stopped it. An earlier same-day test was
   inconclusive (no encoder feedback remotely observable); the evening test had
   a live odom stream, which was the difference. **Consequence:** an explicit
   T:13 stop is the only halt — the unconditional boot stop, stop-on-disarm,
   and explicit zero bursts after any drive burst are all load-bearing, and
   killing a publisher is never a stop.
2. `[code-verified]` **ESP32 JSON `T:13` velocity, `T:13 0,0` stop; `T:900` model select
   (`ugv_beast`→3); `T:1001` feedback with IMU LSB scales (ICM-20948: 8192 LSB/g,
   16.4 LSB/dps, 0.15 µT/LSB), `odl/odr` in cm, `v` in centivolts (~1.2 % low vs INA219).**
   Verified by reading the ESP32 firmware source and the `ugv_bringup` parsing code; the
   ~1.2 % INA219-vs-centivolts discrepancy is a live observation that needs retesting.
3. `[code-verified]` **Serial: `/dev/serial/by-id/usb-1a86_USB_Single_Serial_5B5E130201-if00`
   @ 115200 on Jetson** (env `UGV_SERIAL_PORT`). **LiDAR: LD19 on the by-id CP2102 symlink**
   (`…5970075705` → `ttyACM1`). Live probe 2026-08-07 confirmed the by-id ESP32 path.
   **`deploy/systemd/ugv.env.example` still carries the stale `/dev/ttyTHS1`** — must be
   fixed to the by-id path in Phase 1 (§5). The `ttyTHS1` fallback in
   `default_serial_port()` is a code fallback only; the env file is the deployed truth.
4. `[code-verified]` **INA219 at `0x41` on `/dev/i2c-7`** (`0x40` is the LeoRover default and
   wrong). Config reset value `0x399F` (= datasheet reset value; the part is genuine but
   unconfigured). **`RSHUNT = 0.1 Ω` is UNVERIFIED** — amps stay provisional until a
   multimeter measurement at the barrel jack (Phase 3, owner-assisted). Live probe
   2026-08-07: part responds, `smbus2` imports cleanly for the `beast` user.
   `/ugv/voltage` is owned by `beast_power` since the 2026-08-07 cutover (#171) — `ugv_bringup`
   no longer publishes BatteryState. The cutover is **not yet deployed** to the robot.
5. `[doc-claim-unverified]` **Two power rails disagree**: ESP32-side and INA219-side sit
   ~0.14 V apart and moved in opposite directions during one charging session (see
   `power_log.py` docstring). Charging detection is not yet trustworthy. Stale observation
   embedded in a code comment — re-verify live before trusting it (Phase 3).
6. `[code-verified]` **rosbridge 2.0.7 behaviors**: unset glob = allow-all; force-appends
   `/rosapi/*` to any non-`None` `services_glob`; glob strings must be bracketed,
   single-quoted-or-bare, one string; denials are silent to the client.
7. `[code-verified]` **twist_mux behaviors**: output topic is hard-coded `cmd_vel_out`; lock
   topics subscribe VOLATILE (one-shot publishes can lose the discovery race; lock does not
   survive restart); `timeout: 0.0` = manual toggle only. The mux estop lock stays
   configured for CLI operators over SSH, never for the browser.
8. `[code-verified]` **TF topology**: EKF (`robot_localization`) owns `odom→base_footprint`
   (`publish_tf: true`); rf2o has `publish_tf: false`; `odom_publisher` `pub_odom_tf`
   defaults false. Do not let two nodes publish the same transform.

## 3. Defect register — status after #174

Compressed from the 2026-08-07 review; full detail in the session record. Status is current
as of `7e86feb`; re-verify against the code before relying on it.

- **H1 — crash-runaway: FIXED IN PLACE (#174).** `ugv_bringup` callbacks warn+drop on
  malformed input instead of raising (`joint_states_callback` length + missing-joint guard;
  `led_ctrl_callback` / `pt_steady_ctrl_callback` length guard), `main()` is guarded
  (`try/spin` + `finally`), and the boot stop is now **unconditional** (sent immediately
  after serial open, regardless of `allow_motion`). **Phase 1 must preserve all of this in
  `beast_base` by construction** — behavioral tests, no string pinning.
- **H2 — vizanti landmine: NEUTRALIZED, NOT DELETED.** `vizanti_server.launch.py` and
  `vizanti_rws.launch.py` no longer start stock rosbridge/rws on `0.0.0.0:5001` with no
  globs + `rosapi_node` — they log a deprecation warning and do nothing, and
  `ugv_web_app/launch/bringup.launch.py` no longer includes them. The vizanti packages
  (**266 files: `vizanti`, `vizanti_msgs`, `vizanti_cpp`, `vizanti_server`,
  `vizanti_demos`**) and `ugv_web_app` are still in the tree. **Deletion is Phase 2.** Until
  then the deprecation warnings are the only trace.
- **H3 — interlocks fail-open: DONE.** `ugv_safety_monitor` package deleted (#174) — the
  automatic Ethernet/charging interlocks are gone. The cockpit keeps only the manual
  `/ugv/set_allow_motion` SetBool gate (a *service*, restart-surviving; no client liveness
  contract to fail open).
- **D8 — cmd_vel silence watchdog: DONE.** `cmd_vel_timeout`, `_cmd_vel_watchdog_*`,
  `/ugv/watchdog_state`, and the 2 Hz ceremony are removed; the zero-drop and yaw-deadband
  hacks are deleted, not preserved; the boot stop is unconditional. Web and cockpit
  consumers of `/ugv/watchdog_state` were **deliberately left in place** (#174) and render
  UNKNOWN honestly — **removing them is Phase 1 scope** (anchor list in §5 Phase 1).
- **M4 — CHARGING_LOCK untrustworthy: superseded.** The lock lived in the deleted safety
  monitor; the `0.05 A` threshold died with it. Remaining: **`RSHUNT` and charging
  sign/threshold need a multimeter + live charge-watch in Phase 3** (facts 4–5).
- **M5 — smbus2 contradiction: RESOLVED LIVE 2026-08-07.** `smbus2` imports cleanly for the
  `beast` user (`/home/beast/.local/lib/python3.10/site-packages/smbus2`); the contradiction
  was stale doc drift. Phase 3 re-verifies the INA219 end-to-end on the deployed tree.
- **M6 — stale safety comments: PARTIALLY CLEARED.** The `beast-ros-base.service`
  description ("zero-motion staging") and `power_log.py` docstring were fixed by #174/earlier.
  Still stale and on the **Phase 1 sweep list**: `twist_mux.yaml` (claims the 0.5 s
  `cmd_vel_timeout` watchdog still exists), `rosbridge.launch.py` + `ugv_cockpit/README.md`
  + `test_cockpit_bridge.py` ("`/imu/data` does not exist" — false since #174's
  `ugv_bringup.py` publishes `imu/data`), and any residual "0.5 s watchdog" copy in
  `CommandRail.tsx` / `HonestyRail.tsx` / cockpit launch docstrings.
- **L7 — legacy notes, mostly moot.** The unset-origin allowlist is **intentional**
  (decided 2026-08-07 — tailnet is the perimeter, #165). `base_ctrl` T:13 writes bypassing
  a lock, `power_node`/`safety_monitor` missing respawn, and the unenforceable mux estop
  lock contract all described apparatus that no longer exists or is CLI-only by decision.
  Nothing to do.

## 4. Owner decisions — all decided 2026-08-07

| # | Question | Decision | Status |
|---|---|---|---|
| D1 | Hangar UI driving | **Keep the rich cockpit and restricted bridge.** | decided — keep |
| D2 | twist_mux spine | **Keep the 4-rung mux** (consequence of D1+D7: `cmd_vel_joy_robot` 150, `cmd_vel_joy_operator` 100, `cmd_vel_ui` 50, `cmd_vel_nav` 10). | decided — keep |
| D3 | `allow_motion` kill-switch | **Keep the simple SetBool gate**: parameter + `/ugv/set_allow_motion` service, default armed, stop-on-disable, idempotent. No interlocks, no monitor, no ceremony. | decided — keep |
| D4 | beast_power | **Keep and deploy** (telemetry, standalone; M5 verified, INA219 live-confirmed). | decided — deploy with next robot merge |
| D5 | Storage stack + blackbox/mission record units | **Separate plan** — out of scope here. | decided — out of scope |
| D6 | vizanti + vendor web app | **Delete from tree** (interim: neutralized via no-op launch files). | decided — Phase 2 |
| D7 | Vendor demo retargets | **Keep teleop, revert demos.** `ugv_tools` joy/keyboard (`teleop_twist_joy.launch.py`, `joy_ctrl.py`, `keyboard_ctrl.py` — mux rungs 150/100, autorepeat, `ZERO_TAIL_LIMIT=5`) STAY. The **12 demo repoints revert to vendor**: 8 in `ugv_vision/ugv_vision/` (`apriltag_track.py`, `color_ball_track.py`, `color_line_follow.py`, `face_track.py`, `gesture_ctrl.py`, `oak_color_ball_track.py`, `oak_object_track.py`, `roarm_color_line_follow.py`), 3 in `ugv_slam/ugv_slam/` (`lidar_follow.py`, `lidar_guard.py`, `lidar_obstacle_avoidance.py`), plus `ugv_tools/ugv_tools/behavior_ctrl.py`. | decided — keep teleop, revert demos (Phase 2) |
| D8 | `cmd_vel` watchdog | **Remove; keep the boot stop.** | DONE in-place (#174) |
| **NEW** | Operator-facing capability strip | **None.** `beast_base` keeps T:132 LED, T:133 gimbal `joint_states`, T:137 PT-steady, T:3 OLED, low-battery voice. Everything dropped (watchdog, interlocks, zero-drop, yaw deadband) was custom apparatus, not a shipped capability. | decided |

## 5. Execution phases

Each phase ends green on CI (`beast-ros-spine`, plus the web test suite for Phase 1's
`src/` changes) and, when robot-facing, passes the ground-truth checks in `docs/beast-ops.md`
Quick connect — updated, dated, at the end of any such phase (AGENTS.md rule). Each phase is
**its own PR**; robot-facing merges deploy same-day via `deploy-to-beast.sh` (user runs it;
needs robot sudo), Quick connect updated dated after deploy.

### Phase 1 — extract `beast_base` (the drift escape) — PR #1 of this plan

**Goal.** The in-place trim proved the keep-set inside the vendor file. Move it out into a
new package so `ugv_bringup.py` can revert to stock `037dfca`, and delete the web/cockpit
consumers of the removed watchdog.

**New package: `robot/beast/ros2_ws/src/ugv_main/beast_base`** (~400–450 lines — the old
~200-line sketch predates the keep-everything decision; this is the corrected size). A
normal ament_python package (package.xml, setup.py, resource, entry point `beast_base`).

**Carry table** — verified against the current `ugv_bringup.py` (all of these move, behavior
preserved; they are the *entire* keep-set):

| Item | Source of truth (current file) |
|---|---|
| Serial open via `UGV_SERIAL_PORT` env (by-id path), @115200 | `default_serial_port()` + `BaseController(serial_port, baud_rate)` |
| T:131 enable command at startup | `{"T":131,"cmd":1}` |
| T:900 model select | `set_ugv_version()` — `ugv_beast`→3 |
| T:13 velocity + stop | `cmd_vel_callback` / `send_stop_command` |
| T:1001 feedback → `/imu/data` (+`/imu/raw` same-payload alias) + `/imu/mag` + `/odom/odom_raw` | `feedback_loop_thread` → `publish_imu_data_raw` / `publish_imu_mag` / `publish_odom_raw` |
| REP-145 gate: `orientation_covariance[0] = -1.0` | **Load-bearing.** `odom_publisher` (subscribes `odom/odom_raw`) and the EKF starve without it; keep the covariance diagonals as-is. |
| T:132 LED aux sub | `led_ctrl_callback` (`/ugv/led_ctrl`) |
| T:133 gimbal aux sub | `joint_states_callback` (`/joint_states`, missing-joint guard + degrees conversion, sends `T:133`) |
| T:137 PT-steady aux sub | `pt_steady_ctrl_callback` (`/ugv/pt_steady_ctrl`) |
| T:3 OLED thread | `ip_thread_func` — Wi-Fi/eth IP lines (`lineNum` 1/0) + low-battery `V:` line (`lineNum` 2) |
| Low-battery voice | `check_low_battery` / `_maybe_low_battery_warning` — ESP32 `v` (centivolts, ~1.2 % low) gates `spd-say 'low battery'` + OLED line. **Do not publish BatteryState** — `/ugv/voltage` is beast_power's. |
| `allow_motion` param + `/ugv/set_allow_motion` SetBool | Default armed; **stop-on-disable** (stop sent immediately on the true→false edge); **idempotent** (no-op flip, no duplicate stop); both service and `parameter:allow_motion` paths apply it |
| `/ugv/allow_motion` Bool TRANSIENT_LOCAL | **Published AFTER the unconditional boot stop — the ordering is load-bearing** (a publisher create can raise; telemetry must never precede safing). TRANSIENT_LOCAL latch **plus a 1 Hz heartbeat of the same latched value**: the latch alone was tried first and failed live 2026-08-07 — `cockpit_status` judges bringup liveness by message freshness (`BRINGUP_STALE_S` = 3 s), so a once-at-boot sample aged out and the cockpit reported `allow_motion` UNKNOWN permanently. The heartbeat is that liveness signal; late subscribers still get the latched value from durability. |
| Malformed-input-proof callbacks | All callbacks warn+drop instead of raising (H1). |
| Guarded `main()` | `try: rclpy.spin` / `finally: destroy_node + shutdown`. |

**Drops (already gone in place — do NOT re-add):** cmd_vel silence watchdog,
`/ugv/watchdog_state`, 2 Hz ceremony, zero-drop and yaw-deadband hacks.

**Optional line item (nice-to-have, include if cheap):** non-enforcing
`/ugv/ethernet_connected` Bool from `UGV_ETHERNET_INTERFACE` carrier state. Restores the
tether diagnostic lost with the safety monitor and answers a #174 review comment. Must not
gate anything.

**Web-side watchdog-consumer removal (Phase 1 scope — the topic is gone; these render
UNKNOWN honestly today and must be cleaned):**

- `src/lib/ros/client.ts` — `ROS_SUBSCRIPTIONS` entry for `/ugv/watchdog_state`,
  `watchdogArmed`/`watchdogFired` state, the `/ugv/watchdog_state` parse case, and the
  direct-vs-aggregator `watchdogDirectAt` branches (render UNKNOWN honestly until removed).
- `src/server/beast/ros-singleton.ts` — `STATUS_TOPICS`, `/ugv/watchdog_state` `handleTopic`
  case, `watchdogArmed`/`watchdogFired` state + `lockReason` framing.
- `src/server/beast/types.ts` — `watchdogArmed`/`watchdogFired` fields.
- `src/server/beast/tools.ts` — watchdog mention in the read-snapshot tool description.
- `src/components/cockpit/SafetyStrip.tsx` — the "cmd_vel watchdog" cell.
- `src/components/cockpit/CommandRail.tsx` + `HonestyRail.tsx` — the "0.5 s watchdog is the
  guarantee / lower backstop" copy (now false; reword to the ESP32 latch + boot-stop reality
  or drop).
- `robot/beast/ros2_ws/src/ugv_main/ugv_cockpit/ugv_cockpit/cockpit_status.py` — watchdog
  entry (`DIAG_WATCHDOG` diagnostics item, `_on_watchdog`, `_watchdog_status`).
- `robot/beast/ros2_ws/src/ugv_main/ugv_cockpit/ugv_cockpit/cockpit_contract.py` —
  `WATCHDOG_STATE_TOPIC`, `DIAG_WATCHDOG`, `KEY_ARMED`, `KEY_FIRED`.
- `robot/beast/ros2_ws/src/ugv_main/ugv_cockpit/launch/rosbridge.launch.py` —
  `TOPICS_SUB_GLOB`: drop `/ugv/watchdog_state`; also fix the stale "/imu/data does not
  exist" comment (now false).
- Tests and fixtures: `src/__tests__/ros-client.test.ts`, `src/__tests__/ros-singleton.test.ts`,
  and the watchdog fixtures/expectations in the safety-strip / command-rail / agent-tools
  tests (`safety-strip.test.tsx`, `command-rail.test.tsx`, `agent-tools.test.ts`).

**Launch/service deltas:**

- `robot/beast/ros2_ws/src/ugv_main/ugv_bringup/launch/bringup_lidar.launch.py` — point
  `bringup_node` at package `beast_base` / executable `beast_base`; **keep** the
  `serial_port`, `baud_rate`, `wifi_interface`, `ethernet_interface`, `allow_motion`
  parameters. The `odom_publisher` node (still in `ugv_bringup`) and EKF blocks stay.
- `robot/beast/ros2_ws/deploy/systemd/beast-ros-base.service` — `ExecStart` launch package
  `ugv_bringup` → `beast_base` (same `bringup_lidar.launch.py` entry).
- `robot/beast/ros2_ws/deploy/systemd/ugv.env.example` — `UGV_SERIAL_PORT` must be the by-id
  path `/dev/serial/by-id/usb-1a86_USB_Single_Serial_5B5E130201-if00`, not `/dev/ttyTHS1`.
- Stale-comment sweep (M6): `ugv_cockpit/config/twist_mux.yaml` (lines ~31–33, 72–74 — the
  "0.5 s cmd_vel_timeout watchdog" claims), `ugv_cockpit/README.md` (~38–41 — the
  "`/imu/raw`, not `/imu/data`" claim), `rosbridge.launch.py` (~109–111), and any residual
  "0.5 s watchdog" docstrings in the cockpit launch files / `behavior_server.launch.py`.
  (`ugv_cockpit/package.xml`'s description carries no `/imu/data` claim — verify before
  touching.)
- `ugv_bringup` **package stays** as the home of `bringup_lidar.launch.py`, configs, and
  `odom_publisher`. The reverted stock `ugv_bringup.py` node module is **deleted** (unused
  once the launch points at `beast_base`).

**Tests (Phase 1):** behavioral pytest for `beast_base` only — boot stop unconditional;
garbage frames don't raise; gate rejects non-zero when disarmed **and** sends a stop;
re-arm sends nothing; idempotent flip; feedback fan-out publishes (`/imu/data`,
`/imu/mag`, `/odom/odom_raw`). **No AST-string pinning.** CI: update the
`.github/workflows/beast-ros-spine.yml` safety-gate file list — it currently pins
`ugv_bringup/test/test_jetson_safety.py` (the bringup tests move with the package to
`beast_base`).

**Done when:** `beast_base` carries the full keep-set (per the table above) with behavior
preserved; `bringup_lidar.launch.py` and `beast-ros-base.service` launch `beast_base`; the
now-unused `ugv_bringup.py` node module is **deleted** from `ugv_bringup` (launch,
configs, and `odom_publisher` stay); `ugv.env.example` carries the by-id serial path; CI
(web + spine) green; no `/ugv/watchdog_state` consumer left in `src/` or `ugv_cockpit`.

**Bench protocol (user-supervised, after deploy):**

1. Crawl around; **browser DISARM mid-crawl** — robot stops immediately (stop-on-disable).
2. **Reboot** (or restart `beast-ros-base.service`) — robot stays stopped (unconditional
   boot stop), `/ugv/allow_motion` latches the gate.
3. **Joystick drives** via rung 150 (`cmd_vel_joy_robot`); keyboard rung 100.
4. **LED + gimbal from cockpit** (T:132 / T:133 / T:137 round-trips).
5. Rates sane: `/imu/data` + `/odom/odom_raw` at expected cadence; EKF `/odom` alive.
6. Update `docs/beast-ops.md` Quick connect (dated) with any facts that changed.

### Phase 2 — strip the remainder — PR #2 of this plan

**Goal.** Delete the neutralized vizanti/web-app surface and revert the demo retargets.

**Delete:** `robot/beast/ros2_ws/src/ugv_else/vizanti/` (266 files; packages `vizanti`,
`vizanti_msgs`, `vizanti_cpp`, `vizanti_server`, `vizanti_demos`) and
`robot/beast/ros2_ws/src/ugv_main/ugv_web_app/`.

**Fix references:**

- `robot/beast/ros2_ws/build_common.sh` (~21–25 vizanti list, ~38 `ugv_web_app`)
- `robot/beast/ros2_ws/build_first.sh` (~210 vizanti list, ~218 `ugv_web_app`)
- Subtree docs: delete `robot/beast/ros2_ws/docs/web_app.md` whole; strip vizanti/web-app
  mentions from `packages.md`, `index.md`, `bringup.md`, `mapping.md`, `navigation.md`,
  `teleoperation.md`, `experimental.md`; fix `command_arbitration.md` (~30, the "Vizanti's
  teleop widget" rung note); remove the Web App nav entry from `robot/beast/ros2_ws/mkdocs.yml`
  (~31).
- Repo-root `docs/beast-ops.md` — the "Existing separate surfaces remain Vizanti
  `:5100`/`:5001`" line (currently ~401; was mis-referenced as 358). Keep the
  `ugv_chat_ai`/MediaMTX surfaces; drop the Vizanti mention.

**Revert the 12 demo retargets to vendor** (D7 — demos go back to stock `/cmd_vel`;
`behavior_ctrl.py` goes back to stock too):

```bash
# Run INSIDE robot/beast/ros2_ws. Pathspecs are SUBTREE-RELATIVE because 037dfca's
# tree lives at the repo root of that commit, NOT under robot/beast/ros2_ws.
# QUIRK: a subtree-prefixed pathspec (robot/beast/ros2_ws/src/...) does not exist in
# 037dfca, so git silently treats it as unmatched — the diff shows the whole file as
# ADDED and `git checkout` errors "did not match". From the repo root, a relative
# pathspec would also write into the web app's root src/ — never do that.
for f in \
  src/ugv_main/ugv_vision/ugv_vision/apriltag_track.py \
  src/ugv_main/ugv_vision/ugv_vision/color_ball_track.py \
  src/ugv_main/ugv_vision/ugv_vision/color_line_follow.py \
  src/ugv_main/ugv_vision/ugv_vision/face_track.py \
  src/ugv_main/ugv_vision/ugv_vision/gesture_ctrl.py \
  src/ugv_main/ugv_vision/ugv_vision/oak_color_ball_track.py \
  src/ugv_main/ugv_vision/ugv_vision/oak_object_track.py \
  src/ugv_main/ugv_vision/ugv_vision/roarm_color_line_follow.py \
  src/ugv_main/ugv_slam/ugv_slam/lidar_follow.py \
  src/ugv_main/ugv_slam/ugv_slam/lidar_guard.py \
  src/ugv_main/ugv_slam/ugv_slam/lidar_obstacle_avoidance.py \
  src/ugv_main/ugv_tools/ugv_tools/behavior_ctrl.py ; do
  git checkout 037dfca -- "$f"
done
```

**Verify the first revert landed before proceeding** (the quirk makes silent no-ops
possible): `git status --short` must show the files modified, and
`git diff 037dfca -- <path>` must be empty for each. **Fallback** if a checkout no-ops:
`git show 037dfca:<subtree-relative-path> > <path>` (also run inside
`robot/beast/ros2_ws`).

**Keep (do not revert):** `ugv_tools` teleop trio (`launch/teleop_twist_joy.launch.py`,
`ugv_tools/joy_ctrl.py`, `ugv_tools/keyboard_ctrl.py` — mux rungs 150/100, autorepeat,
`ZERO_TAIL_LIMIT=5`); the nav2 remap files (`ugv_nav/launch/nav_bringup/navigation_launch.py`
+ its params yamls — nav2 publishes on `cmd_vel_nav`, never `/cmd_vel`); `bringup_lidar.launch.py`;
the `ugv_cockpit` package.

**Test moves:** `ugv_cockpit/test/test_twist_mux_spine.py` trims the demo-rung mentions
(its retarget-file pin list goes away with the reverts — behavior_ctrl and the
slam/vision files will no longer point at `cmd_vel_nav`); `test_cockpit_bridge.py` topic
list updated (stale `/imu/data` assertions go with Phase 1's sweep);
`test_behavior_server_config.py` stays.

**Done when:** no `vizanti` / `ugv_web_app` / `cmd_vel_nav`-repointed-demo references remain
in the subtree, build scripts, or docs; `git diff 037dfca HEAD -- <subtree-relative>` for
each reverted file is empty; CI green; deploy + Quick connect updated (dated).

### Phase 3 — verify + shrink-proof — PR #3 of this plan

**Goal.** Prove the surviving drift is exactly the keep-set, run the robot ground-truth
checklist, promote lasting facts, and delete this plan.

1. **Drift audit.** The subtree-prefixed pathspec no-ops against `037dfca` (tree lives at
   repo root there) — the whole tree shows as added. Use one of:
   ```bash
   git diff --stat 037dfca HEAD | grep ros2_ws          # from repo root (rename-aware)
   git -C robot/beast/ros2_ws diff --stat 037dfca HEAD -- src   # from inside the subtree
   ```
   Expect only the keep-set to remain custom vs vendor: `beast_base`, `ugv_cockpit`,
   `beast_power`, `deploy/`, `docs/`, `build_common.sh`/`build_first.sh` edits, the teleop
   trio, nav2 remaps, `bringup_lidar.launch.py`, CI. **Paste the summary into the PR.**
2. **Robot ground-truth checklist** (per `docs/beast-ops.md` Quick connect commands):
   node list sane; drive test (joystick rung 150); **kill/boot test** — restart the
   service and confirm the unconditional boot stop; `/ugv/voltage` present (beast_power
   owner); **RSHUNT live verification** (M4) — multimeter at the barrel jack, owner-assisted;
   smbus2 still present for the service user; INA219 config register no longer the factory
   `0x399F` once calibrated.
3. **Promote lasting facts** into `docs/beast-ops.md` (Quick connect, dated) and
   `robot/beast/ros2_ws/README.md`; delete anything that belongs to the strip itself.
4. **DELETE THIS PLAN.** Executed plans are not archived — git is the archive.

**Done when:** the audit pasted into the PR shows only the keep-set; all ground-truth items
pass (owner-assisted ones noted as pending if the owner isn't available); facts promoted;
this file deleted.

## 6. Rollback

Everything pre-strip is recoverable: the `beast-pre-strip` tag, the full fork history in the
subtree (`037dfca..af1dedd`), and this doc's inventory (until Phase 3 deletes it — git
history is the archive). Rollback = revert the strip PR(s), restart
`beast-ros-base.service` from the previous commit, re-run the Phase 3 robot checks.
