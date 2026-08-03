# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0

"""Static checks for the standalone PR-4a behavior_server config.

Runnable on Windows (no ROS runtime): parses the YAML + launch AST and asserts
the safety contracts the Hangar agent path depends on.

  python -m pytest src/ugv_main/ugv_cockpit/test/test_behavior_server_config.py

On-robot verify (not automated here — needs Jetson + bringup):

  ros2 launch ugv_cockpit behavior_server.launch.py
  ros2 action list   # /spin /backup /drive_on_heading /wait
  # disarmed Spin goal → wheels stay still (allow_motion false)
"""

import ast
import os

import pytest
import yaml


PARAMS_REL = 'src/ugv_main/ugv_cockpit/config/behavior_server.yaml'
LAUNCH_REL = 'src/ugv_main/ugv_cockpit/launch/behavior_server.launch.py'

BEAST_MAX_LINEAR_M_S = 0.15
REQUIRED_PLUGINS = ('spin', 'backup', 'drive_on_heading', 'wait')


def workspace_root():
    path = os.path.abspath(os.path.dirname(__file__))
    while True:
        if os.path.isdir(os.path.join(path, 'src', 'ugv_main')):
            return path
        parent = os.path.dirname(path)
        if parent == path:
            raise RuntimeError('workspace root not found above %s' % path)
        path = parent


def read(relative_path):
    with open(os.path.join(workspace_root(), relative_path), encoding='utf-8') as handle:
        return handle.read()


@pytest.fixture(scope='module')
def behavior_params():
    document = yaml.safe_load(read(PARAMS_REL))
    assert 'behavior_server' in document, 'top-level key must be behavior_server'
    return document['behavior_server']['ros__parameters']


@pytest.fixture(scope='module')
def params_document():
    return yaml.safe_load(read(PARAMS_REL))


PLUGIN_TYPES = {
    'spin': 'nav2_behaviors/Spin',
    'backup': 'nav2_behaviors/BackUp',
    'drive_on_heading': 'nav2_behaviors/DriveOnHeading',
    'wait': 'nav2_behaviors/Wait',
}


def test_odom_frames_only_no_map(behavior_params):
    assert behavior_params['global_frame'] == 'odom'
    assert behavior_params['robot_base_frame'] == 'base_link'
    # Humble behavior_server has no local_frame param; reject a map global.
    assert behavior_params['global_frame'] != 'map'
    assert 'local_frame' not in behavior_params or behavior_params['local_frame'] == 'odom'


def test_required_behavior_plugins(behavior_params):
    plugins = behavior_params['behavior_plugins']
    for name in REQUIRED_PLUGINS:
        assert name in plugins, 'missing behavior plugin %r' % name
        assert behavior_params[name]['plugin'] == PLUGIN_TYPES[name]


def test_humble_costmap_topic_keys(behavior_params):
    """Match ros-humble-nav2-behaviors 1.1.x (singular topic keys)."""
    assert behavior_params['costmap_topic'] == 'local_costmap/costmap_raw'
    assert behavior_params['footprint_topic'] == 'local_costmap/published_footprint'


def test_local_costmap_is_live_and_scan_backed(params_document):
    costmap = params_document['local_costmap']['local_costmap']['ros__parameters']
    assert costmap['global_frame'] == 'odom'
    assert costmap['robot_base_frame'] == 'base_link'
    assert costmap['rolling_window'] is True
    assert costmap['robot_radius'] == pytest.approx(0.15)
    assert costmap['plugins'] == ['obstacle_layer', 'inflation_layer']
    obstacle = costmap['obstacle_layer']
    assert obstacle['plugin'] == 'nav2_costmap_2d::ObstacleLayer'
    assert obstacle['observation_sources'] == 'scan'
    assert obstacle['scan']['topic'] == '/scan'
    assert obstacle['scan']['data_type'] == 'LaserScan'
    assert obstacle['scan']['clearing'] is True
    assert obstacle['scan']['marking'] is True


