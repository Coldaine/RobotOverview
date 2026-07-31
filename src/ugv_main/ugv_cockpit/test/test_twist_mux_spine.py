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

import ast
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
# '.sh' is here because a shell script is a perfectly good way to smuggle a
# /cmd_vel publisher back in (`ros2 topic pub /cmd_vel ...` in a demo or service
# wrapper) and it would otherwise sail past a scan that only reads source files.
SCANNED_SUFFIXES = (
    '.py', '.cpp', '.hpp', '.h', '.cc', '.js', '.yaml', '.yml', '.xml', '.sh',
)

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
    # nav2 / collision_monitor style output parameter, YAML form:
    #   cmd_vel_out_topic: "cmd_vel"   or   cmd_vel_out_topic: cmd_vel
    # The trailing lookahead is what keeps this off the legitimate
    # `cmd_vel_out_topic: cmd_vel_nav`.
    (re.compile(r"cmd_vel_out_topic\s*:\s*['\"]?/?cmd_vel(?![\w/])"),
     'nav2 cmd_vel_out_topic'),
    # ...and the Python-dict / launch-parameter form, where the KEY is quoted:
    #   {'cmd_vel_out_topic': 'cmd_vel'}
    # The YAML pattern above cannot see this one — the quote after the key
    # breaks its `cmd_vel_out_topic\s*:` anchor — so a param set from a launch
    # file instead of a yaml file would slip straight through.
    (re.compile(r"['\"]cmd_vel_out_topic['\"]\s*:\s*['\"]/?cmd_vel['\"]"),
     'nav2 cmd_vel_out_topic (python dict form)'),
    # Shell scripts: `ros2 topic pub /cmd_vel geometry_msgs/msg/Twist ...`.
    # Docs deliberately teach this as a manual stop, and docs are not scanned;
    # a script in src/ that does it is a publisher the spine cannot see.
    (re.compile(r"ros2\s+topic\s+pub\b[^\n]*?(?<![\w/])/?cmd_vel(?![\w/])"),
     'shell publish onto cmd_vel'),
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

    # Top-level operator scripts (ros2.sh, save_map.sh, build_*.sh). These are
    # the shell scripts in this repo that actually run ROS commands — the ones
    # under src/ are udev and model-export helpers — so scanning only src/
    # would make the .sh suffix above almost a no-op. Non-recursive: everything
    # nested at the root that matters is either src/ (above) or not ours.
    for name in sorted(os.listdir(root)):
        if not name.endswith('.sh'):
            continue
        absolute = os.path.join(root, name)
        if os.path.isfile(absolute):
            yield name, absolute


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
# Launch-level audit of the nav2 bringup.
#
# The scan above is per-line and only sees a remapping that *targets* cmd_vel.
# It is blind to the opposite and much likelier mistake: a nav2 node that
# publishes Twist on its default "cmd_vel" and is simply never remapped at all.
# That is how behavior_server shipped straight past the mux — nav2_behaviors'
# timed_behavior.hpp creates its own Twist publisher on "cmd_vel", so a node
# carrying only the tf remappings reaches /cmd_vel directly.
#
# So: enumerate every Node/ComposableNode in navigation_launch.py and force
# each one into a named bucket. A nav2 package nobody has classified fails the
# test rather than silently defaulting to "probably harmless".
# --------------------------------------------------------------------------
NAV2_LAUNCH_FILE = 'src/ugv_main/ugv_nav/launch/nav_bringup/navigation_launch.py'

# Velocity-capable: these packages can put a geometry_msgs/Twist on the wire.
# Each must be accounted for below.
VELOCITY_CAPABLE_NAV2_PACKAGES = frozenset({
    'nav2_controller',          # controller_server — the main control loop
    'nav2_velocity_smoother',   # smooths controller output
    'nav2_collision_monitor',   # nav2's last-chance veto
    'nav2_behaviors',           # spin / backup / drive_on_heading / assisted_teleop
})

# Velocity-capable AND routed by a launch remapping on "cmd_vel".
NAV2_PACKAGES_NEEDING_CMD_VEL_REMAP = frozenset({
    'nav2_controller',
    'nav2_velocity_smoother',
    'nav2_behaviors',
})

