# BEAST ROS 2 custom drift — inventory, strip-down, and controlled re-implementation

Status: **inventory complete; safety-monitor strip landed; remaining reduction is still open.**
Written: 2026-08-07, after a full skeptical review of the ROS 2 stack (findings in §3).

This plan supersedes the robot-side parts of
[2026-07-31-beast-command-deck-plan.md](2026-07-31-beast-command-deck-plan.md): the cockpit
safety spine it built is largely *unwanted* (owner decision 2026-08-07) and is scheduled for
removal here, not further gating.

## 0. What this plan is

The Waveshare vendor workspace (`waveshareteam/ugv_ws`, vendored as a subtree at
`robot/beast/ros2_ws`) accumulated 45 custom commits before and after its import into this
monorepo. The owner wants every custom change **documented** (this file), the unwanted ones
**stripped**, and only the hardware-forced minimum **re-implemented** — in a controlled,
verifiable sequence, not a bonfire.

## 1. Baseline and how to re-derive the inventory

- Vendor baseline (last Waveshare commit, author DUDULRX): **`037dfca`**
- Fork tip at subtree import: **`af1dedd3d828ca39d530f4ff7f8e90b5bfb23fd4`** (45 custom
  commits: `git log --oneline --reverse 037dfca..af1dedd`)
- Post-import custom commits on `main`: `e9c093f`, `179db1b`, `1e65a91`+`feaaeca`,
  `6ef4a48`, `53cad7d`+`247e4d5` (squashed as `2b691c2`), `f01fa83` (pip bump)

Drift at import: **132 files, +10,497 / −203 lines** (`git diff --stat 037dfca af1dedd`).
To audit the drift at any later time:

```bash
# fork-era drift (tree lived at repo root then — no pathspec):
git diff --stat 037dfca af1dedd3d828ca39d530f4ff7f8e90b5bfb23fd4
# post-import drift (subtree path):
git log --oneline 1e8a167..HEAD -- robot/beast/ros2_ws
```

Total custom surface ≈ **10.5k lines**. Composition:

| Area | Files | ±Lines | What it is |
|---|---|---|---|
| `src/ugv_main/ugv_cockpit` (new package) | 31 | +5,654 | rosbridge wrapper + globs, `twist_mux` spine config/launch, `cockpit_status`, `safety_monitor` interlocks, wire contract, ~2.7k lines of tests |
| `src/ugv_main/beast_power` (new package) | 18 | +1,175 | INA219 driver/node, SoC curve, telemetry, tests |
| `ugv_bringup.py` + `base_ctrl.py` (vendor file, modified) | 2 | ~+360 | cmd_vel silence watchdog, `allow_motion` gate + `/ugv/set_allow_motion` service, safety-state publishers, telemetry-honesty docs, vendor hacks (zero-drop, yaw deadband) pinned by tests |
| Launch plumbing (vendor, modified) | ~10 | ~+250 | `bringup_lidar` includes mux/monitor/power; nav/slam forward `allow_motion`; ldlidar port env knobs; gazebo ros_gz deps |
| Velocity-source retarget (vendor, modified) | ~16 | ~+200 | ugv_tools joy/keyboard autorepeat + rung topics; 10 ugv_vision/ugv_slam demos repointed `/cmd_vel` → `/cmd_vel_nav`; vizanti teleop JS spine migration |
| `deploy/` (new) | 15 | +1,071 | 8 systemd units (ros-base, cockpit, storage×4, blackbox/mission record), `ugv.env.example`, storage env + tests, `diagnostics/power_log.py` |
| `docs/` (ros2_ws) | 13 | +724 | `cockpit.md` (417), `command_arbitration.md` (174), `BEAST.md`, 10 vendor doc edits |
| CI / build | 6 | +147 | `.github/workflows` ×3, build script + requirements edits |

## 2. Hardware facts that must survive any strip

These are claims extracted from the custom commits. They are **not all verified**:
each item is tagged `[code-verified]` if it is supported by source/config in this
repository or vendored upstream source, or `[doc-claim-unverified]` if it is inherited
from documentation, prior-session notes, or stale observations and still needs live
verification. Only `[code-verified]` items can be treated as ground truth; the rest are
hypotheses to be checked before demolition.

1. `[doc-claim-unverified]` **ESP32 latches its last velocity; no firmware timeout.**
   This is the central claim behind the AI-added `cmd_vel` silence watchdog. The live
   test 2026-08-07 re-armed the robot, sent `/cmd_vel_ui` angular.z = 0.2 rad/s for 2 s,
   and watched `/cmd_vel` return to zero — but no encoder feedback was observable remotely
   (`/odom/odom_raw`, `/odom_wheel`, and `/joint_states` wheel positions stayed silent/zero),
   so **the underlying hardware question remains unresolved.** A physical, wheels-up
   observation is still required.
