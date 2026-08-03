# Plan: BEAST-01 Cockpit Parity & Command Surfaces

**TL;DR**
Deploy the cockpit bridge end-to-end (the one blocker between the finished Hangar cockpit
and a drivable robot), reach verified functional parity with the stock Waveshare web UI
(drive, lights, gimbal, cameras, voltage), rewire the e-stop onto the robot-side latched
authority (`/ugv/set_allow_motion`) and delete the browser heartbeat + tab-election theater,
then extend the surfaces: light presets, speed control, PT cam feed, snapshots, gamepad,
and the OAK-D spatial overlays. No LLM/agent layer, no Nav2 goals, no local LLM — this plan
is the human-driven command deck done right.

## Ground truth (verified this session, 2026-08-03)

**Hangar (`RobotOverview`, branch `feat/beast-immobile-agent-session`)** — all surfaces
already built, none verified end-to-end against the robot:

- `src/app/cockpit/CockpitClient.tsx` — layout, bridge-fault rail, beforeunload trap
- `src/components/cockpit/SafetyStrip.tsx` — e-stop button, motion state, watchdog, mux source, voltage bar
- `src/components/cockpit/CommandRail.tsx` — WASD/hold-pad drive at 10 Hz, LED sliders (IO4/IO5), gimbal drag/center/steady, mux ladder
- `src/components/cockpit/SpatialView.tsx` — LD19 cyan plot, blind-sector wedge, zoom
- `src/components/cockpit/OpticsWall.tsx` — OAK RGB + depth feeds live; PT cam tile STANDBY (no publisher)
- `src/components/cockpit/TelemetryRow.tsx` — voltage/IMU sparklines, diagnostics ticker, REC button disabled (no robot service)
- `src/lib/ros/client.ts` — rosbridge client with staleness model, ~350 lines of e-stop heartbeat + BroadcastChannel election (to be deleted, Phase 1)

**Robot (`ugv_ws`)** — deployed HEAD `bebb86e` on `beast/pr1-safety-spine`:

- `ugv_bringup.py` — `allow_motion` dynamic gate (boots `false`), `cmd_vel_timeout` 0.5 s watchdog
- `/ugv/set_allow_motion` — `std_srvs/SetBool` service, latched robot-side (ugv_bringup.py:152). **This is the e-stop authority.**
- `/ugv/allow_motion`, `/ugv/watchdog_state`, `/ugv/safety/status` — latched status topics
- `ugv_safety_monitor` — auto-disarms on Ethernet carrier (ETHERNET_LOCK)
- `ugv_cockpit` — twist_mux spine (`twist_mux.yaml`), `rosbridge.launch.py`, `cockpit.launch.py` (includes OAK pipeline, depth_colorizer, overhead_clearance), `cockpit_status.py`
- `ugv_vision/launch/camera.launch.py` — v4l2_camera pattern for the PT cam (not wired into cockpit)
- `beast-cockpit.service` — installed, **disabled**; rosbridge `:9090` commissioned loopback once, then stopped
- Tailscale Serve — **no serve config** (the documented blocker)
- Open PRs to reconcile: #11 (safety spine = robot HEAD), #12 (behaviors, `2d1eab7`), beast_power PRs (`beast/power-telemetry`, `beast/power-telemetry-on-cockpit` — local checkout HEAD `bf6507b`)

## Locked decisions

1. **E-stop = robot-side latched service.** Button calls `/ugv/set_allow_motion` (SetBool).
   Confirmation comes from the `/ugv/allow_motion` topic, never from local intent. The 2 Hz
   heartbeat, BroadcastChannel election, writer state, beforeunload trap, and keep-socket-alive
   machinery in `client.ts` are deleted. Rationale: twist_mux lock topics are VOLATILE and
   don't survive mux restart (documented in `twist_mux.yaml` comments); the service flag lives
   in `ugv_bringup` below the mux and gates the serial write itself — it also covers the BT pad.
2. **Parity target = stock Waveshare web UI**: live video, joystick + speed slider, LED IO4/IO5,
   PT gimbal, voltage. Hangar deltas to close: PT cam feed (tile is STANDBY), variable speed
   (fixed 0.2 m/s cap today).
3. **Bridge exposure = Tailscale Serve WSS**, with LAN `ws://` as the bring-up fallback.
4. **Boot flow is disarmed.** Robot boots `allow_motion:=false`; the cockpit must render
   DISARMED prominently and gate ARM behind a hold-to-confirm. This replaces "E-STOP" as the
   primary motion authority control: the states are ARMED / DISARMED / LOCKED(hardware).
5. **Out of scope** (next plan): LLM/agent layer, Nav2 action goals, SLAM mapping, UPS I2C
   bench wiring (`beast_power` cutover), leader-follower anything, local LLM on the Nano.

## Architecture after this plan

```text
Hangar /cockpit (Next.js, any network)
  ├─ drive intent 10 Hz ────────────────► /cmd_vel_ui ──► twist_mux(50) ─┐
  ├─ LED / gimbal / steady ─────────────► /ugv/led_ctrl, /pt_..., /ugv/pt_steady_ctrl
  ├─ ARM/DISARM (service call) ─────────► /ugv/set_allow_motion ─► ugv_bringup serial gate
  └─ mirrors ◄── /scan, /camera/scan, /ugv/allow_motion, /cockpit/status, images
                 WSS via Tailscale Serve → rosbridge :9090 (loopback on Jetson)
Robot guarantees that do NOT depend on the UI:
  cmd_vel_timeout 0.5 s watchdog · ugv_safety_monitor (Ethernet/charge locks) · boot disarmed
```

