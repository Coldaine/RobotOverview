# Plan: BEAST-01 Cockpit Parity & Command Surfaces

**TL;DR**
Deploy the cockpit bridge end-to-end (the one blocker between the finished Hangar cockpit
and a drivable robot), reach verified functional parity with the stock Waveshare web UI
(drive, lights, gimbal, cameras, voltage), rewire the e-stop onto the robot-side latched
authority (`/ugv/set_allow_motion`) — replacing the one-shot volatile-lock publish that can
silently no-op — then extend
the surfaces: light presets, speed control, PT cam feed, snapshots, gamepad, and the OAK-D
spatial overlays. No LLM/agent feature work, no Nav2 goals, no local LLM — this plan is the
human-driven command deck done right.

## Ground truth (refreshed 2026-08-03, third pass — verified against `origin/main` @ `87062a7`)

**Repo topology changed: it is a monorepo now.** PR #153 merged the ROS workspace into
RobotOverview at `robot/beast/ros2_ws/`. The old `Coldaine/ugv_ws` repo is archived
(GitHub no longer resolves it); all robot development happens here. The robot itself still
runs the legacy checkout (`~/beast/ugv_ws` @ `2d1eab7`, per `docs/beast-ops.md` quick
connect 2026-08-03) — **the monorepo cutover is merged but NOT yet deployed to the Jetson.**
`beast-ros-base.service` active, `beast-cockpit.service` inactive on the robot.

**LiDAR and OAK-D Lite survived the merge — verified on `origin/main`:**

- `robot/beast/ros2_ws/src/ugv_else/ldlidar/` — LD19 driver with `bins: 480` and blind-sector
  crop `225°–315°`, defaults env-configurable (`UGV_LIDAR_BINS`, `UGV_LIDAR_ANGLE_CROP_MIN/MAX`
  from `/etc/beast/ugv.env`)
- `robot/beast/ros2_ws/src/ugv_main/ugv_vision/launch/oak_d_lite.launch.py` — OAK-D Lite pipeline
- `robot/beast/ros2_ws/src/ugv_main/ugv_cockpit/` — full cockpit package: `cockpit.launch.py`
  (includes OAK), `rosbridge.launch.py`, `twist_mux.yaml`, `depth_colorizer.py`,
  `overhead_clearance.py`, `safety_monitor.py`, `cockpit_status.py`, `behavior_server.launch.py`
- `robot/beast/ros2_ws/src/ugv_main/beast_power/` — power telemetry package (UPS I2C, undeployed)

