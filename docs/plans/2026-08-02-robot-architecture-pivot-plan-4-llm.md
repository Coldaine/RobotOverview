# Plan 4: LLM Autonomous Piloting & Edge Control

## Executive Summary
Adapting an LLM to directly command a high-latency `/cmd_vel` motor loop is inherently unsafe due to token generation speeds. Based on community state-of-the-art frameworks (like `llama_ros`, `HomeRobot`, and `ROSGPT`), the reliable approach is a **Hierarchical Skill-Based Architecture**. The LLM operates asynchronously as a planner, issuing structured target coordinates or intentions to local execution servers (Nav2) that handle the fast, deterministic 30Hz safety loops.

## The Architecture Stack

### 1. LLM Evaluation & Target Generation (The Commander)
- A Vision-Language Model (VLM, such as Qwen-VL or LLaMA-V) processes natural language inputs (e.g., "Drive to the blue door across the room").
- It can run locally on the Jetson Orin NX (leveraging TensorRT-LLM for massive inference speedups vs PyTorch) or via Wi-Fi from the browser/cloud.
- Using constrained decoding frameworks (like `vLLM` guided decoding or `Outlines`), the LLM strictly outputs structured JSON, bypassing conversational filler.
  Example output: `{"skill": "nav2_pose", "target_coordinate": [3.5, -2.1, 1.57]}`

### 2. LLM Bridge Node
- A dedicated ROS 2 node subscribes to the LLM's JSON target messages.
- It translates these JSON goals into standard `nav2_msgs/action/NavigateToPose` actions.

### 3. Nav2 Local Execution (The Worker)
- The ROS 2 Navigation Stack (`nav2`) receives the target pose and calculates the path, avoiding obstacles utilizing the new LiDAR pipeline (Plan 2).
- It independently commands `/cmd_vel` at a tight, deterministic control loop (20-50Hz), isolating robot motion from LLM token latency.

## Edge Teleop Optimization (Token Streaming)
If the user commands an immediate action ("Spin left right now"), the system utilizes **Token Streaming**.
- As the LLM generates tokens, a parser listens. The moment it detects `[SPIN_LEFT]`, it triggers an immediate twist command at the ROS bridge.
- The command is continuously fed to `twist_mux` by the local ROS node until the LLM outputs `[STOP_SPIN]`.
- At all times, the robot's fundamental `cmd_vel_timeout` (Plan 1) ensures that if the LLM crashes or Wi-Fi drops, the underlying driver halts the spin immediately.