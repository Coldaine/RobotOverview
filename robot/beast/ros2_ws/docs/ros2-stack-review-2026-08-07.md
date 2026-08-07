# BEAST-01 ROS 2 stack map and reuse review

**Date:** 2026-08-07  
**Audited revision:** `f01fa8300a2ad619f22d2157c6958084f1392cce` (`main`)  
**Scope:** `robot/beast/ros2_ws`, its deployment scripts and systemd units, and the Hangar-side ROS client surfaces that depend on it.

This is a source and architecture review. It does not claim that the current checkout is deployed or that the live robot has passed the proposed runtime gates.

## Bottom line

BEAST-01 is a real ROS 2 Humble application built on a substantial upstream stack. It is not a generic reference workspace, and it should not be rewritten into one.

The custom code is concentrated at the physical and product boundaries:

- Waveshare ESP32 serial protocol, motor command path, encoder decoding, and watchdog in `ugv_bringup`.
- Driver-board INA219 reading and battery semantics in `beast_power`.
- BEAST-specific safety authority, interlocks, and restricted browser command ingress in `ugv_cockpit`.
- Robot-specific URDF, frames, sensor mounting, and hardware calibration.
- Hangar's agent/cockpit contract, status semantics, and operator UI.

The highest-value reuse work is therefore **convergence and deletion around the edges**, not a wholesale replacement:

1. Keep the hardware, safety, power, and product integration custom.
2. Keep using upstream `robot_localization`, `twist_mux`, Nav2, `slam_toolbox`, DepthAI ROS, `rosbridge`, `ros_gz`, and standard ROS description tools.
3. Make one upstream Nav2 controller and one 2D localization path the supported default; demote the legacy alternatives.
4. Consider `ros2_control`/`diff_drive_controller` only as a measured hardware-interface migration, not as a drop-in replacement for the ESP32 bridge.
5. Fix deployment coherence before any architectural migration: the current service enables `beast_power`, but both build scripts omit it.

Do not install Jazzy or Kilted binaries into this Humble workspace. A distro migration is a separate platform change requiring a dedicated build/test/deployment lane.

## Current stack map

### Runtime graph

```text
keyboard / joystick / browser / Nav2 / behavior / vision / LiDAR demos
             │       │       │       │          │
             └───────┴───────┴──────┴──────────┴──> twist_mux inputs
                                                        │
                                                        v
                                                     /cmd_vel
                                                        │
                                                        v
                                             ugv_bringup / motion gate
                                             - allow_motion authority
                                             - 0.5 s cmd_vel watchdog
                                             - Waveshare JSON serial bridge
                                                        │
                                                        v
                                                   ESP32 / tracks

encoder serial ──> odom_publisher ──> /odom_wheel ──┐
LiDAR ──> rf2o_laser_odometry ──> /odom_rf2o ────────┼──> robot_localization EKF ──> /odom
IMU ──> /imu/data (yaw rate only) ──────────────────┘

driver-board INA219 ──> beast_power ──> /ugv/voltage + /ugv/charging_active
                                                               │
charging topic ────────────────────────────────> /ugv/charging_active (observability only)

OAK-D / USB camera ──> depthai_ros_driver / v4l2_camera ──> cockpit and vision nodes
rosbridge (loopback) ──> allowlisted Hangar browser topics/services
```

### Package and role inventory

