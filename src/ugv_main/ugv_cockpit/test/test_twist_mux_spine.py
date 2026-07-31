# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0

"""Safety tests for the BEAST-01 command spine.

These prove three things about the workspace as checked in:

  1. ``config/twist_mux.yaml`` parses and declares exactly the priority ladder
     and 0.5 s per-source timeouts from the Command Deck spec.
  2. The e-stop lock sits at priority 255 with ``timeout: 0.0`` (manual toggle,
     not a heartbeat) and outranks every drive source.
  3. Nothing in this workspace publishes ``geometry_msgs/Twist`` on ``/cmd_vel``
     except twist_mux — a static scan that fails if anyone reintroduces a direct
     publisher in a node, a launch remapping, a nav2 param file, or a web client.

Scope honesty: this is a *source* property, not a runtime guarantee. ROS 2 does
not let a node reserve a topic, so ``ros2 topic pub /cmd_vel ...`` from a shell
still reaches ugv_bringup. What PR-1 buys is that no code in the tree does it,
and that a future PR reintroducing one fails here. Making it unreachable *from a
cockpit client* is the bridge whitelist's job (PR-2); making the robot stop when
commands go silent is ugv_bringup's 0.5 s watchdog, which is untouched and has
its own tests in ugv_bringup/test/test_jetson_safety.py.

Run: ``colcon test --packages-select ugv_cockpit`` on the robot, or
``python3 -m pytest src/ugv_main/ugv_cockpit/test`` from the workspace root.
"""

import os
import re

import pytest
import yaml


# --------------------------------------------------------------------------
# Spec — BEAST-01 Command Deck, "Command functions" + "Safety model".
# Any change here is a deliberate safety change, not a refactor.
# --------------------------------------------------------------------------
SOURCE_TIMEOUT_S = 0.5

EXPECTED_TOPICS = {
    'joy_robot': {'topic': 'cmd_vel_joy_robot', 'timeout': 0.5, 'priority': 150},
    'joy_operator': {'topic': 'cmd_vel_joy_operator', 'timeout': 0.5, 'priority': 100},
    'ui': {'topic': 'cmd_vel_ui', 'timeout': 0.5, 'priority': 50},
    'nav': {'topic': 'cmd_vel_nav', 'timeout': 0.5, 'priority': 10},
}

EXPECTED_LOCKS = {
    'estop': {'topic': 'cmd_vel_estop_lock', 'timeout': 0.0, 'priority': 255},
}

# Highest priority first — a human input must always outrank autonomy.
EXPECTED_LADDER = ['joy_robot', 'joy_operator', 'ui', 'nav']

# Every in-tree Twist publisher, and the mux input it must target. Keys are
# workspace-relative paths; values are the declared twist_mux input topic.
EXPECTED_REROUTES = {
    # Gamepad plugged into / paired with the Jetson itself.
    'src/ugv_main/ugv_tools/ugv_tools/joy_ctrl.py': 'cmd_vel_joy_robot',
    # Operator's direct teleop over SSH.
    'src/ugv_main/ugv_tools/ugv_tools/keyboard_ctrl.py': 'cmd_vel_joy_operator',
    # Autonomy — lowest rung, a human always wins.
    'src/ugv_main/ugv_tools/ugv_tools/behavior_ctrl.py': 'cmd_vel_nav',
    'src/ugv_main/ugv_slam/ugv_slam/lidar_follow.py': 'cmd_vel_nav',
    'src/ugv_main/ugv_slam/ugv_slam/lidar_guard.py': 'cmd_vel_nav',
    'src/ugv_main/ugv_slam/ugv_slam/lidar_obstacle_avoidance.py': 'cmd_vel_nav',
    'src/ugv_main/ugv_vision/ugv_vision/apriltag_track.py': 'cmd_vel_nav',
    'src/ugv_main/ugv_vision/ugv_vision/color_ball_track.py': 'cmd_vel_nav',
    'src/ugv_main/ugv_vision/ugv_vision/color_line_follow.py': 'cmd_vel_nav',
    'src/ugv_main/ugv_vision/ugv_vision/face_track.py': 'cmd_vel_nav',
    'src/ugv_main/ugv_vision/ugv_vision/gesture_ctrl.py': 'cmd_vel_nav',
    'src/ugv_main/ugv_vision/ugv_vision/oak_color_ball_track.py': 'cmd_vel_nav',
    'src/ugv_main/ugv_vision/ugv_vision/oak_object_track.py': 'cmd_vel_nav',
    'src/ugv_main/ugv_vision/ugv_vision/roarm_color_line_follow.py': 'cmd_vel_nav',
}

