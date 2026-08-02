# BEAST-01: Stand up the LD19 LiDAR meaningfully — SLAM + Nav2

## Goal

Turn the LD19 from a cockpit visualization source into the robot's working 2D
navigation sensor: verified driver output, 2D SLAM maps, Nav2 autonomous
navigation on a saved map, and (later) a map view in the Hangar cockpit —
using existing libraries and tooling, not hand-rolled implementations.

## Key decisions

1. **SLAM backend: slam_toolbox** (sync mapping, then lifelong localization
   mode on the saved map). Already tuned in `ugv_slam/config/`, has the best
   accuracy when fed fused odometry (comparative study: ATE 0.13 m vs
   Cartographer 0.21 m), and `ugv_nav` already has a
   `slam_toolbox_localization.yaml` path.
2. **Ops console: Vizanti** (`ugv_ws/src/ugv_else/vizanti`, already vendored,
   launch via `ros2 launch ugv_web_app bringup.launch.py`, web UI :5100,
   its own rosbridge :5001). Use it for mapping runs, initial-pose, and
   click-to-goal. Do not build operational map tooling in the cockpit.
3. **Cockpit map view (later phase): `ros2-web2d`** npm library
   (`OccupancyGridClient` with `'costmap'` colorizer, `LaserScanClient`,
   `PathClient`, `PoseInteractionView` click-drag goal, TF-aware
   `SceneNode`) + `roslibjs` (`ROS2TFClient`) for new map/TF subscriptions.
   Keep the existing native-WebSocket client for current telemetry topics;
   do not migrate working subscriptions in the same pass.
4. **Motion: teleop-only until watchdogs verified.** Mapping runs use
   supervised teleop (`allow_motion:=true` passed explicitly, never default).
   Nav2 autonomous goals stay disabled until the Jetson `cmd_vel_timeout`
   watchdog re-test passes and the ESP32 heartbeat-stop failure is resolved.
   (User dismissed the interview; these are the recommended defaults.)
5. **Do not run duplicate stacks.** `nav.launch.py` includes
   `bringup_lidar.launch.py`; never launch both. Same for standalone
   `slam_toolbox.launch.py` vs `nav.launch.py use_slam:=true`.

## Phase 0 — Robot-side fixes (ugv_ws, all verified bugs)

1. **IMU topic mismatch**: `ugv_bringup.py` publishes `/imu/raw`
   (`ugv_bringup.py:80-85`) but `odom_publisher.py:56-58` and RF2O
   (`rf2o_laser_odometry.launch.py:19-32`) subscribe `/imu/data`. Fix by
   remapping or renaming; pick one canonical topic and update the cockpit
   README reference too (`ugv_cockpit/README.md:23-25`).
2. **EKF has no IMU**: `config/ekf.yaml:144-167` IMU block is commented out.
   Enable `imu0` (angular velocity + linear acceleration only, no pose)
   after fix 1 lands.
3. **collision_monitor sim time**: `ugv_nav/params/{teb,rpp,dwa,mppi}.yaml`
   set `use_sim_time: True` under `collision_monitor` (e.g.
   `teb.yaml:411-419`). Remove / set false — hardware runs wall time.
4. **robot_pose_publisher sim time**: hard-coded `use_sim_time: True` in
   `robot_pose_publisher_launch.py:11-16`. Make it follow the launch arg.
5. **allow_motion not forwarded**: SLAM/Nav wrapper launches don't expose the
   flag; `bringup_lidar.launch.py:74-80` defaults false and `ugv_bringup.py`
   rejects all motion. Thread an `allow_motion` launch arg through
   `slam_toolbox.launch.py` and `nav.launch.py` into the included bringup.
6. **Verify the LD19 fixed-bin output live** (known trap): stock LDROBOT
   drivers emit variable-length scans and slam_toolbox discards ~70% of them
   (`ldlidar_stl_ros2#11`). Our vendored driver defaults to `bins: 480`
   (`ldlidar.launch.py:66-77`) which should sidestep it — confirm with
   `ros2 topic echo /scan --once` twice and check `len(ranges)` is exactly
   480 both times. If not, port the binning fix.
7. **Re-check the rear crop**: driver masks 225–315°
   (`ldlidar.launch.py:71-75`) while the cockpit crops 45–134.5°
   (`ros/client.ts:550-568`) — these are the same physical sector under the
   mirror transform, but SLAM/Nav2 now see the driver-side NaN sector too.
   Confirm the blind sector is still physically correct after any remount;
   consider `enable_angle_crop_func:=false` if the mount allows a full scan.

## Phase 1 — Meaningful LiDAR, no motion (robot reachable)

1. Bring up the stack: `ros2 launch ugv_bringup bringup_lidar.launch.py
   use_lidar:=true use_ekf:=true` (standard `/home/ws/ugv_ws` env,
   `UGV_MODEL=ugv_beast`, `LDLIDAR_MODEL=ld19`).
2. Verify: `ros2 topic hz /scan` (~10 Hz), `ros2 topic hz /odom` (~20 Hz),
   `tf2_echo odom base_footprint`, `tf2_echo base_link base_lidar_link`.
3. Bench odometry validation: lift/mark wheels, drive a known 1 m square via
   teleop (motion armed for the bench run only), compare `/odom_wheel`,
   `/odom_rf2o`, `/odom`. Record drift. This gates SLAM quality.