## Phase 0 — Repo reconciliation & bridge deployment (prerequisite to everything)

**ugv_ws:**
1. Reconcile open PRs into one lineage on `beast/jetson-orin-nano-adaptation`: #11 (safety spine,
   robot HEAD) first, #12 (behaviors) rebased on top, close/supersede redundant beast_power PRs
   (keep `beast/power-telemetry-on-cockpit` content, one PR). Merge.
2. Deploy to robot (`~/beast/ugv_ws`), `colcon build` the changed packages, restart
   `beast-ros-base.service`.
3. Enable + start `beast-cockpit.service`; verify `Rosbridge WebSocket server started on port 9090`
   and loopback `ws://127.0.0.1:9090` answers.
4. Author the rosbridge glob whitelist in `rosbridge.launch.py`: exactly the topics/services in
   `client.ts` `ROS_SUBSCRIPTIONS`/`ROS_PUBLICATIONS` plus service `/ugv/set_allow_motion`
   (`services_glob`). The bridge fault rail in the UI will confirm refusals.
5. Tailscale Serve: proxy HTTPS:443 → `localhost:9090` on `beast-01`; verify
   `wss://beast-01.<tailnet>.ts.net` upgrades a WebSocket from the workstation.

**RobotOverview:**
6. Doppler `homelab`/`dev` (+`prd`): `BEAST_COCKPIT_WS_URL=wss://beast-01.<tailnet>.ts.net`.
   Keep a documented LAN fallback (`ws://192.168.0.187:9090`) for bench bring-up.
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
6. `SafetyStrip` button → ARM/DISARM control calling `/ugv/set_allow_motion`:
   DISARM = `{data: false}` (one click, immediate); ARM = `{data: true}` behind a 2 s
   hold-to-confirm. Rendered state comes only from `/ugv/allow_motion` +
   `/cockpit/status` locks (CHARGING/ETHERNET override ARMED).
7. Extend `rosClient.callService` to track `service_response` by id (today it fire-and-forgets);
   a failed/timeout call renders "DISARM UNCONFIRMED" — never silent.
8. Delete from `client.ts`: e-stop heartbeat timers, `ESTOP_*` constants, BroadcastChannel
   election (`claimEstopWriter`/`probeEstopWriter`/`resetEstopElection`), writer state in
   `estop-store`, `CockpitClient` beforeunload trap + keep-socket-alive + `releaseHeavyStreams`
   (~350 lines). Remove the `/cmd_vel_estop_lock` publication and the 255 "E-STOP Lock" rung
   from the ladder UI (robot-side mux config stays for CLI operators; the UI ladder gains an
   `allow_motion` ARMED/DISARMED banner instead).
9. Update `src/__tests__/ros-client.test.ts` + `cockpit-client.test.tsx`: delete election/heartbeat
   tests, add service-call + confirmation-state tests. `HonestyRail` copy updated to match.

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

- LLM/agent runtime, tool vocabulary, Nav2 action goals, `nav2_behavior_server` wiring — next plan.
- SLAM mapping / `slam_toolbox` / EKF fusion.
- UPS INA219 I2C bench session (`beast_power` cutover) — separate bench session; until then
  `isCharging` stays UNKNOWN-capable and the UI must not fake it.
- Any on-robot LLM/VLM — abandoned.

## Risks & mitigations

- **Tailscale Serve + WSS + globs** is the documented blocker. Mitigate: prove LAN `ws://`
  first (Phase 0.7 fallback), then serve; the bridge-fault rail surfaces glob refusals loudly.
- **Boot-disarmed every power cycle.** The cockpit must make DISARMED unmissable (banner +
  disabled drive) or every session starts with "robot broken" confusion. Phase 1.6 covers it.
- **Service-call e-stop depends on the same socket as everything else.** If the socket dies
  mid-disarm the robot keeps its own guarantees (0.5 s watchdog, safety_monitor locks). The UI
  must render UNCONFIRMED, not assume (Phase 1.7).
- **OAK bandwidth on USB2** may not carry RGB + depth + `/camera/scan`. Degrade depth FPS
  before dropping the RGB feed the operator drives on.
- **`/ugv/led_ctrl` is write-only** — light state is "commanded, not confirmed". Label it as
  such; do not invent a readback.

## Validation

- Robot: `ros2 topic hz /scan` (~10 Hz), `ros2 topic echo /ugv/allow_motion --once`,
  `ros2 service call /ugv/set_allow_motion std_srvs/srv/SetBool "{data: false}"` round-trip,
  `ros2 param get /rosbridge_websocket topics_glob` shows the whitelist.
- End-to-end (untethered, ≥ 10.5 V, supervised): drive, lights, gimbal, PT feed, ARM/DISARM
  with confirmation, Ethernet-plug → ETHERNET_LOCK auto-disarm visible in UI.
- RobotOverview: `npm run lint`, `npm run typecheck`, updated test suite green
  (`ros-client.test.ts`, `cockpit-client.test.tsx`).
- Each Phase merges as its own PR (RobotOverview and/or ugv_ws per repo touched);
  `docs/beast-ops.md` Quick connect updated with dated ground truth after any robot session.

## Open questions (resolve during implementation, not blocking)

- Exact rosbridge glob syntax for service whitelist on the deployed rosbridge version
  (`ros2 param get /rosbridge_websocket services_glob` after first enable).
- `/camera/scan` crop angles for the OAK forward arc (tune against the live scan, same
  discipline as the LD19 `ORIENTATION UNVERIFIED` wedge — verify with `ros2 topic echo`, then
  trust).
