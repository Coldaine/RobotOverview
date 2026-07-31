# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0

"""The ``/cockpit/status`` wire contract, asserted byte for byte.

The shipped cockpit compares ``active_source`` with ``===`` against fixed
display strings (SafetyStrip.tsx:23, CommandRail.tsx:114-160 in
Coldaine/RobotOverview), so a wrong character does not degrade — the panel
falls through to its "NONE" rendering and shows an idle command source on a
moving robot. Same for the DiagnosticStatus entry names and KeyValue keys:
client.ts dispatches on them exactly.

``ugv_cockpit/cockpit_contract.py`` holds those strings and the arbitration
rule, and imports nothing from ROS on purpose, so this file can load it
straight off disk on the bare runner in .github/workflows/spine-tests.yml.
Loading by path rather than ``import ugv_cockpit.cockpit_contract`` is what
keeps that working without a colcon install tree — the same constraint
test_twist_mux_spine.py runs under.

This file also asserts the two ends of the arming link that make the cockpit's
drive gate honest: ugv_bringup publishes what it actually enforces, and
cockpit_status consumes it instead of guessing.
"""

import importlib.util
import os
import re

import pytest
import yaml

PACKAGE_DIR = 'src/ugv_main/ugv_cockpit/ugv_cockpit'
TWIST_MUX_CONFIG = 'src/ugv_main/ugv_cockpit/config/twist_mux.yaml'
STATUS_NODE = 'src/ugv_main/ugv_cockpit/ugv_cockpit/cockpit_status.py'
COCKPIT_LAUNCH = 'src/ugv_main/ugv_cockpit/launch/cockpit.launch.py'
TWIST_MUX_LAUNCH = 'src/ugv_main/ugv_cockpit/launch/twist_mux.launch.py'
BRINGUP_NODE = 'src/ugv_main/ugv_bringup/ugv_bringup/ugv_bringup.py'

# The exact strings the UI switches on. Spelled out here as an INDEPENDENT
# copy: a test that imported them and compared them to themselves would pass
# through any typo.
UI_ACTIVE_SOURCES = {
    'SOURCE_ESTOP': 'E-STOP lock',
    'SOURCE_JOY_ROBOT': 'BT pad · robot',
    'SOURCE_JOY_OPERATOR': 'Operator pad',
    'SOURCE_UI': 'UI teleop',
    'SOURCE_NAV': 'nav2',
    'SOURCE_NONE': 'NONE',
}

# DiagnosticStatus.name -> the KeyValue keys client.ts reads out of it.
UI_DIAGNOSTIC_ENTRIES = {
    'cockpit_safety_watchdog': ('armed', 'fired'),
    'twist_mux': ('active_source', 'command_age', 'publisher_count'),
    'bringup': ('allow_motion',),
    'system_metrics': ('wifi_rssi', 'disk_free', 'cpu_temp', 'gpu_temp'),
}


def workspace_root():
    """Walk up from this file until the directory holding src/ugv_main."""
    path = os.path.abspath(os.path.dirname(__file__))
    while True:
        if os.path.isdir(os.path.join(path, 'src', 'ugv_main')):
            return path
        parent = os.path.dirname(path)
        if parent == path:
            raise RuntimeError('workspace root not found above %s' % __file__)
        path = parent


def read(relative_path):
    with open(os.path.join(workspace_root(), relative_path), encoding='utf-8') as handle:
        return handle.read()


