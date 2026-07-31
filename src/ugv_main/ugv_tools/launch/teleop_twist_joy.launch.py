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
        name='joy_node',
        parameters=[{
            # autorepeat_rate: 0.0 == "only publish /joy when the pad actually
            # changes". The joy driver's default (20.0 Hz in Humble) re-sends
            # the last state forever, so an idle gamepad left plugged into the
            # Jetson produces 20 messages/s of all-zeros.
            #
            # That is the twist_mux starvation failure: joy_ctrl is the
            # top drive rung (priority 150), and any message — zeros included —
            # refreshes its timestamp, so the source never expires and every
            # lower rung (UI 50, nav 10) is masked for as long as the pad is
            # connected. joy_ctrl's ZERO_TAIL_LIMIT bounds the zeros it forwards;
            # this setting stops them being manufactured in the first place.
            #
            # Safety note: this does NOT weaken stopping. Releasing the sticks
            # is a real state change, so joy_node still emits it immediately and
            # joy_ctrl still sends its zero tail. Silence afterwards is the
            # intent, and ugv_bringup's 0.5 s cmd_vel watchdog is the backstop.
            'autorepeat_rate': 0.0,
        }]
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