| Surface | What is actually custom | Upstream already present or appropriate | Disposition |
|---|---|---|---|
| `ugv_bringup` | ESP32 serial protocol, JSON `T=13` velocity command, encoder/IMU decoding, motion gate, watchdog, LED and board telemetry | `robot_localization`, `tf2`, standard ROS messages | Keep the hardware boundary. Reduce only the estimator/launch boilerplate after live calibration. |
| `beast_power` | INA219 register access, signed current interpretation, charging heuristic, SOC model, honest `BatteryState` contract | `sensor_msgs/BatteryState`; `diagnostic_updater` can add health reporting | Keep. No generic package identified that knows this board wiring and semantics. |
| `ugv_cockpit` | Restricted rosbridge adapter, cockpit status/depth nodes, command-spine launch | `twist_mux`, Nav2 behaviors, collision monitor, velocity smoother, `cv_bridge` | Keep the policy and boundary. Use upstream nodes inside it; do not replace Hangar's operator surface with a generic dashboard. |
| `ugv_description` | BEAST/Rover URDF, meshes, frames, sensor mounts, pan-tilt model | `xacro`, `robot_state_publisher`, `joint_state_publisher`, `tf2`, `ros2_control` | Keep robot geometry; remove only duplicated description plumbing. |
| `ugv_gazebo` | Project-specific model/world and sim launch | `ros_gz`, `gz_ros2_control`, `robot_state_publisher`, standard controllers | Keep as a thin project wrapper. Prefer Harmonic path; retain Classic only if a tested use case still needs it. |
| `ugv_nav` | Nav2 launch/config selection, map and localization wiring, legacy controller options | Nav2/Nav2 Bringup, AMCL, map server, RPP, MPPI, collision monitor, lifecycle manager | Trim wrapper complexity and make one supported default. Do not blindly delete alternatives before checking map/mission users. |
| `ugv_slam` | Launch wrappers and small LiDAR behavior demos | `slam_toolbox`, `cartographer_ros`, `rtabmap_ros`/`rtabmap_slam` | Keep thin launch wrappers; support `slam_toolbox` for 2D and RTAB-Map for RGB-D/3D. Legacy alternatives should be explicitly optional. |
| `ugv_tools` | Keyboard/gamepad implementations, behavior action server | `teleop_twist_keyboard`, `joy`, `teleop_twist_joy`, Nav2 actions | Replace simple teleop nodes when mappings and safety behavior are reproduced. Keep `behavior_ctrl` until its custom `Behavior` action is retired. |
| `ugv_vision` | Tracking algorithms, PID behavior, AprilTag/colour/face/gesture application logic | `depthai_ros_driver`, `v4l2_camera`/`camera_ros`, `image_transport`, `image_pipeline`, `cv_bridge` | Keep application algorithms; standardize acquisition and transport. |
| `ugv_web_app` | Vizanti launcher and older web control path | `rosbridge_suite`, Foxglove Bridge/Studio, `diagnostic_aggregator` | Keep the reviewed Hangar bridge for control. Add Foxglove as observability, not as an unaudited control replacement. |
| `ugv_msgs` | `Behavior.action` and `MapSave.srv` | Nav2 actions and map-saving services cover some of this | Keep while Hangar consumes the contracts; remove each interface only after a consumer inventory and migration proof. |
| `ugv_voice` / `ugv_chat_ai` | Optional local voice/LLM features | No need for a core ROS replacement | Keep outside baseline bringup. They are optional product features, not missing ROS architecture. |

## What is already upstream and should not be rebuilt

Several “custom” areas are mostly configuration around standard packages already in the workspace:

- `robot_localization` is already the EKF authority. The current config fuses wheel velocity from `odom_wheel`, differential pose/yaw-rate data from `odom_rf2o`, and IMU yaw rate only.
- `twist_mux` is already the command arbitration authority. Its priority ladder and timeout contract are asserted by `test_twist_mux_spine.py`.
- Nav2 behavior, costmap, lifecycle, collision-monitor, and velocity-smoother nodes are already used by the cockpit/navigation paths.
- `slam_toolbox`, RTAB-Map, Cartographer, and Nav2 are existing upstream ecosystems; the local code mainly chooses and wires them.
- `depthai_ros_driver`, `v4l2_camera`, `cv_bridge`, and image-processing components provide the sensor plumbing.
- `xacro`, `robot_state_publisher`, `joint_state_publisher`, `tf2`, `ros_gz`, and `gz_ros2_control` are the right primitives for the description/simulation layers.

The report's recommendation is not to create local replacements for these packages. It is to remove stale launch paths, duplicated assumptions, and unnecessary vendored copies where a distro package is already the supported dependency.

## Reuse matrix for the custom surfaces

### 1. Base control and odometry

