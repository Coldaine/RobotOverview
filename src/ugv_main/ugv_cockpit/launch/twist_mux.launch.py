"""BEAST-01 command spine — twist_mux in front of /cmd_vel.

This launch file stands up the ONE node that is allowed to publish
geometry_msgs/Twist on /cmd_vel. Every other velocity source in this
workspace publishes to a twist_mux input topic instead (see
config/twist_mux.yaml for the priority ladder, and
ugv_cockpit/test/test_twist_mux_spine.py for the test that fails if anyone
reintroduces a direct /cmd_vel publisher).

It is included unconditionally by ugv_bringup's bringup_lidar.launch.py, so
the spine is up whenever the thing that drives the ESP32 is up. That coupling
is deliberate and fail-closed: with every source rerouted, a bringup without
twist_mux simply has no path to the motors at all.

What this file does NOT do:
  * It does not touch `allow_motion`. That gate lives entirely in
    ugv_bringup and is still the thing that decides whether a non-zero
    command reaches the ESP32.
  * It does not replace ugv_bringup's 0.5 s cmd_vel_timeout watchdog.
    twist_mux never publishes a stop of its own — on source silence it
    simply stops emitting. The watchdog is the only thing in the chain
    guaranteed to notice silence and act on it.
  * It does not open a network port. The cockpit bridge (foxglove_bridge)
    and the operator teleop path land in PR-2.
"""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description():
    default_config = os.path.join(
        get_package_share_directory('ugv_cockpit'),
        'config',
        'twist_mux.yaml',
    )

    twist_mux_config_arg = DeclareLaunchArgument(
        'twist_mux_config',
        default_value=default_config,
        description=(
            'Path to the twist_mux ros__parameters file that declares the '
            'command priority ladder. Overriding this replaces the safety '
            'arbitration policy — do not point it at anything that has not '
            'been through the same review as the default.'
        ),
    )

    use_sim_time_arg = DeclareLaunchArgument(
        'use_sim_time', default_value='false',
        description=(
            'Use /clock instead of wall time. Must be true under Gazebo, '
            'otherwise every source expires immediately against a sim clock '
            'that starts near zero.'
        ),
    )

    twist_mux_node = Node(
        package='twist_mux',
        executable='twist_mux',
        # No `name=` override: the twist_mux node hard-codes its own name to
        # "twist_mux" (TwistMux::TwistMux() in twist_mux.cpp), which is also
        # the top-level key twist_mux.yaml uses — leave both alone so they
        # keep matching. A rename here silently drops the whole ladder.
        output='screen',
        parameters=[
            LaunchConfiguration('twist_mux_config'),
            {
                'use_sim_time': ParameterValue(
                    LaunchConfiguration('use_sim_time'), value_type=bool
                ),
            },
        ],
        # twist_mux always publishes to the fixed relative topic
        # "cmd_vel_out" (not a parameter — see twist_mux.cpp). Remap it to
        # the exact topic ugv_bringup already subscribes to.
        remappings=[('cmd_vel_out', '/cmd_vel')],
        # DELIBERATELY NO `respawn=`. Every velocity source in the workspace
        # publishes to a mux input, so if twist_mux dies /cmd_vel simply has
        # no publisher and the robot stops (ugv_bringup's 0.5 s cmd_vel
        # watchdog sees the silence and sends a stop). That is the
        # fail-closed direction, and it is the behaviour we want on a crash:
        # a mux crash is a safety event, not a hiccup to paper over.
        #
        # Auto-respawning would instead bring the arbiter back up in a fresh,
        # empty state — notably with the e-stop lock RELEASED, since lock
        # state does not survive a restart (see the client contract in
        # config/twist_mux.yaml). A robot that resumes accepting commands
        # after an unnoticed crash of its own arbiter is strictly worse than
        # one that stops and makes the operator look.
    )

    return LaunchDescription([
        twist_mux_config_arg,
        use_sim_time_arg,
        twist_mux_node,
    ])
