"""BEAST-01 standalone Nav2 behavior_server (PR-4a / Set 4a).

Lands stock ``ros-humble-nav2-behaviors`` action servers for the Hangar agent
command path without bringing up bt_navigator, planner, or a map:

  * /spin
  * /backup
  * /drive_on_heading
  * /wait

Frames are odom-only (see config/behavior_server.yaml). Velocity leaves this
node on the default ``cmd_vel`` publisher from timed_behavior.hpp — we remap
that onto twist_mux's ``/cmd_vel_nav`` input (priority 10). Human teleop on
higher mux rungs still wins.

---------------------------------------------------------------------------
COSTMAP DECISION (v1): BLIND PRIMITIVES
---------------------------------------------------------------------------
This launch does NOT start a local costmap. Collision simulate-ahead still
subscribes to ``local_costmap/costmap_raw`` (params YAML); with no publisher
those checks fail closed. Follow-up: minimal standalone ``nav2_costmap_2d``
fed by ``/scan`` (Set 3a) — do not half-wire a topic name without the node.

---------------------------------------------------------------------------
INSTALL (Jetson) — required apt package
---------------------------------------------------------------------------
  sudo apt-get update
  sudo apt-get install -y ros-humble-nav2-behaviors

Verified present on beast-01 (2026-08-02, read-only): 
  ros-humble-nav2-behaviors 1.1.20-1jammy (arm64).

---------------------------------------------------------------------------
What this launch deliberately does NOT do
---------------------------------------------------------------------------
  * Does not set ``allow_motion`` / arm the robot.
  * Does not include itself from bringup or cockpit.launch — opt-in only.
  * Does not replace ugv_bringup's cmd_vel watchdog or the mux e-stop lock.

On-robot verify (motion locked — allow_motion false / default):

  ros2 launch ugv_cockpit behavior_server.launch.py
  ros2 action list   # expect /spin /backup /drive_on_heading
  # send a small Spin goal while disarmed — action may run or fail closed
  # on missing costmap; wheels must not move either way.
"""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description():
    default_params = os.path.join(
        get_package_share_directory('ugv_cockpit'),
        'config',
        'behavior_server.yaml',
    )

    params_file_arg = DeclareLaunchArgument(
        'params_file',
        default_value=default_params,
        description=(
            'Path to the standalone behavior_server + lifecycle_manager '
            'ros__parameters YAML (ugv_cockpit/config/behavior_server.yaml).'
        ),
    )

    use_sim_time_arg = DeclareLaunchArgument(
        'use_sim_time',
        default_value='false',
        description='Use /clock (Gazebo). Must match twist_mux / bringup.',
    )

    autostart_arg = DeclareLaunchArgument(
        'autostart',
        default_value='true',
        description='Lifecycle manager transitions behavior_server to active.',
    )

    # Remap timed_behavior.hpp's Twist publisher onto the mux nav rung.
    # Same reason as ugv_nav/launch/nav_bringup/navigation_launch.py —
    # without this remap, spin/backup/drive_on_heading drive /cmd_vel and
    # bypass twist_mux entirely. Keep the ('cmd_vel', 'cmd_vel_nav') pair
    # inline so ugv_cockpit/test/test_behavior_server_config.py can AST-scan it.
    behavior_server_node = Node(
        package='nav2_behaviors',
        executable='behavior_server',
        name='behavior_server',
        output='screen',
        parameters=[
            LaunchConfiguration('params_file'),
            {
                'use_sim_time': ParameterValue(
                    LaunchConfiguration('use_sim_time'), value_type=bool
                ),
            },
        ],
        remappings=[
            ('/tf', 'tf'),
            ('/tf_static', 'tf_static'),
            ('cmd_vel', 'cmd_vel_nav'),
        ],
    )

    lifecycle_manager_node = Node(
        package='nav2_lifecycle_manager',
        executable='lifecycle_manager',
        name='lifecycle_manager_behavior',
        output='screen',
        parameters=[
            LaunchConfiguration('params_file'),
            {
                'use_sim_time': ParameterValue(
                    LaunchConfiguration('use_sim_time'), value_type=bool
                ),
                'autostart': ParameterValue(
                    LaunchConfiguration('autostart'), value_type=bool
                ),
                'node_names': ['behavior_server'],
            },
        ],
    )

    return LaunchDescription([
        params_file_arg,
        use_sim_time_arg,
        autostart_arg,
        behavior_server_node,
        lifecycle_manager_node,
    ])