**Candidate:** [`ros2_control`](https://github.com/ros-controls/ros2_control) plus [`diff_drive_controller`](https://github.com/ros-controls/ros2_controllers/tree/jazzy/diff_drive_controller).

**Potential benefit:** standard controller lifecycle, command interfaces, joint state interfaces, velocity limits, and odometry publication.

**Why this is not a drop-in replacement:** the current BEAST path is not a normal ROS wheel-controller setup. `ugv_bringup` sends a Waveshare-specific JSON protocol to an ESP32, and the firmware owns low-level track control. `diff_drive_controller` would require a real `ros2_control` hardware interface and a proof that its tracked/differential kinematics, encoder units, limits, and stop behavior match the existing robot. It could replace the ROS-side integration only after that adapter exists; it does not eliminate the hardware adapter.

**Recommendation:** future P2 investigation, not current migration. First capture command/encoder traces and validate distance, turn rate, stop latency, and restart behavior. Do not change the motion path during a safety or deployment cleanup.

**Already adopted:** [`robot_localization`](https://github.com/cra-ros-pkg/robot_localization) remains the correct estimator. The opportunity is calibration and clean configuration, not replacing it.

**Complement:** [`diagnostic_updater`](https://github.com/ros/diagnostics) and the diagnostics ecosystem can expose serial link, encoder, IMU, watchdog, and battery health. They are observability only; they must not become a second motion authority or replace the hard stop path.

### 2. Safety and command arbitration

**Already adopted:** [`twist_mux`](https://github.com/ros-teleop/twist_mux) is the correct upstream primitive and should stay.

The custom safety pieces are not generic mux functionality:

- `ugv_bringup` owns `allow_motion` and the downstream watchdog.
- Hangar owns the browser/operator confirmation and re-arm UX.
- The rosbridge adapter restricts publish/service surfaces before commands reach the mux.

Do not replace this with a generic dashboard or a second command arbiter. The software stop is not a hardware e-stop: the current design relies on the ESP32 receiving a stop and the Jetson watchdog firing after approximately 0.5 seconds when command traffic goes silent. The documented volatile `twist_mux` e-stop lock also requires periodic client publishing and is not restart-persistent. These are real operating constraints that need end-to-end testing, not a package swap.

**Teleop candidates:** [`teleop_twist_keyboard`](https://github.com/ros2/teleop_twist_keyboard), [`teleop_twist_joy`](https://github.com/ros2/teleop_twist_joy), and [`joy`](https://github.com/ros-drivers/joystick_drivers/tree/ros2/joy).

**Recommendation:** replace the simple custom keyboard/gamepad generation only if the exact topic names, priorities, dead-man behavior, and stop semantics are preserved. Keep all inputs on mux inputs; never let an upstream teleop node publish directly to `/cmd_vel`.

### 3. Navigation and local planning

`ugv_nav` currently exposes `teb`, `dwa`, `rpp`, and `mppi` parameter choices. `nav.launch.py` defaults to `teb`, while RPP and MPPI are the modern upstream Nav2 paths.

**Recommended supported default:** choose one of:

- [`nav2_regulated_pure_pursuit_controller`](https://github.com/ros-navigation/navigation2/tree/jazzy/nav2_regulated_pure_pursuit_controller) for a simple, inspectable differential/tracked-base controller; or
- [`nav2_mppi_controller`](https://github.com/ros-navigation/navigation2/tree/jazzy/nav2_mppi_controller) if measured smoothness/obstacle behavior justifies its additional tuning.

Both are upstream Nav2 components. The choice should come from a real map/mission comparison, not from package fashion. RPP is the lower-complexity default candidate. MPPI is the higher-complexity candidate.

**Recommendation:** make `rpp` the first migration target, preserve the existing TEB configuration until the replacement passes the same map, obstacle, stop, and command-spine checks, then remove TEB from the supported build path. Treat DWA/TEB as legacy options rather than five equal production paths.

Keep upstream Nav2 components for map server, AMCL, lifecycle management, behavior server, costmaps, collision monitor, and velocity smoother. The local launch code should select and parameterize them, not reimplement them.

### 4. SLAM and localization

**2D default:** [`slam_toolbox`](https://github.com/SteveMacenski/slam_toolbox). It is already present and is the best fit for a LiDAR ground robot's supported mapping/localization path.

**RGB-D/3D option:** [`rtabmap_ros`](https://github.com/introlab/rtabmap_ros) / `rtabmap_slam`, when OAK-D data and 3D loop closure are actually required.

**Optional alternatives:** `cartographer_ros`, `slam_gmapping`, and EMCL2 can remain only for a demonstrated map or hardware use case. They should not all be treated as co-equal defaults.

`rf2o_laser_odometry` currently feeds the EKF and is a more consequential dependency than a launch wrapper. Keep it until an alternative estimator is measured against wheel odometry and the robot's LiDAR geometry. Its vendored package declares GPLv3; that license should be part of the deployment decision.

### 5. Sensors and perception

**LiDAR:** the current `ldlidar` package is already the vendor-specific driver boundary. The upstream LDROBOT repository supports LD06, LD19, and STL-27L and is MIT-licensed: [`ldlidar_stl_ros2`](https://github.com/ldrobotSensorTeam/ldlidar_stl_ros2). The local launch wrapper adds the BEAST's environment-driven port, model, crop, and bin configuration. Keep the wrapper, but compare the vendored fork against upstream before carrying local patches forward.

Do not swap to `rplidar_ros` or `ydlidar_ros2_driver` unless the physical sensor changes. A generic LiDAR driver is not a replacement for a different vendor protocol.

**Camera:** [`depthai-ros`](https://github.com/luxonis/depthai-ros), `v4l2_camera`/`camera_ros`, `image_transport`, `image_pipeline`, and `cv_bridge` are the right acquisition and transport layers. Keep BEAST's tracking/application nodes (`color_ball_track`, face/AprilTag/gesture behavior, PID policies) until a product requirement justifies replacing them.

`depthimage_to_laserscan` is a useful complement only if the project decides to turn depth into a 2D obstacle source. It should not be introduced merely because it exists.

### 6. Web cockpit and observability

**Current control path:** restricted `rosbridge_suite` plus Hangar's `ros-singleton`, motion gate, topic schema, service handling, and UI. This is a product/security boundary, not a generic visualization problem.

**Candidate observability path:** the ROS 2 [`foxglove_bridge`](https://github.com/foxglove/foxglove-sdk/tree/main/ros/src/foxglove_bridge) and Foxglove Studio can replace ad hoc debugging panels and make topic/TF/diagnostic inspection easier. They should be added as a read/diagnostics surface first. They must not bypass `twist_mux`, `allow_motion`, the watchdog, or the rosbridge allowlist.

**Diagnostics candidate:** [`diagnostic_aggregator`](https://github.com/ros/diagnostics) can roll up structured health status, but it does not replace the safety monitor. A “healthy” diagnostic aggregate must never be the sole condition that permits motion.

### 7. ESP32 integration

**Candidate:** [micro-ROS](https://github.com/micro-ROS) could eventually replace the bespoke serial message marshaling if the firmware can run a micro-ROS client and the resulting lifecycle, latency, reconnect, and fail-stop behavior are acceptable.

**Recommendation:** treat this as a separate firmware project. The existing JSON protocol is a known boundary; replacing it to reduce Python code is not automatically safer or simpler. Do not start micro-ROS work until the current command/encoder contract is documented and tested.

## Correction: `beast_power` is both risky and overbuilt

The first version of this review undercalled this package. `beast_power` is not a large subsystem, but it is large for what it does: one INA219, one `BatteryState`, and one charging boolean.

| Surface | Lines |
|---|---:|
| Production Python (`ina219.py`, `power_node.py`, `telemetry.py`, `soc.py`) | 555 |
| Tests | 233 |
| Package/config/launch/docs/notices | about 188 |
| Total package surface excluding caches/bytecode | about 976 |

Some of that is legitimate testability and license documentation. The production shape is still over-factored: a 187-line driver contains an in-production fake bus, a 206-line node duplicates ROS parameter/message plumbing, and a 105-line telemetry adapter duplicates most of `sensor_msgs/BatteryState` only to copy it back into a ROS message. The standalone launch file, four-layer telemetry model, historical fake-SOC helper, and repeated cutover prose add more surface than the hardware boundary warrants.

### Actual correctness issues

1. **The current/power calibration is explicitly unverified.** `ina219.py:33-36` hard-codes `RSHUNT = 0.1` and derives the calibration from that value, while the comment says it is an inherited LeoRover default. Until the physical driver-board shunt is measured or its schematic confirms 0.1 Ω, current and power are estimates—not INA219 ground truth. The code should make shunt resistance a verified configuration value or refuse to call the result calibrated.

2. **Sensor failure is reported as `charging_active=false`.** `telemetry.py:76-92` deliberately converts an absent/failed sensor into `charging_active=False`; `power_node.py:154-159` publishes that value every cycle. The current branch no longer uses this topic as a motion interlock, but consumers can still mistake false for a healthy “not charging” reading. Unknown sensor state needs a distinct validity contract.

3. **The charging signal is only a current threshold, not charger detection.** `telemetry.py:53-61` calls any current at or above 50 mA “charging.” There is no charger-presence input, debounce, hysteresis, or dwell time. Keep this topic observational until those semantics are measured and documented.

4. **The SOC is an uncalibrated voltage guess.** `soc.py:5-12` admits the table is a generic NMC/Li-ion OCV curve and not a BEAST pack calibration. Bus voltage under load and charge is not open-circuit voltage. Publishing that value as `BatteryState.percentage` is acceptable only if every consumer treats it as an estimate; it should not be described as battery ground truth. Removing SOC from the authoritative contract until it is calibrated would make the package more honest and smaller.

5. **Several `BatteryState` fields overclaim what the sensor proves.** A responding INA219 establishes that the monitor is reachable, not necessarily that a battery is present or healthy. `telemetry.py:110-114` sets `present=True` and `power_supply_health=GOOD` whenever a read succeeds. Health should remain `UNKNOWN` unless there is a real health signal; `present` needs a defined electrical criterion or an explicit “sensor present” interpretation outside `BatteryState`.

6. **The failure values are partly indistinguishable from real values.** The absent path publishes `voltage=0.0`, `current=0.0`, and `charging_active=false`, while only percentage/capacity-like fields become NaN. Consumers that do not honor `present` can read “zero current, not charging” rather than “measurement unavailable.” The telemetry contract needs an explicit validity state.

7. **The read exception path is incomplete.** If `ensure_ready()` succeeds and `Ina219.read()` then raises, `power_node.py:188-191` logs and publishes absent status but leaves `_sensor_ok=True` and the bus open. The next cycle may recover through `ensure_ready()`, but the error path should close/invalidate the connection and schedule reconnection immediately. Malformed register buffers can also raise `struct.error`, which is not handled alongside `OSError`.

8. **The fake bus does not test the important bus contract.** `FakeSMBus` ignores the I²C address, allows reads/writes without checking that the bus is open, and always returns correctly sized buffers. The tests prove the model against its own fake, not the address/open/short-read failure modes that matter on the Jetson. That is test scaffolding, not evidence of hardware correctness.

9. **The package documentation had contradicted the active configuration.** Earlier text said `0x40` and “UPS Module 3S” while runtime uses driver-board INA219 at `0x41`; this branch corrects those labels and the build-path note.

### What I would keep and what I would remove

Keep a local driver because no maintained ROS 2 community INA219 package matches this board and contract. The alternatives found are either stale/low-adoption (`Pet-Series` is 2023-era and generic), ROS 1, or only a `ros2_control` BatteryState broadcaster that still requires a hardware sensor interface. Reusing one would not remove the board calibration and failure-policy work.

Strip the package to a direct path:

- one small INA219 adapter with verified bus/address/shunt configuration;
- one node that reads, validates, publishes voltage/current, and emits an explicit health/validity state;
- a small optional SOC estimator kept out of safety decisions, or removed until the pack curve is measured;
- tests for conversion math plus a real Jetson smoke test for address, register values, disconnect, reconnect, and publisher ownership.

Move `FakeSMBus` to test support, remove the legacy fake-percentage helper from runtime code, collapse the duplicate `BatteryTelemetry` field bag where it does not add policy, and avoid making a generic `BatteryState` field look authoritative when the hardware cannot measure it.

**Revised disposition:** keep the package boundary, but do not approve the current implementation as “ground truth” or as finished. Fix calibration/validity semantics first; then reduce the implementation before adding more features.

## Vendored `ugv_else` assessment

`ugv_else` is a mixed collection of upstream and third-party code, not one coherent BEAST subsystem. The current build scripts compile many packages even when only a subset is on the baseline bringup path.

### Clearly on the current path

- `ldlidar` — LiDAR driver.
- `rf2o_laser_odometry` — EKF input.
- `robot_pose_publisher` — launch support in navigation/SLAM paths.
- `vizanti*` — web-app path.
- `gz_ros2_control` — simulation path.
- `emcl2`, Cartographer, and the SLAM alternatives — selected only by corresponding navigation/localization arguments.

### Candidates to demote or remove from the baseline build

- `teb_local_planner`, `teb_msgs`, and `costmap_converter`: the active default points at TEB, but Nav2 RPP/MPPI are better-supported upstream choices for the target direction. Migrate and measure before deleting.
- `openslam_gmapping`/`slam_gmapping`: retain only if a real map workflow still needs it; `slam_toolbox` should be the supported 2D default.
- `explore_lite`: no active baseline launch reference was found; verify consumers before removing.
- `vizanti_demos` and unused Vizanti support packages: keep only what `ugv_web_app` actually launches.
- Cartographer/EMCL2: optional localization packages, not reasons to make every clean install compile every legacy path.

This cleanup should be driven by actual launch references and a deployment build profile. Do not delete a package solely because its name looks old.

### License and redistribution flags

The vendored tree has license constraints that are easy to miss in a general ROS workspace:

- `ugv_else/gmapping`: `CreativeCommons-by-nc-sa-2.0` in the package manifests.
- `ugv_else/rf2o_laser_odometry`: GPLv3.
- `ugv_else/costmap_converter`: BSD package, but includes GPLv3 `MultitargetTracker` code.
- TEB includes permissive primary code with LGPL/MPL/other third-party components called out in its README.

Before shipping a combined image or redistributing source/binaries, perform a deliberate dependency/license audit. Replacing unused legacy packages with distro dependencies may reduce both build time and legal surface.

## Concrete findings that must be resolved before calling the stack coherent

### P0 resolved in this branch: `beast_power` was enabled by the service but omitted from both build scripts

`bringup_lidar.launch.py` defaults `use_power:=true` and creates the `beast_power/power_node`. `beast-ros-base.service` launches that bringup with no `use_power:=false` override. However:

- Before this branch, `build_first.sh` did not include `beast_power` in either `colcon build` package list.
- Before this branch, `build_common.sh` did not include `beast_power` in its selectable package list.
- The documented robot checkout was `6ef4a48`, three commits behind the cutover at audit time.

The branch now adds the package and `python3-smbus2` to the build path. A robot rebuild and live publisher-ownership proof are still required before treating the cutover as deployed.

### P1 resolved in this branch: documentation contained pre-cutover battery and cockpit claims

`docs/beast-ops.md` contains old text describing fake `/ugv/voltage` fields and an unwired UPS, despite the newer cutover section describing INA219 ground truth. It also contains cockpit deployment wording that conflicts with the current systemd unit, which is explicitly disabled by default.

This branch corrects the package description, README address, build note, and current interlock wording. Older historical sections in `docs/beast-ops.md` remain dated evidence rather than current deployment claims.

The stale passages must be corrected or removed. They are dangerous because they make a future operator either distrust real telemetry or assume that a remote command surface is active when it is not.

### P1: launch/package metadata is not hermetic

Several package manifests omit direct launch/runtime dependencies used by the code. For example, `ugv_bringup` launches or resolves `ugv_description`, `ldlidar`, `rf2o_laser_odometry`, `robot_localization`, `beast_power`, `launch`, `launch_ros`, and `ament_index_python`, but its manifest does not declare the full set. `ugv_slam` uses NumPy without declaring the Python runtime dependency; `ugv_tools` imports pygame without declaring it; other packages rely on the global install/build script.

This may work on the prepared Jetson image, but it prevents `rosdep` and a clean workspace from expressing the actual contract. Add direct dependencies as part of deployment hardening, not as part of an unrelated controller migration.

### P1: calibration and end-to-end estimator proof are missing

The source contains explicit assumptions around encoder units, IMU scaling, frames, wheel base, and covariances. The EKF configuration is reasonable in shape, but repository tests do not prove real distance, turn rate, frame alignment, or map behavior. `/odom/odom_raw` and IMU values need live calibration evidence before autonomous navigation is called validated.

### P1: software stop is not a hardware e-stop

The current watchdog and mux contract can stop a robot after command silence, but the latency and restart behavior are software-defined. The volatile `twist_mux` lock is client-published and not persistent across mux restarts. Preserve the explicit distinction between:

- an operator disarm through `/ugv/set_allow_motion`,
- a mux lock,
- the Jetson watchdog stop,
- an ESP32 stop command, and
- physical power removal/hardware e-stop.

No upstream package makes these semantics safe by itself.

### P2: integration proof is narrower than unit-test proof

The recent INA219 and motion-authority changes have useful unit/UI tests, but the following evidence was not present in this Windows checkout:

- launch-level proof that `beast_power` is the only `/ugv/voltage` publisher;
- live or HIL proof of I2C access, charging state, and service startup;
- service → `allow_motion` topic echo → cockpit confirmation loop;
- runtime proof that the standalone behavior server remains behind smoother, mux, motion gate, and watchdog when disarmed.

These are the right next tests because they cover cross-layer boundaries. More package-level mocks would not substitute for them.

## Recommended sequence

### Now: deployment coherence

1. Add `beast_power` to `build_first.sh` and `build_common.sh`.
2. Build `beast_power` and `ugv_bringup` together; install/restart the systemd unit with the `i2c` group.
3. On the robot, prove:
   - `beast_power` is running;
   - `/ugv/voltage` has one publisher;
   - `BatteryState.voltage`, signed current, presence, and charging state match INA219 register evidence;
   - `/ugv/charging_active` is published for observability only and does not control motion;
   - motion remains stopped when the gate is disarmed.
4. Correct the stale ops documentation and add the deployment result as dated evidence.

### Next: supported-path reduction

1. Choose `slam_toolbox` as the supported 2D mapping/localization path; retain RTAB-Map only for an explicit RGB-D/3D requirement.
2. Benchmark RPP first against the current TEB default on the same map and command spine. Promote it only after stop, obstacle, and path-following checks pass.
3. Separate optional legacy launch paths from the clean baseline build. Remove unreferenced vendored packages only after consumer and license checks.
4. Normalize package manifests and run a clean `rosdep`/colcon build in the target distro.

### Later: hardware standardization

1. Document the ESP32 protocol and encoder/IMU semantics as a stable contract.
2. Prototype a `ros2_control` hardware interface without changing the live motion path.
3. Compare it against the existing path for command latency, encoder agreement, stop behavior, reconnection, and power-cycle recovery.
4. Consider micro-ROS only if the firmware-side trade-off is genuinely better.

## Verification performed for this review

- `beast_power` tests: **18 passed**.
- ROS package tests available without NumPy-dependent collection: **171 passed, 6 skipped**.
- Full cockpit collection was blocked by the local Windows environment missing `numpy` for `test_cockpit_nodes.py`; this is an environment gap, not a reported source failure.
- Python custom modules compiled successfully with `compileall`.
- Hangar JavaScript/TypeScript suite: **448 passed** across 40 files. React `act(...)` warnings and jsdom canvas warnings were present but did not fail the suite.
- No ROS 2 launch/build or live Jetson validation was run from this Windows checkout.

## Research references

These are upstream/community sources used for candidate comparison, not instructions to mix distro binaries:

- [ROS 2 Control](https://github.com/ros-controls/ros2_control)
- [`diff_drive_controller`](https://github.com/ros-controls/ros2_controllers/tree/jazzy/diff_drive_controller)
- [Navigation2](https://github.com/ros-navigation/navigation2)
- [SLAM Toolbox](https://github.com/SteveMacenski/slam_toolbox)
- [RTAB-Map ROS](https://github.com/introlab/rtabmap_ros)
- [twist_mux](https://github.com/ros-teleop/twist_mux)
- [teleop_twist_keyboard](https://github.com/ros2/teleop_twist_keyboard)
- [teleop_twist_joy](https://github.com/ros2/teleop_twist_joy)
- [DepthAI ROS](https://github.com/luxonis/depthai-ros)
- [LDROBOT LiDAR ROS 2 driver](https://github.com/ldrobotSensorTeam/ldlidar_stl_ros2)
- [Foxglove ROS 2 bridge](https://github.com/foxglove/foxglove-sdk/tree/main/ros/src/foxglove_bridge)
- [ROS diagnostics](https://github.com/ros/diagnostics)
- [rosbridge_suite](https://github.com/RobotWebTools/rosbridge_suite)
- [micro-ROS](https://github.com/micro-ROS)
