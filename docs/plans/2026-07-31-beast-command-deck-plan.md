# BEAST-01 Command Deck + sensor fusion — implementation plan

**Status:** ACTIVE — 2026-07-31. Companion to the approved
[cockpit spec](2026-07-31-beast-command-deck-spec.md). This plan sequences the work into
PR-sized chunks across **two repos** — `Coldaine/ugv_ws` (robot-side, safety-relevant) and this
repo (the in-app `/cockpit` command surface and docs). The owner will split phases into per-PR plan
docs as they are picked up.

## Done condition

All six:

1. Any device on the tailnet (desktop app, browser, phone) can open the cockpit and see live
   scan, TF, odom, voltage, IMU, and OAK RGB+depth — through exactly one robot port per surface,
   with the bridge's command-publish globs enforced.
2. Every `/cmd_vel` publisher on the robot routes through twist_mux; publishing directly to
   `/cmd_vel` from a cockpit client is impossible (not merely discouraged).
3. The beast-paces Phase 2 watchdog re-gate has passed live (crawl + kill, self-stop ≤ 1 s,
   recorded in `docs/beast-ops.md`) before the first cockpit teleop session.
4. All three teleop inputs work through the mux ladder: robot-paired BT pad, operator gamepad
   with deadman, on-screen teleop — each verified to lose arbitration to the higher source.
5. OAK runs at SUPER (USB3) or a dated decision records staying at USB2; a slam_toolbox map of
   one real space is saved (serialized posegraph + .pgm) and renders in the cockpit.
6. The honesty rail ships: fake SOC hidden, PT open-loop and IMU-uncal labels visible, ESP32
   heartbeat gap stated on the safety strip.

## Where things stand (verified 2026-07-31)

Done tonight — do not redo:

| Landed | Evidence |
| --- | --- |
| OAK-D Lite first light; camera cutover gate closed | `USB SPEED: HIGH`, RGB ~16 FPS, depth ~16.3 FPS 16UC1 aligned; `docs/beast-ops.md` Quick connect bullet |
| 5 MP PT cam one-frame verification | v4l2-ctl grab, same bullet |
| TF audit: URDF OAK macro correct, `/scan` frame correct | tf2_echo `base_link → oak_rgb_camera_optical_frame` |
| rf2o "duplicate node" diagnosed cosmetic (one process, two in-process names; ~10 Hz single-rate) | same bullet |
| Baseline bag (13 topics, 417 MB) | `~/beast-acceptance/bags/oak-baseline-20260731` on the robot |
| Cockpit config drafts (twist_mux, teleop, bridge, combined launch, README) | [`beast-command-deck-drafts/`](beast-command-deck-drafts/) — staging copies; land in ugv_ws PRs, then delete per promote-then-delete |
| Approved visual mockup | [`beast-command-deck-drafts/beast-command-deck.html`](beast-command-deck-drafts/beast-command-deck.html) |
| Research base: OAK bringup, fusion sizing, cockpit tooling, ugv_ws inventory | four-lane research 2026-07-31; conclusions folded into the spec |

Standing constraints: motion software-locked; watchdog deployed but not live re-gated; ESP32 has
no firmware heartbeat; pack was at the 10.5 V floor — charge before any motion phase.

## Recommended PR series

Split so each safety-relevant change is reviewable alone and no PR mixes repos:

| # | Repo | Contents | Merge gate |
| --- | --- | --- | --- |
| PR-0 | RobotOverview | This plan + spec + drafts dir + beast-ops updates (already in working tree) | docs review only |
| PR-1 | ugv_ws | **Safety spine:** twist_mux + config, all existing publishers rerouted (`ugv_tools` keyboard/joy/behavior → mux inputs), tests proving direct `/cmd_vel` is unreachable from clients | unit tests on-robot; no cockpit yet |
| PR-2 | ugv_ws | **Cockpit bridge:** loopback-only `rosbridge_websocket` with exact publish/subscribe globs and no service/action operations, `beast-cockpit.service` (disabled by default), firewall notes | bridge commissioning with motion locked; publish rejected outside the exact globs; services/actions unavailable |
| PR-3 | ugv_ws | **OAK productization:** `beast-oak.yaml` (RGBD, sync, 480P, fps per USB tier), optional-camera arg in bringup or sibling service, IMU probe recorded | one-frame check via the new launch; USB tier recorded |
| PR-4 | ugv_ws | **Phase E — SLAM:** slam_toolbox crawl tuning (min travel 0.10–0.15 m), map save workflow to the storage layout | map of one space saved + reloads in localization mode |
| PR-5 | ugv_ws | **Phase F — nav2:** Beast velocity retune (≤0.15 m/s, replaces generic 0.26), depth scan via depthimage_to_laserscan as second obstacle source, collision monitor | supervised runs only; ESP32 heartbeat still absent |
| PR-6 | RobotOverview | **Superseded:** the command surface landed directly in the Hangar as `/cockpit`; no separate link-out or Foxglove layout is planned | complete in-app implementation, then deploy only after PR-2 and the physical safety gates |

Interleaved non-PR gates (hardware/procedure, tracked in `docs/beast-ops.md`): charge pack →
USB3 cable swap + `USB SPEED: SUPER` re-check → beast-paces Phase 2 watchdog re-gate →
supervised teleop session → mapping drive.

## Phases

- **Phase B — USB3 unlock (hardware, 5 min + one cable).** Known-USB3 USB-C cable direct into an
  Orin USB3 port; confirm `USB SPEED: SUPER` in the driver log; then raise OAK to 30 FPS
  profiles. Fallback recorded if the Orin L4T36 UPHY quirk bites (try other port; stay USB2 and
  keep 15 FPS profiles). Also: `pip install depthai` → IMU presence probe, recorded in ugv.env
  comment + beast-ops.
- **Phase C — safety spine + bridge (PR-1, PR-2).** The command controls are present, but the
  robot remains motion-locked until Phase D passes. Verify the in-app telemetry surface from a
  browser and a phone before any motion session.
- **Phase D — motion re-gate (procedure, no PR).** beast-paces Phase 2 crawl+kill; expect
  self-stop ≤ 1 s; record pass/fail + stop delay in beast-ops. Only then first supervised
  cockpit teleop, all three inputs, arbitration checked.
- **Phase E — mapping (PR-4).** Drive a loop; save serialized posegraph + .pgm; render map in
  cockpit; replay bags through RTAB-Map offline as an experiment (no live commitment).
- **Phase F — obstacle-aware nav (PR-5).** nav2 with static map + `/scan` + depth-derived scan;
  supervised only while the ESP32 heartbeat gap stands.

## Rejected approaches (do not re-litigate)

- **Standalone link-out as the Hangar command surface** — superseded by the owner's 2026-07-31
  decision and the implemented in-app `/cockpit` route.
- **Native Windows ROS 2 / RViz-as-cockpit** — painful install, DDS-over-Tailscale unsolved;
  RViz-in-WSL2 + zenoh stays a back-pocket debug tool only.
- **Isaac ROS (nvblox/cuVSLAM) on this robot** — container-mandatory, RAM-heavy, duplicates what
  slam_toolbox + STVL do for a slow indoor rover on an 8 GB board.
- **Live RTAB-Map alongside the base stack** — offline-on-bags first; live only if the offline
  result justifies ~1 core + ~1 GB.
- **Streaming raw images over the bridge** — compressed variants only; Orin Nano has no NVENC,
  so JPEG (not H.264) is the default.
