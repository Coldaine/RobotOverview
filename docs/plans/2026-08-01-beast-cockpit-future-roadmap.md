# 2026-08-01 BEAST Cockpit Future Roadmap
*Status: Draft*

## 1. Audit Findings: Cockpit GUI & Codebase
An audit of the current GUI and codebase (`src/app/cockpit/` and `src/components/cockpit/`) was conducted. Here is the assessed state of the BEAST-01 Command Deck:

*   **`CockpitClient` (`/cockpit` route):** Acts as the central dashboard hub. Integrates real-time connection state management via ROS websockets. Displays a beautifully structured layout holding the Safety Strip, Spatial View, Optics Wall, Command Rail, Telemetry Row, and Honesty Rail. Solid handling of degraded setups (missing `BEAST_COCKPIT_WS_URL`).
*   **`OpticsWall`:** Subscribes to `/oak/rgb/image_raw/compressed` and `/cockpit/depth/compressed`. Handles frame counting manually on refs to avoid React re-render thrashing (an excellent performance pattern for high-Hz feeds). Includes a dynamic overhead clearance safety HUD (connected to `useCockpitOverheadClearance`). Highlights a placeholder 5MP PT Camera feed marked as standby.
*   **`SpatialView`:** High-quality HTML5 Canvas rendering for LiDAR scan points, range rings, and robot odometry (`/scan` and `/cmd_vel` odometry from EKF). Accurately renders a structural blind sector (45°-134.5° rear crop). Includes zoom controls and visualizes missing data smoothly.
*   **`CommandRail`:** Displays the active `twist_mux` ladder priority (E-STOP, BT pads, UI teleop, nav2). Features WASD keyboard drive integration piping directly to `/cmd_vel_ui`. Handles Gimbal (Pan/Tilt) position commands and LED states directly.

**Quality Assessment:** The codebase represents a robust, highly polished Next.js React application. It utilizes modern techniques (Canvas for high-frequency point clouds, ref-based image tag updates for video feeds, `lucide-react` icons, dark-themed complex Tailwind CSS styling). There is excellent separation of concerns and consideration for rendering performance.

---

## 2. Future Roadmap & Enhancements

### 2.1 Optics Wall: 3D Renderings & Semantic Understanding
*   **Feature:** Incorporate 3D Point Cloud visualization utilizing the existing OAK-D depth data.
*   **Implementation Idea:** Instead of just a 2D colorized depth map, stream a sparse voxel or point cloud array derived from `/oak/points`. Render it in a `<Canvas>` utilizing `react-three-fiber` and `three.js`. This allows the operator to rotate and inspect the depth topography directly in the browser.
*   **Feature:** Real-time Bounding Box Overlays (Semantic AI).
*   **Implementation Idea:** Leverage the Jetson Orin's ML inference (YOLOv8/MobileNet). Have the ROS stack output a `vision_msgs/Detection2DArray` topic, and subscribe to it on the Command Deck to draw localized bounding-box SVGs or canvas strokes dynamically over the `RGB` feed in `OpticsWall`.

### 2.2 Spatial View & Autonomous Navigation
*   **Feature:** Map visualizer (`nav2` map) and Click-to-Nav.
*   **Implementation Idea:** Overlay the Canvas in `SpatialView` with a `/map` OccupancyGrid or parsed map tiles. Add interactive functionality where the operator can click on the canvas, convert the local pixel coordinate to the global map frame, and publish a `geometry_msgs/PoseStamped` to `/goal_pose` to invoke `nav2` autonomy directly from the UI.
*   **Feature:** LiDAR History & Decay Trails.
*   **Implementation Idea:** Keep a short rolling buffer of older LiDAR scans. Render them with decreasing opacity and slight color shifting to visualize the robot's physical traversal trails and dynamic obstacles over previous seconds.

### 2.3 Command Rail & Teleop Enhancements
*   **Feature:** Browser Gamepad Integration.
*   **Implementation Idea:** Enhance the `CommandRail` driving logic to listen to the browser's native `navigator.getGamepads()` API, falling back to UI teleop on the `twist_mux` ladder. This allows generic USB/Bluetooth controllers connected directly to the operator's PC to send `/cmd_vel_ui` without requiring OS-level ROS joy bindings.
*   **Feature:** Auto-Tracking Gimbal Mode.
*   **Implementation Idea:** Introduce an "Auto-Track" toggle for the Pan/Tilt mechanism. When active, it calculates the center offset of an AI-identified target box and applies a software PID loop to auto-adjust `pan` and `tilt` state strings, keeping the target perfectly centered in the 5MP PT Camera feed.

### 2.4 Agentic Copilot Integration
*   **Feature:** On-board LLM Diagnostic Assistant.
*   **Implementation Idea:** Feed the `/rosout` error logs and the telemetry arrays into an integrated context window in the sidebar. The operator can ask a chat box (e.g. "Why is nav2 refusing to move?") and the AI assistant retrieves diagnostic information directly from the `twist_mux`, overhead clearance, and `ekf` variables to provide human-readable troubleshooting based on current operational context.