# Copyright (c) 2018 Intel Corporation
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os

from ament_index_python.packages import get_package_share_directory

from launch import LaunchDescription
from launch.actions import (DeclareLaunchArgument, GroupAction,
                            IncludeLaunchDescription, SetEnvironmentVariable)
from launch.conditions import IfCondition, LaunchConfigurationEquals, LaunchConfigurationNotEquals
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, PythonExpression
from launch_ros.actions import Node
from launch_ros.actions import PushRosNamespace
from launch_ros.descriptions import ParameterFile

from nav2_common.launch import RewrittenYaml, ReplaceString

import launch
from launch import LaunchContext
from launch.utilities import perform_substitutions

class LaunchConfigAsBool(launch.Substitution):
    """
    Converts a LaunchConfiguration value into a normalized boolean string: 'true' or 'false'.

    Allows CLI arguments like 'True', 'true', '1', 'yes' and 'False', 'false', '0', 'no'.
    Returns a string 'true' or 'false' for use in PythonExpression and IfCondition contexts.
    """

    def __init__(self, name: str) -> None:
        super().__init__()
        self._config = LaunchConfiguration(name)

    def perform(self, context: LaunchContext) -> str:
        value = perform_substitutions(context, [self._config])
        if value.strip().lower() in ['true', '1', 'yes', 'on']:
            return 'True'
        return 'False'

    def describe(self) -> str:
        return f'LaunchConfigAsBool({self._config.describe()})'