# nav2's final hop before the mux. collision_monitor stays last inside nav2 so
# nav2 keeps its own stop authority; its output is the mux's priority-10 input.
NAV2_PARAM_FILES = (
    'src/ugv_main/ugv_nav/params/dwa.yaml',
    'src/ugv_main/ugv_nav/params/mppi.yaml',
    'src/ugv_main/ugv_nav/params/rpp.yaml',
    'src/ugv_main/ugv_nav/params/teb.yaml',
)


# --------------------------------------------------------------------------
# Static scan
# --------------------------------------------------------------------------
SCANNED_SUFFIXES = ('.py', '.cpp', '.hpp', '.h', '.cc', '.js', '.yaml', '.yml', '.xml')

SKIPPED_DIR_NAMES = frozenset({
    '.git', '__pycache__', 'build', 'install', 'log', 'node_modules', 'site',
})

# Each pattern describes a shape that would make something a *publisher* of
# /cmd_vel. Kept narrow on purpose: a broad "any mention of cmd_vel" scan turns
# every comment into a test failure and gets disabled the first time it is
# noisy, which is worse than no test at all.
CMD_VEL_PUBLISHER_PATTERNS = (
    # rclpy, any message type: create_publisher(Twist, '/cmd_vel', 10)
    (re.compile(r"create_publisher\s*\([^)]*['\"]/?cmd_vel['\"]"),
     'rclpy publisher on cmd_vel'),
    # rclcpp: create_publisher<geometry_msgs::msg::Twist>("cmd_vel", ...)
    (re.compile(r"create_publisher\s*<[^>]*>\s*\(\s*\"/?cmd_vel\""),
     'rclcpp publisher on cmd_vel'),
    # launch remapping whose TARGET is cmd_vel: ('cmd_vel_out', '/cmd_vel')
    (re.compile(r"\(\s*['\"][^'\"]+['\"]\s*,\s*['\"]/?cmd_vel['\"]\s*\)"),
     'launch remapping onto cmd_vel'),
    # nav2 / collision_monitor style output parameter
    (re.compile(r"cmd_vel_out_topic\s*:\s*['\"]/?cmd_vel['\"]"),
     'nav2 cmd_vel_out_topic'),
    # web clients (Vizanti, roslibjs): topic = "/cmd_vel" / name: "/cmd_vel"
    (re.compile(r"topic\s*=\s*['\"]/?cmd_vel['\"]"),
     'web client publishing on cmd_vel'),
    # roslibjs: new ROSLIB.Topic({name: '/cmd_vel', ...}). The lookbehind keeps
    # this off ros_gz_bridge.yaml's ros_topic_name/gz_topic_name keys, which
    # describe a ROS_TO_GZ bridge — a subscriber on the ROS side, not a
    # publisher.
    (re.compile(r"(?<!\w)name\s*:\s*['\"]/?cmd_vel['\"]"),
     'roslibjs Topic named cmd_vel'),
)

# The ONLY accepted hits, each with the reason it is not a violation. A new
# entry here is a review flag, not a formality: adding one is claiming that
# something other than twist_mux may touch /cmd_vel.
ALLOWED_CMD_VEL_HITS = {
    'src/ugv_main/ugv_cockpit/launch/twist_mux.launch.py':
        'THE allowed publisher: remaps twist_mux cmd_vel_out -> /cmd_vel.',
    'src/ugv_else/teb_local_planner/teb_local_planner/scripts/'
    'cmd_vel_to_ackermann_drive.py':
        'Subscriber, not publisher: reads /cmd_vel and emits AckermannDrive. '
        'Third-party teb_local_planner, not in any BEAST launch path.',
}


def workspace_root():
    """Walk up from this file until the directory holding src/ugv_main."""
    path = os.path.abspath(os.path.dirname(__file__))
    while True:
        if os.path.isdir(os.path.join(path, 'src', 'ugv_main')):
            return path
        parent = os.path.dirname(path)
        if parent == path:
            raise RuntimeError(
                'workspace root (a directory containing src/ugv_main) not found '
                'above %s' % os.path.abspath(os.path.dirname(__file__))
            )
        path = parent


def read(relative_path):
    with open(os.path.join(workspace_root(), relative_path), encoding='utf-8') as handle:
        return handle.read()


def scanned_files():
    """Yield workspace-relative paths of every file the scan inspects."""
    root = workspace_root()
    src = os.path.join(root, 'src')
    for dirpath, dirnames, filenames in os.walk(src):
        dirnames[:] = [d for d in dirnames if d not in SKIPPED_DIR_NAMES]
        for name in filenames:
            if not name.endswith(SCANNED_SUFFIXES):
                continue
            absolute = os.path.join(dirpath, name)
            yield os.path.relpath(absolute, root).replace(os.sep, '/'), absolute


