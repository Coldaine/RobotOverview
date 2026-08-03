# Third-party notices — beast_power

## LeoRover charging_monitor (vendored / adapted)

- Project: [LeoRover/leo_robot-ros2](https://github.com/LeoRover/leo_robot-ros2) (9 stars)
- File: `leo_bringup/scripts/charging_monitor` (ros2 branch; charging monitor merged Dec 2025)
- License: MIT (see upstream repository)
- Use: INA219 register map, calibration math, smbus2 open/read/write pattern,
  and soft-reset reconfiguration. Adapted for BEAST-01 topics
  (`sensor_msgs/BatteryState`, `std_msgs/Bool`), injectable fake bus, and 3S SOC.

Do **not** depend on the Galactic-era Pet-Series INA219 package; this tree
keeps a local copy under `beast_power/ina219.py` + `power_node.py`.
