from launch import LaunchDescription
from launch_ros.actions import Node
import os
from launch.actions import IncludeLaunchDescription, DeclareLaunchArgument
from launch.launch_description_sources import PythonLaunchDescriptionSource
from ament_index_python.packages import get_package_share_directory
from launch.substitutions import LaunchConfiguration

def generate_launch_description():
    host_arg = DeclareLaunchArgument(
        'host',
        default_value='0.0.0.0',
        description='Host IP address to bind the Flask server'
    )

    nodes = []
    if os.environ.get('ROARM_MODEL'):
        roarm_control_node = Node(
            package='ugv_web_app',
            executable='roarm_control',
            name='roarm_control',
        )
        nodes.append(roarm_control_node)
    
    ugv_web_app_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(get_package_share_directory('vizanti_server'), 'launch', 'vizanti_server.launch.py')
        ),
        launch_arguments={
            'host': LaunchConfiguration('host'),
        }.items()
    )

    return LaunchDescription([
        host_arg,
        *nodes,
        ugv_web_app_launch
    ])