@pytest.fixture(scope='module')
def twist_mux_params():
    raw = read('src/ugv_main/ugv_cockpit/config/twist_mux.yaml')
    document = yaml.safe_load(raw)
    assert 'twist_mux' in document, (
        'top-level key must stay "twist_mux": the node hard-codes that name, and '
        'a mismatch means ROS 2 silently loads none of these parameters'
    )
    return document['twist_mux']['ros__parameters']


# --------------------------------------------------------------------------
# (a) the ladder
# --------------------------------------------------------------------------
def test_config_declares_the_exact_priority_ladder(twist_mux_params):
    assert twist_mux_params['topics'] == EXPECTED_TOPICS


def test_every_command_source_expires_after_half_a_second(twist_mux_params):
    for name, entry in twist_mux_params['topics'].items():
        assert entry['timeout'] == SOURCE_TIMEOUT_S, (
            'source %r must expire on the same 0.5 s cadence as ugv_bringup\'s '
            'cmd_vel watchdog' % name
        )


def test_priorities_are_strictly_ordered_human_over_autonomy(twist_mux_params):
    topics = twist_mux_params['topics']
    ordered = sorted(topics, key=lambda name: topics[name]['priority'], reverse=True)
    assert ordered == EXPECTED_LADDER
    priorities = [topics[name]['priority'] for name in ordered]
    assert len(set(priorities)) == len(priorities), 'no two sources may tie'


def test_source_topics_are_distinct_and_never_cmd_vel(twist_mux_params):
    names = [entry['topic'] for entry in twist_mux_params['topics'].values()]
    assert len(set(names)) == len(names)
    for name in names:
        assert name.lstrip('/') != 'cmd_vel', (
            'a mux INPUT named cmd_vel would feed the mux its own output'
        )


# --------------------------------------------------------------------------
# (c) the e-stop lock
# --------------------------------------------------------------------------
def test_estop_lock_is_priority_255_manual_toggle(twist_mux_params):
    assert twist_mux_params['locks'] == EXPECTED_LOCKS


def test_estop_lock_outranks_every_drive_source(twist_mux_params):
    highest_source = max(
        entry['priority'] for entry in twist_mux_params['topics'].values()
    )
    assert twist_mux_params['locks']['estop']['priority'] > highest_source


def test_estop_lock_timeout_is_zero_to_avoid_the_epoch_zero_lock(twist_mux_params):
    """twist_mux locks initialise their last-received stamp at epoch zero.

    With ``timeout > 0`` the lock therefore reads as *expired*, i.e. engaged,
    from the instant the node starts, and stays engaged until some node
    publishes a heartbeat on it. Nothing in this workspace publishes
    ``cmd_vel_estop_lock`` yet, so a non-zero timeout would ship a robot that
    can never be commanded. ``0.0`` makes the lock a pure manual toggle.
    Flip this to 0.5 in the same commit that lands a heartbeat publisher.
    """
    assert twist_mux_params['locks']['estop']['timeout'] == 0.0


# --------------------------------------------------------------------------
# (b) nothing else publishes /cmd_vel
# --------------------------------------------------------------------------
def test_no_direct_cmd_vel_publisher_outside_twist_mux():
    violations = []
    for relative_path, absolute_path in scanned_files():
        if relative_path == 'src/ugv_main/ugv_cockpit/test/test_twist_mux_spine.py':
            continue  # this file quotes the patterns it searches for
        try:
            with open(absolute_path, encoding='utf-8') as handle:
                lines = handle.readlines()
        except (UnicodeDecodeError, OSError):
            continue
        for number, line in enumerate(lines, start=1):
            for pattern, description in CMD_VEL_PUBLISHER_PATTERNS:
                if not pattern.search(line):
                    continue
                if relative_path in ALLOWED_CMD_VEL_HITS:
                    continue
                violations.append(
                    '%s:%d  %s\n      %s'
                    % (relative_path, number, description, line.strip())
                )

    assert not violations, (
        'twist_mux must be the only publisher of /cmd_vel. Route these to a '
        'twist_mux input topic (see ugv_cockpit/config/twist_mux.yaml) instead:\n'
        + '\n'.join(violations)
    )


def test_allowlist_entries_still_exist():
    """A stale allowlist silently widens the scan's blind spot."""
    root = workspace_root()
    for relative_path in ALLOWED_CMD_VEL_HITS:
        assert os.path.isfile(os.path.join(root, relative_path)), (
            'allowlisted path no longer exists, drop it: %s' % relative_path
        )


