"""rosbridge WebSocket transport for the BEAST-01 cockpit.

Serves rosbridge on port 9090 (its own default — avoids Vizanti's 5001 and
ugv_chat_ai's 5000). Bound to all interfaces but reachable only over the LAN
subnet and tailscale0 (firewall those; never expose publicly). `tailscale serve`
proxies HTTPS->9090 so the browser gets a valid wss:// with a real Let's Encrypt
cert, which is the only clean way to satisfy an HTTPS page's mixed-content rules.

authenticate:false is safe ONLY because access is gated by Tailscale ACLs.
"""
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    port_arg = DeclareLaunchArgument('port', default_value='9090')
    address_arg = DeclareLaunchArgument('address', default_value='0.0.0.0')

    rosbridge = Node(
        package='rosbridge_server',
        executable='rosbridge_websocket',
        name='rosbridge_websocket',
        output='screen',
        parameters=[{
            'port': LaunchConfiguration('port'),
            'address': LaunchConfiguration('address'),
            'authenticate': False,
            'use_compression': True,
            # Cap image fan-out so a slow client can't stall the loop.
            'max_message_size': 10_000_000,
            'unregister_timeout': 10.0,
        }],
    )

    rosapi = Node(
        package='rosapi',
        executable='rosapi_node',
        name='rosapi',
        output='screen',
    )

    return LaunchDescription([port_arg, address_arg, rosbridge, rosapi])
