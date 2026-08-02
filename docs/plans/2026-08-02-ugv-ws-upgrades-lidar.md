# LD19 LiDAR Integration & ROS 2 Upgrades

## Overview
The UGV Beast uses an **LDROBOT LD19 (LDS19/STL-19P)** 2D LiDAR. Currently, it is launched with `use_lidar:=false` because it was not fully mapped into the navigation stack. To use it for SLAM/Nav2, we must update the `ugv_ws` repository dependencies and configurations.

## Driver
We recommend the official `ldrobotSensorTeam/ldlidar_stl_ros2` package, as it includes built-in angle cropping required to mask the Beast's chassis/mast blindspots.

## Known Issues to Fix in `ugv_ws`

### 1. The Variable-Length Scan Bug (`slam_toolbox` crash)
**The Problem:** The LD19 natively outputs scans with variable point counts (e.g., 478, then 482) depending on minute RPM fluctuations. `slam_toolbox` expects exactly the same number of points every frame. Variable lengths cause `slam_toolbox` to drop up to 70% of frames with errors like `LaserRangeScan contains N range readings, expected X`.
**The Fix:** The lidar driver node in `ugv_ws` must be patched or configured to interpolate/resample points into a fixed number of bins (e.g., exactly 480 points per spin).

### 2. Rear Mast Occlusion
**The Problem:** The physical mast blocks the rear view of the LiDAR (~225° to 315°). If this isn't masked, SLAM sees a permanent wall 5cm behind the robot.
**The Fix:** Enable angle cropping right in the driver parameter file so SLAM only gets the clean data.

## Recommended `ldlidar_node` Configuration
Update or add these parameters in the Jetson `ugv_ws` repository's lidar launch file:

```python
parameters=[
    {'product_name': 'LDLiDAR_LD19'},
    {'topic_name': 'scan'},
    {'frame_id': 'base_laser_link'},       # Must align with URDF
    {'port_name': '/dev/ttyACM1'},         # Ensure symlink is correct
    {'port_baudrate': 230400},
    {'laser_scan_dir': True},              # Counterclockwise
    {'enable_angle_crop_func': True},
    {'angle_crop_min': 225.0},             # Physical rear block
    {'angle_crop_max': 315.0},
    {'bins': 480}                          # Essential for slam_toolbox
]
```

Once configured, the Beast can be successfully brought up for mapping via:
```bash
ros2 launch ugv_bringup bringup_lidar.launch.py use_lidar:=true use_ekf:=true
ros2 launch slam_toolbox online_sync_launch.py
```