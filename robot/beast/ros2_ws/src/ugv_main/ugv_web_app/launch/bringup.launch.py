from launch import LaunchDescription
from launch_ros.actions import Node
import os


def generate_launch_description():
    nodes = []
    if os.environ.get('ROARM_MODEL'):
        roarm_control_node = Node(
            package='ugv_web_app',
            executable='roarm_control',
            name='roarm_control',
        )
        nodes.append(roarm_control_node)

    return LaunchDescription(nodes)