# Velocity-capable but routed by a PARAMETER, not a remapping:
# collision_monitor's output topic is `cmd_vel_out_topic` in params/*.yaml,
# already asserted by test_nav2_final_hop_feeds_the_mux_not_cmd_vel. Listing it
# here is the explicit claim "yes, this one publishes velocity, and here is
# where its routing is checked instead".
NAV2_PACKAGES_ROUTED_BY_PARAM = frozenset({
    'nav2_collision_monitor',
})

# No velocity output at all — action servers, map/localisation, lifecycle. These
# must NOT carry a cmd_vel remapping; one appearing here means either the node
# grew a velocity path or someone pasted a remap into the wrong block.
# nav2_smoother is the PATH smoother (smoother_server), not velocity_smoother.
NAV2_PACKAGES_WITHOUT_VELOCITY = frozenset({
    'nav2_planner',             # planner_server — produces paths
    'nav2_bt_navigator',        # behaviour tree, issues actions
    'nav2_smoother',            # smoother_server — smooths PATHS, not velocity
    'nav2_waypoint_follower',   # sequences navigate_to_pose goals
    'nav2_map_server',          # map / map_saver
    'nav2_amcl',                # localisation
    'nav2_lifecycle_manager',   # lifecycle transitions only
})

# Where a nav2 cmd_vel remapping is allowed to land: an internal nav2 hop, or
# the mux input. Never bare cmd_vel — that is twist_mux's output.
ALLOWED_NAV2_CMD_VEL_TARGETS = frozenset({'cmd_vel_nav_raw', 'cmd_vel_nav'})

_LAUNCH_NODE_CALLS = ('Node', 'ComposableNode')


def _call_name(node):
    func = node.func
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return None


def launch_node_calls(relative_path):
    """Every Node(...)/ComposableNode(...) call in a launch file.

    Returns a list of (call_name, {keyword: unparsed_source}). Parsing the AST
    rather than slicing text means indentation, comments, argument order and
    line wrapping cannot fool it — the previous text-level checks in this file
    would happily miss a remapping split across lines.
    """
    tree = ast.parse(read(relative_path), filename=relative_path)
    calls = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        name = _call_name(node)
        if name not in _LAUNCH_NODE_CALLS:
            continue
        kwargs = {}
        for keyword in node.keywords:
            if keyword.arg is None:
                continue  # **kwargs — nothing we can classify
            kwargs[keyword.arg] = ast.unparse(keyword.value)
        calls.append((name, kwargs))
    return calls


def _package_of(kwargs):
    raw = kwargs.get('package')
    if raw is None:
        return None
    return raw.strip('\'"')


def _cmd_vel_remap_targets(kwargs):
    """Targets of any ('cmd_vel', X) pair in this call's remappings."""
    remappings = kwargs.get('remappings', '')
    return re.findall(
        r"\(\s*['\"]/?cmd_vel['\"]\s*,\s*['\"]/?([A-Za-z0-9_/]+)['\"]\s*\)",
        remappings,
    )


def test_every_nav2_launch_node_is_classified():
    """A nav2 package nobody has thought about must not slip in silently."""
    known = (
        VELOCITY_CAPABLE_NAV2_PACKAGES
        | NAV2_PACKAGES_WITHOUT_VELOCITY
    )
    unknown = set()
    for _, kwargs in launch_node_calls(NAV2_LAUNCH_FILE):
        package = _package_of(kwargs)
        if package is not None and package not in known:
            unknown.add(package)
    assert not unknown, (
        '%s launches nav2 packages this test has never classified: %s. Decide '
        'whether each one can publish geometry_msgs/Twist and add it to '
        'VELOCITY_CAPABLE_NAV2_PACKAGES (and one of the routing sets) or to '
        'NAV2_PACKAGES_WITHOUT_VELOCITY.' % (NAV2_LAUNCH_FILE, sorted(unknown))
    )


def test_velocity_capable_sets_partition_cleanly():
    """The two routing sets must together be exactly the velocity-capable set."""
    assert (
        NAV2_PACKAGES_NEEDING_CMD_VEL_REMAP | NAV2_PACKAGES_ROUTED_BY_PARAM
        == VELOCITY_CAPABLE_NAV2_PACKAGES
    )
    assert not (
        NAV2_PACKAGES_NEEDING_CMD_VEL_REMAP & NAV2_PACKAGES_ROUTED_BY_PARAM
    )
    assert not (
        VELOCITY_CAPABLE_NAV2_PACKAGES & NAV2_PACKAGES_WITHOUT_VELOCITY
    )