def generate_launch_description():
    # Get the launch directory
    bringup_dir = get_package_share_directory('nav2_bringup')
    launch_dir = os.path.join(bringup_dir, 'launch')

    ugv_nav_dir = get_package_share_directory('ugv_nav')
    ugv_launch_dir = os.path.join(ugv_nav_dir, 'launch/nav_bringup')
    
    # Create the launch configuration variables
    namespace = LaunchConfiguration('namespace')
    use_namespace = LaunchConfiguration('use_namespace')
    use_slam = LaunchConfigAsBool('use_slam')
    map_yaml_file = LaunchConfiguration('map')
    pbstream_file = LaunchConfiguration('pbstream')
    posegraph_file = LaunchConfiguration('posegraph')
    keepout_mask_yaml_file = LaunchConfiguration('keepout_mask')
    speed_mask_yaml_file = LaunchConfiguration('speed_mask')
    use_localization = LaunchConfiguration('use_localization')
    use_sim_time = LaunchConfiguration('use_sim_time')
    emcl2_params_file = LaunchConfiguration('emcl2_params_file')
    params_file = LaunchConfiguration('params_file')
    slam_toolbox_params_file = LaunchConfiguration('slam_toolbox_params_file')
    autostart = LaunchConfiguration('autostart')
    use_composition = LaunchConfiguration('use_composition')
    use_respawn = LaunchConfiguration('use_respawn')
    log_level = LaunchConfiguration('log_level')
    use_keepout_zones = LaunchConfigAsBool('use_keepout_zones')
    use_speed_zones = LaunchConfigAsBool('use_speed_zones')
    # Map fully qualified names to relative ones so the node's namespace can be prepended.
    # In case of the transforms (tf), currently, there doesn't seem to be a better alternative
    # https://github.com/ros/geometry2/issues/32
    # https://github.com/ros/robot_state_publisher/pull/30
    # TODO(orduno) Substitute with `PushNodeRemapping`
    #              https://github.com/ros2/launch_ros/issues/56
    remappings = [('/tf', 'tf'),
                  ('/tf_static', 'tf_static')]

    # Create our own temporary YAML files that include substitutions
    param_substitutions = {
        'use_sim_time': use_sim_time,
        'yaml_filename': map_yaml_file
    }

    # Only it applys when `use_namespace` is True.
    # '<robot_namespace>' keyword shall be replaced by 'namespace' launch argument
    # in config file 'nav2_multirobot_params.yaml' as a default & example.
    # User defined config file should contain '<robot_namespace>' keyword for the replacements.
    params_file = ReplaceString(
        source_file=params_file,
        replacements={'<robot_namespace>': ('/', namespace)},
        condition=IfCondition(use_namespace))

    configured_params = ParameterFile(
        RewrittenYaml(
            source_file=params_file,
            root_key=namespace,
            param_rewrites=param_substitutions,
            convert_types=True),
        allow_substs=True)

    stdout_linebuf_envvar = SetEnvironmentVariable(
        'RCUTILS_LOGGING_BUFFERED_STREAM', '1')

    declare_namespace_cmd = DeclareLaunchArgument(
        'namespace',
        default_value='',
        description='Top-level namespace')

    declare_use_namespace_cmd = DeclareLaunchArgument(
        'use_namespace',
        default_value='false',
        description='Whether to apply a namespace to the navigation stack')

    declare_slam_cmd = DeclareLaunchArgument(
        'use_slam',
        default_value='False',
        description='Whether run a SLAM')

    declare_map_yaml_cmd = DeclareLaunchArgument(
        'map',
        description='Full path to map yaml file to load')

    declare_keepout_mask_yaml_cmd = DeclareLaunchArgument(
        'keepout_mask', default_value=os.path.join(ugv_nav_dir, 'maps', 'mask.yaml'),
        description='Full path to keepout mask yaml file to load')

    declare_speed_mask_yaml_cmd = DeclareLaunchArgument(
        'speed_mask', default_value='',
        description='Full path to speed mask yaml file to load')

    declare_use_keepout_zones_cmd = DeclareLaunchArgument(
        'use_keepout_zones', default_value='False',
        description='Whether to enable keepout zones or not')

    declare_use_speed_zones_cmd = DeclareLaunchArgument(
        'use_speed_zones', default_value='False',
        description='Whether to enable speed zones or not')

    declare_use_sim_time_cmd = DeclareLaunchArgument(
        'use_sim_time',
        default_value='false',
        description='Use simulation (Gazebo) clock if true')

    declare_emcl2_params_file_cmd = DeclareLaunchArgument(
        'emcl2_params_file',
        default_value=os.path.join(ugv_nav_dir, 'params', 'emcl2_quick_start.param.yaml'),
        description='Full path to the ROS2 parameters file to use for all launched nodes')

    declare_params_file_cmd = DeclareLaunchArgument(
        'params_file',
        default_value=os.path.join(bringup_dir, 'params', 'nav2_params.yaml'),
        description='Full path to the ROS2 parameters file to use for all launched nodes')

    declare_pbstream_file_cmd = DeclareLaunchArgument(
        'pbstream',
        default_value=os.path.join(bringup_dir, 'maps', 'map.pbstream'),
        description='Full path to the ROS2 parameters file to use for all launched nodes')

    declare_posegraph_file_cmd = DeclareLaunchArgument(
        'posegraph',
        default_value=os.path.join(bringup_dir, 'maps', 'map'),
        description='Full path to the ROS2 parameters file to use for all launched nodes')

    declare_slam_toolbox_param_file_cmd = DeclareLaunchArgument(
        'slam_toolbox_params_file',
        default_value=os.path.join(ugv_nav_dir, 'params', 'slam_toolbox_localization.yaml'),
        description='Full path to the ROS2 parameters file to use for slam_toolbox nodes')

    declare_autostart_cmd = DeclareLaunchArgument(
        'autostart', default_value='true',
        description='Automatically startup the nav2 stack')

    declare_use_composition_cmd = DeclareLaunchArgument(
        'use_composition', default_value='True',
        description='Whether to use composed bringup')

    declare_use_respawn_cmd = DeclareLaunchArgument(
        'use_respawn', default_value='False',
        description='Whether to respawn if a node crashes. Applied when composition is disabled.')

    declare_log_level_cmd = DeclareLaunchArgument(
        'log_level', default_value='info',
        description='log level')

    # Specify the actions
    bringup_cmd_group = GroupAction([
        PushRosNamespace(
            condition=IfCondition(use_namespace),
            namespace=namespace),

        Node(
            condition=IfCondition(use_composition),
            name='nav2_container',
            package='rclcpp_components',
            executable='component_container_isolated',
            parameters=[configured_params, {'autostart': autostart}],
            arguments=['--ros-args', '--log-level', log_level],
            remappings=remappings,
            output='screen'),

        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(ugv_launch_dir, 'slam_launch.py')),
            # condition=LaunchConfigurationEquals('use_localization', 'slam'),
            condition=IfCondition(use_slam),
            launch_arguments={'namespace': namespace,
                              'use_sim_time': use_sim_time,
                              'autostart': autostart,
                              'use_respawn': use_respawn,
                              'params_file': params_file,
                              'slam_toolbox_params_file': slam_toolbox_params_file,}.items()),

        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(ugv_launch_dir,'localization_launch.py')),
            # condition=LaunchConfigurationNotEquals('use_localization', 'slam'),
            condition=IfCondition(PythonExpression(['not ', use_slam])),
            launch_arguments={'namespace': namespace,
                              'pbstream': pbstream_file,
                              'map': map_yaml_file,
                              'use_sim_time': use_sim_time,
                              'autostart': autostart,
                              'use_localization': use_localization,
                              'emcl2_params_file': emcl2_params_file,
                              'params_file': params_file,
                              'posegraph_file': posegraph_file,
                              'slam_toolbox_params_file': slam_toolbox_params_file,
                              'use_composition': use_composition,
                              'use_respawn': use_respawn,
                              'container_name': 'nav2_container'}.items()),

        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(
                os.path.join(ugv_launch_dir, 'keepout_zone_launch.py')
            ),
            condition=IfCondition(use_keepout_zones),
            launch_arguments={
                'namespace': namespace,
                'keepout_mask': keepout_mask_yaml_file,
                'use_sim_time': use_sim_time,
                'params_file': params_file,
                'use_composition': use_composition,
                'use_respawn': use_respawn,
                'container_name': 'nav2_container',}.items()),

        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(
                os.path.join(ugv_launch_dir, 'speed_zone_launch.py')
            ),
            condition=IfCondition(use_speed_zones),
            launch_arguments={
                'namespace': namespace,
                'speed_mask': speed_mask_yaml_file,
                'use_sim_time': use_sim_time,
                'params_file': params_file,
                'use_composition': use_composition,
                'use_respawn': use_respawn,
                'container_name': 'nav2_container',}.items()),

        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(ugv_launch_dir, 'navigation_launch.py')),
            launch_arguments={'namespace': namespace,
                              'use_sim_time': use_sim_time,
                              'autostart': autostart,
                              'params_file': params_file,
                              'use_composition': use_composition,
                              'use_respawn': use_respawn,
                              'container_name': 'nav2_container'}.items()),

    ])

    # Create the launch description and populate
    ld = LaunchDescription()

    # Set environment variables
    ld.add_action(stdout_linebuf_envvar)

    # Declare the launch options
    ld.add_action(declare_namespace_cmd)
    ld.add_action(declare_use_namespace_cmd)
    ld.add_action(declare_slam_cmd)
    ld.add_action(declare_map_yaml_cmd)
    ld.add_action(declare_keepout_mask_yaml_cmd)
    ld.add_action(declare_speed_mask_yaml_cmd)
    ld.add_action(declare_use_sim_time_cmd)
    ld.add_action(declare_emcl2_params_file_cmd)
    ld.add_action(declare_params_file_cmd)
    ld.add_action(declare_pbstream_file_cmd)
    ld.add_action(declare_posegraph_file_cmd)
    ld.add_action(declare_slam_toolbox_param_file_cmd)
    ld.add_action(declare_autostart_cmd)
    ld.add_action(declare_use_composition_cmd)
    ld.add_action(declare_use_respawn_cmd)
    ld.add_action(declare_log_level_cmd)
    ld.add_action(declare_use_keepout_zones_cmd)
    ld.add_action(declare_use_speed_zones_cmd)

    # Add the actions to launch all of the navigation nodes
    ld.add_action(bringup_cmd_group)

    return ld
