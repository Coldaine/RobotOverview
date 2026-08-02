# Plan 2: LiDAR Upgrades & `slam_toolbox` Integration

## Executive Summary
The LDROBOT LD19 is currently disabled at boot (`use_lidar:=false`) because raw scans crash standard SLAM algorithms and detect the robot's own mast. We will replace/update the driver stack in `ugv_ws` to provide clean, filtered geometric data.

## Implementation Steps

### 1. Driver Package Replacement
We will migrate from generic/unmaintained lidar nodes to the official (or heavily patched) `ldrobotSensorTeam/ldlidar_stl_ros2`. This driver natively supports LD19 metadata and exposes crucial filtering parameters.

### 2. Resolving the Variable Scan Length Bug
**The Problem**: The LD19 LiDAR's RPM fluctuates slightly, causing the number of points per 360° scan to vary (e.g., 478, then 482). ROS 2's `slam_toolbox` is highly optimized and drops scans that do not match a rigidly expected bin count, flooding logs and breaking maps.
**The Fix**: Insert a scan-filtering node (or enable the interpolation feature in the `ldlidar` driver) that resamples the raw array into exactly `480 bins` (0.75° resolution) per message before publishing to `/scan`.

### 3. Chassis / Mast Masking
**The Problem**: The LiDAR sits near the Beast's mast, meaning the 225°–315° sweep sees the mast a few centimeters away, registering it as a constant wall and confusing the localization algorithm's raycasting.
**The Fix**: Use angle cropping directly at the driver level.
- `enable_angle_crop_func`: `True`
- `angle_crop_min`: `225.0`
- `angle_crop_max`: `315.0`
This replaces the occluded rays with `NaN` or `inf`, which SLAM natively ignores.

### 4. Launch Integration
Modify `bringup_lidar.launch.py` to ensure `frame_id` specifically links to `base_laser_link` in the TF tree, and ensure `use_sim_time` is definitively `False` to prevent clock drifting between hardware stamps and the EKF node.