2. `[code-verified]` **ESP32 JSON `T:13` velocity, `T:13 0,0` stop; `T:900` model select
   (`ugv_beast`→3); `T:1001` feedback with IMU LSB scales (ICM-20948: 8192 LSB/g,
   16.4 LSB/dps, 0.15 µT/LSB), `odl/odr` in cm, `v` in centivolts (~1.2 % low vs INA219).**
   Verified by reading the ESP32 firmware source and the `ugv_bringup` parsing code; the
   ~1.2 % INA219-vs-centivolts discrepancy is a live observation that needs retesting.
3. `[code-verified]` **Serial: `/dev/serial/by-id/usb-1a86_USB_Single_Serial_5B5E130201-if00`
   @ 115200 on Jetson** (env `UGV_SERIAL_PORT`). **LiDAR: LD19 on the by-id CP2102 symlink**
   (`ugv.env.example` carries the exact path). Both paths are checked into repo configuration;
   live path presence should still be confirmed before relying on them.
4. `[code-verified]` **INA219 at `0x41` on `/dev/i2c-7`** (`0x40` is the LeoRover
   default and wrong). Config reset value `0x399F`. **`RSHUNT = 0.1 Ω` is UNVERIFIED** —
   all current/charging values are provisional until measured. Live probe 2026-08-07 confirmed
   the part responds (`i2cdetect -y -r 7` shows `0x41`, config register reads `0x399F`), and
   `smbus2` imports cleanly for the `beast` user. `/ugv/voltage` is currently published by
   `ugv_bringup` (a fixed-ish BatteryState); `beast_power` is installed but not running because
   the cutover prepared 2026-08-07 was never deployed.
5. `[doc-claim-unverified]` **Two power rails disagree**: ESP32-side and INA219-side sit
   ~0.14 V apart and moved in opposite directions during one charging session (see
   `power_log.py` docstring). Charging detection is not yet trustworthy. This is a stale
   observation embedded in a code comment, not a current measurement.
6. `[code-verified]` **rosbridge 2.0.7 behaviors**: unset glob = allow-all; force-appends
   `/rosapi/*` to any non-`None` `services_glob`; glob strings must be bracketed,
   single-quoted-or-bare, one string; denials are silent to the client. Verified by reading
   `rosbridge_server` source.
7. `[code-verified]` **twist_mux behaviors**: output topic is hard-coded `cmd_vel_out`; lock
   topics subscribe VOLATILE (one-shot publishes can lose the discovery race; lock does not
   survive restart); `timeout: 0.0` = manual toggle only. Verified by reading `twist_mux`
   source.
8. `[code-verified]` **TF topology**: EKF (`robot_localization`) owns `odom→base_footprint`
   (`publish_tf: true`); rf2o has `publish_tf: false`; `odom_publisher` `pub_odom_tf`
   defaults false. Do not let two nodes publish the same transform. Verified from launch and
   parameter files in the workspace.

## 3. Defects found in the 2026-08-07 review

Carry-across or kill-list for execution. Full detail in the session record; compressed here.

- **H1 — crash-runaway.** `ugv_bringup` callbacks raise on malformed input
  (`led_ctrl_callback`/`pt_steady_ctrl_callback` index unguarded; `joint_states_callback`
  `name.index`), `main()` has no guard, and since `179db1b` the boot stop only fires when
  `allow_motion` is false. Crash while driving → ESP32 keeps last velocity; restart comes up
  armed and never clears it. `/ugv/led_ctrl` is browser-reachable, so this is remotely
  triggerable.
- **H2 — vizanti landmine.** `vizanti_server.launch.py` starts stock rosbridge on
  `0.0.0.0:5001` with no globs + `rosapi_node`. One launch bypasses every cockpit control.
- **H3 — interlocks are fail-open.** `ugv_safety_monitor` is a client-side request with no
  respawn, no heartbeat; bringup neither knows nor cares if it exists.
- **M4 — CHARGING_LOCK untrustworthy** (facts 4–5 above; threshold `0.05 A` is a guess).
- **M5 — smbus2 contradiction** (fact 4). **Resolved live 2026-08-07:** `smbus2`
  imports cleanly for the `beast` user (`/home/beast/.local/lib/python3.10/site-packages/smbus2`).
  The contradiction was stale doc drift, not a real dependency gap.
- **M6 — stale safety comments** in `twist_mux.yaml` (claims estop lock still
  browser-admitted), `rosbridge.launch.py` ("five topics", "`/imu/data` does not exist" —
  both false), `beast-ros-base.service` description ("zero-motion staging" on an armed boot),
  `power_log.py` (`/ugv/voltage` "from ugv_bringup").
- **L7** — origin allowlist accepts missing `Origin` header; `base_ctrl` T:13 writes bypass
  its own lock; `power_node`/`safety_monitor` have no respawn; mux estop lock's ≥1 Hz client
  contract is unenforceable docs.

