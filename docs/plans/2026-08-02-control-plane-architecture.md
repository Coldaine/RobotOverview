# Control Plane Architecture: One Repository, Two Runtimes

## Source topology

RobotOverview is the single source repository. It contains two independently built and
deployed surfaces that run on different machines and serve different roles. Repository
co-location does not grant the web app robot-side safety authority.

### 1. `RobotOverview` (The Hangar / Cockpit)
- **Location:** `D:\_projects\RobotOverview` (Developed on the Windows PC / cloud, hosted externally or locally for the operator).
- **Stack:** Next.js, React, Tailwind, `roslibjs`.
- **Role:** The **Operator UI and Information Surface**. It renders telemetry, video feeds, logs, and provides teleoperation inputs (a virtual joystick/gamepad). 
- **Safety Authority:** **NONE.** It cannot guarantee motion stops. It cannot detect physical unplugs of hardware. It sends polite `geometry_msgs/Twist` requests over a WebSocket. 

### 2. `robot/beast/ros2_ws` (The Robot Brain)
- **Location:** Developed at `D:\_projects\RobotOverview\robot\beast\ros2_ws`, sparse-checked out and built on the Jetson Orin Nano at `~/beast/RobotOverview/robot/beast/ros2_ws`.
- **Stack:** Python, C++, ROS 2 Humble.
- **Role:** The **Hardware Control Plane**. It is the absolute authority on what the robot's motors do. It talks directly to the ESP32 microcontroller over `/dev/ttyACM0` via `ugv_bringup`, receives sensor data from the LiDAR and OAK-D, and handles SLAM/Nav2.
- **Safety Authority:** **TOTAL.** It multiplexes commands using `twist_mux`, enforces `cmd_vel_timeout` (halting the robot if the UI crashes or Wi-Fi drops), and evaluates physical hardware interlocks (e.g., "Ethernet is plugged in -> force zero velocity").

## The Boundary
The boundary between them is **`rosbridge_websocket`** running on the Jetson at port `9090`. 
- `RobotOverview` connects to `:9090` and acts as a standard pub/sub client. 
- The ROS runtime does not know or care that the client source shares its Git repository. It just sees an incoming `/cmd_vel_ui` stream.

## Why the Runtime Split?
Web browsers are stateless, pause background tabs, drop websockets, and suffer GC pauses.
They cannot own a real-time control loop or safety interlock. The robot-side ROS runtime
therefore remains independently deployable, safe, autonomous, and physically aware even if
the frontend Hangar app is completely offline. The monorepo removes source-management
overhead without weakening that runtime boundary.
