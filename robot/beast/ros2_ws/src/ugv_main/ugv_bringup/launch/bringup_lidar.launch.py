from ament_index_python.packages import get_package_share_path
from launch_ros.substitutions import FindPackageShare
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition, UnlessCondition
from launch.substitutions import (
    Command,
    EnvironmentVariable,
    LaunchConfiguration,
    PathJoinSubstitution,
    PythonExpression,
)

from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue
import os
from ament_index_python.packages import get_package_share_directory

from launch.actions import IncludeLaunchDescription, TimerAction
from launch.launch_description_sources import PythonLaunchDescriptionSource

def generate_launch_description():
    # Declare launch arguments
    pub_odom_tf_arg = DeclareLaunchArgument(
        'pub_odom_tf', default_value='false',
        description='Whether to publish the tf from the original odom to the base_footprint'
    )

    use_ekf_arg = DeclareLaunchArgument(
        'use_ekf', default_value='true',
        description='Whether to use ekf'
    )

    use_rviz_arg = DeclareLaunchArgument(
        'use_rviz', default_value='false',
        description='Whether to launch RViz2'
    )

    rviz_config_arg = DeclareLaunchArgument(
        'rviz_config', default_value='bringup',
        description='Choose which rviz configuration to use'
    )

    serial_port_arg = DeclareLaunchArgument(
        'serial_port',
        default_value=EnvironmentVariable(
            'UGV_SERIAL_PORT',
            # cp210x by-id path (verified live 2026-08-07) — cp210x
            # re-enumeration lands here, not ttyTHS1. The env file in
            # deploy/systemd/ugv.env.example is the deployed truth; this is
            # only the no-env fallback.
            default_value='/dev/serial/by-id/usb-1a86_USB_Single_Serial_5B5E130201-if00'
        ),
        description='Serial port connected to the UGV ESP32 controller'
    )

    lidar_port_arg = DeclareLaunchArgument(
        'lidar_port',
        default_value=EnvironmentVariable(
            'UGV_LIDAR_PORT', default_value='/dev/ttyACM0'
        ),
        description='Serial port connected to the LiDAR'
    )

    wifi_interface_arg = DeclareLaunchArgument(
        'wifi_interface',
        default_value=EnvironmentVariable('UGV_WIFI_INTERFACE', default_value=''),
        description='Wi-Fi interface shown on the UGV OLED; empty enables auto-detection'
    )

    ethernet_interface_arg = DeclareLaunchArgument(
        'ethernet_interface',
        default_value=EnvironmentVariable('UGV_ETHERNET_INTERFACE', default_value=''),
        description=(
            'Ethernet interface shown on the UGV OLED; empty enables '
            'auto-detection'
        )
    )

    allow_motion_arg = DeclareLaunchArgument(
        'allow_motion', default_value='true',
        description=(
            'Permit non-zero cmd_vel commands by default. Toggle at runtime '
            'via the /ugv/set_allow_motion service (e.g. from the cockpit UI).'
        )
    )

    use_lidar_arg = DeclareLaunchArgument(
        'use_lidar', default_value='true',
        description='Whether to launch the LiDAR and laser odometry nodes'
    )

    use_power_arg = DeclareLaunchArgument(
        'use_power', default_value='true',
        description=(
            'Start beast_power, the sole owner of /ugv/voltage since the '
            '2026-08-07 cutover (driver-board INA219: real volts, signed '
            'current, charging state). ugv_bringup no longer publishes '
            'BatteryState. Also publishes /ugv/charging_active.'
        )
    )

    ekf_config = os.path.join(              
        get_package_share_directory('ugv_bringup'),
        'config',
        'ekf.yaml'
    )

    # Include the robot state launch from the ugv_description package
    robot_state_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(get_package_share_directory('ugv_description'), 'launch', 'display.launch.py')
        ),
        launch_arguments={
            'use_rviz': LaunchConfiguration('use_rviz'),
            'rviz_config': LaunchConfiguration('rviz_config'),
        }.items()
    ) 
    # Define the nodes to be launched
    laser_bringup_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(get_package_share_directory('ldlidar'), 'launch', 'ldlidar.launch.py')
        ),
        launch_arguments={
            'use_rviz': "false",
            'port_name': LaunchConfiguration('lidar_port'),
        }.items(),
        condition=IfCondition(LaunchConfiguration('use_lidar')),
    )
    rf2o_laser_odometry_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(get_package_share_directory('rf2o_laser_odometry'), 'launch', 'rf2o_laser_odometry.launch.py')
        ),
        condition=IfCondition(PythonExpression([
            "'", LaunchConfiguration('use_lidar'), "' == 'true' and '",
            LaunchConfiguration('use_ekf'), "' == 'true'",
        ])),
    )
    # Command spine — twist_mux is the ONLY publisher of /cmd_vel, and /cmd_vel
    # is what bringup_node below subscribes to. Included unconditionally and
    # with no enabling argument on purpose: every velocity source in this
    # workspace publishes to a mux input topic now, so a bringup without the
    # spine has no path to the motors at all. That is the fail-closed direction.
    # Ladder + timeouts: ugv_cockpit/config/twist_mux.yaml.
    #
    # This does not weaken the allow_motion gate below — it still sits
    # downstream of the mux, as does the unconditional startup stop. (The
    # cmd_vel silence watchdog was removed 2026-08-07 per owner decision D8.)
    twist_mux_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(get_package_share_directory('ugv_cockpit'), 'launch', 'twist_mux.launch.py')
        ),
    )
    # Define the nodes to be launched
    # The ESP32 bridge node moved to the beast_base package (Phase 1 of the
    # strip-down work order); ugv_bringup keeps the launch, configs, and
    # odom_publisher below.
    bringup_node = Node(
        package='beast_base',
        executable='beast_base',
        parameters=[{
            'serial_port': LaunchConfiguration('serial_port'),
            'baud_rate': 115200,
            'wifi_interface': LaunchConfiguration('wifi_interface'),
            'ethernet_interface': LaunchConfiguration('ethernet_interface'),
            'allow_motion': ParameterValue(
                LaunchConfiguration('allow_motion'), value_type=bool
            ),
        }]
    )
    # Define the nodes to be launched
    base_node = Node(
        package='ugv_bringup',
        executable='odom_publisher',
        parameters=[{
            'odom_frame': 'odom',
            'base_footprint_frame': 'base_footprint',
            'pub_odom_tf': LaunchConfiguration('pub_odom_tf'),
        }],
        condition=IfCondition(LaunchConfiguration('use_ekf'))
    )
    # Define the nodes to be launched
    ekf_node = Node(
        package='robot_localization',
        executable='ekf_node',
        name='ekf_filter_node',
        output='screen',
        parameters=[ekf_config],
        remappings=[('/odometry/filtered', '/odom')],
        condition=IfCondition(LaunchConfiguration('use_ekf'))
    )

    # Sole owner of /ugv/voltage (INA219 on i2c-7). Requires the service user
    # in the `i2c` group — see deploy/systemd/beast-ros-base.service.
    # PathJoinSubstitution + FindPackageShare resolve lazily at node launch, so
    # a workspace without beast_power built still boots the rest of the stack
    # (get_package_share_directory here would crash the whole launch at import,
    # even with use_power:=false).
    power_node = Node(
        package='beast_power',
        executable='power_node',
        name='beast_power',
        output='screen',
        parameters=[PathJoinSubstitution([
            FindPackageShare('beast_power'),
            'config',
            'beast_power.yaml',
        ])],
        condition=IfCondition(LaunchConfiguration('use_power')),
    )

    return LaunchDescription([
        pub_odom_tf_arg,
        use_ekf_arg,
        use_rviz_arg,
        rviz_config_arg,
        serial_port_arg,
        lidar_port_arg,
        wifi_interface_arg,
        ethernet_interface_arg,
        allow_motion_arg,
        use_lidar_arg,
        use_power_arg,
        robot_state_launch,
        laser_bringup_launch,
        rf2o_laser_odometry_launch,
        twist_mux_launch,
        bringup_node,
        base_node,
        ekf_node,
        power_node,
    ])
