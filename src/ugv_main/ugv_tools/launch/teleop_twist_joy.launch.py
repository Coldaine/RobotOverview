from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():

    xspeed_limit_arg = DeclareLaunchArgument(
        'xspeed_limit',
        default_value='0.5',
        description='Max linear x speed'
    )

    yspeed_limit_arg = DeclareLaunchArgument(
        'yspeed_limit',
        default_value='0.5',
        description='Max linear y speed'
    )

    angular_speed_limit_arg = DeclareLaunchArgument(
        'angular_speed_limit',
        default_value='1.0',
        description='Max angular speed'
    )

    # Joystick driver
    joy_node = Node(
        package='joy',
        executable='joy_node',
        name='joy_node'
    )

    # Joystick control node
    joy_ctrl_node = Node(
        package='ugv_tools',
        executable='joy_ctrl',
        name='joy_ctrl',
        parameters=[{
            'xspeed_limit': LaunchConfiguration('xspeed_limit'),
            'yspeed_limit': LaunchConfiguration('yspeed_limit'),
            'angular_speed_limit': LaunchConfiguration('angular_speed_limit'),
        }]
    )

    return LaunchDescription([
        xspeed_limit_arg,
        yspeed_limit_arg,
        angular_speed_limit_arg,
        joy_node,
        joy_ctrl_node
    ])
