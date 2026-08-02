# LLM Autonomous Control & Teleop Plan

## Core Philosophy
We will NOT have the LLM stream `/cmd_vel` directly. Direct streaming suffers from conversational latency, token generation stutters, and network jitter, resulting in a dangerous, jerky robot.

Instead, we will use a **Hierarchical Skill-Based Architecture**.

### The Control Loop
1. **The Core Base Driver (`ugv_bringup`)**: The Jetson handles motor safety. If no `/cmd_vel` arrives within 0.5s (`cmd_vel_timeout`), it halts. This is our unbreachable physical safety net.
2. **Intermediate Safety Mux (`twist_mux`)**: This node sits between high-level autonomous planners, gamepad teleop, and the base driver. E-Stop or gamepad overrides always take priority 1.
3. **The Local Executing Agency (Nav2 / SLAM)**: Generates the actual smooth 30Hz `/cmd_vel` curve to reach a destination, performing local obstacle avoidance. 
4. **The LLM Commander Node**:
   - The user types a natural language command ("Drive slowly down the hallway and stop at the blue door") into the web UI over Wi-Fi.
   - The API (cloud or heavily quantized edge LLM via TensorRT-LLM/llama.cpp) parses the text.
   - It outputs a structured JSON target: `{"skill": "nav2_pose", "target": "hallway_blue_door", "max_vel": 0.2}`.
   - The ROS LLM Bridge Node parses the JSON and dispatches an Action Client request to Nav2 or a custom intermediate controller.
   - The LLM's latency (1-3 seconds) is absorbed at the *planning* tier, not the *execution* tier.

## Required Implementation
1. **ROSBridge WebSocket**: Already implemented on port 9090.
2. **ROS 2 LLM Node (Patterned off `llama_ros` or `ros2-llm`)**:
   - Subscribes to `/chatbot_commands` (String).
   - Generates action states.
   - Publishes to `/goal_pose` or distinct Action Servers.
3. **Fast Teleoperation Mode (Token Streaming)**:
   - For direct remote driving ("rotate left"), the LLM must use constrained decoding (e.g. `Outlines`) to only output enum commands like `[CMD: ROTATE_LEFT]`. 
   - A dedicated parser converts this immediately to a burst of `/cmd_vel` and latches it until a `[CMD: STOP]` token is streamed.

## Inspiration Repos
- [alsora/llama_ros](https://github.com/alsora/llama_ros) - Best for running Llama.cpp natively within ROS 2 C++ nodes to avoid python/network latency on the Orin.
- [fzi-forschungszentrum-informatik/ROSGPT](https://github.com/fzi-forschungszentrum-informatik/ROSGPT) - Good reference for the JSON-to-ROS-topic parsing layer.