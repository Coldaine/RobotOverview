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
            # autorepeat_rate MUST stay > 0. The joy driver only emits a /joy
            # message when SDL reports a change, and a stick held at full
            # deflection is not a change — the OS sends nothing until it moves
            # again. Without autorepeat, "push the stick and hold it" produces
            # exactly ONE /joy message:
            #
            #   * joy_ctrl publishes one Twist on cmd_vel_joy_robot, twist_mux
            #     expires that source 0.5 s later, and ugv_bringup's cmd_vel
            #     watchdog stops the robot mid-command while the stick is still
            #     pinned;
            #   * the gimbal freezes too — joy_ctrl integrates pan/tilt once per
            #     /joy message, so no messages means no movement.
            #
            # 20.0 Hz is the joy driver's own default and is comfortably above
            # the mux's 2 Hz expiry floor (0.5 s per-source timeout), so a held
            # stick keeps refreshing its rung and the gimbal keeps its rate.
            #
            # This does NOT reintroduce the twist_mux starvation failure. An
            # idle pad autorepeats all-zero /joy messages forever, but joy_ctrl
            # forwards only ZERO_TAIL_LIMIT (5) of them and then goes silent, so
            # the priority-150 rung still expires and every lower rung (UI 50,
            # nav 10) gets the floor. The zero tail is the fix for starvation;
            # turning autorepeat off was not.
            'autorepeat_rate': 20.0,
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
