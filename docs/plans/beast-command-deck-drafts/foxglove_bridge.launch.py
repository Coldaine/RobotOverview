#!/usr/bin/env python3
"""foxglove_bridge.launch.py — DRAFT, not wired into any package yet.

Launches `ros-humble-foxglove-bridge` (package/executable both named
`foxglove_bridge`) with a locked-down parameter set: a fixed telemetry
read whitelist (what the bridge will forward OUT to any connected client)
and a fixed, much narrower client-publish whitelist (what a connected
client is allowed to inject BACK into the ROS graph). Included from
cockpit_robot.launch.py; can also be run standalone for a telemetry-only
session with no teleop nodes up.

Parameter names confirmed against the current upstream source
(github.com/foxglove/foxglove-sdk, `ros/src/foxglove_bridge/launch/
foxglove_bridge_launch.xml`, which is what humble/distribution.yaml in
ros/rosdistro points the `ros-humble-foxglove-bridge` release at). A
handful of the newer parameters on that list (remote_access,
device_token, foxglove_api_url, sysinfo*, message_backlog_size,
asset_uri_allowlist, video_transcode_topic_denylist,
ignore_unresponsive_param_nodes, include_hidden, publish_client_count)
are cloud/asset/diagnostics features that may not exist on whatever
`ros-humble-foxglove-bridge` .deb is actually installed on the Jetson
today (apt tracks a point-in-time snapshot, not upstream HEAD). This file
only sets the stable, long-standing param set that has existed across
bridge versions; it deliberately leaves the newer ones unset rather than
guess at their current defaults. # VERIFY: run
`ros2 param list /foxglove_bridge` on the robot once this is actually
launched there, and compare against this file before assuming any param
not listed here needs setting.

Security posture (why the whitelist looks the way it does):
  - This bridge only needs to be reachable from the general LAN
    (192.168.0.x) and the Tailscale tailnet (100.107.16.72), per
    docs/beast-ops.md's Network section — never the public internet.
    `address: 0.0.0.0` binds all interfaces, which is fine ONLY because
    both of those networks are already access-controlled (LAN behind the
    home router; Tailscale requires tailnet auth). If the Jetson ever
    gets a routable public IP or a bridge network, tighten `address` to
    a specific interface IP instead of 0.0.0.0.
  - `tls: false` — plaintext WebSocket. Acceptable on a trusted LAN/tailnet
    for now; there's no operator-facing login step to protect. Revisit if
    this ever needs to cross an untrusted network.
  - No OS firewall rule is declared here (nothing in this repo touches the
    Jetson) — this file only documents the expectation. `sudo ufw allow
    from 192.168.0.0/24 to any port 8765` (and the Tailscale interface,
    which Tailscale itself already firewalls by tailnet ACL) is the
    intended posture; apply it on the robot directly, out of band.
  - `client_topic_whitelist` is intentionally an exact, short allowlist,
    not a broad pattern — every entry is something a cockpit client is
    actually expected to publish. Anything not listed here cannot be
    injected into the ROS graph by a connected client even if that client
    is compromised or misbehaving.
  - `param_whitelist` and `service_whitelist` are both set to an empty
    list: no remote parameter edits, no remote service calls, from any
    client. Nothing in this cockpit needs either yet. # VERIFY: revisit if
    a later feature needs one (e.g. a Vizanti "save map" service call, or
    a Foxglove panel that edits a node parameter live).
  - `capabilities` is trimmed from the package default down to exactly
    what's used: clientPublish (teleop/pan-tilt/LED/e-stop-lock all rely
    on it) and connectionGraph (harmless, useful for Foxglove's graph
    view). `parameters`, `parametersSubscribe`, `services`, and `assets`
    are dropped since param_whitelist/service_whitelist are empty anyway
    and asset serving isn't used here.

Reachability note: this is the single open port on the robot for cockpit
purposes — see cockpit_robot.launch.py and README.md.
"""

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    port_arg = DeclareLaunchArgument(
        'port', default_value='8765',
        description='WebSocket port for foxglove_bridge (Foxglove Studio '
                     'and Foxglove-based tools, incl. Lichtblick, connect '
                     'here). 0 would pick a random free port — do not use '
                     '0, this needs to be a stable, documented number.'
    )
    address_arg = DeclareLaunchArgument(
        'address', default_value='0.0.0.0',
        description='Bind address. 0.0.0.0 = all interfaces (LAN + '
                     'Tailscale); see security posture note above.'
    )
    tls_arg = DeclareLaunchArgument(
        'tls', default_value='false',
        description='Enable TLS. Off for now — see security posture note.'
    )
    certfile_arg = DeclareLaunchArgument(
        'certfile', default_value='',
        description='TLS cert path; unused while tls:=false.'
    )
    keyfile_arg = DeclareLaunchArgument(
        'keyfile', default_value='',
        description='TLS key path; unused while tls:=false.'
    )

    foxglove_bridge_node = Node(
        package='foxglove_bridge',
        executable='foxglove_bridge',
        name='foxglove_bridge',
        output='screen',
        parameters=[{
            'port': LaunchConfiguration('port'),
            'address': LaunchConfiguration('address'),
            'tls': LaunchConfiguration('tls'),
            'certfile': LaunchConfiguration('certfile'),
            'keyfile': LaunchConfiguration('keyfile'),

            # --- Outbound telemetry: what a connected client CAN SEE -----
            # Regexes (ECMAScript grammar, matched against the full topic
            # name). Anchored with ^...$ so e.g. "/odom" doesn't also match
            # something like "/odom_extra" by accident.
            'topic_whitelist': [
                '^/scan$',                # LD19 LiDAR scan
                '^/tf$', '^/tf_static$',  # transform tree
                '^/odom$',                # EKF-fused odometry (ekf_filter_node
                                           # remaps /odometry/filtered here —
                                           # confirmed in ugv_bringup's
                                           # bringup_lidar.launch.py)
                '^/odom_wheel$',          # raw wheel-encoder odometry
                                           # (ugv_bringup odom_publisher.py,
                                           # pre-EKF)
                '^/odom_rf2o$',           # rf2o laser odometry
                '^/ugv/voltage$',         # battery telemetry — see
                                           # docs/beast-ops.md "Telemetry
                                           # honesty" table before trusting
                                           # every field (voltage is real;
                                           # percentage/current/etc. are
                                           # fake/dummy on this firmware)
                '^/imu/data$',            # NOTE: as of this draft, nothing
                                           # in ugv_ws actually publishes
                                           # /imu/data — odom_publisher.py
                                           # and rf2o both subscribe to it
                                           # but the EKF's imu0 fusion input
                                           # is commented out in
                                           # ugv_bringup/config/ekf.yaml, so
                                           # no node produces it today.
                                           # ugv_bringup.py publishes the
                                           # UNFILTERED feed on /imu/raw
                                           # instead. Whitelisting the topic
                                           # here is harmless (an absent
                                           # topic just shows nothing in
                                           # Foxglove) but don't expect data
                                           # on it until that gap is closed.
                '^/joint_states$',        # pan-tilt joint_state_broadcaster
                '^/diagnostics$',
                '^/robot_description$',
                '^/oak/.*',                # OAK-D Lite (depthai-ros) — RGB,
                                           # depth, camera_info, etc.; not
                                           # anchored at the end since this
                                           # is a whole topic subtree
                '^/map$',                 # nav2 occupancy grid, once nav2
                                           # exists — harmless to list now
                '^/cmd_vel$',              # so the operator can SEE the
                                           # command twist_mux actually
                                           # forwarded, not just what they
                                           # sent — the two can differ if a
                                           # higher-priority source or the
                                           # e-stop lock is in play
            ],

            # --- Inbound: what a connected client MAY PUBLISH -------------
            # See "Security posture" docstring above for why this is short
            # and exact rather than a broad pattern.
            'client_topic_whitelist': [
                '^/joy_operator$',
                    # sensor_msgs/Joy from Foxglove's Joystick connector ->
                    # consumed by the operator teleop_twist_joy instance
                '^/cmd_vel_ui$',
                    # geometry_msgs/Twist from the Foxglove Teleop panel or
                    # Vizanti's click-to-drive control (twist_mux priority 50)
                '^/pt_joint_position_controller/commands$',
                    # std_msgs/Float64MultiArray [pan_rad, tilt_rad] ->
                    # ros2_control JointGroupPositionController for the
                    # pan-tilt head (pan +-3.14, tilt -0.523..+1.571)
                '^/ugv/led_ctrl$',
                    # std_msgs/Float32MultiArray [IO4, IO5], 0-255
                '^/ugv/pt_steady_ctrl$',
                    # std_msgs/Float32MultiArray [mode(0/1), y_value] — this
                    # is the pan-tilt "steady cam" self-leveling control,
                    # confirmed from ugv_bringup.py's
                    # pt_steady_ctrl_callback. NOT an e-stop topic.
                    #
                    # IMPORTANT DEVIATION FROM THE REQUEST FOR THIS FILE:
                    # the spec for this whitelist listed this exact topic
                    # with the annotation "(e-stop lock topic too)". Having
                    # now read ugv_bringup.py, that pairing looks like a
                    # mix-up rather than something to encode as fact — this
                    # topic genuinely is only the pan-tilt steady-cam
                    # control, and mislabeling it as the e-stop channel in
                    # a safety-relevant whitelist file felt like the wrong
                    # kind of "just do what was asked." Read literally, the
                    # request also seems to want the actual e-stop lock
                    # topic added here (without it, no client could ever
                    # reach twist_mux's emergency lock at all) — so that's
                    # added below as its own entry instead of folded into
                    # this one. Please confirm this reading is right.
                '^/cmd_vel_estop_lock$',
                    # std_msgs/Bool -> twist_mux's priority-255 emergency
                    # lock (see twist_mux.yaml `locks.estop`). This is the
                    # actual e-stop lock topic; a client (Foxglove panel
                    # button, Vizanti, or a dedicated e-stop UI) must be
                    # able to publish here or the arbitration-layer e-stop
                    # is unreachable from any operator surface.
            ],

            # No remote parameter edits or service calls from any client —
            # nothing in this cockpit needs either yet.
            'param_whitelist': [],
            'service_whitelist': [],

            # Trimmed from the package default (which also includes
            # 'parameters', 'parametersSubscribe', 'services', 'assets') —
            # see security posture note above.
            'capabilities': ['clientPublish', 'connectionGraph'],

            'use_sim_time': False,

            # QoS / performance knobs — package defaults are sane for this
            # scale of robot; set explicitly so they're visible/tunable
            # rather than implicit.
            'min_qos_depth': 1,
            'max_qos_depth': 10,
            'num_threads': 0,          # 0 = auto (package default)
            'send_buffer_limit': 10000000,  # 10 MB, package default
        }],
    )

    return LaunchDescription([
        port_arg,
        address_arg,
        tls_arg,
        certfile_arg,
        keyfile_arg,
        foxglove_bridge_node,
    ])
