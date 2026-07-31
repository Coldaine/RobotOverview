#!/usr/bin/env python3
"""cockpit_robot.launch.py — DRAFT, not wired into any package yet.

Top-level launch for BEAST-01's teleop cockpit. Run this ALONGSIDE the
existing `ugv_bringup` bringup launch (bringup_lidar.launch.py) — it does
not replace it, and it does not touch allow_motion. This file only stands
up the arbitration + telemetry-bridge layer that sits between operator
input devices and ugv_bringup's existing /cmd_vel subscription.

Composes:
  1. foxglove_bridge.launch.py (sibling file, included as-is) — the single
     network-facing piece; everything else here only talks to it over
     local ROS topics, never the network directly.
  2. twist_mux, configured from twist_mux.yaml (sibling file) — arbitrates
     every /cmd_vel_* source down to one /cmd_vel.
  3. teleop_twist_joy for the WORKSTATION gamepad path, configured from
     teleop_joy_operator.yaml (sibling file). Its `joy` input arrives
     over the network as sensor_msgs/Joy on /joy_operator, published by
     Foxglove's Joystick connector through foxglove_bridge's clientPublish
     capability — there is no local joy_node for this path, the bridge IS
     the joystick driver here.
  4. Optionally (launch arg `use_robot_gamepad`, default false): a local
     joy_node reading a Bluetooth gamepad PAIRED DIRECTLY TO THE ROBOT
     (not over the network) on /joy_robot, plus its own teleop_twist_joy
     instance -> /cmd_vel_joy_robot. This is the "someone is standing next
     to the robot with a controller" path — see twist_mux.yaml, priority
     150, deliberately above the remote operator (100) so a person on-site
     can always take over from a distracted/laggy remote session.

Path resolution note: this is a loose draft directory, not an installed
ROS package, so sibling config/launch files are located relative to this
file's own path rather than via get_package_share_directory(). If/when
this moves into a real package (e.g. a new `ugv_cockpit` package next to
`ugv_bringup` in ugv_ws/src/ugv_main/), switch THIS_DIR below to
`get_package_share_directory('ugv_cockpit')` and put twist_mux.yaml /
teleop_joy_operator.yaml under that package's installed `config/`, per
that package's setup.py data_files (see ugv_bringup's own setup.py for
the pattern already used in this workspace).
"""

import os

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

THIS_DIR = os.path.dirname(os.path.abspath(__file__))


