# WaveShare UGV ROS2 Humble

![GitHub top language](https://img.shields.io/github/languages/top/waveshareteam/ugv_ws)
![GitHub language count](https://img.shields.io/github/languages/count/waveshareteam/ugv_ws)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/waveshareteam/ugv_ws)
![GitHub repo size](https://img.shields.io/github/repo-size/waveshareteam/ugv_ws)
![GitHub last commit (branch)](https://img.shields.io/github/last-commit/waveshareteam/ugv_ws/main)

## 1. Introduction of Function Package

<details open>
<summary><strong>1.1 Package Tree</strong></summary>

```text
ugv_ws
|-- README.md
|-- build_common.sh
|-- build_first.sh
|-- requirements.txt
|-- ros2.sh
|-- save_map.sh
|-- src
    |-- ugv_else
    |   |-- cartographer
    |   |-- costmap_converter
    |   |-- emcl2_ros2
    |   |-- explore_lite
    |   |-- gmapping
    |   |-- gz_ros2_control
    |   |-- ldlidar
    |   |-- rf2o_laser_odometry
    |   |-- robot_pose_publisher
    |   |-- teb_local_planner
    |   |-- vizanti
    |-- ugv_main
        |-- ugv_bringup
        |-- ugv_chat_ai
        |-- ugv_description
        |-- ugv_gazebo
        |-- ugv_msgs
        |-- ugv_nav
        |-- ugv_slam
        |-- ugv_tools
        |-- ugv_vision
        |-- ugv_voice
        |-- ugv_web_app
```

</details>

---

<details>
<summary><strong>1.2. Package Description</strong></summary>

#### README.md
This file provides an overview of the project, including usage instructions, build steps, and general documentation.

#### build_common.sh
This script allows users to select specific packages to compile.

#### build_first.sh
This script is used for the initial build process, typically to set up the environment and compile essential packages in the correct order.

#### requirements.txt
This file lists the Python dependencies required by the project and is used with pip to install them.

#### save_map.sh
This script is used to save the current SLAM map to disk during mapping.

#### ros2.sh
The script on the vehicle is used to disable the ugv-app service that starts automatically on the vehicle by default, and to start the container and enable the container's remote SSH login service. 

The script on the virtual machine is used to start the container, enable the container's remote SSH login service, and enter the container.

<details>
<summary><strong>ugv_else</strong></summary>

This folder contains third-party auxiliary ROS 2 software packages used by the UGV system, primarily for radar driving, laser odometry, mapping, positioning, path planning, automated exploration, and web applications.

- **cartographer**: This package provides 2D SLAM mapping and pure localization configuration based on Google Cartographer.
- **costmap_converter**: This package converts costmap data into polygon or obstacle representations for local planners.
- **emcl2_ros2**: This package implements EMCL (Monte Carlo Localization) for robot localization.
- **explore_lite**: This package provides autonomous exploration functionality for map building.
- **gmapping**: This package provides 2D SLAM using the GMapping algorithm.
- **gz_ros2_control**: This package provides ros2_control controller architecture with the Gazebo Harmonic simulator.
- **ldlidar**: This package is the driver for LiDAR sensors.
- **rf2o_laser_odometry**: This package provides laser-based odometry using the RF2O algorithm.
- **robot_pose_publisher**: This package publishes the robot pose by listening to TF transformations.
- **teb_local_planner**: This package provides a Timed Elastic Band (TEB) local planner for navigation.
- **vizanti**: This package provides a visual and control interface for a web application.

</details>

<details>
<summary><strong>ugv_main</strong></summary>

This folder contains the core software package of the UGV system, including functions such as robot description, simulation, navigation, perception, interaction, and web app applications.

- **ugv_bringup**: This package provides UGV driving functionality and wheel odometry.
- **ugv_chat_ai**: This package provides a web application built with Flask that allows for interaction and task control using a large language model.
- **ugv_description**: This package provides the Xacro description model and mesh file for UGV.
- **ugv_gazebo**: This package provides Gazebo simulation support, including the world and the model.
- **ugv_msgs**: This package provides a custom ROS2 message and service interface for UGV.
- **ugv_nav**: This package provides navigation-related configurations.
- **ugv_slam**: This package provides SLAM-related configuration and simple use of LiDAR functions.
- **ugv_tools**: This package provides common tools and utilities for teleoperation and control.
- **ugv_vision**: This package provides vision-related functions.
- **ugv_voice**: This package provides voice interaction.
- **ugv_web_app**: This package provides a web-based application for monitoring and controlling the UGV during SLAM.

</details>

</details>

---

## 2. Environment

<details open>
<summary><strong>2.1. Base</strong></summary>

- Operating System: Ubuntu 22.04

- ROS Version: ROS2 Humble

- PC Software:

    - Simulation: VMware Workstation 17 Pro / Oracle VM VirtualBox 

    - Real Robot: MobaXterm (remote access & terminal)

- Lidar model：[ld19](https://www.waveshare.com/d500-lidar-kit.htm), [stl27l](https://www.waveshare.com/dtof-lidar-stl27l.htm)

- Depth cam model: [oak-d-lite](https://www.waveshare.com/oak-d-lite.htm)

- UGV model：

    - ugv_rover

        | ugv-rover-ros2-kit | ugv-rover-pt-jetson-orin-ros2-kit |
        |-------------------|----------------------------------|
        | <a href="https://www.waveshare.com/ugv-rover-ros2-kit.htm"> <img width="200" height="200" alt="ugv-rover-ros2-kit" src="https://github.com/user-attachments/assets/3999d94e-e788-4c8b-92d5-cc56bf23fb03"> </a> | <a href="https://www.waveshare.com/ugv-rover-pt-jetson-orin-ros2-kit.htm"> <img width="200" height="200" alt="ugv-rover-pt-jetson-orin-ros2-kit" src="https://github.com/user-attachments/assets/82144645-0d6a-436a-9536-5794b1bd4dd0"> </a> |

    - ugv_beast 

        | ugv-beast-ros2-kit | ugv-beast-pt-jetson-orin-ros2-kit |
        |-------------------|----------------------------------|
        | <a href="https://www.waveshare.com/ugv-beast-ros2-kit.htm"> <img width="200" height="200" alt="Image" src="https://github.com/user-attachments/assets/70ab8885-1409-432f-9eb2-81bf6fdf1739"> </a> | <a href="https://www.waveshare.com/ugv-beast-pt-jetson-orin-ros2-kit.htm"> <img width="200" height="200" alt="Image" src="https://github.com/user-attachments/assets/6ad04d98-2e9b-43f2-96bc-4fd758d7fbaa">  </a> |

</details>

---

<details>
<summary><strong>2.2. Build from source</strong></summary>

#### Download source code

```jsx
git clone -b main https://github.com/waveshareteam/ugv_ws.git
```
    
#### First compilation

- Modify "build_first.sh"

    <img width="400" height="300" alt="Image" src="https://github.com/user-attachments/assets/3ef79a11-3971-41f7-a8a0-3c56d0806f2b" />

- Execute script

    ```jsx
    cd /home/ws/ugv_ws && bash build_first.sh
    ```

    <span style="color:red;">This script will install dependencies, select the model, and perform the initial compilation.</span>

#### Daily compilation

```jsx
cd /home/ws/ugv_ws && bash build_common.sh
```  

<img width="500" height="600" alt="Image" src="https://github.com/user-attachments/assets/1e2e2e98-f475-47d4-b5b0-eb1ef4ac858c" />

This script allows users to select a specific package and perform the compilation.

</details>

---

<details>
<summary><strong>2.3. Factory image</strong></summary>

- Oracle VM VirtualBox(simulator) image:
    - [VM_ROS2](https://drive.google.com/file/d/1BUiWwmoEM_r46liVtBiZyStXq5lhEM2j/view?usp=sharing)
- UGV image:

    Visit the wiki page for technical support.
    - [UGV_Rover_PI_ROS2](https://www.waveshare.com/wiki/UGV_Rover_PI_ROS2)
    - [UGV_Beast_PI_ROS2](https://www.waveshare.com/wiki/UGV_Beast_PI_ROS2)
    - [UGV_Rover_Jetson_Orin_ROS2](https://www.waveshare.com/wiki/UGV_Rover_Jetson_Orin_ROS2)
    - [UGV_Beast_Jetson_Orin_ROS2](https://www.waveshare.com/wiki/UGV_Beast_Jetson_Orin_ROS2)

</details>

---

## 3. Use

**Note: The ROS packages in the factory-provided images are all used within containers.**

**Use `screen` to run multiple tasks simultaneously, for instructions on using `screen`, please refer to section `3.1.4. Control the robot`.**

use_rviz: enable rviz visualization (true/false)

<details open>
<summary><strong>3.1. Real Robot on UGV</strong></summary>

---

<details>
<summary><strong>3.1.1. Prepare</strong></summary>

- Start the vehicle, use MobarXterm to remotely access the host to stop the `ugv-app` service, start the container and allow SSH remote access to the container.

    ```jsx
    cd /home/ws/ugv_ws && bash ros2.sh
    ```
        
- Use MobarXterm to remotely access the container so that it can be used for a subsequent visualization interface.
    
    <img width="600" height="150" alt="Image" src="https://github.com/user-attachments/assets/f821dbca-984d-49bf-901d-e8689ddee19c" />

    
    <img width="600" height="100" alt="Image" src="https://github.com/user-attachments/assets/1ac35635-1029-4a59-99ac-1a5aa18e2e6b" />

    login as: 

    ```jsx
    root
    ```
    
    root@ip's password: 

    ```jsx
    ws
    ```
    
- Enter workspace
    
    ```jsx
    cd /home/ws/ugv_ws
    ```
</details>

---

<details>
<summary><strong>3.1.2. View model joints</strong></summary>

<span style="color:red;">Note: The environment variables of the factory image have been pre-set with UGV_MODEL and LDLIDAR_MODEL.</span>

Restore default environment variables

```jsx
source ~/.bashrc
```   

- lidar model: ld06, ld19, stl27l

- ugv model: 

    <details>
    <summary>rasp_rover</summary>

    Temporarily set the UGV_MODEL environment variable
    
    ```jsx
    export UGV_MODEL=rasp_rover
    ```
    
    Start up
    
    ```jsx
    ros2 launch ugv_description display.launch.py use_rviz:=true
    ```
    
    <img width="400" height="300" alt="Image" src="https://github.com/user-attachments/assets/e6c79ee9-d675-45b6-88a6-438dd4045e83" />

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    </details>

    <details>
    <summary>ugv_rover</summary>

    Temporarily set the UGV_MODEL environment variable
    
    ```jsx
    export UGV_MODEL=ugv_rover
    ```
    
    Start up
    
    ```jsx
    ros2 launch ugv_description display.launch.py use_rviz:=true
    ```
    
    <img width="400" height="300" alt="Image" src="https://github.com/user-attachments/assets/ad5af7a4-8867-4f92-a996-43b03fce98f5" />

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    </details>

    <details>
    <summary>ugv_beast</summary>

    Temporarily set the UGV_MODEL environment variable
    
    ```jsx
    export UGV_MODEL=ugv_beast
    ```
    
    Start up
    
    ```jsx
    ros2 launch ugv_description display.launch.py use_rviz:=true
    ```
    
    <img width="400" height="300" alt="Image" src="https://github.com/user-attachments/assets/77299b75-739b-4a86-b20e-abee9abbff9f" />

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    </details>
    
</details>

---

<details>
<summary><strong>3.1.3. Bring up the robot</strong></summary>

- Start up 
    
    ```jsx
    ros2 launch ugv_bringup bringup_lidar.launch.py use_rviz:=true
    ```
    
    Rotate the car in place to check the posture.

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

---

<details>
<summary><strong>3.1.4. Control the robot</strong></summary>

Use `screen` to run multiple tasks simultaneously.

- Start a screen session

    ```jsx
    screen
    ```

    <img width="600" height="400" alt="Image" src="https://github.com/user-attachments/assets/bbad152d-cc28-45e6-b058-1489c4b11d18" />

- Create new windows

    Press `Ctrl + A`, then `C` to create a new window and run this.
    
    - Start up 

        ```jsx
        ros2 launch ugv_bringup bringup_lidar.launch.py use_rviz:=true
        ```
    
        Press `Ctrl + A`, then `C` again to create another window and run this.

        <details>
        <summary>Search for battery voltage by topic</summary>

        ```jsx
        ros2 topic echo /ugv/voltage --once
        ```    

        Reply content:

        ```jsx
        header:
        stamp:
            sec: 0
            nanosec: 0
        frame_id: ''
        voltage: 11.90999984741211
        temperature: 0.0
        current: 0.0
        charge: 0.0
        capacity: 0.0
        design_capacity: 0.0
        percentage: 0.9452381134033203
        power_supply_status: 0
        power_supply_health: 0
        power_supply_technology: 0
        present: true
        cell_voltage: []
        cell_temperature: []
        location: ''
        serial_number: ''
        ```

        - voltage value range: (0.0, 12.6)
        - percentage: (0.0, 1.0)

        </details>

        <details>
        <summary>Control the LED lights by topic</summary>

        ```jsx
        ros2 topic pub /ugv/led_ctrl std_msgs/msg/Float32MultiArray "{data: [0.0, 0.0]}" --once
        ```    

        data[0] control the light IO4 near the oak camera, data[1] control the light IO5 near the usb camera.

        - data[0-1] value range: (0.0, 255.0)

        </details>

        <details>
        <summary>Control the gimbal by topic</summary>

        ```jsx
        ros2 topic pub /pt_joint_position_controller/commands std_msgs/msg/Float64MultiArray "{data: [0.0,0.0]}" --once
        ```    
        
        data[0] control the Joint1 (X), data[1] control the Joint2 (Y)
        - data[0] value range: (-3.14, 3.14)
            
        - data[1] value range: (-0.523, 1.5708)

        </details>

        <details>
        <summary>Control the car's speed and gimbal using a keyboard</summary>

        ```jsx
        ros2 run ugv_tools keyboard_ctrl
        ```
        
        <img width="400" height="350" alt="Image" src="https://github.com/user-attachments/assets/8c910b89-c215-4b2b-9de6-b3a17e8c8531" />

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

        </details>

        <details>
        <summary>Control the car's speed, LED lights, and gimbal using a game controller</summary>

        The joystick USB interface needs to be connected to the car
        
        ```jsx
        ros2 launch ugv_tools teleop_twist_joy.launch.py \
        xspeed_limit:=0.5 \
        yspeed_limit:=0.5 \
        angular_speed_limit:=1.0
        ```

        | Control                | Action                                   |
        |------------------------|------------------------------------------|
        | LEFT_TRIGGER(L1)       | Decrease speed level                     |
        | LEFT_BUMPER(L2)        | Increase speed level                     |
        | Left Stick X           | Linear velocity (X axis)                 |
        | Left Stick Y           | Angular velocity (Z axis)                |
        | Right Stick X          | Gimbal joint 1 rotation                  |
        | Right Stick Y          | Gimbal joint 2 rotation                  |
        | Right Stick Click      | Reset gimbal to 0 position               |
        | RIGHT_TRIGGER(L1)      | Decrease LED brightness                  |
        | RIGHT_BUMPER(L2)       | Increase LED brightness                  |

        - speed value range

            - actual_speed = max_speed × speed_level

            - speed_lever: [0.25, 0.5, 0.75, 1.0]

            - max_speed: 

                - xspead_limit: 

                    - ugv_rover: 1.3 m/s

                    - ugv_beast: 0.35 m/s

                - yspead_limit (not used): 0.5 m/s

                - angular_spead_limit: 1.0 rad/s

        - led value range: (0.0, 255.0)

        - gimbal value range 

            - joint1 range: (-3.14, 3.14)
                
            - joint2 range: (-0.523, 1.5708)

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

        </details>

    Press `Ctrl + A`, then `P` to view the previous window.

    Press `Ctrl + A`, then `N` to view the next window.

    Input `exit`, then press `Enter` to destory the current window.

    For more commands related to screen, please refer to [screen](https://www.gnu.org/software/screen/manual/screen.html).

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>  

---

<details>
<summary><strong>3.1.5. Lidar interaction</strong></summary>

<span style="color:red;">Note: Please ensure the environment is open and clean.</span>
- Start up 
        
    ```jsx
    ros2 launch ugv_bringup bringup_lidar.launch.py use_rviz:=true
    ```

    - follow
    
        ```jsx
        ros2 run ugv_slam lidar_follow
        ```

        Follow the nearest object within 0.1-0.5m.

        - target_dist: 0.2 m  

        <span style="color:red;"> Before stopping the program, please lift the robot off the ground. </span> 

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

        To immediately stop the robot, publish a zero velocity command:

        ```jsx
        ros2 topic pub /cmd_vel geometry_msgs/msg/Twist --once
        ```

    - guard

        ```jsx
        ros2 run ugv_slam lidar_guard
        ```

        Always facing the nearest object.

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>
        
        To immediately stop the robot, publish a zero velocity command:

        ```jsx
        ros2 topic pub /cmd_vel geometry_msgs/msg/Twist --once
        ```

    - obstacle_avoidance

        ```jsx
        ros2 run ugv_slam lidar_obstacle_avoidance
        ```

        - safe_dist: 0.3 m 

        This node performs simple reactive obstacle avoidance using LaserScan and Odometry.
        The robot moves forward by default and executes predefined turning maneuvers (90° or 180°) when obstacles are detected in the front region.

        <span style="color:red;"> Before stopping the program, please lift the robot off the ground. </span> 

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

        To immediately stop the robot, publish a zero velocity command:

        ```jsx
        ros2 topic pub /cmd_vel geometry_msgs/msg/Twist --once
        ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

---

<details>
<summary><strong>3.1.6. Visual interaction</strong></summary>

- Start up 
        
    ```jsx
    ros2 launch ugv_bringup bringup_lidar.launch.py use_rviz:=true
    ```
    <details>
    <summary>Monocular</summary>

    - Turn on the camera

        ```jsx
        ros2 launch ugv_vision camera.launch.py
        ```

        <span style="color:red;">While running the following programs, view the camera feed through the webpage `http://ip:8889/cam/`, replace `ip`  with the actual IP address of the UGV.</span>

        <details>
        <summary>Camera raw frames</summary>

        ```jsx
        ros2 run ugv_vision cam_webrtc
        ```

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

        </details>

        <details>
        <summary>Color line</summary>

        - Color select

            ```jsx
            ros2 run ugv_vision color_select
            ```
            <img width="1000" height="400" alt="Image" src="https://github.com/user-attachments/assets/d56b7444-2949-439b-b41b-a627fccd48ea" />

            Adjust the threshold by sliding the window slider.

            <span style="color:red;">After hovering the mouse over the image, press `Esc` to stop this node, then run the other node.</span>

            The threshold range just selected.

            <img width="600" height="60" alt="Image" src="https://github.com/user-attachments/assets/46c7da18-460a-4834-864f-0f75c61e221f" />

        - Car follow

            <span style="color:red;">Please lift the robot off the ground first.</span>

            <span style="color:red;"> Wait until the camera preview in the browser successfully detects the line and the system enters <strong>TrackState.FOLLOW</strong>, then place the robot back on the ground. </span>

            ```jsx
            ros2 run ugv_vision color_line_follow \
                --ros-args \
                -p lower_l:=0 \
                -p lower_a:=100 \
                -p lower_b:=187 \
                -p upper_l:=255 \
                -p upper_a:=255 \
                -p upper_b:=255
            ```

            <span style="color:red;"> Before stopping the program, please lift the robot off the ground. </span> 
            
            <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

            To immediately stop the robot, publish a zero velocity command:

            ```jsx
            ros2 topic pub /cmd_vel geometry_msgs/msg/Twist --once
            ```

        </details>

        <details>
        <summary>Color ball</summary>

        - Color select

            ```jsx
            ros2 run ugv_vision color_select
            ```
            <img width="800" height="300" alt="Image" src="https://github.com/user-attachments/assets/3eecaf93-41d6-4aaf-8660-84cfe8ffd021" />

            Adjust the threshold by sliding the window slider.

            <span style="color:red;">After hovering the mouse over the image, press `Esc` to stop this node, then run the other node.</span>

            The threshold range just selected.
            <img width="600" height="60" alt="Image" src="https://github.com/user-attachments/assets/7f4cfb33-d2b3-43b7-95c0-cfc707f4d899" />
            
        - Pt track

            ```jsx
            ros2 run ugv_vision pt_color_ball_track \
                --ros-args \
                -p lower_l:=0 \
                -p lower_a:=0 \
                -p lower_b:=85 \
                -p upper_l:=255 \
                -p upper_a:=130 \
                -p upper_b:=110
            ```
            <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

            Publish a zero pt position command:

            ```jsx
            ros2 topic pub /pt_joint_position_controller/commands std_msgs/msg/Float64MultiArray "{data: [0.0,0.0]}" --once
            ```    

        - Car track

            <span style="color:red;">Please lift the robot off the ground first.</span>

            <span style="color:red;">When the camera preview in the browser successfully detects the ball, place the robot back on the ground.</span>

            ```jsx
            ros2 run ugv_vision color_ball_track \
                --ros-args \
                -p lower_l:=0 \
                -p lower_a:=0 \
                -p lower_b:=85 \
                -p upper_l:=255 \
                -p upper_a:=130 \
                -p upper_b:=110
            ```
            - target_distance: 0.2 m

            - target_yaw: 0.0 rad

            <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

            To immediately stop the robot, publish a zero velocity command:

            ```jsx
            ros2 topic pub /cmd_vel geometry_msgs/msg/Twist --once
            ```

        </details>

        <details>
        <summary>Face</summary>

        - Pt track

            ```jsx
            ros2 run ugv_vision pt_face_track
            ```
            <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

            Publish a zero pt position command:

            ```jsx
            ros2 topic pub /pt_joint_position_controller/commands std_msgs/msg/Float64MultiArray "{data: [0.0,0.0]}" --once
            ```    

        - Car track

            <span style="color:red;">Please lift the robot off the ground first.</span>

            <span style="color:red;">When the camera preview in the browser successfully detects the face, place the robot back on the ground.</span>

            ```jsx
            ros2 run ugv_vision face_track
            ```
            
            <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

            To immediately stop the robot, publish a zero velocity command:

            ```jsx
            ros2 topic pub /cmd_vel geometry_msgs/msg/Twist --once
            ```

        </details>

        <details>
        <summary>Gesture(Gesture-based number recognition needs improvement)</summary>

        - Pt ctrl

            ```jsx
            ros2 run ugv_vision pt_gesture_ctrl
            ```
            number 1 : Rotate to align with the center of gesture 1

            number 2 : Flash and take a picture，'output.jpg' will be saved in the current folder where the program is running, overwriting the existing file.

            <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

            Publish a zero pt position command:

            ```jsx
            ros2 topic pub /pt_joint_position_controller/commands std_msgs/msg/Float64MultiArray "{data: [0.0,0.0]}" --once
            ```    

        - Car ctrl

            <span style="color:red;">Please lift the robot off the ground first.</span>

            <span style="color:red;">When the camera preview in the browser successfully detects the gesture, place the robot back on the ground.</span>   

            ```jsx
            ros2 run ugv_vision gesture_ctrl
            ```
            number 1 : Rotate to align with the center of gesture 1

            number 3 : forward
            
            number 4 : backward

            <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

            To immediately stop the robot, publish a zero velocity command:

            ```jsx
            ros2 topic pub /cmd_vel geometry_msgs/msg/Twist --once
            ```

        </details>

        <details>
        <summary>Apriltag</summary>

        Current settings for apriltag are tag36h11, id 0, tag_size 0.063.

        [apriltag generator](https://chaitanyantr.github.io/apriltag.html)

        <img width="500" height="400" alt="Image" src="https://github.com/user-attachments/assets/6d4a1ea7-a6ec-46fd-b727-0c6cd0d6be7c" />

        - Pt track

            ```jsx
            ros2 run ugv_vision pt_apriltag_track
            ```
            <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

            Publish a zero pt position command:

            ```jsx
            ros2 topic pub /pt_joint_position_controller/commands std_msgs/msg/Float64MultiArray "{data: [0.0,0.0]}" --once
            ```    

        - Car track

            <span style="color:red;">Please lift the robot off the ground first.</span>

            <span style="color:red;">When the camera preview in the browser successfully detects the apriltag, place the robot back on the ground.</span>

            ```jsx
            ros2 run ugv_vision apriltag_track
            ```

            <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

            - target_distance: 0.3 m
            
            To immediately stop the robot, publish a zero velocity command:

            ```jsx
            ros2 topic pub /cmd_vel geometry_msgs/msg/Twist --once
            ```

        </details>

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    </details>

    <details>
    <summary>Depth</summary>

    <span style="color:red;">While running the following programs, view the camera feed through the webpage `http://ip:8889/cam/`, replace `ip`  with the actual IP address of the UGV.</span>

    <details>
    <summary>Camera raw frames</summary>

    ```jsx
    ros2 run ugv_vision cam_oak_webrtc
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    </details>

    <details>
    <summary>Color ball</summary>

    - Color select

        ```jsx
        ros2 run ugv_vision oak_color_select
        ```

        <img width="800" height="300" alt="Image" src="https://github.com/user-attachments/assets/12981c81-0604-4859-bbdf-c9d2bd1a035a" />

        Adjust the threshold by sliding the window slider.

        <span style="color:red;">After hovering the mouse over the image, press `Esc` to stop this node, then run the other node.</span>

        The threshold range just selected.

        <img width="600" height="60" alt="Image" src="https://github.com/user-attachments/assets/7f4cfb33-d2b3-43b7-95c0-cfc707f4d899" />

    - Car track

        <span style="color:red;">Please lift the robot off the ground first.</span>

        <span style="color:red;">When the camera preview in the browser successfully detects the ball, place the robot back on the ground.</span>

        ```jsx
        ros2 run ugv_vision oak_color_ball_track \
            --ros-args \
            -p lower_l:=0 \
            -p lower_a:=0 \
            -p lower_b:=85 \
            -p upper_l:=255 \
            -p upper_a:=130 \
            -p upper_b:=110
        ```

        - target_distance: 0.25 m
            
        - target_yaw: 0.0 rad

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    </details>

    <details>
    <summary>Object</summary>

    - Car track

        <span style="color:red;">Please lift the robot off the ground first.</span>

        <span style="color:red;">When the camera preview in the browser successfully detects the object, place the robot back on the ground.</span>

        ```jsx
        ros2 run ugv_vision oak_object_track \
            --ros-args \
            -p track_id:=12 \
        ```

        - target_distance: 0.3 m
        
        The current settings for oak_object_track are only id 12 (dog).

        - object labelMap:

            ["background", "aeroplane", "bicycle", "bird", "boat", "bottle", "bus", "car", "cat", "chair", "cow","diningtable", "dog", "horse", "motorbike", "person", "pottedplant", "sheep", "sofa", "train", "tvmonitor"]

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    </details>

    </details>

<span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

---

<details>
<summary><strong>3.1.7. Voice interaction</strong></summary>

<details>
<summary>Voice interaction by topics</summary>

```jsx
ros2 run ugv_voice voice_ctrl \
    --ros-args -p language:=en
```
- language: zh/en
    <details>
    <summary>Keyword spotting</summary>

    - start

        ```jsx
        ros2 topic pub /kws std_msgs/Bool "{data: true}" --once
        ```

    - stop

        ```jsx
        ros2 topic pub /kws std_msgs/Bool "{data: false}" --once
        ```

    - keyword: 

        - zh: 

            ```jsx
            小爱同学
            小薇小薇
            小艺小艺
            张伟张伟
            ```

        - en: 

            ```jsx
            HELLO WORLD
            HI GOOGLE
            HEY SIRI
            ALEXA
            LOVE AND PEACE
            PLAY MUSIC
            GO HOME
            HAPPY NEW YEAR
            MERRY CHRISTMAS
            ```

        See README.md([zh](src/ugv_main/ugv_voice/ugv_voice/models/kws/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01/README.md)/[en](src/ugv_main/ugv_voice/ugv_voice/models/kws/sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01/README.md)) for further modifications.

    </details>

    <details>
    <summary>Speech recognition</summary>

    - start

        ```jsx
        ros2 topic pub /asr std_msgs/Bool "{data: true}" --once
        ```

    - stop

        ```jsx
        ros2 topic pub /asr std_msgs/Bool "{data: false}" --once
        ```

    </details> 

    <details>
    <summary>Text to speech</summary>

    ```jsx
    ros2 topic pub /tts std_msgs/String "{data: 'Hello robot'}" --once
    ```

    ```jsx
    ros2 topic pub /tts std_msgs/String "{data: '你好，机器人'}" --once
    ```

    Does not support mixed Chinese and English

    </details>

<span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>
        
<details>
<summary>Simple speech interaction with LLM</summary>

```jsx
ros2 run ugv_voice voice_chat \
    --ros-args \
    -p language:=en \
    -p server_url:=http://ip:11434/api/chat
```
It uses [ollama](https://github.com/ollama/ollama#chat-with-a-model) to run llm `qwen3:8b`.

- language: zh/en
- server_url: `http://ip:11434/api/chat`

    Replace `ip` with the actual IP address of the ollama server.

- keyword: 

    - zh: 

        ```jsx
        小爱同学
        小薇小薇
        小艺小艺
        张伟张伟
        ```

    - en: 

        ```jsx
        HELLO WORLD
        HI GOOGLE
        HEY SIRI
        ALEXA
        LOVE AND PEACE
        PLAY MUSIC
        GO HOME
        HAPPY NEW YEAR
        MERRY CHRISTMAS
        ```

        See README.md([zh](src/ugv_main/ugv_voice/ugv_voice/models/kws/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01/README.md)/[en](src/ugv_main/ugv_voice/ugv_voice/models/kws/sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01/README.md)) for further modifications.

<span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

</details>

---

<details>

<summary><strong>3.1.8. Mapping</strong></summary>

After the map is built, execute the script to save the map.

```jsx
cd /home/ws/ugv_ws && bash save_map.sh
```

Map saved folder： `/home/ws/ugv_ws/src/ugv_main/ugv_nav/maps`

<details>
<summary>2D (LiDAR)</summary>

- Gmapping
    
    ```jsx
    ros2 launch ugv_slam gmapping.launch.py use_rviz:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>
    
- Cartographer
    
    ```jsx
    ros2 launch ugv_slam cartographer.launch.py use_rviz:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- Slam_toolbox
    
    - sync

        ```jsx
        ros2 launch ugv_slam slam_toolbox.launch.py use_slam:=sync use_rviz:=true
        ```

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    - async

        ```jsx
        ros2 launch ugv_slam slam_toolbox.launch.py use_slam:=async use_rviz:=true
        ```

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

<details>
<summary>3D (lidar + depth camera)</summary>

- Rtabmap

    - Rtabmap_viz Visualization
        
        ```jsx
        ros2 launch ugv_slam rtabmap.launch.py use_viz:=true
        ```

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    - Rviz Visualization

        ```jsx
        ros2 launch ugv_slam rtabmap.launch.py use_rviz:=true
        ```

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    After the mapping is completed, directly press `Ctrl + C` to exit the mapping node, and the system will automatically save the map. 
    
    Map saved folder: `/root/.ros/rtabmap.db` 

</details>

</details>

---

<details>
<summary><strong>3.1.9. Navigation</strong></summary>

<details>
<summary>Local localization</summary>

use_localization: amcl(default)，emcl，cartographer, slam_toolbox, rtabmap

- amcl
    
    After startup, you need to manually specify the approximate initial position
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localization:=amcl use_rviz:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- emcl
    
    After startup, you need to manually specify the approximate initial position
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localization:=emcl use_rviz:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- cartographer
    
    <span style="color:red;">Note: you need to use cartographer to build the map before you can proceed.</span>
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localization:=cartographer use_rviz:=true
    ```
    
    After startup, if the accurate position has not been located, you can control the car and simply move it to assist in the initial positioning.
    
    ```jsx
    ros2 run ugv_tools keyboard_ctrl
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- slam_toolbox
    
    <span style="color:red;">Note: you need to use slam_toolbox to build the map before you can proceed.</span>

    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localization:=slam_toolbox use_rviz:=true
    ```
    After startup, if the accurate position has not been located, you can control the car and simply move it to assist in the initial positioning.
    
    ```jsx
    ros2 run ugv_tools keyboard_ctrl
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- rtabmap

    <span style="color:red;">Note: you need to use rtabmap to build the map before you can proceed.</span>

    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localization:=rtabmap use_rviz:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

<details>
<summary>Local navigation</summary>

use_localplan: dwa，teb (default), rpp, mppi

- dwa
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localplan:=dwa use_rviz:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- teb
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localplan:=teb use_rviz:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- rpp
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localplan:=rpp use_rviz:=true
    ```     

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- mppi
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localplan:=mppi use_rviz:=true
    ```     

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

<details>
<summary>Navigating with Keepout Zones</summary>

Please view this document first [prepare-filter-mask](https://docs.nav2.org/tutorials/docs/navigation2_with_keepout_filter.html#prepare-filter-mask), prepare a filter mask pgm, rename it to mask.pgm and replace the file (src/ugv_main/ugv_nav/maps/mask.pgm) in this location.

Copy map.yaml (src/ugv_main/ugv_nav/maps/map.yaml) and rename it to mask.yaml and replace the file(src/ugv_main/ugv_nav/maps/mask.yaml).

```jsx
ros2 launch ugv_nav nav.launch.py use_keepout_zones:=true use_rviz:=true
```     

</details>

<details>
<summary>Mapping and navigation are enabled at the same time (slam_toolbox)</summary>

```jsx
ros2 launch ugv_nav nav.launch.py use_slam:=true use_rviz:=true 
```

- Rviz manually publishes navigation points for exploration (you can also use the keyboard, handle, and web side for remote exploration)
    

- Automatic exploration (to be in a closed rule area)
    
    ```jsx
    ros2 launch explore_lite explore.launch.py 
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

</details>      

---

<details>
<summary><strong>3.1.10. Web ai interaction</strong></summary>

- Start the car
    
    ```jsx
    ros2 launch ugv_bringup bringup_lidar.launch.py use_rviz:=true
    ```
    
    - Start related interfaces
        
        ```jsx
        ros2 run ugv_tools behavior_ctrl
        ```
    
    - Web ai Interaction (requires relevant ai interface, currently ollama local deployment)
        
        ```jsx
        ros2 run ugv_chat_ai app \
        --ros-args \
        -p server_url:=http://ip:11434/api/chat
        ```

        It uses [ollama](https://github.com/ollama/ollama#chat-with-a-model) to run llm `qwen3:8b`.
        
        - server_url: `http://ip:11434/api/chat`

            Replace `ip` with the actual IP address of the ollama server.

        View the camera feed through the webpage `http://ip:5000`, replace `ip`  with the actual IP address of the UGV.

        Send some prompts to the AI ​​so that it can respond with JSON instructions to control the robot's movement.

        ```jsx
        You are an assistant helping me with the simulator for robots.
        Here are some tips you can use to command the robot.
        {"T": "1", "type": type, "data": data}
        type: drive_on_heading back_up spin stop
        data: num
        you should return only json in code,without explanation
        for examples,
        "user": "move 2 units forward."
        "assistant": {"T": 1, "type": "drive_on_heading", "data": 2}

        "user": "move 2 units back."
        "assistant": {"T": 1, "type": "back_up", "data": 2}

        "user": "turn left 30 degrees."
        "assistant": {"T": 1, "type": "spin", "data": 30}

        "user": "stop."
        "assistant": {"T": 1, "type": "stop", "data": 0}
        ```

        <img width="600" height="400" alt="Image" src="https://github.com/user-attachments/assets/c72fcc92-d43d-454c-837d-9e3ef24f5940" />

<span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>  

---

<details>
<summary><strong>3.1.11. Web side control</strong></summary>
 
- Start mapping

    Please refer to section `3.1.7. Mapping`. 

    ```jsx
    ros2 launch ugv_slam slam_toolbox.launch.py use_slam:=sync use_rviz:=true
    ```

    - Web
        
        ```jsx
        ros2 launch ugv_web_app bringup.launch.py 
        ```

<span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

---

<details>
<summary><strong>3.1.12. Command interaction </strong></summary>

<span style="color:red;">**Note: you need to put the car down and run, and judge whether the goal has been completed based on the odometer**</span>
    
```jsx
ros2 run ugv_tools behavior_ctrl
```

<details>
<summary>Basic control </summary>

- Start the car
    
    ```jsx
    ros2 launch ugv_bringup bringup_lidar.launch.py use_rviz:=true
    ```

    - Forward data unit meters

        ```jsx
        ros2 action send_goal /behavior ugv_msgs/action/Behavior "{command: '[{\"T\": 1, \"type\": \"drive_on_heading\", \"data\": 0.1}]'}"
        ```

    - Back data unit meters

        ```jsx
        ros2 action send_goal /behavior ugv_msgs/action/Behavior "{command: '[{\"T\": 1, \"type\": \"back_up\", \"data\": 0.1}]'}"
        ```

    -  Rotation data unit degree ,positive number left rotation, negative number right rotation

        ```jsx
        ros2 action send_goal /behavior ugv_msgs/action/Behavior "{command: '[{\"T\": 1, \"type\": \"spin\", \"data\": -1}]'}"
        ```

    - Stop

        ```jsx
        ros2 action send_goal /behavior ugv_msgs/action/Behavior "{command: '[{\"T\": 1, \"type\": \"stop\", \"data\": 0}]'}"
        ```

<span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

<details>
<summary>Navigation interaction</summary>

- Start the car

    ```jsx
    ros2 launch ugv_nav nav.launch.py use_rviz:=true
    ```

    - Get current point position
        
        ```jsx
        ros2 topic echo /robot_pose --once
        ```
        
    - Save as navigation point
        
        data Navigation point name, optional a-g
        
        ```jsx
        ros2 action send_goal /behavior ugv_msgs/action/Behavior "{command: '[{\"T\": 1, \"type\": \"save_map_point\", \"data\": \"a\"}]'}"
        ```
    
    - Move to navigation point
        
        data Navigation point name, optional a-g
        
        ```jsx
        ros2 action send_goal /behavior ugv_msgs/action/Behavior "{command: '[{\"T\": 1, \"type\": \"pub_nav_point\", \"data\": \"a\"}]'}"
        ```
    
    The saved points will also be stored in the file.

<span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

<span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>
</details>

</details>

---

<details open>
<summary><strong>3.2. Simulation on VMware Workstation 17Pro / Oracle VM VirtualBox</strong></summary>

---

<details>
<summary><strong>3.2.1. Prepare</strong></summary>

- Start the VMware Workstation 17 Pro / Oracle VM VirtualBox, start the container and allow SSH remote access to the container.

    ```jsx
    cd /home/ws/ugv_ws && bash ros2.sh
    ```

- Open a new window and execute the following command to visualize the container graphical interface.

    ```jsx
    xhost +
    ```

</details>

---

<details>
<summary><strong>3.2.2. View model joints</strong></summary>

<span style="color:red;">Note: The environment variables of the factory image have been pre-set with UGV_MODEL and LDLIDAR_MODEL.</span>

Restore default environment variables

```jsx
source ~/.bashrc
```   

- lidar model: ld06, ld19, stl27l

- ugv model: 

    <details>
    <summary>rasp_rover</summary>

    Temporarily set the UGV_MODEL environment variable
    
    ```jsx
    export UGV_MODEL=rasp_rover
    ```
    
    Start up
    
    ```jsx
    ros2 launch ugv_description display.launch.py use_rviz:=true
    ```
    
    <img width="400" height="300" alt="Image" src="https://github.com/user-attachments/assets/e6c79ee9-d675-45b6-88a6-438dd4045e83" />

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    </details>

    <details>
    <summary>ugv_rover</summary>

    Temporarily set the UGV_MODEL environment variable
    
    ```jsx
    export UGV_MODEL=ugv_rover
    ```
    
    Start up
    
    ```jsx
    ros2 launch ugv_description display.launch.py use_rviz:=true
    ```
    
    <img width="400" height="300" alt="Image" src="https://github.com/user-attachments/assets/ad5af7a4-8867-4f92-a996-43b03fce98f5" />

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    </details>

    <details>
    <summary>ugv_beast</summary>

    Temporarily set the UGV_MODEL environment variable
    
    ```jsx
    export UGV_MODEL=ugv_beast
    ```
    
    Start up
    
    ```jsx
    ros2 launch ugv_description display.launch.py use_rviz:=true
    ```
    
    <img width="400" height="300" alt="Image" src="https://github.com/user-attachments/assets/77299b75-739b-4a86-b20e-abee9abbff9f" />

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    </details>

</details>

---

<details>
<summary><strong>3.2.3. Bring up the robot</strong></summary>

- Start up 
    
    ```jsx
    ros2 launch ugv_gazebo bringup_gazebo.launch.py use_rviz:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

---

<details>
<summary><strong>3.2.4. Control the robot</strong></summary>

- Start up 

    ```jsx
    ros2 launch ugv_gazebo bringup_gazebo.launch.py use_rviz:=true
    ```

    <details>
    <summary>Control the gimbal by topic</summary>

    ```jsx
    ros2 topic pub /pt_joint_position_controller/commands std_msgs/msg/Float64MultiArray "{data: [0.0,0.0]}" --once
    ```   

    data[0] control the Joint1 (X), data[1] control the Joint2 (Y)

    - data[0] value range: (-3.14, 3.14)
        
    - data[1] value range: (-0.523,1.5708)

    </details>

    <details>
    <summary>Control the car's speed and gimbal using a keyboard</summary>

    ```jsx
    ros2 run ugv_tools keyboard_ctrl
    ```

    <img width="400" height="350" alt="Image" src="https://github.com/user-attachments/assets/8c910b89-c215-4b2b-9de6-b3a17e8c8531" />

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    </details>

    <details>
    <summary>Control the car's speed, LED lights, and gimbal using a game controller</summary>

    The joystick USB interface needs to be connected to the pc

    ```jsx
    ros2 launch ugv_tools teleop_twist_joy.launch.py \
    xspeed_limit:=0.5 \
    yspeed_limit:=0.5 \
    angular_speed_limit:=1.0
    ```
    
    | Control                | Action                                   |
    |------------------------|------------------------------------------|
    | LEFT_TRIGGER(L1)       | Decrease speed level                     |
    | LEFT_BUMPER(L2)        | Increase speed level                     |
    | Left Stick X           | Linear velocity (X axis)                 |
    | Left Stick Y           | Angular velocity (Z axis)                |
    | Right Stick X          | Gimbal joint 1 rotation                  |
    | Right Stick Y          | Gimbal joint 2 rotation                  |
    | Right Stick Click      | Reset gimbal to 0 position               |
    | RIGHT_TRIGGER(L1)      | Decrease LED brightness                  |
    | RIGHT_BUMPER(L2)       | Increase LED brightness                  |

    - speed value range

        - actual_speed = max_speed × speed_level

        - speed_lever: [0.25, 0.5, 0.75, 1.0]

        - max_speed: 

            - xspead_limit: 

                - ugv_rover: 1.3 m/s

                - ugv_beast: 0.35 m/s

            - yspead_limit (not used): 0.5 m/s

            - angular_spead_limit: 1.0 rad/s

    - led value range: (0.0, 255.0)

    - gimbal value range 

        - joint1 range: (-3.14, 3.14)
            
        - joint2 range: (-0.523, 1.5708)            

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    </details>

</details>

---

<details>
<summary><strong>3.2.5. Mapping</strong></summary>

After the map is built, execute the script to save the map.

```jsx
cd /home/ws/ugv_ws && bash save_map.sh
```

Map saved folder： `src/ugv_main/ugv_nav/maps`

<details>
<summary>2D (LiDAR)</summary>

- Gmapping
    
    ```jsx
    ros2 launch ugv_slam gmapping.launch.py use_rviz:=true use_sim_time:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- Cartographer
    
    ```jsx
    ros2 launch ugv_slam cartographer.launch.py use_rviz:=true use_sim_time:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- Slam_toolbox
    
    - sync
    
        ```jsx
        ros2 launch ugv_slam slam_toolbox.launch.py use_slam:=sync use_rviz:=true use_sim_time:=true
        ```

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    - async

        ```jsx
        ros2 launch ugv_slam slam_toolbox.launch.py use_slam:=async use_rviz:=true use_sim_time:=true
        ```

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

<details>
<summary>3D (lidar + depth camera)</summary>

- Rtabmap

    - Rtabmap_viz Visualization
        
        ```jsx
        ros2 launch ugv_slam rtabmap.launch.py use_viz:=true use_sim_time:=true
        ```

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    - Rviz Visualization

        ```jsx
        ros2 launch ugv_slam rtabmap.launch.py use_rviz:=true use_sim_time:=true
        ```

        <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

    After the mapping is completed, directly press ctrl+c to exit the mapping node, and the system will automatically save the map. Map default save path ~/.ros/rtabmap.db 

</details>

</details>

---

<details>
<summary><strong>3.2.6. Navigation</strong></summary>

<details>
<summary>Local localization</summary>

use_localization: amcl（default），emcl，cartographer, slam_toolbox, rtabmap

- amcl
    
    After startup, you need to manually specify the approximate initial position.
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localization:=amcl use_rviz:=true use_sim_time:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- emcl
    
    After startup, you need to manually specify the approximate initial position.
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localization:=emcl use_rviz:=true use_sim_time:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- cartographer
    
    <span style="color:red;">Note: you need to use cartographer to build the map before you can proceed.</span>

    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localization:=cartographer use_rviz:=true use_sim_time:=true
    ```
    
    After startup, if the accurate position has not been located, you can control the car and simply move it to assist in the initial positioning.
    
    ```jsx
    ros2 run ugv_tools keyboard_ctrl
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- slam_toolbox
    
    <span style="color:red;">Note: you need to use slam_toolbox to build the map before you can proceed.</span>
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localization:=slam_toolbox use_rviz:=true use_sim_time:=true
    ```

    After startup, if the accurate position has not been located, you can control the car and simply move it to assist in the initial positioning.
    
    ```jsx
    ros2 run ugv_tools keyboard_ctrl
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- rtabmap
    
    <span style="color:red;">Note: you need to use rtabmap to build the map before you can proceed.</span>
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localization:=rtabmap use_rviz:=true use_sim_time:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>
    
<details>
<summary>Local navigation</summary>

use_localplan: dwa，teb (default), rpp, mppi

- dwa
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localplan:=dwa use_rviz:=true use_sim_time:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- teb
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localplan:=teb use_rviz:=true use_sim_time:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>
            
- rpp
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localplan:=rpp use_rviz:=true use_sim_time:=true
    ```      

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

- mppi
    
    ```jsx
    ros2 launch ugv_nav nav.launch.py use_localplan:=mppi use_rviz:=true use_sim_time:=true
    ```     

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

<details>
<summary>Navigating with Keepout Zones</summary>

Please view this document first [prepare-filter-mask](https://docs.nav2.org/tutorials/docs/navigation2_with_keepout_filter.html#prepare-filter-mask), prepare a filter mask pgm, rename it to mask.pgm and replace the file (src/ugv_main/ugv_nav/maps/mask.pgm) in this location.

Copy map.yaml (src/ugv_main/ugv_nav/maps/map.yaml) and rename it to mask.yaml and replace the file(src/ugv_main/ugv_nav/maps/mask.yaml).

```jsx
ros2 launch ugv_nav nav.launch.py use_keepout_zones:=true use_rviz:=true
```     

</details>

<details>
<summary>Mapping and navigation are enabled at the same time (slam_toolbox)</summary>

```jsx
ros2 launch ugv_nav nav.launch.py use_slam:=true use_rviz:=true use_sim_time:=true
```

- Rviz manually publishes navigation points for exploration (you can also use the keyboard, handle, and web side for remote exploration)
    

- Automatic exploration (to be in a closed rule area)
    
    ```jsx
    ros2 launch explore_lite explore.launch.py use_sim_time:=true
    ```

    <span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

</details>

---

<details>
<summary><strong>3.2.7. Web ai interaction</strong></summary>

- Start the car
    
    ```jsx
    ros2 launch ugv_bringup bringup_lidar.launch.py use_rviz:=true
    ```
    
    - Start related interfaces
        
        ```jsx
        ros2 run ugv_tools behavior_ctrl
        ```
    
    - Web ai Interaction (requires relevant ai interface, currently ollama local deployment)
        
        ```jsx
        ros2 run ugv_chat_ai app \
        --ros-args \
        -p server_url:=http://ip:11434/api/chat
        ```

        It uses [ollama](https://github.com/ollama/ollama#chat-with-a-model) to run llm `qwen3:8b`.
        
        - server_url: `http://ip:11434/api/chat`

            Replace `ip` with the actual IP address of the ollama server.

        View the camera feed through the webpage `http://ip:5000`, replace `ip`  with the actual IP address of the UGV.

        Send some prompts to the AI ​​so that it can respond with JSON instructions to control the robot's movement.

        ```jsx
        You are an assistant helping me with the simulator for robots.
        Here are some tips you can use to command the robot.
        {"T": "1", "type": type, "data": data}
        type: drive_on_heading back_up spin stop
        data: num
        you should return only json in code,without explanation
        for examples,
        "user": "move 2 units forward."
        "assistant": {"T": 1, "type": "drive_on_heading", "data": 2}

        "user": "move 2 units back."
        "assistant": {"T": 1, "type": "back_up", "data": 2}

        "user": "turn left 30 degrees."
        "assistant": {"T": 1, "type": "spin", "data": 30}

        "user": "stop."
        "assistant": {"T": 1, "type": "stop", "data": 0}
        ```

        <img width="600" height="400" alt="Image" src="https://github.com/user-attachments/assets/c72fcc92-d43d-454c-837d-9e3ef24f5940" />
    
<span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>  
 
---

<details>
<summary><strong>3.2.8. Web side control</strong></summary>

- Start mapping

    Please refer to section `3.2.5. Mapping`. 

    ```jsx
    ros2 launch ugv_slam slam_toolbox.launch.py use_slam:=sync use_rviz:=true use_sim_time:=true
    ```

    - Web
        
        ```jsx
        ros2 launch ugv_web_app bringup.launch.py 
        ```

<span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>
    
---

<details>
<summary><strong>3.2.9. Command interaction</strong></summary>
    
```jsx
ros2 run ugv_tools behavior_ctrl
```

<details>
<summary>Basic control </summary>

- Start up
    
    ```jsx
    ros2 launch ugv_gazebo bringup_gazebo.launch.py use_rviz:=true use_sim_time:=true
    ```

    - Forward data unit meters

        ```jsx
        ros2 action send_goal /behavior ugv_msgs/action/Behavior "{command: '[{\"T\": 1, \"type\": \"drive_on_heading\", \"data\": 0.1}]'}"
        ```

    - Back data unit meters

        ```jsx
        ros2 action send_goal /behavior ugv_msgs/action/Behavior "{command: '[{\"T\": 1, \"type\": \"back_up\", \"data\": 0.1}]'}"
        ```

    -  Rotation data unit degree ,positive number left rotation, negative number right rotation

        ```jsx
        ros2 action send_goal /behavior ugv_msgs/action/Behavior "{command: '[{\"T\": 1, \"type\": \"spin\", \"data\": -1}]'}"
        ```

    - Stop

        ```jsx
        ros2 action send_goal /behavior ugv_msgs/action/Behavior "{command: '[{\"T\": 1, \"type\": \"stop\", \"data\": 0}]'}"
        ```

<span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>

</details>

<details>
<summary>Navigation interaction</summary>

- Start up

    ```jsx
    ros2 launch ugv_nav nav.launch.py use_rviz:=true use_sim_time:=true
    ```

    - Get current point position
        
        ```jsx
        ros2 topic echo /robot_pose --once
        ```
    
    - Save as navigation point
        
        data Navigation point name, optional a-g
        
        ```jsx
        ros2 action send_goal /behavior ugv_msgs/action/Behavior "{command: '[{\"T\": 1, \"type\": \"save_map_point\", \"data\": \"a\"}]'}"
        ```
    
    - Move to navigation point
        
        data Navigation point name, optional a-g
        
        ```jsx
        ros2 action send_goal /behavior ugv_msgs/action/Behavior "{command: '[{\"T\": 1, \"type\": \"pub_nav_point\", \"data\": \"a\"}]'}"
        ```
    
    The saved points will also be stored in the file.

<span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>  

</details>

<span style="color:red;">Press `Ctrl + C` to stop the current program before running the other one.</span>
</details>

</details>

---