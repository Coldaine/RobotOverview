# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Launch beast_power alone (bench/diagnostic use).

Since the 2026-08-07 cutover the normal path is bringup_lidar.launch.py, which
starts this node under its ``use_power`` argument; ugv_bringup no longer
publishes BatteryState. Use this standalone launch only when running the power
node without the rest of the stack.
"""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    default_config = os.path.join(
        get_package_share_directory('beast_power'),
        'config',
        'beast_power.yaml',
    )

    config_arg = DeclareLaunchArgument(
        'beast_power_config',
        default_value=default_config,
        description='YAML with i2c_bus_nr, sensor_address, rate, topics.',
    )

    # Default off here: a bench run should not append to the robot's
    # production discharge series unless asked. The normal path
    # (bringup_lidar.launch.py) logs unconditionally under use_power.
    log_arg = DeclareLaunchArgument(
        'log_to_csv',
        default_value='false',
        description='Also run beast_power_logger writing the durable CSV.',
    )

    node = Node(
        package='beast_power',
        executable='power_node',
        name='beast_power',
        output='screen',
        parameters=[LaunchConfiguration('beast_power_config')],
    )

    logger_node = Node(
        package='beast_power',
        executable='power_logger',
        name='beast_power_logger',
        output='screen',
        parameters=[LaunchConfiguration('beast_power_config')],
        condition=IfCondition(LaunchConfiguration('log_to_csv')),
    )

    return LaunchDescription([config_arg, log_arg, node, logger_node])