def generate_launch_description():
    use_robot_gamepad_arg = DeclareLaunchArgument(
        'use_robot_gamepad', default_value='false',
        description=(
            'Bring up a second, robot-side teleop path for a Bluetooth '
            'gamepad paired directly to the Jetson (not over the network). '
            'Publishes /joy_robot -> /cmd_vel_joy_robot at twist_mux '
            'priority 150 (above the remote operator, below nothing but '
            'the e-stop lock). Leave false when nobody is physically at '
            'the robot with a paired controller — an idle joy_node still '
            'opens a device handle and is one more thing that can fail to '
            'find a controller and spam errors.'
        )
    )

    robot_gamepad_device_arg = DeclareLaunchArgument(
        'robot_gamepad_device_id', default_value='0',
        description=(
            "joy_node's device_id (enumeration index under /dev/input/js*) "
            'for the robot-paired gamepad. # VERIFY on-robot: index can '
            'shift if other input devices are present. Prefer switching '
            "this launch to joy_node's `device_name` param (exact string "
            'match) once the paired controller\'s reported name is known — '
            '`ros2 run joy joy_enumerate_devices` or inspect '
            '/dev/input/by-id/ on the robot to find it.'
        )
    )

    # --- 1. Telemetry + command bridge (the only networked piece) --------
    foxglove_bridge_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(THIS_DIR, 'foxglove_bridge.launch.py')
        )
    )

    # --- 2. Arbitration: every /cmd_vel_* source -> one /cmd_vel ----------
    twist_mux_yaml = os.path.join(THIS_DIR, 'twist_mux.yaml')
    twist_mux_node = Node(
        package='twist_mux',
        executable='twist_mux',
        # No `name=` override: the twist_mux node hard-codes its own name
        # to "twist_mux" (see TwistMux::TwistMux() in twist_mux.cpp), which
        # is also the top-level key twist_mux.yaml uses — leave both alone
        # so they keep matching.
        output='screen',
        parameters=[twist_mux_yaml, {'use_sim_time': False}],
        # twist_mux always publishes to the fixed relative topic
        # "cmd_vel_out" (not a parameter — see twist_mux.cpp). Remap it to
        # the exact topic ugv_bringup already subscribes to.
        remappings=[('/cmd_vel_out', '/cmd_vel')],
    )

    # --- 3. Operator (workstation gamepad, via foxglove-joystick) --------
    teleop_operator_yaml = os.path.join(THIS_DIR, 'teleop_joy_operator.yaml')
    teleop_operator_node = Node(
        package='teleop_twist_joy',
        executable='teleop_node',
        # Must match teleop_joy_operator.yaml's top-level key exactly —
        # ROS 2 matches a parameters-file's top-level key against the
        # node's resolved name at load time; a mismatch means the file's
        # parameters silently fail to apply (or the node errors at start,
        # depending on version). Keeping this explicit rather than relying
        # on whatever the package's internal default name happens to be.
        name='teleop_twist_joy_node',
        output='screen',
        parameters=[teleop_operator_yaml],
        remappings=[
            ('joy', '/joy_operator'),
            ('cmd_vel', '/cmd_vel_joy_operator'),
        ],
    )

    # --- 4. Optional: robot-paired BT gamepad -----------------------------
    joy_robot_node = Node(
        package='joy',
        executable='joy_node',
        name='joy_node_robot',
        output='screen',
        parameters=[{
            'device_id': LaunchConfiguration('robot_gamepad_device_id'),
            'deadzone': 0.05,
            'autorepeat_rate': 20.0,
            'sticky_buttons': False,
            # VERIFY: `coalesce_interval_ms` (milliseconds, int) is the
            # current param name on the `joy` package's `ros2` development
            # branch. Some Humble-era apt builds may still expose the
            # older `coalesce_interval` (seconds, float) instead — check
            # `ros2 param list /joy_node_robot` on the robot if this
            # param is rejected at startup.
            'coalesce_interval_ms': 10,
        }],
        remappings=[('joy', '/joy_robot')],
        condition=IfCondition(LaunchConfiguration('use_robot_gamepad')),
    )

    teleop_robot_node = Node(
        package='teleop_twist_joy',
        executable='teleop_node',
        name='teleop_twist_joy_robot',
        output='screen',
        parameters=[{
            # Inline rather than a shared YAML: this is a physically-local
            # operator standing next to a slow tracked robot, a different
            # risk profile than the remote workstation path. Values below
            # intentionally mirror teleop_joy_operator.yaml's crawl-safe
            # defaults for now (same 0.2 / 0.4 m/s, 1.0 rad/s) rather than
            # granting a higher ceiling just because they're on-site —
            # revisit only after the on-robot heartbeat-stop re-test in
            # docs/beast-ops.md passes and the physical gamepad's actual
            # button layout is confirmed.
            'require_enable_button': True,
            'enable_button': 5,        # RB — # VERIFY against the actual
            'enable_turbo_button': 4,  # LB —  paired controller's mapping,
                                       # native joy_node button order can
                                       # differ from a browser Gamepad API
                                       # order (see teleop_joy_operator.yaml)
            'axis_linear': {'x': 1},
            'axis_angular': {'yaw': 0},
            'scale_linear': {'x': 0.2},
            'scale_linear_turbo': {'x': 0.4},
            'scale_angular': {'yaw': 1.0},
            'scale_angular_turbo': {'yaw': 1.0},
            'publish_stamped_twist': False,
        }],
        remappings=[
            ('joy', '/joy_robot'),
            ('cmd_vel', '/cmd_vel_joy_robot'),
        ],
        condition=IfCondition(LaunchConfiguration('use_robot_gamepad')),
    )

    return LaunchDescription([
        use_robot_gamepad_arg,
        robot_gamepad_device_arg,
        foxglove_bridge_launch,
        twist_mux_node,
        teleop_operator_node,
        joy_robot_node,
        teleop_robot_node,
    ])