**Boot/arm design changed: motion-enabled startup (PR #155, merged 2026-08-03).**
`bringup_lidar.launch.py` now declares `allow_motion` with `default_value='true'`. The robot
boots **motion-enabled**; `ugv_safety_monitor` disarms only when an interlock (Ethernet
carrier / charging) is observed, calling `/ugv/set_allow_motion` (`std_srvs/SetBool`) — still
the sole motion authority in `ugv_bringup`. `interlock_override` exists as a startup-only
maintenance escape hatch (never a service, never default true). **There is no boot-ARM gate
to design around — the earlier "boots disarmed" assumption is dead.**

**The agent path is already on main (PR #157, merged 2026-08-03).** `/agent` surface +
`api/agent/chat` route, `src/server/beast/ros-singleton.ts` (server-side rosbridge client —
subscribes `/ugv/allow_motion`, `/ugv/watchdog_state`, `/ugv/voltage`, `/scan`; action clients
for the stock Nav2 behaviors `/drive_on_heading`, `/spin`, `/backup`), `motion-gate.ts`
(refuses motion intents unless `allow_motion === true` — "physical enforcement stays on the
robot"), model = `BEAST_AGENT_MODEL` via the OpenAI-compatible `beast-ollama` provider. So
there are now TWO rosbridge clients on main — browser (`src/lib/ros/client.ts`, cockpit) and
server (`ros-singleton.ts`, agent) — and **both already anchor on `/ugv/allow_motion` as the
authority. This plan's e-stop rewire aligns the cockpit with the authority the agent and the
robot already share.** Agent feature work itself stays out of scope here.

**Hangar cockpit (on main):** all surfaces built (`SafetyStrip`, `CommandRail`, `SpatialView`,
`OpticsWall`, `TelemetryRow`; note `HonestyRail` exists only on the stale #152 branch), none
verified end-to-end. `src/lib/ros/client.ts` on main has a **one-shot** e-stop publish into
the volatile twist_mux lock (`setEstopLock`/`operatorEngaged`/`/cmd_vel_estop_lock`) — no
heartbeat, no election. That is exactly the silent-failure pattern `twist_mux.yaml` warns
about: a single publish into a VOLATILE subscription can lose the discovery race and the
e-stop does nothing. `/ugv/set_allow_motion` is the latched authority that fixes it.

**Bridge lockdown is already authored on main.** `rosbridge.launch.py` sets `topics_pub_glob`,
`topics_sub_glob`, `services_glob`, `actions_glob`; `cockpit_rosbridge.py` restricts
capabilities. What remains is verification (does `services_glob` cover
`/ugv/set_allow_motion`?) and exposure. `beast-cockpit.service` exists at
`robot/beast/ros2_ws/deploy/systemd/` (ExecStart: `cockpit.launch.py use_camera:=true
use_bridge:=true`, sourcing `/home/beast/beast/RobotOverview/robot/beast/ros2_ws`) — written
for the monorepo layout, not yet enabled on the robot.

**PR #152 (`feat/beast-immobile-agent-session`):** mined by #157 (agent path, topology docs,
probe scripts). What remains on it (plan deletions, BroadcastChannel election, this plan's
first draft at `f136157`) is either superseded or preserved in history. **Close it.**

## Locked decisions

1. **E-stop = robot-side latched service.** The cockpit DISARM button calls
   `/ugv/set_allow_motion` (`{data: false}`); re-arm calls `{data: true}`. Rendered state comes
   only from `/ugv/allow_motion` + `/cockpit/status` interlock fields — never from local
   intent. Main's one-shot publish into the volatile mux lock goes away. Rationale: a single
   publish into a VOLATILE subscription can lose the discovery race (e-stop does nothing) and
   lock state doesn't survive a mux restart (documented in `twist_mux.yaml`); the service flag
   lives in `ugv_bringup` below the mux, gates the serial write itself, and covers every
   command source. It is also the same authority `motion-gate.ts` already enforces for the
   agent — one gate, one truth, every client.
2. **Motion states shown in the UI:** ARMED (default at boot) / DISARMED (operator or
   interlock) / LOCKED (hardware interlock observed: Ethernet or charging). No ARM-from-boot
   flow exists — PR #155 removed it. DISARM is one click, immediate; RE-ARM requires a 2 s
   hold-to-confirm so a dropped click never re-enables motion.
3. **Parity target = stock Waveshare web UI**: live video, joystick + speed slider, LED
   IO4/IO5, PT gimbal, voltage. Hangar deltas to close: PT cam feed (tile is STANDBY),
   variable speed (fixed 0.2 m/s cap today).
4. **Bridge exposure = Tailscale Serve WSS**, with LAN `ws://` as the bring-up fallback.
5. **Out of scope** (next plan): LLM/agent layer, Nav2 action goals, SLAM mapping, UPS I2C
   bench wiring (`beast_power` cutover), leader-follower anything, local LLM on the Nano.

## Architecture after this plan

```text
Hangar /cockpit (Next.js, any network)
  ├─ drive intent 10 Hz ────────────────► /cmd_vel_ui ──► twist_mux(50) ─┐
  ├─ LED / gimbal / steady ─────────────► /ugv/led_ctrl, /pt_..., /ugv/pt_steady_ctrl
  ├─ DISARM / RE-ARM (service call) ────► /ugv/set_allow_motion ─► ugv_bringup serial gate
  └─ mirrors ◄── /scan, /camera/scan, /ugv/allow_motion, /cockpit/status, images
                 WSS via Tailscale Serve → rosbridge :9090 (loopback on Jetson)
Robot guarantees that do NOT depend on the UI:
  cmd_vel_timeout 0.5 s watchdog · ugv_safety_monitor (Ethernet/charge interlocks)
```

## Phase 0 — Monorepo cutover deploy & bridge bring-up (prerequisite to everything)

**Robot deploy (from this repo, `robot/beast/ros2_ws/`):**
1. Cut the Jetson over from legacy `~/beast/ugv_ws` (@ `2d1eab7`) to the monorepo workspace.
   Mechanics are already documented (`docs/beast-control-topology.md`): push here → pull on the
   Jetson (`~/beast/RobotOverview`) → `colcon build` changed packages → restart named units →
   prove → dated beast-ops note. The deployed unit file
   (`robot/beast/ros2_ws/deploy/systemd/beast-cockpit.service`) already sources
   `/home/beast/beast/RobotOverview/robot/beast/ros2_ws/install/setup.bash`. Keep the legacy
   checkout on disk as rollback.
   **Check the systemd unit's launch args during cutover** — it currently passes
   `allow_motion:=false`; the new code defaults `true`. Decide the unit's args deliberately
   (recommend: let the new default stand; interlocks still disarm).
2. Verify ground truth post-cutover: `/scan` ~10 Hz / 480 ranges, `/ugv/allow_motion` true,
   watchdog armed, `ETHERNET_LOCK` appears on `/ugv/safety/status` when the cable is in.
3. Enable + start `beast-cockpit.service` (ExecStart: `cockpit.launch.py use_camera:=true
   use_bridge:=true`); verify `Rosbridge WebSocket server started on port 9090` and loopback
   `ws://127.0.0.1:9090` answers.
4. Verify the bridge lockdown covers the cockpit contract: `rosbridge.launch.py` already sets
   `topics_pub_glob` / `topics_sub_glob` / `services_glob` / `actions_glob`. Confirm
   `services_glob` includes `/ugv/set_allow_motion` and the topic globs cover every entry in
   `client.ts` `ROS_SUBSCRIPTIONS`/`ROS_PUBLICATIONS`; extend the lists if anything is missing.
   The bridge fault rail in the UI will confirm refusals.
5. Tailscale Serve: proxy HTTPS:443 → `localhost:9090` on `beast-01`; verify
   `wss://beast-01.<tailnet>.ts.net` upgrades a WebSocket from the workstation.

**Hangar:**
6. Doppler `homelab`/`dev` (+`prd`): `BEAST_COCKPIT_WS_URL=wss://beast-01.<tailnet>.ts.net`.
   This one variable now feeds BOTH clients — the browser cockpit and the server-side agent
   (`ros-singleton.ts` idles with "bridge_unavailable" without it). Keep a documented LAN
   fallback (`ws://192.168.0.187:9090`) for bench bring-up.
7. Smoke: cockpit loads, connection badge CONNECTED, zero entries in the bridge-fault rail,
   `/scan` points painting, voltage live.

## Phase 1 — Parity: drive, lights, gimbal, cameras + e-stop rewire

**Verify-then-fix each control end-to-end** (robot untethered, pack ≥ 10.5 V, supervised):
1. Drive: WASD + hold-pad at 10 Hz lands on `/cmd_vel`; release → watchdog stop ≤ 0.5 s.
2. LED sliders move IO4/IO5; gimbal drag/center/steady all land. (Types already pinned by
   `ros-client.test.ts`; this is the live confirmation.)
3. **Speed control** (parity gap): slider 0.05–0.5 m/s (default 0.2) scaling
   `LINEAR_STEP`/`ANGULAR_STEP` in `CommandRail.tsx`; display the active cap.
4. **Light presets** (parity-plus): OFF / NAV (64) / FULL (255) per rail + ALL ON / ALL OFF
   master. Sliders stay. Label state "commanded" — `/ugv/led_ctrl` is write-only, no readback.
5. **PT cam feed** (parity gap): add `v4l2_camera` (pattern in `ugv_vision/launch/camera.launch.py`)
   to `cockpit.launch.py` with `image_transport` compressed out at `/pt/image_raw/compressed`;
   add the topic to `ROS_SUBSCRIPTIONS`/`IMAGE_TOPICS`; wire the STANDBY tile in `OpticsWall.tsx`
   through `registerImageCallback`. Verify `/dev/video0` on the robot first (verified present
   2026-07-31, never published).

**E-stop rewire (the client.ts surgery):**
6. `SafetyStrip` e-stop button → DISARM/RE-ARM control calling `/ugv/set_allow_motion`:
   DISARM = `{data: false}` (one click, immediate); RE-ARM = `{data: true}` behind a 2 s
   hold-to-confirm. Rendered state comes only from `/ugv/allow_motion` +
   `/cockpit/status` interlocks (CHARGING/ETHERNET render as LOCKED, overriding ARMED).
7. Extend `rosClient.callService` to track `service_response` by id (today it fire-and-forgets);
   a failed/timeout call renders "DISARM UNCONFIRMED" — never silent.
8. Delete from `client.ts` (main's version): the one-shot `/cmd_vel_estop_lock` publication,
   `ESTOP_*` constants, `operatorEngaged` intent latching, `CockpitClient` beforeunload trap,
   and `releaseHeavyStreams`. Remove the 255 "E-STOP Lock" rung from the ladder UI (robot-side
   mux config stays for CLI operators); the ladder gains an `allow_motion`
   ARMED/DISARMED/LOCKED banner instead.
9. Update `src/__tests__/ros-client.test.ts` + `cockpit-client.test.tsx`: replace one-shot
   e-stop assertions with service-call + confirmation-state tests. Update the cockpit footer /
   honesty copy to match (no `HonestyRail` component on main — fold the copy into whatever
   footer main's cockpit renders).

## Phase 2 — Control surface extensions (UI-only, no new robot capability)

1. **Snapshot**: capture the live frame of any feed to PNG (draw `<img>` → canvas → download).
2. **Fullscreen** per feed tile.
3. **Gamepad drive**: Gamepad API → same drive-intent path as WASD (left stick linear, right
   stick angular, scaled by the speed slider). Show pad-connected chip.
4. **Touch joystick** on the drive pad for mobile (pointer events already in place; replace the
   5-button grid with a drag stick on coarse pointers, keep buttons as fallback).
5. **Connection HUD**: bridge RTT (stamp skew indicator already decoded for images; add a
   1 Hz ping topic echo or rosbridge `time` call), RSSI chip already fed by `/cockpit/status`.
6. Keyboard extras: `Shift` = 2× speed multiplier while held; `Q/E` nudge gimbal pan.

## Phase 3 — OAK-D spatial overlays (extend the optics/spatial surfaces)

Robot side (mostly exists — `cockpit.launch.py` already brings up OAK + depth_colorizer +
overhead_clearance):
1. Add `depthimage_to_laserscan` (`ros-humble-depthimage-to-laserscan`) on
   `/oak/stereo/image_raw` → `/camera/scan` (squashes 3D overhangs to a 2D forward arc).
   Note USB3 cable is PENDING — on USB2 verify bandwidth with RGB + depth + scan live before
   enabling all three; degrade depth rate first.
2. Verify `/cockpit/depth/compressed` + `/cockpit/overhead_clearance` live (nodes exist, unverified).

UI side:
3. **Amber overlay**: subscribe `/camera/scan`, paint OAK points in amber over the cyan LD19
   plot in `SpatialView` — "LD19 = floor truth (cyan), OAK-D = 3D envelope (amber)" legend.
4. **Cat-whiskers HUD**: lateral whiskers driven by nearest LD19 hit per side; forward arc
   whiskers driven by `/camera/scan`; snap to red under a threshold (0.3 m default, tunable).
5. **Threat-horizon ribbon**: absolute-positioned canvas strip over the OAK RGB feed, nearest
   depth per column mapped blue→red (source: `/cockpit/depth/compressed` frame, downsampled
   in-browser; reuse `depth_ops.py` stats if a lighter topic exists).
6. **Stretch (only after 3–5 verified on the live robot)**: topographic proximity isobars on
   `SpatialView`; 2.5D voxel extrusions via Three.js (check `package.json` — add `three` only
   if the stretch tier is started).

## Out of scope (explicit)

- LLM/agent feature work — the scaffolding is already on main (#157: `/agent` surface,
  `ros-singleton.ts`, `motion-gate.ts`, stock-behavior action clients). Extending it is the
  next plan; this one only keeps the cockpit compatible with the same `allow_motion` authority.
- SLAM mapping / `slam_toolbox` / EKF fusion.
- UPS INA219 I2C bench session (`beast_power` cutover) — separate bench session; until then
  `isCharging` stays UNKNOWN-capable and the UI must not fake it.
- Any on-robot LLM/VLM — abandoned.
- PR #152 — mined by #157; close it, do not rebase.

## Risks & mitigations

- **Monorepo cutover is a big-bang robot deploy.** The Jetson moves from a known-running
  legacy checkout to the merged workspace in one step. Mitigate: keep the legacy checkout on
  disk, diff launch args (especially `allow_motion` — unit currently passes `false`, new
  default is `true`), and run the Wave-style ground-truth stamp after restart before any arming.
- **Boot motion-enabled (PR #155) means the robot is armed at boot** unless an interlock
  fires. The cockpit must surface ARMED unambiguously; low voltage is NOT an interlock —
  keep the ≥ 10.5 V session floor as operator discipline in `docs/beast-ops.md`.
- **Tailscale Serve + WSS** is the remaining exposure blocker (globs are already authored —
  Phase 0.4 is verification, not authoring). Mitigate: prove LAN `ws://` first (Phase 0.7
  fallback), then serve; the bridge-fault rail surfaces any glob refusals loudly.
- **Service-call disarm depends on the same socket as everything else.** If the socket dies
  mid-disarm the robot keeps its own guarantees (0.5 s watchdog, safety_monitor interlocks).
  The UI must render UNCONFIRMED, not assume (Phase 1.7).
- **OAK bandwidth on USB2** may not carry RGB + depth + `/camera/scan`. Degrade depth FPS
  before dropping the RGB feed the operator drives on.
- **`/ugv/led_ctrl` is write-only** — light state is "commanded, not confirmed". Label it as
  such; do not invent a readback.

## Validation

- Robot (post-cutover): `ros2 topic hz /scan` (~10 Hz, 480 ranges),
  `ros2 topic echo /ugv/allow_motion --once`,
  `ros2 service call /ugv/set_allow_motion std_srvs/srv/SetBool "{data: false}"` round-trip,
  `ros2 param get /rosbridge_websocket services_glob` covers `/ugv/set_allow_motion`.
- End-to-end (untethered, ≥ 10.5 V, supervised): drive, lights, gimbal, PT feed,
  DISARM/RE-ARM with confirmation, Ethernet-plug → ETHERNET_LOCK auto-disarm visible in UI.
- Repo: `npm run lint`, `npm run typecheck`, updated test suite green
  (`ros-client.test.ts`, `cockpit-client.test.tsx`); robot-side `colcon test` for touched
  packages.
- Each Phase merges as its own PR against this repo; `docs/beast-ops.md` Quick connect
  updated with dated ground truth after any robot session.

## Open questions (resolve during implementation, not blocking)

- Whether `services_glob` in `rosbridge.launch.py` already covers `/ugv/set_allow_motion`
  (read the file; if not, add it — one line).
- `/camera/scan` crop angles for the OAK forward arc (tune against the live scan, same
  discipline as the LD19 wedge — verify with `ros2 topic echo`, then trust).
