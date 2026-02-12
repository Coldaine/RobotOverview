from launch import LaunchDescription
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch.actions import DeclareLaunchArgument
from ament_index_python.packages import get_package_share_directory
import os

def generate_launch_description():
    use_sim_time = LaunchConfiguration('use_sim_time', default='false')
    slam_gmapping_dir = get_package_share_directory('slam_gmapping')

    # Define paths for different RViz configuration files
    slam_gmapping_config_file = os.path.join(slam_gmapping_dir, 'config', 'slam_gmapping_params.yaml')

    return LaunchDescription([
        DeclareLaunchArgument(
            'use_sim_time',
            default_value='false',
            description='Use simulation time if true'
        ),  
        Node(
            package='slam_gmapping', 
            executable='slam_gmapping',
            output='screen',
            parameters=[
                slam_gmapping_config_file,
                {'use_sim_time': use_sim_time}
            ]
        ),
    ])
