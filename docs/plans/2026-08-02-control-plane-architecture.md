# Control Plane Architecture: RobotOverview vs. ugv_ws

## The Two Repositories

The system is strictly divided into two completely separate repositories that run on different machines and serve entirely different roles. 

### 1. `RobotOverview` (The Hangar / Cockpit)
- **Location:** `D:\_projects\RobotOverview` (Developed on the Windows PC / cloud, hosted externally or locally for the operator).
- **Stack:** Next.js, React, Tailwind, `roslibjs`.
- **Role:** The **Operator UI and Information Surface**. It renders telemetry, video feeds, logs, and provides teleoperation inputs (a virtual joystick/gamepad). 
- **Safety Authority:** **NONE.** It cannot guarantee motion stops. It cannot detect physical unplugs of hardware. It sends polite `geometry_msgs/Twist` requests over a WebSocket. 

### 2. `ugv_ws` (The Robot Brain)
- **Location:** Developed on PC at `D:\_projects\ugv_ws`, synced and built on the Jetson Orin Nano at `~/beast/ugv_ws`.
- **Stack:** Python, C++, ROS 2 Humble.
- **Role:** The **Hardware Control Plane**. It is the absolute authority on what the robot's motors do. It talks directly to the ESP32 microcontroller over `/dev/ttyACM0` via `ugv_bringup`, receives sensor data from the LiDAR and OAK-D, and handles SLAM/Nav2.
- **Safety Authority:** **TOTAL.** It multiplexes commands using `twist_mux`, enforces `cmd_vel_timeout` (halting the robot if the UI crashes or Wi-Fi drops), and evaluates physical hardware interlocks (e.g., "Ethernet is plugged in -> force zero velocity").

## The Boundary
The boundary between them is **`rosbridge_websocket`** running on the Jetson at port `9090`. 
- `RobotOverview` connects to `:9090` and acts as a standard pub/sub client. 
- The ROS environment (`ugv_ws`) does not know or care that "RobotOverview" is a web app. It just sees an incoming `/cmd_vel_ui` stream.

## Why the Split?
This is a standard robotics pattern. Web browsers are stateless, pause background tabs, drop websockets, and suffer GC pauses. You cannot run a real-time 50Hz control loop or safety interlock in Chrome. By keeping `ugv_ws` completely decoupled, the robot remains safe, autonomous, and physically aware even if the frontend Hangar app is completely offline.