@pytest.fixture(scope='module')
def contract():
    """Load cockpit_contract.py from source, with no package machinery.

    Deliberately not ``import ugv_cockpit.cockpit_contract``: that needs the
    workspace installed (or on sys.path) and drags in the package __init__.
    """
    path = os.path.join(workspace_root(), PACKAGE_DIR, 'cockpit_contract.py')
    spec = importlib.util.spec_from_file_location('_cockpit_contract', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# --------------------------------------------------------------------------
# (1) the strings the UI compares with ===
# --------------------------------------------------------------------------
@pytest.mark.parametrize('name,expected', sorted(UI_ACTIVE_SOURCES.items()))
def test_active_source_display_strings_match_the_ui_exactly(name, expected, contract):
    assert getattr(contract, name) == expected, (
        '%s is compared with === in the shipped cockpit. A mismatch does not '
        'degrade gracefully: the UI renders its NONE state while the robot is '
        'being driven.' % name
    )


def test_bt_pad_source_uses_a_middle_dot_not_a_lookalike(contract):
    """U+00B7, not a period, a bullet (U+2022) or a katakana dot (U+30FB)."""
    value = contract.SOURCE_JOY_ROBOT
    assert '·' in value, 'SOURCE_JOY_ROBOT lost its U+00B7 MIDDLE DOT: %r' % value
    assert value.encode('utf-8') == b'BT pad \xc2\xb7 robot', (
        'SOURCE_JOY_ROBOT must be exactly these UTF-8 bytes, got %r'
        % value.encode('utf-8')
    )


def test_diagnostic_entry_names_and_keys_match_the_client(contract):
    assert set(contract.DIAG_NAMES) == set(UI_DIAGNOSTIC_ENTRIES)
    for name, keys in UI_DIAGNOSTIC_ENTRIES.items():
        assert contract.DIAG_KEYS[name] == keys, (
            'entry %r must carry exactly the keys client.ts reads: %s'
            % (name, list(keys))
        )


def test_booleans_are_lowercase_strings(contract):
    """client.ts tests `values.armed === 'true'`; Python's str(True) fails that."""
    assert contract.boolean(True) == 'true'
    assert contract.boolean(False) == 'false'


def test_mux_source_table_matches_twist_mux_yaml(contract):
    """The display table and the arbitration config must not drift apart.

    A rung added to twist_mux.yaml without a display string here would show up
    in the cockpit as "NONE" while that rung drives the robot.
    """
    params = yaml.safe_load(read(TWIST_MUX_CONFIG))['twist_mux']['ros__parameters']
    declared = {
        name: (entry['topic'], entry['priority'])
        for name, entry in params['topics'].items()
    }
    mirrored = {
        key: (topic, priority)
        for key, topic, priority, _display in contract.MUX_SOURCES
    }
    assert mirrored == declared

    lock = params['locks']['estop']
    assert contract.ESTOP_LOCK_TOPIC == lock['topic']
    assert contract.ESTOP_LOCK_PRIORITY == lock['priority']
    assert contract.SOURCE_TIMEOUT_S == next(iter(params['topics'].values()))['timeout']


def test_mux_policy_cannot_be_replaced_without_a_code_review():
    source = read(TWIST_MUX_LAUNCH)
    assert "LaunchConfiguration('twist_mux_config')" not in source
    assert 'default_config' in source


def test_mux_sources_are_ordered_highest_priority_first(contract):
    """resolve_active_source returns on the first live rung, so order matters."""
    priorities = [priority for _, _, priority, _ in contract.MUX_SOURCES]
    assert priorities == sorted(priorities, reverse=True)


# --------------------------------------------------------------------------
# (2) arbitration, reproduced from outside twist_mux
# --------------------------------------------------------------------------
def test_no_traffic_resolves_to_none(contract):
    display, age = contract.resolve_active_source(
        100.0, {key: None for key, _, _, _ in contract.MUX_SOURCES}, False
    )
    assert display == contract.SOURCE_NONE
    assert age is None
    assert contract.format_command_age(age) == contract.NO_COMMAND_AGE


def test_highest_live_rung_wins(contract):
    display, age = contract.resolve_active_source(
        100.0,
        {'joy_robot': 99.9, 'joy_operator': 99.95, 'ui': 99.99, 'nav': 100.0},
        False,
    )
    assert display == contract.SOURCE_JOY_ROBOT
    assert age == pytest.approx(0.1)


def test_expired_rungs_yield_to_lower_live_ones(contract):
    """0.5 s of silence and the operator pad loses the floor to the UI."""
    display, age = contract.resolve_active_source(
        100.0,
        {'joy_robot': 99.0, 'joy_operator': 99.4, 'ui': 99.8, 'nav': None},
        False,
    )
    assert display == contract.SOURCE_UI
    assert age == pytest.approx(0.2)


def test_expiry_boundary_is_inclusive(contract):
    """A command exactly at the timeout is still live, matching twist_mux."""
    live, _ = contract.resolve_active_source(100.0, {'ui': 99.5}, False)
    assert live == contract.SOURCE_UI
    dead, _ = contract.resolve_active_source(100.0, {'ui': 99.49}, False)
    assert dead == contract.SOURCE_NONE


def test_estop_lock_masks_every_source(contract):
    display, age = contract.resolve_active_source(
        100.0, {key: 100.0 for key, _, _, _ in contract.MUX_SOURCES}, True
    )
    assert display == contract.SOURCE_ESTOP
    assert age is None, (
        'nothing is driving while the lock is engaged, so there is no command '
        'age to report — the UI renders a placeholder for a negative age'
    )


def test_command_age_never_fabricates_a_zero(contract):
    assert contract.format_command_age(None) == contract.NO_COMMAND_AGE
    assert contract.format_command_age(float('nan')) == contract.NO_COMMAND_AGE
    assert contract.format_command_age(float('inf')) == contract.NO_COMMAND_AGE
    assert float(contract.format_command_age(0.25)) == pytest.approx(0.25)


# --------------------------------------------------------------------------
# (3) the node actually uses all of it
# --------------------------------------------------------------------------
def test_status_node_derives_the_active_source_instead_of_hardcoding_it():
    """The 'wire real values here once the spine lands' placeholder is gone.

    The spine merged before this node existed, so a literal ``'NONE'`` in the
    active_source slot is not honest caution any more — it is a safety strip
    reporting that nothing is driving while something is.
    """
    source = read(STATUS_NODE)
    assert 'resolve_active_source' in source, (
        '%s must derive active_source by mirroring twist_mux arbitration' % STATUS_NODE
    )
    assert re.search(r"key=KEY_ACTIVE_SOURCE,\s*value=display", source), (
        '%s must publish the derived display string, not a constant' % STATUS_NODE
    )
    assert not re.search(r"active_source['\"],\s*value=['\"]NONE", source), (
        '%s still hardcodes active_source to NONE' % STATUS_NODE
    )


def test_status_node_subscribes_every_rung_and_the_lock():
    source = read(STATUS_NODE)
    assert 'MUX_SOURCES' in source and 'ESTOP_LOCK_TOPIC' in source, (
        '%s must subscribe the four rung topics and the e-stop lock — that is '
        'the only way to know which source holds the floor' % STATUS_NODE
    )


def test_status_node_and_mux_share_the_ros_clock_mode():
    status_source = read(STATUS_NODE)
    launch_source = read(COCKPIT_LAUNCH)
    assert 'self.get_clock().now().nanoseconds' in status_source
    assert 'time.monotonic()' not in status_source
    assert "parameters=[{'use_sim_time': False}]" in launch_source
    assert "DeclareLaunchArgument(\n        'use_sim_time'" not in launch_source


def test_bringup_publishes_the_safety_state_the_cockpit_gates_on():
    """The arming link: the robot reports what it enforces, not what the UI sent."""
    source = read(BRINGUP_NODE)
    assert "create_publisher(\n            Bool, 'ugv/allow_motion'" in source or \
        "Bool, 'ugv/allow_motion'" in source, (
            '%s must publish /ugv/allow_motion (std_msgs/Bool) so the cockpit '
            'can gate its drive controls on the robot-reported value'
            % BRINGUP_NODE
        )
    assert "'ugv/watchdog_state'" in source, (
        '%s must publish /ugv/watchdog_state (DiagnosticStatus with armed/fired)'
        % BRINGUP_NODE
    )
    assert '_publish_safety_state' in source
    assert 'self._cmd_vel_watchdog_fired = True' in source, (
        "%s must latch 'fired' where the watchdog actually stops the robot — "
        'nothing outside this process can observe that transition, because the '
        'stop it sends is byte-identical to an operator stop' % BRINGUP_NODE
    )


def test_status_node_consumes_the_bringup_safety_topics():
    source = read(STATUS_NODE)
    assert 'ALLOW_MOTION_TOPIC' in source and 'WATCHDOG_STATE_TOPIC' in source


def test_status_node_lets_stale_safety_state_decay_to_the_safe_default():
    """A dead bringup must not leave 'motion armed' latched on the safety strip."""
    source = read(STATUS_NODE)
    assert 'BRINGUP_STALE_S' in source, (
        '%s must age out /ugv/allow_motion and /ugv/watchdog_state rather than '
        'holding the last value forever' % STATUS_NODE
    )
    assert re.search(r'_is_fresh', source), (
        '%s: the staleness check must gate the published values' % STATUS_NODE
    )