def test_rerouted_publishers_target_declared_mux_inputs(twist_mux_params):
    declared = {entry['topic'] for entry in twist_mux_params['topics'].values()}
    publisher = re.compile(
        r"create_publisher\(\s*Twist\s*,\s*['\"]/?(?P<topic>[A-Za-z0-9_/]+)['\"]"
    )
    for relative_path, expected_topic in EXPECTED_REROUTES.items():
        assert expected_topic in declared, (
            '%s is routed to %r, which twist_mux.yaml does not declare'
            % (relative_path, expected_topic)
        )
        found = publisher.findall(read(relative_path))
        assert found, 'no Twist publisher found in %s' % relative_path
        for topic in found:
            assert topic.lstrip('/') == expected_topic, (
                '%s publishes Twist on %r, expected the %r mux input'
                % (relative_path, topic, expected_topic)
            )


def test_nav2_final_hop_feeds_the_mux_not_cmd_vel():
    for relative_path in NAV2_PARAM_FILES:
        params = yaml.safe_load(read(relative_path))
        monitor = params['collision_monitor']['ros__parameters']
        assert monitor['cmd_vel_out_topic'] == 'cmd_vel_nav', (
            '%s: collision_monitor is nav2\'s last node, so its output is the '
            'mux input, not /cmd_vel' % relative_path
        )
        assert monitor['cmd_vel_in_topic'] != 'cmd_vel'


# --------------------------------------------------------------------------
# Wiring: the spine is actually launched, and its output lands where the
# driver listens.
# --------------------------------------------------------------------------
def test_twist_mux_launch_remaps_output_onto_cmd_vel():
    source = read('src/ugv_main/ugv_cockpit/launch/twist_mux.launch.py')
    assert "package='twist_mux'" in source
    assert "executable='twist_mux'" in source
    assert "('cmd_vel_out', '/cmd_vel')" in source
    assert "'twist_mux.yaml'" in source
    assert re.search(r'^\s*name\s*=', source, re.MULTILINE) is None, (
        'do not rename the node: twist_mux.cpp hard-codes "twist_mux", which is '
        'also the parameter file\'s top-level key, and a rename silently drops '
        'the whole ladder'
    )


def test_robot_bringup_launches_the_spine_unconditionally():
    source = read('src/ugv_main/ugv_bringup/launch/bringup_lidar.launch.py')
    assert "get_package_share_directory('ugv_cockpit')" in source
    assert "'twist_mux.launch.py'" in source
    assert 'twist_mux_launch,' in source, 'include it in the LaunchDescription'
    include = source.split('twist_mux_launch = IncludeLaunchDescription(')[1]
    include = include.split('\n    )')[0]
    assert 'condition=' not in include, (
        'the spine must not be switchable off: with every source rerouted, a '
        'bringup without twist_mux has no path to the motors at all'
    )


def test_simulation_uses_the_same_ladder():
    source = read('src/ugv_main/ugv_gazebo/launch/bringup_gazebo.launch.py')
    assert "get_package_share_directory('ugv_cockpit')" in source
    assert "'use_sim_time': 'true'" in source, (
        'twist_mux source timeouts run on ROS time; without sim time every '
        'source expires instantly against /clock'
    )


def test_ugv_bringup_still_consumes_cmd_vel():
    """The mux output has to land on the topic the ESP32 bridge listens to."""
    source = read('src/ugv_main/ugv_bringup/ugv_bringup/ugv_bringup.py')
    assert 'create_subscription(Twist, "cmd_vel"' in source


# --------------------------------------------------------------------------
# Guard rails: PR-1 changes routing only. These fail if a later change starts
# "simplifying" the downstream safety layers the spine depends on.
# --------------------------------------------------------------------------
def test_motion_gate_and_watchdog_are_untouched():
    source = read('src/ugv_main/ugv_bringup/ugv_bringup/ugv_bringup.py')
    assert "self.declare_parameter('allow_motion', False)" in source, (
        'allow_motion must stay default-off'
    )
    assert "self.declare_parameter('cmd_vel_timeout', 0.5)" in source
    assert 'Rejected non-zero cmd_vel while allow_motion is false' in source
    assert '_cmd_vel_watchdog_tick' in source
    assert 'def send_stop_command' in source


def test_bringup_quirks_are_preserved_not_fixed():
    """The zero-drop and yaw-floor hacks are routed around, never edited.

    ugv_bringup drops zero Twists after 5 consecutive zeros and forces a tiny
    yaw command up to +/-0.2 rad/s. Both are documented quirks the cockpit has
    to respect; "fixing" them here would change ESP32 behaviour under a PR whose
    whole claim is that it only changes routing.
    """
    source = read('src/ugv_main/ugv_bringup/ugv_bringup/ugv_bringup.py')
    assert 'self.zero_vel_limit = 5' in source
    assert 'angular_velocity = 0.2' in source
    assert 'angular_velocity = -0.2' in source


def test_bringup_launch_still_defaults_allow_motion_false():
    source = read('src/ugv_main/ugv_bringup/launch/bringup_lidar.launch.py')
    assert "'allow_motion', default_value='false'" in source
