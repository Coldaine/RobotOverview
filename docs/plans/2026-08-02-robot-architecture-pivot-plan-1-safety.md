# Plan 1: Jetson-Native Safety & Motion Lock Architecture

## Executive Summary
We are completely abandoning browser-side safety authority. The UI will no longer have E-Stop heartbeats, tab elections, or JavaScript-based timeouts. A disabled network connection natively stops the robot, and physically plugged-in tethers will physically block motion at the robot's hardware interface natively.

## The Architecture

### 1. The Ultimate Backstop: `cmd_vel_timeout`
ROS 2 differential drive standards rely on the base controller (or a multiplexer) to enforce command freshness.
- In `ugv_bringup`, the base driver implements a `cmd_vel_timeout` of `0.5s`.
- If the browser closes, crashes, or drops Wi-Fi, the `/cmd_vel_ui` stream stops.
- Within 500ms, the robot halts. **No continuous browser heartbeat is required.**

### 2. The Physical Tether Interlock Node (`ugv_safety_monitor`)
A new lightweight ROS 2 Python/C++ node deployed on the Jetson Orin Nano evaluates physical hardware states and manages the `allow_motion` flag.
- **Ethernet Detection**: Reads `/sys/class/net/eth0/carrier`. If `1` (cable connected), force `allow_motion: false` with reason `ETHERNET_LOCK`.
- **Charging Detection**: Reads the UPS I2C bus (once wired). If positive current flow or external voltage is detected, force `allow_motion: false` with reason `CHARGING_LOCK`.
- **Safe State**: If untethered and not charging, state defaults safely to `ARMED`/`ENABLED`.

### 3. Override Capability
- An authorized SSH operator or specific ROS 2 service call can issue a manual override (e.g., `ros2 service call /ugv/safety/override std_srvs/srv/SetBool "{data: true}"`).
- The override temporarily suppresses the tether checks to allow testing the robot while plugged in.

### 4. UI as a Stateless Telemetry Monitor
The Hangar web app (`RobotOverview`) will simply subscribe to `/cockpit/status` to render the active lock reason. If it says `ETHERNET_LOCK`, the UI shows Ethernet Lock. It exerts zero influence over this computation.