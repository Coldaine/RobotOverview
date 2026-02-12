import os
import xacro
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, DeclareLaunchArgument, OpaqueFunction
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import PathJoinSubstitution
from launch.substitutions import LaunchConfiguration
from launch.conditions import IfCondition, UnlessCondition
from ament_index_python.packages import get_package_share_directory

# Function to get the appropriate RViz configuration file based on the input parameter
def get_rviz_config_file(context):
    rviz_config = context.launch_configurations['rviz_config']

    # Get the package directories for the UGV project
    ugv_description_dir = get_package_share_directory('ugv_description')
    ugv_bringup_dir = get_package_share_directory('ugv_bringup')
    ugv_slam_dir = get_package_share_directory('ugv_slam')
    ugv_nav_dir = get_package_share_directory('ugv_nav')

    # Define paths for different RViz configuration files
    rviz_description_config = os.path.join(ugv_description_dir, 'rviz', 'view_description.rviz')
    rviz_bringup_config = os.path.join(ugv_bringup_dir, 'rviz', 'view_bringup.rviz')
    rviz_slam_2d_config = os.path.join(ugv_slam_dir, 'rviz', 'view_slam_2d.rviz')
    rviz_slam_3d_config = os.path.join(ugv_slam_dir, 'rviz', 'view_slam_3d.rviz')
    rviz_nav_2d_config = os.path.join(ugv_nav_dir, 'rviz', 'view_nav_2d.rviz')
    rviz_nav_3d_config = os.path.join(ugv_nav_dir, 'rviz', 'view_nav_3d.rviz')

    # Map configuration options to corresponding RViz files
    config_map = {
        'description': rviz_description_config,
        'bringup': rviz_bringup_config,
        'slam_2d': rviz_slam_2d_config,
        'slam_3d': rviz_slam_3d_config,
        'nav_2d': rviz_nav_2d_config,
        'nav_3d': rviz_nav_3d_config
    }

    # Return the corresponding RViz configuration file, defaulting to 'description'
    return config_map.get(rviz_config, rviz_description_config)

def launch_setup(context, *args, **kwargs):
    rviz_config = context.launch_configurations['rviz_config']
    share_dir = get_package_share_directory('ugv_description')    
    UGV_MODEL = os.environ['UGV_MODEL']
    xacro_file_name = UGV_MODEL + '.xacro'
    xacro_file = os.path.join(
        share_dir,
        'urdf/bases', 
        xacro_file_name)    
        
    mappings = {"use_gazebo": "true"}  
    robot_description_config = xacro.process_file(xacro_file, mappings=mappings)
    robot_urdf = robot_description_config.toxml()

    robot_state_publisher_node = Node(
        package='robot_state_publisher',
        executable='robot_state_publisher',
        name='robot_state_publisher',
        parameters=[
            {'robot_description': robot_urdf}
        ]
    )

    joint_state_publisher_node = Node(
        package='joint_state_publisher',
        executable='joint_state_publisher',
        name='joint_state_publisher',
        parameters=[{'use_sim_time': True}]
    )

    gazebo_server = IncludeLaunchDescription(
        PythonLaunchDescriptionSource([
            PathJoinSubstitution([
                FindPackageShare('gazebo_ros'),
                'launch',
                'gzserver.launch.py'
            ])
        ]),
    )

    gazebo_client = IncludeLaunchDescription(
        PythonLaunchDescriptionSource([
            PathJoinSubstitution([
                FindPackageShare('gazebo_ros'),
                'launch',
                'gzclient.launch.py'
            ])
        ])
    )

    urdf_spawn_node = Node(
        package='gazebo_ros',
        executable='spawn_entity.py',
        arguments=[
            '-entity', UGV_MODEL,
            '-topic', 'robot_description'
        ],
        output='screen'
    )

    # Get the appropriate RViz configuration file
    rviz_config_file = get_rviz_config_file(context)

    # Define the RViz2 node to launch RViz if enabled
    rviz2_node = Node(
        package='rviz2',
        executable='rviz2',
        name='rviz2',
        output='screen',
        arguments=['-d', rviz_config_file],
        condition=IfCondition(LaunchConfiguration('use_rviz'))
    )

    return [
        robot_state_publisher_node,
        joint_state_publisher_node,
        gazebo_server,
        gazebo_client,
        urdf_spawn_node,
        rviz2_node,
    ]

# Function to generate the launch description with configurable arguments
def generate_launch_description():
    return LaunchDescription([
        # Argument to specify whether to use RViz
        DeclareLaunchArgument('use_rviz', default_value='false', description='Whether to launch RViz2'),
        # Argument to specify which RViz configuration to use
        DeclareLaunchArgument('rviz_config', default_value='description', description='Choose which rviz configuration to use: description, bringup, slam_2d, slam_3d, nav_2d, nav_3d'),
        # Opaque function to execute the setup
        OpaqueFunction(function=launch_setup)
    ])