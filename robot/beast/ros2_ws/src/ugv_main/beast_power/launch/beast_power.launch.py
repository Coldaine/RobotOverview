# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Launch beast_power alone — do not co-publish /ugv/voltage with ugv_bringup.

Wave 1 / PR-2a coexistence: stock bringup still invents BatteryState on
/ugv/voltage. This launch is for offline bench / explicit sole-owner trials.
PR-2b removes bringup's publisher and wires this into bringup launch.
"""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
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

    node = Node(
        package='beast_power',
        executable='power_node',
        name='beast_power',
        output='screen',
        parameters=[LaunchConfiguration('beast_power_config')],
    )

    return LaunchDescription([config_arg, node])