def test_every_velocity_capable_nav2_node_is_routed_off_cmd_vel():
    """The test that would have caught behavior_server."""
    missing = []
    misrouted = []
    for call_name, kwargs in launch_node_calls(NAV2_LAUNCH_FILE):
        package = _package_of(kwargs)
        if package not in NAV2_PACKAGES_NEEDING_CMD_VEL_REMAP:
            continue
        targets = _cmd_vel_remap_targets(kwargs)
        if not targets:
            missing.append('%s(package=%s)' % (call_name, package))
            continue
        for target in targets:
            if target.lstrip('/') not in ALLOWED_NAV2_CMD_VEL_TARGETS:
                misrouted.append(
                    '%s(package=%s) remaps cmd_vel -> %r'
                    % (call_name, package, target)
                )

    assert not missing, (
        'these nav2 nodes publish geometry_msgs/Twist on their default '
        '"cmd_vel" topic and carry no remapping, so they reach /cmd_vel '
        'directly and bypass twist_mux entirely: %s\nAdd '
        "('cmd_vel', 'cmd_vel_nav') (or 'cmd_vel_nav_raw' for an internal nav2 "
        'hop) to their remappings in %s.' % (missing, NAV2_LAUNCH_FILE)
    )
    assert not misrouted, (
        'nav2 cmd_vel remappings must land on an internal nav2 hop or the mux '
        'input, never on /cmd_vel itself: %s' % misrouted
    )


def test_both_nav2_launch_branches_carry_the_same_routing():
    """use_composition picks ONE branch, so a fix in one is a fix in neither."""
    seen = {}
    for call_name, kwargs in launch_node_calls(NAV2_LAUNCH_FILE):
        package = _package_of(kwargs)
        if package in NAV2_PACKAGES_NEEDING_CMD_VEL_REMAP:
            seen.setdefault(package, []).append(
                (call_name, tuple(_cmd_vel_remap_targets(kwargs)))
            )

    for package in sorted(NAV2_PACKAGES_NEEDING_CMD_VEL_REMAP):
        entries = seen.get(package, [])
        branches = {call_name for call_name, _ in entries}
        assert branches == set(_LAUNCH_NODE_CALLS), (
            '%s must appear in BOTH the plain-Node and the ComposableNode '
            'branch of %s (found: %s)' % (package, NAV2_LAUNCH_FILE, sorted(branches))
        )
        targets = {target for _, target in entries}
        assert len(targets) == 1, (
            '%s is remapped differently in the two branches of %s: %s. '
            'use_composition selects one at launch time, so they must agree.'
            % (package, NAV2_LAUNCH_FILE, sorted(targets))
        )


def test_non_velocity_nav2_nodes_carry_no_cmd_vel_remap():
    """A cmd_vel remap on a node with no velocity output is a paste error."""
    stray = []
    for call_name, kwargs in launch_node_calls(NAV2_LAUNCH_FILE):
        package = _package_of(kwargs)
        if package not in NAV2_PACKAGES_WITHOUT_VELOCITY:
            continue
        targets = _cmd_vel_remap_targets(kwargs)
        if targets:
            stray.append(
                '%s(package=%s) -> %s' % (call_name, package, targets)
            )
    assert not stray, (
        'these nav2 nodes are on the no-velocity allowlist but carry a cmd_vel '
        'remapping — either the allowlist is wrong or the remap is: %s' % stray
    )


def test_collision_monitor_is_routed_by_param_not_remap():
    """Documents WHY collision_monitor is exempt from the remap requirement."""
    for call_name, kwargs in launch_node_calls(NAV2_LAUNCH_FILE):
        if _package_of(kwargs) not in NAV2_PACKAGES_ROUTED_BY_PARAM:
            continue
        assert not _cmd_vel_remap_targets(kwargs), (
            '%s: collision_monitor takes its output topic from '
            'cmd_vel_out_topic in params/*.yaml (asserted by '
            'test_nav2_final_hop_feeds_the_mux_not_cmd_vel). A launch remapping '
            'here would be a second, competing source of truth.' % call_name
        )