def test_beast_speed_policy_enforced_on_robot(behavior_params, params_document):
    text = read(PARAMS_REL)
    assert '0.15' in text
    assert '≤ 0.15' in text or '<= 0.15' in text or '≤0.15' in text
    # Soft ramps must not imply a server-side speed above Beast policy.
    for key in ('backup', 'drive_on_heading'):
        assert behavior_params[key]['minimum_speed'] <= BEAST_MAX_LINEAR_M_S
        assert behavior_params[key]['acceleration_limit'] > 0.0
        assert behavior_params[key]['deceleration_limit'] < 0.0
    smoother = params_document['velocity_smoother']['ros__parameters']
    assert smoother['feedback'] == 'OPEN_LOOP'
    assert smoother['max_velocity'][0] == pytest.approx(BEAST_MAX_LINEAR_M_S)
    assert smoother['min_velocity'][0] == pytest.approx(-BEAST_MAX_LINEAR_M_S)
    assert smoother['velocity_timeout'] > 0.0


def test_launch_uses_nav2_behaviors_and_lifecycle():
    source = read(LAUNCH_REL)
    assert "package='nav2_behaviors'" in source
    assert "executable='behavior_server'" in source
    assert "package='nav2_costmap_2d'" in source
    assert "executable='nav2_costmap_2d'" in source
    assert "package='nav2_velocity_smoother'" in source
    assert "executable='velocity_smoother'" in source
    assert "package='nav2_lifecycle_manager'" in source
    assert "'behavior_server.yaml'" in source
    assert "get_package_share_directory('ugv_cockpit')" in source


def _node_remappings(tree, package):
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = func.id if isinstance(func, ast.Name) else getattr(func, 'attr', None)
        if name != 'Node':
            continue
        kwargs = {kw.arg: kw.value for kw in node.keywords if kw.arg}
        pkg = kwargs.get('package')
        if pkg is None or ast.literal_eval(ast.unparse(pkg)) != package:
            continue
        remappings = kwargs.get('remappings')
        assert remappings is not None, '%s Node needs remappings' % package
        return ast.literal_eval(remappings)
    raise AssertionError('no %s Node found in %s' % (package, LAUNCH_REL))


def test_launch_routes_behavior_through_clamp_onto_mux_nav_rung():
    """No behavior path may bypass the robot-side clamp or twist_mux."""
    tree = ast.parse(read(LAUNCH_REL), filename=LAUNCH_REL)
    behavior_remaps = dict(_node_remappings(tree, 'nav2_behaviors'))
    smoother_remaps = dict(_node_remappings(tree, 'nav2_velocity_smoother'))
    assert behavior_remaps['cmd_vel'] == 'cmd_vel_behavior_raw'
    assert smoother_remaps['cmd_vel'] == 'cmd_vel_behavior_raw'
    assert smoother_remaps['smoothed_cmd_vel'] == 'cmd_vel_nav'


def test_lifecycle_manager_owns_complete_behavior_stack(params_document):
    manager = params_document['lifecycle_manager_behavior']['ros__parameters']
    assert manager['autostart'] is True
    assert manager['node_names'] == [
        'local_costmap',
        'behavior_server',
        'velocity_smoother',
    ]


def test_launch_header_documents_required_stack():
    source = read(LAUNCH_REL)
    assert 'ros-humble-nav2-behaviors' in source
    assert 'ros-humble-nav2-costmap-2d' in source
    assert 'ros-humble-nav2-velocity-smoother' in source
    assert 'allow_motion' in source
    assert 'cmd_vel_nav' in source


def test_launch_is_opt_in_not_in_cockpit_or_bringup():
    """Standalone only — Wave 2/3 apply on-robot; do not auto-arm via bringup."""
    cockpit = read('src/ugv_main/ugv_cockpit/launch/cockpit.launch.py')
    bringup = read('src/ugv_main/ugv_bringup/launch/bringup_lidar.launch.py')
    assert 'behavior_server.launch.py' not in cockpit
    assert 'behavior_server.launch.py' not in bringup