4. Update the Quick connect block in `docs/beast-ops.md` with dated results.

## Phase 2 — SLAM mapping (supervised teleop)

1. `ros2 launch ugv_slam slam_toolbox.launch.py use_slam:=sync
   allow_motion:=true` (after Phase 0.5) — one terminal; `ros2 run ugv_tools
   keyboard_ctrl` in another. Alternatively use Vizanti's teleop.
2. Drive the house/space slowly (0.26 m/s max), watch `/map` in RViz/Vizanti
   for smearing; watch slam_toolbox logs for the `LaserRangeScan contains N
   range readings` warning — must not appear after Phase 0.6.
3. Save the map: `bash save_map.sh` → option 3 →
   `ugv_nav/maps/map.{yaml,pgm,posegraph,data}`. Commit map assets.
4. Validate: relaunch with `nav.launch.py use_localization:=slam_toolbox`
   (or `amcl`), set initial pose in Vizanti, teleop around and confirm the
   robot glyph tracks the map without jumps.

## Phase 3 — Nav2 on the saved map (gated on watchdogs)

1. Prereq: Jetson `cmd_vel_timeout` watchdog re-tested live; ESP32
   heartbeat-stop investigated (both logged open in `beast-ops.md:154-165`).
2. `ros2 launch ugv_nav nav.launch.py use_localization:=slam_toolbox
   use_localplan:=rpp` (RPP is simplest robust controller; TEB also tuned).
3. In Vizanti: set initial pose → send one short click-to-goal in open
   floor → verify collision_monitor slows/stops on a held obstacle → verify
   twist_mux lets BT pad / UI teleop override Nav2 (`/cmd_vel_nav` pri 10).
4. Only then: waypoint missions via Vizanti's mission bridge.

## Phase 4 — Cockpit map view (RobotOverview, after Phase 3)

1. Add `roslib` + `ros2-web2d` deps. Create `ROS2TFClient` (fixedFrame
   `map`, rate 10) against the existing rosbridge :9090.
2. New `MapView` cockpit panel beside `SpatialView`: base `/map`
   `OccupancyGridClient` (grayscale), `/local_costmap/costmap` overlay
   (`colorizer:'costmap'`), `LaserScanClient` (feed mode from our existing
   native `/scan` subscription to avoid double-subscribing), `PathClient`
   `/plan`, robot pose arrow from `ROS2TFClient` on `base_footprint`.
3. Click-to-goal via `PoseInteractionView` publishing `/goal_pose` — behind
   an explicit "autonomy armed" UI gate tied to `/cockpit/status` mux state;
   keep `allow_motion=false` boot default unchanged.
4. Perf: render into the existing Canvas pattern; requestAnimationFrame
   scheduling; `/map` arrives at 5 s intervals, costmap at 2 Hz — no React
   state per message (follow the `OpticsWall` ref pattern).
5. Also expose scan intensity in the existing scan path (driver publishes
   `intensities`; `ros/client.ts` drops them) as point brightness — cheap,
   useful quality signal.

## Validation

- `ros2 topic echo /scan --once` ×2 → `len(ranges)==480` both times.
- slam_toolbox log free of `LaserRangeScan contains … expected …` warnings.
- Saved map reloads; localization holds pose while teleop-driving a loop.
- Collision monitor stops the robot on a hand-held obstacle during a Nav2
  goal; mux override works from the gamepad.
- Cockpit renders map + costmap + pose with no frame drops at 10 Hz scan.
- `docs/beast-ops.md` Quick connect block updated with each dated result.

## Risks / open questions

- **Odometry drift**: encoder-unit and wheelbase assumptions
  (`odom_publisher.py:137-153`) are unvalidated; Phase 1.3 gates everything.
- **Wi-Fi reachability**: robot was unreachable during this planning
  session (`beast-01.local` DNS fail, Tailscale + .187 timeouts) — all
  robot-side phases need it on the LAN.
- **Frame naming inconsistency** (slam_toolbox uses `base_footprint`,
  gmapping/costmaps `base_link`) — connectable via static TF, but watch for
  subtle config drift when editing params.
- **Dual rosbridge ports**: Vizanti :5001 vs cockpit :9090 — fine as long as
  nobody launches both bridge stacks expecting one port.
- **Cartographer/RTAB-Map**: explicitly out of scope (no `.pbstream` asset;
  RTAB-Map needs OAK-D and disables EKF).
- **3D**: unchanged — OAK-D depth/pointcloud remains the roadmap's 3D
  source (`docs/plans/2026-08-01-beast-cockpit-future-roadmap.md`).

## References

- Cockpit audit: `src/lib/ros/client.ts`, `src/components/cockpit/SpatialView.tsx`
- Robot audit: `ugv_ws/src/ugv_main/ugv_bringup`, `ugv_slam`, `ugv_nav`,
  `ugv_else/ldlidar`, `ugv_else/vizanti`
- ros2-web2d: https://github.com/Neoplanetz/ros2-web2d
- Vizanti: https://github.com/MoffKalast/vizanti (ros2 branch, vendored)
- LD19 scan-length bug: https://github.com/ldrobotSensorTeam/ldlidar_stl_ros2/issues/11
- SLAM comparison: https://www.mdpi.com/2079-9292/14/24/4822