# --------------------------------------------------------------------------
# Idle sources must let go of the twist_mux floor.
#
# twist_mux awards /cmd_vel to the highest-priority source that has not
# expired, and ANY message refreshes that source's timer — a zero Twist
# included. A teleop node that publishes zeros while idle therefore pins its
# rung forever and starves everything below it. Both teleop nodes send a
# bounded tail of zeros (so the robot stops by command) and then go silent (so
# the rung is released).
# --------------------------------------------------------------------------
ZERO_TAIL_SOURCES = (
    'src/ugv_main/ugv_tools/ugv_tools/keyboard_ctrl.py',
    'src/ugv_main/ugv_tools/ugv_tools/joy_ctrl.py',
)

# Same number as ugv_bringup's own `zero_vel_limit = 5`, asserted below.
EXPECTED_ZERO_TAIL_LIMIT = 5

JOY_LAUNCH_FILE = 'src/ugv_main/ugv_tools/launch/teleop_twist_joy.launch.py'


@pytest.mark.parametrize('relative_path', ZERO_TAIL_SOURCES)
def test_teleop_declares_a_named_zero_tail_limit(relative_path):
    """Named constant, identical in both files, so this test is not regex bait."""
    source = read(relative_path)
    match = re.search(
        r'^ZERO_TAIL_LIMIT\s*=\s*(\d+)\s*$', source, re.MULTILINE
    )
    assert match, (
        '%s must declare a module-level `ZERO_TAIL_LIMIT = <n>`: the bound on '
        'how many zero Twists it sends before going silent. Without it an idle '
        'teleop node holds its twist_mux rung forever and every lower rung '
        '(UI 50, nav 10) is starved.' % relative_path
    )
    assert int(match.group(1)) == EXPECTED_ZERO_TAIL_LIMIT, (
        '%s: keep ZERO_TAIL_LIMIT at %d, matching ugv_bringup\'s zero_vel_limit'
        % (relative_path, EXPECTED_ZERO_TAIL_LIMIT)
    )


@pytest.mark.parametrize('relative_path', ZERO_TAIL_SOURCES)
def test_teleop_actually_uses_the_zero_tail_limit(relative_path):
    """The constant has to gate a publish, not just sit there."""
    source = read(relative_path)
    uses = len(re.findall(r'(?<!^)ZERO_TAIL_LIMIT', source, re.MULTILINE))
    assert uses >= 2, (
        '%s declares ZERO_TAIL_LIMIT but barely references it — the bound must '
        'actually gate the publish (a counter compared against it) and be '
        'reset when a real command arrives.' % relative_path
    )
    assert re.search(r'<\s*ZERO_TAIL_LIMIT', source), (
        '%s: expected a `... < ZERO_TAIL_LIMIT` guard around the zero publish'
        % relative_path
    )


def test_zero_tail_limit_matches_bringup_zero_vel_limit():
    source = read('src/ugv_main/ugv_bringup/ugv_bringup/ugv_bringup.py')
    match = re.search(r'self\.zero_vel_limit\s*=\s*(\d+)', source)
    assert match, 'ugv_bringup no longer declares zero_vel_limit'
    assert int(match.group(1)) == EXPECTED_ZERO_TAIL_LIMIT, (
        'ugv_bringup changed zero_vel_limit; the teleop zero tails mirror it '
        'deliberately, so move ZERO_TAIL_LIMIT in the same commit'
    )


def test_joy_node_does_not_autorepeat_an_idle_gamepad():
    """joy_node's default 20 Hz autorepeat is a starvation source by itself.

    With autorepeat_rate > 0 the driver re-sends the last pad state forever, so
    a gamepad sitting untouched on a desk keeps joy_ctrl's priority-150 rung
    alive and nothing below it can ever reach the motors.
    """
    joy_nodes = [
        kwargs for _, kwargs in launch_node_calls(JOY_LAUNCH_FILE)
        if _package_of(kwargs) == 'joy'
    ]
    assert joy_nodes, '%s no longer launches the joy driver' % JOY_LAUNCH_FILE
    for kwargs in joy_nodes:
        parameters = kwargs.get('parameters', '')
        match = re.search(
            r"['\"]autorepeat_rate['\"]\s*:\s*([0-9.]+)", parameters
        )
        assert match, (
            '%s: joy_node must set autorepeat_rate explicitly. Its default '
            '(20.0 Hz in Humble) synthesises /joy messages for an idle pad, '
            'which pins the top twist_mux rung.' % JOY_LAUNCH_FILE
        )
        assert float(match.group(1)) == 0.0, (
            '%s: autorepeat_rate must be 0.0 — publish /joy only on real pad '
            'state changes.' % JOY_LAUNCH_FILE
        )


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