## 4. Decisions required from the owner (execution blockers)

| # | Question | Options | Default if unanswered |
|---|---|---|---|
| D1 | **Hangar UI driving.** Stripping `ugv_cockpit`'s rosbridge removes the browser's only path to the robot. | **Keep the rich cockpit and restricted bridge** | decided |
| D2 | **twist_mux spine.** Keep the 4-rung mux, or collapse to a single `/cmd_vel` input on the new bridge node? | keep / collapse | collapse (fewer moving parts) |
| D3 | **`allow_motion` kill-switch.** Keep any software disarm, or is "no commands sent" + watchdog enough? | **Keep simple SetBool** | decided |
| D4 | **beast_power.** Keep (telemetry, standalone) or drop with the apparatus? | Keep (telemetry, standalone) | **keep and deploy** (M5 verified; INA219 live-confirmed) |
| D5 | **Storage stack** (4 units + tests, `#2–#5` fork PRs) and blackbox/mission record units. In scope of this strip? | keep / strip / separate plan | separate plan (out of scope here) |
| D6 | **vizanti + vendor web app.** Delete from tree, or quarantine behind a wrapper with cockpit-equivalent globs? | **Delete Vizanti launch entry points; keep package only if a consumer requires it** | decided |
| D7 | **Vendor demo retargets** (`/cmd_vel_nav` repoints, joy/keyboard autorepeat). Needed at all, or revert with the vendor files? | keep teleop only / revert all | open |
| D8 | **`cmd_vel` watchdog.** Keep the AI-added silence watchdog, or return to the stock ESP32 latch behavior? | **Remove watchdog; keep boot stop** | decided |

## 5. Execution phases

Each phase ends green on CI (`beast-ros-spine`, `beast-power-tests` while those packages
exist) and, when robot-facing, the ground-truth checks in `docs/beast-ops.md` Quick connect
— which must be updated, dated, at the end of any phase that touches the robot (AGENTS.md
rule).

**Phase 0 — Freeze (this doc + tag).**
- [x] Commit this plan; `git tag beast-pre-strip` at the pre-strip main tip.
- [x] Record the live power/telemetry facts and smbus2 state in `docs/beast-ops.md` Quick connect.
- [x] Record the current owner decisions in §4; D7 remains open.

**Phase 1 — Minimal bridge node (the only re-implementation).**
- [ ] New node (working name `beast_base`, ~200 lines, in a new small package or inside a
      trimmed `ugv_bringup`): serial open (`/dev/ttyTHS1`), `T:13`/`T:900`/`T:1001`
      handling per fact 2, **unconditional stop at startup**, no AI-added cmd_vel silence
      watchdog per D8, malformed-input-proof callbacks, guarded `main()`.
      Carries facts 1–3; fixes H1 by construction. Vendor hacks (zero-drop, yaw deadband)
      are **deleted, not preserved** — validate driving feel on the bench.
- [ ] Per D3: `SetBool` motion gate, default armed, stop-on-disable. No interlocks, no
      monitor, no arming ceremony.
- [ ] Tests: stop sent at boot; garbage frames don't raise; gate rejects non-zero when
      disarmed. Plain pytest, no AST-string pinning.
- [ ] Bench verify: crawl + kill test documents the stock ESP32 latch behavior, and a
      restart confirms the unconditional boot stop.

**Phase 2 — Strip.**
- [x] Delete the safety monitor and automatic Ethernet/charging interlock machinery; keep
      the cockpit/bridge and manual SetBool gate per D1/D3.
- [ ] Delete per D6/D7: Vizanti entry points, unwanted vendor web-app includes, and
      unapproved vendor retargets.
- [ ] Revert vendor files to `037dfca` state except the retargets D7 keeps:
      `git checkout 037dfca -- <path>` per file, then re-apply kept deltas.
- [x] Correct the base service description and build path for the retained power package.
- [ ] Rewrite the remaining deployment/docs surface after D6/D7 and the final bridge decision.

**Phase 3 — Verify + shrink-proof.**
- [ ] Drift audit: `git diff --stat 037dfca HEAD` (subtree) shows only the intended keep-set;
      paste the summary into the PR description.
- [ ] Robot ground-truth: node list, drive test, kill test, boot test, `/ugv/voltage`
      present iff D4 kept. Update Quick connect (dated).
- [ ] This plan is then **deleted** (executed plans are not archived — git is the archive);
      lasting facts promoted into `docs/beast-ops.md` / `robot/beast/ros2_ws/README.md`.

## 6. Rollback

Everything pre-strip is recoverable: `beast-pre-strip` tag, the full fork history in the
subtree (`037dfca..af1dedd`), and this doc's inventory. Rollback = revert the strip PR(s),
restart `beast-ros-base.service` from the previous commit, re-run Phase 3 robot checks.
