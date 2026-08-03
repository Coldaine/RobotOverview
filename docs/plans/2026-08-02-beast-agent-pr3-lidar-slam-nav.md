# Set 3 — LiDAR, SLAM, Nav2 (ugv_ws)

**Parent:** [master plan](2026-08-02-beast-agent-architecture.md). Absorbs Command Deck
PR-4/PR-5 and the kilo plan's Phase 0. The LD19 "does nothing" today because
`beast-ros-base.service` boots with `use_lidar:=false` — policy, not hardware.

## Inputs

- `ugv_ws/deploy/systemd/beast-ros-base.service` — the `use_lidar:=false` line.
- `ugv_ws/src/ugv_else/ldlidar/` — vendored driver, already has `bins: 480` + crop
  225–315°. **Keep this fork**; upstream `ldlidar_stl_ros2` lacks both (issue #11 open).
- `ugv_ws/src/ugv_main/ugv_bringup/launch/bringup_lidar.launch.py`,
  `ugv_ws/src/ugv_main/ugv_slam/`, `ugv_ws/src/ugv_main/ugv_nav/params/*.yaml`.
- Frame is `base_lidar_link` (URDF + Hangar cockpit contract) — do NOT rename.
- Kilo plan `.kilo/plans/1785521009354-beast-lidar-slam-nav2-plan.md` Phase 0 items.

## Work items

### PR-3a — Boot LiDAR on
- Set `UGV_LIDAR_PORT` to the by-id path (`…5970075705`, → ttyACM1) in
  `ugv.env.example` and live `/etc/beast/ugv.env`; flip the service to
  `use_lidar:=true`. Keep `allow_motion:=false`.
- Prove: `ros2 topic hz /scan` ≈ 10 Hz; `echo --once` twice → `len(ranges)==480` both
  times; TF `base_link → base_lidar_link` resolves.
- Fix the Quick-connect contradiction in `docs/beast-ops.md` (claims true; service
  said false) — dated.

### PR-3b — Driver hardening
- Publish `[0, 2π)` (`angle_increment = 2π/bins`, no duplicated 0/360 sample) so
  slam_toolbox stops rejecting even with fixed bins.
- Assert constant bin count (log or small test); expose `bins`/crop via env only.
- Validate the crop sector live against the Hangar `LIDAR_CROP_SECTOR_DEG`
  (45–134.5°, currently unverified) and reconcile either the driver or the UI.

### PR-3c — Perception hygiene (kilo Phase 0)
- Unify IMU topic (`/imu/raw` vs `/imu/data` — remap or rename; one convention).
- Enable `imu0` in `ugv_bringup/config/ekf.yaml` after the unify; spot-check at rest
  (≈1 g Z, gyros ≈0) per the calibration table in beast-ops.
- `use_sim_time: False` in all `ugv_nav/params/*.yaml` (collision_monitor is `True` in
  at least rpp) and in `robot_pose_publisher_launch.py`.
- Thread `allow_motion` through `slam_toolbox.launch.py` / `nav.launch.py`.
- Never run `nav.launch.py` on top of a live `beast-ros-base` (second twist_mux) —
  document the stop-first procedure in the launch header + beast-ops.

### PR-3d — Mapping (supervised)
- slam_toolbox sync mode with crawl tuning (`minimum_travel_distance` 0.10–0.15 m);
  map save/reload workflow to `ugv_nav/maps/` per the storage layout.
- One real space mapped and reloaded in localization mode, driven via Vizanti or the
  Hangar pad (once Set 1b is live). Motion for this still requires the Set 1 gate.

### PR-3e — Nav2 retune (gated)
- Beast velocities ≤ 0.15 m/s (replaces generic 0.26); RPP first; depth-derived scan
  (`depthimage_to_laserscan` on the OAK) as a second obstacle source; collision
  monitor live.
- **Hard gate:** Set 1 watchdog re-gate passed. Supervised runs only while the ESP32
  heartbeat gap stands.

## Done when

- Stock boot: `/scan` live, 480 bins, cockpit SpatialView renders points with the rear
  blind sector matching reality.
- A saved map reloads in localization mode; Nav2 drives a supervised goal without
  touching the chassis-mast false wall.
