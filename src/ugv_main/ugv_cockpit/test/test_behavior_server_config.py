# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0

"""Static checks for the standalone PR-4a behavior_server config.

Runnable on Windows (no ROS runtime): parses the YAML + launch AST and asserts
the safety contracts the Hangar agent path depends on.

  python -m pytest src/ugv_main/ugv_cockpit/test/test_behavior_server_config.py

On-robot verify (not automated here — needs Jetson + bringup):

  ros2 launch ugv_cockpit behavior_server.launch.py
  ros2 action list   # /spin /backup /drive_on_heading
  # disarmed Spin goal → wheels stay still (allow_motion false)
"""

import ast
import os
import re

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


def test_blind_primitives_documented_in_yaml_header():
    text = read(PARAMS_REL)
    assert 'BLIND PRIMITIVES' in text
    assert 'FOLLOW-UP' in text
    assert '/scan' in text


def test_beast_speed_policy_documented(behavior_params):
    text = read(PARAMS_REL)
    assert '0.15' in text
    assert '≤ 0.15' in text or '<= 0.15' in text or '≤0.15' in text
    # Soft ramps must not imply a server-side speed above Beast policy.
    for key in ('backup', 'drive_on_heading'):
        assert behavior_params[key]['minimum_speed'] <= BEAST_MAX_LINEAR_M_S
        assert behavior_params[key]['acceleration_limit'] > 0.0
        assert behavior_params[key]['deceleration_limit'] < 0.0


def test_launch_uses_nav2_behaviors_and_lifecycle():
    source = read(LAUNCH_REL)
    assert "package='nav2_behaviors'" in source
    assert "executable='behavior_server'" in source
    assert "package='nav2_lifecycle_manager'" in source
    assert "'behavior_server.yaml'" in source
    assert "get_package_share_directory('ugv_cockpit')" in source


def test_launch_remaps_cmd_vel_onto_mux_nav_rung():
    """The test that would have caught an unmapped standalone behavior_server."""
    tree = ast.parse(read(LAUNCH_REL), filename=LAUNCH_REL)
    remapped = False
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = func.id if isinstance(func, ast.Name) else getattr(func, 'attr', None)
        if name != 'Node':
            continue
        kwargs = {kw.arg: kw.value for kw in node.keywords if kw.arg}
        pkg = kwargs.get('package')
        if pkg is None or ast.literal_eval(ast.unparse(pkg)) != 'nav2_behaviors':
            continue
        remappings = kwargs.get('remappings')
        assert remappings is not None, 'behavior_server Node needs remappings'
        text = ast.unparse(remappings)
        targets = re.findall(
            r"\(\s*['\"]/?cmd_vel['\"]\s*,\s*['\"]/?([A-Za-z0-9_/]+)['\"]\s*\)",
            text,
        )
        assert targets, (
            'behavior_server must remap cmd_vel -> cmd_vel_nav so timed_behavior '
            'does not publish /cmd_vel past twist_mux'
        )
        for target in targets:
            assert target.lstrip('/') == 'cmd_vel_nav', target
        remapped = True
    assert remapped, 'no nav2_behaviors Node found in %s' % LAUNCH_REL


def test_launch_header_documents_apt_and_blind_costmap():
    source = read(LAUNCH_REL)
    assert 'ros-humble-nav2-behaviors' in source
    assert 'BLIND PRIMITIVES' in source
    assert 'allow_motion' in source
    assert 'cmd_vel_nav' in source


def test_launch_is_opt_in_not_in_cockpit_or_bringup():
    """Standalone only — Wave 2/3 apply on-robot; do not auto-arm via bringup."""
    cockpit = read('src/ugv_main/ugv_cockpit/launch/cockpit.launch.py')
    bringup = read('src/ugv_main/ugv_bringup/launch/bringup_lidar.launch.py')
    assert 'behavior_server.launch.py' not in cockpit
    assert 'behavior_server.launch.py' not in bringup
