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

import ast
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


def test_every_rung_expires_on_the_same_timeout_the_mirror_uses(contract):
    """SOURCE_TIMEOUT_S is applied to ALL rungs, so it must match ALL of them.

    resolve_active_source takes a single ``timeout_s`` and applies it to every
    entry in MUX_SOURCES. Checking only the first rung would let a rung with a
    different timeout in twist_mux.yaml pass review: the mirror would then age
    that rung out on the wrong schedule and report the wrong source — early or
    late — for the difference between the two values.
    """
    params = yaml.safe_load(read(TWIST_MUX_CONFIG))['twist_mux']['ros__parameters']
    mismatched = {
        name: entry['timeout']
        for name, entry in params['topics'].items()
        if entry['timeout'] != contract.SOURCE_TIMEOUT_S
    }
    assert not mismatched, (
        'these twist_mux rungs expire on a different timeout than the mirror '
        'applies (SOURCE_TIMEOUT_S=%s): %s. resolve_active_source uses one '
        'timeout for every rung, so the cockpit would report the wrong active '
        'source for the difference.' % (contract.SOURCE_TIMEOUT_S, mismatched)
    )
    assert params['topics'], 'twist_mux.yaml declares no rungs at all'


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


def test_the_arbitration_mirror_reads_the_same_clock_as_twist_mux():
    """Scoped to the MIRROR. The liveness stamps deliberately differ.

    twist_mux expires rungs against rclcpp's ``Node::now()``, so the mirror
    must read the ROS clock or it disagrees with the arbiter it reproduces.
    That argument applies only to the rung stamps and the resolve call: the
    bringup liveness stamps have no twist_mux counterpart to agree with, and
    they use ``time.monotonic()`` on purpose, because the ROS clock is the
    system clock and chrony steps it on this RTC-less Jetson. An earlier
    version of this test banned ``time.monotonic()`` from the whole file, which
    would have blocked that fix.
    """
    status_source = read(STATUS_NODE)
    launch_source = read(COCKPIT_LAUNCH)
    tree = ast.parse(status_source, filename=STATUS_NODE)

    def method(name):
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == name:
                return node
        raise AssertionError('%s defines no %s()' % (STATUS_NODE, name))

    def calls_in(node):
        found = set()
        for child in ast.walk(node):
            if isinstance(child, ast.Call) and isinstance(child.func, ast.Attribute):
                found.add(child.func.attr)
        return found

    assert 'get_clock' in calls_in(method('_now_s')), (
        '%s: _now_s() must read the ROS clock — it is what the arbitration '
        'mirror compares against twist_mux expiry' % STATUS_NODE
    )
    assert 'monotonic' in calls_in(method('_liveness_now_s')), (
        '%s: _liveness_now_s() must be monotonic. It answers an elapsed-time '
        'question with no twist_mux counterpart, and a chrony step on the '
        'RTC-less Jetson would otherwise blank the safety strip.' % STATUS_NODE
    )

    # The rung stamps and the resolve call are on the ROS clock.
    assert re.search(r'_last_command_at\[key\] = self\._now_s\(\)', status_source), (
        '%s: rung arrival stamps must use the ROS clock' % STATUS_NODE
    )
    mux = method('_mux_status')
    assert 'resolve_active_source' in {
        child.func.id for child in ast.walk(mux)
        if isinstance(child, ast.Call) and isinstance(child.func, ast.Name)
    }
    assert '_now_s' in calls_in(mux) and '_liveness_now_s' not in calls_in(mux), (
        '%s: _mux_status must resolve on the ROS clock only' % STATUS_NODE
    )

    # ...and the bringup liveness checks are not.
    for name in ('_bringup_status', '_watchdog_status', '_is_fresh'):
        assert '_now_s' not in calls_in(method(name)), (
            '%s: %s() must use _liveness_now_s(), not the steppable ROS clock'
            % (STATUS_NODE, name)
        )

    assert "parameters=[{'use_sim_time': False}]" in launch_source
    assert "DeclareLaunchArgument(\n        'use_sim_time'" not in launch_source


def test_bringup_publishes_the_safety_state_the_cockpit_gates_on():
    """The arming link: the robot reports what it enforces, not what the UI sent."""
    source = read(BRINGUP_NODE)
    assert "create_publisher(\n            Bool, '/ugv/allow_motion'" in source or \
        "Bool, '/ugv/allow_motion'" in source, (
            '%s must publish /ugv/allow_motion (std_msgs/Bool) so the cockpit '
            'can gate its drive controls on the robot-reported value'
            % BRINGUP_NODE
        )
    assert "'/ugv/watchdog_state'" in source, (
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
    assert 'DurabilityPolicy.TRANSIENT_LOCAL' in source, (
        '%s must receive the latest latched safety state when it joins late'
        % STATUS_NODE
    )


def test_status_node_lets_stale_safety_state_decay_out_of_the_message():
    """A dead bringup must not leave 'motion armed' latched on the safety strip."""
    source = read(STATUS_NODE)
    assert 'BRINGUP_STALE_S' in source, (
        '%s must age out /ugv/allow_motion and /ugv/watchdog_state rather than '
        'holding the last value forever' % STATUS_NODE
    )
    assert re.search(r'_is_fresh', source), (
        '%s: the staleness check must gate the published values' % STATUS_NODE
    )
    assert 'bringup_key_values' in source and 'watchdog_key_values' in source, (
        '%s must build allow_motion / armed / fired through the contract '
        'builders, which OMIT the keys when there is nothing to report. '
        'Constructing KeyValue directly reintroduces a confident "false" for '
        'state the node has never received.' % STATUS_NODE
    )


# --------------------------------------------------------------------------
# (4) both ends of the safety wire, read out of ugv_bringup's own syntax
#
# test_jetson_safety.py exercises the watchdog's BEHAVIOUR against a harness.
# These check the structural invariants that a behavioural test cannot see:
# that the topic strings on the two ends of the wire agree, that the stop is
# ordered ahead of everything that can raise, that the callback cannot take the
# process down, and that a timer actually fires the tick.
# --------------------------------------------------------------------------
WATCHDOG_TICK = '_cmd_vel_watchdog_tick'
WATCHDOG_TIMER_PERIOD_S = 0.1


@pytest.fixture(scope='module')
def bringup_tree():
    return ast.parse(read(BRINGUP_NODE), filename=BRINGUP_NODE)


def self_calls_in_source_order(function_node):
    """Every ``self.NAME(...)`` under a function, ordered by source position.

    ``ast.walk`` is breadth-first, so it cannot answer "which call happens
    first". Sorting on (lineno, col_offset) can, and it survives the whole body
    being re-indented into a ``try:`` — which is exactly the change these
    assertions have to keep working across.

    ``self.get_logger().warning(...)`` contributes ``get_logger`` only: the
    outer call's receiver is a Call, not ``self``.
    """
    found = []
    for node in ast.walk(function_node):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not isinstance(func, ast.Attribute):
            continue
        if not (isinstance(func.value, ast.Name) and func.value.id == 'self'):
            continue
        found.append((node.lineno, node.col_offset, func.attr))
    return [(lineno, attr) for lineno, _col, attr in sorted(found)]


def function_def(tree, name):
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return node
    raise AssertionError('%s defines no %s()' % (BRINGUP_NODE, name))


def statements(function_node):
    """A function's statements with a leading docstring dropped."""
    body = list(function_node.body)
    if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
        body = body[1:]
    return body


def executable_body(function_node):
    """The statements that really run, seeing through a whole-body ``try:``."""
    body = statements(function_node)
    if len(body) == 1 and isinstance(body[0], ast.Try):
        return list(body[0].body)
    return body


# (a) ------------------------------------------------------------------
def test_bringup_publishes_on_exactly_the_topics_the_contract_names(
    bringup_tree, contract
):
    """Both ends of the wire, compared to each other rather than to a literal.

    cockpit_status subscribes ALLOW_MOTION_TOPIC / WATCHDOG_STATE_TOPIC.
    ugv_bringup names its topics in its own ``create_publisher`` calls. Nothing
    in the build connects those two facts: rename one side and the cockpit
    subscribes a topic that has no publisher, which looks exactly like a
    ugv_bringup that has died — the safety strip decays to "motion locked /
    watchdog unknown" and reports a healthy robot as a dead one, forever, with
    no error anywhere.
    """
    published = {}
    for node in ast.walk(bringup_tree):
        if not isinstance(node, ast.Assign):
            continue
        call = node.value
        if not isinstance(call, ast.Call):
            continue
        func = call.func
        if not (isinstance(func, ast.Attribute) and func.attr == 'create_publisher'):
            continue
        if len(call.args) < 2 or not isinstance(call.args[1], ast.Constant):
            continue
        for target in node.targets:
            if isinstance(target, ast.Attribute):
                published[target.attr] = call.args[1].value

    for attribute, expected in (
        ('allow_motion_publisher_', contract.ALLOW_MOTION_TOPIC),
        ('watchdog_state_publisher_', contract.WATCHDOG_STATE_TOPIC),
    ):
        assert attribute in published, (
            '%s no longer assigns self.%s from a create_publisher call with a '
            'literal topic name, so nothing checks that the cockpit is '
            'subscribing the topic it actually publishes' % (BRINGUP_NODE, attribute)
        )
        # Relative names resolve into the root namespace this node runs in.
        resolved = '/' + published[attribute].lstrip('/')
        assert resolved == expected, (
            'ugv_bringup publishes %r but cockpit_contract tells cockpit_status '
            'to subscribe %r. The cockpit would then see a topic with no '
            'publisher, which it reports as a DEAD ugv_bringup.'
            % (resolved, expected)
        )


# (b) ------------------------------------------------------------------
def test_watchdog_stop_precedes_every_other_statement_in_the_tick(bringup_tree):
    """The stop goes out first. Everything after it is only reporting.

    This is the robot's ONLY automatic stop — the ESP32 latches the last
    velocity it was given and has no timeout of its own. So the ordering inside
    the tick is a safety property, not a style preference:

      * the cheap guards run first, or the robot is stopped on every tick;
      * ``send_stop_command()`` is the first thing after them, so no line that
        can raise (logging, DDS publishing) sits between deciding to stop and
        actually stopping;
      * ``_publish_safety_state()`` — which touches the DDS stack and is the
        most failure-prone step here — comes last.
    """
    tick = function_def(bringup_tree, WATCHDOG_TICK)
    calls = self_calls_in_source_order(tick)
    names = [attr for _lineno, attr in calls]

    assert 'send_stop_command' in names, (
        '%s() no longer calls send_stop_command(). Nothing else on this robot '
        'stops it when cmd_vel goes silent.' % WATCHDOG_TICK
    )
    assert names[0] == 'send_stop_command', (
        '%s(): send_stop_command() must be the FIRST call in the tick, not %r. '
        'Anything ahead of it is a statement that can raise between deciding to '
        'stop and stopping.' % (WATCHDOG_TICK, names[0])
    )

    assert '_publish_safety_state' in names, (
        '%s() must report the stop it just issued — the fired latch is not '
        'observable from outside this process' % WATCHDOG_TICK
    )
    assert names.index('send_stop_command') < names.index('_publish_safety_state'), (
        '%s(): the robot must be stopped before the cockpit is told about it. '
        'Publishing first puts a DDS call on the path to the stop.' % WATCHDOG_TICK
    )

    # The guards must still come first, or the tick stops the robot every 0.1 s.
    bare_return_guards = [
        node for node in executable_body(tick) if isinstance(node, ast.If)
        if len(node.body) == 1
        and isinstance(node.body[0], ast.Return)
        and node.body[0].value is None
    ]
    assert len(bare_return_guards) >= 3, (
        '%s() should keep its early-out guards (motion allowed, watchdog armed, '
        'a command seen, timeout not yet elapsed); found %d'
        % (WATCHDOG_TICK, len(bare_return_guards))
    )
    stop_line = next(line for line, attr in calls if attr == 'send_stop_command')
    assert max(node.lineno for node in bare_return_guards) < stop_line, (
        '%s(): send_stop_command() sits above the guards, so the tick would '
        'stop the robot on every fire of a 0.1 s timer' % WATCHDOG_TICK
    )


def test_watchdog_tick_cannot_take_the_process_down(bringup_tree):
    """An exception escaping this callback kills the watchdog with the process.

    ``main()`` is a bare ``rclpy.spin`` on a single-threaded executor with no
    exception handling, so there is nothing above this frame to catch anything.
    """
    tick = function_def(bringup_tree, WATCHDOG_TICK)
    body = statements(tick)
    assert len(body) == 1 and isinstance(body[0], ast.Try), (
        '%s() must wrap its whole body in try/except: rclpy.spin is '
        'single-threaded with no handler above it, so anything that escapes '
        'here takes down the only automatic stop the robot has' % WATCHDOG_TICK
    )
    assert any(
        handler.type is None
        or (isinstance(handler.type, ast.Name) and handler.type.id == 'Exception')
        for handler in body[0].handlers
    ), (
        '%s(): the handler must catch Exception, not a narrow subclass'
        % WATCHDOG_TICK
    )


# (c) ------------------------------------------------------------------
def test_the_watchdog_timer_is_actually_created(bringup_tree):
    """Correct tick logic that nothing calls is not a watchdog.

    A 0.1 s period against the 0.5 s ``cmd_vel_timeout`` bounds the overshoot
    past the timeout to one tick. Slowing the timer silently widens the window
    in which a robot that has lost its operator keeps driving.
    """
    periods = []
    for node in ast.walk(bringup_tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not (isinstance(func, ast.Attribute) and func.attr == 'create_timer'):
            continue
        if len(node.args) < 2:
            continue
        callback = node.args[1]
        if not isinstance(callback, ast.Attribute) or callback.attr != WATCHDOG_TICK:
            continue
        if not (isinstance(callback.value, ast.Name) and callback.value.id == 'self'):
            continue
        if isinstance(node.args[0], ast.Constant):
            periods.append(node.args[0].value)

    assert periods, (
        '%s never calls create_timer(..., self.%s). The tick can be perfect and '
        'the robot still never stops, because nothing fires it.'
        % (BRINGUP_NODE, WATCHDOG_TICK)
    )
    assert periods == [WATCHDOG_TIMER_PERIOD_S], (
        'the cmd_vel watchdog must be driven by exactly one %ss timer, found '
        '%s. The period bounds how far past cmd_vel_timeout the robot keeps '
        'the last velocity.' % (WATCHDOG_TIMER_PERIOD_S, periods)
    )


def test_safety_publishers_come_after_the_startup_stop(bringup_tree):
    """Telemetry must never be created ahead of the robot's own safing.

    ``create_publisher`` can raise — a bad QoS combination, an RMW error, an
    invalid name. If it raises before the startup ``send_stop_command()``, the
    node dies with the ESP32 still latching whatever velocity it held at
    power-on and nothing alive to clear it.
    """
    init = function_def(bringup_tree, '__init__')
    calls = self_calls_in_source_order(init)
    names = [attr for _lineno, attr in calls]

    assert 'send_stop_command' in names and 'create_publisher' in names
    first_stop = names.index('send_stop_command')
    safety_publisher_lines = [
        line for line, attr in calls if attr == 'create_publisher'
    ]
    stop_line = calls[first_stop][0]
    late = [line for line in safety_publisher_lines if line > stop_line]
    assert len(late) >= 2, (
        '__init__ must create the two cockpit safety publishers AFTER the '
        'startup stop. create_publisher can raise, and a raise ahead of the '
        'stop leaves the ESP32 latching its power-on velocity with no node '
        'alive to stop it.'
    )


# (d) ------------------------------------------------------------------
class FakeClock:
    """A clock the test moves by hand, so no assertion depends on wall time."""

    def __init__(self, start=1000.0):
        self.t = start

    def now(self):
        return self.t

    def advance(self, seconds):
        self.t += seconds
        return self.t


def test_freshest_highest_rung_wins_and_expires_on_a_driven_clock(contract):
    """Priority first, then expiry — stepped through on an injected clock."""
    clock = FakeClock()
    stamps = {key: None for key, _, _, _ in contract.MUX_SOURCES}

    # Nothing has ever published.
    assert contract.resolve_active_source(
        clock.now(), stamps, False
    )[0] == contract.SOURCE_NONE

    # The UI takes the floor, then the robot-side pad outranks it at the same
    # instant despite the UI being just as fresh.
    stamps['ui'] = clock.now()
    assert contract.resolve_active_source(
        clock.now(), stamps, False
    )[0] == contract.SOURCE_UI

    stamps['joy_robot'] = clock.now()
    display, age = contract.resolve_active_source(clock.now(), stamps, False)
    assert display == contract.SOURCE_JOY_ROBOT
    assert age == pytest.approx(0.0)

    # The pad goes quiet. It holds the floor right up to the timeout...
    clock.advance(contract.SOURCE_TIMEOUT_S)
    display, age = contract.resolve_active_source(clock.now(), stamps, False)
    assert display == contract.SOURCE_JOY_ROBOT
    assert age == pytest.approx(contract.SOURCE_TIMEOUT_S)

    # ...and the instant it expires the UI — equally stale — expires with it,
    # because both stopped at the same time. Nothing is driving.
    clock.advance(0.001)
    assert contract.resolve_active_source(
        clock.now(), stamps, False
    )[0] == contract.SOURCE_NONE

    # A single fresh UI message now wins outright: the pad is still expired.
    stamps['ui'] = clock.now()
    display, age = contract.resolve_active_source(clock.now(), stamps, False)
    assert display == contract.SOURCE_UI
    assert age == pytest.approx(0.0)


def test_engaged_lock_masks_every_rung_however_fresh(contract):
    """Priority 255 beats a command that arrived this instant."""
    clock = FakeClock()
    stamps = {key: clock.now() for key, _, _, _ in contract.MUX_SOURCES}

    display, age = contract.resolve_active_source(clock.now(), stamps, True)
    assert display == contract.SOURCE_ESTOP
    assert age is None, (
        'nothing is on the floor while the lock is engaged, so there is no '
        'command age — a number here would render as a live command'
    )

    # Releasing hands the floor straight back to the highest fresh rung, with
    # no clock movement: the lock masks, it does not expire anything.
    display, age = contract.resolve_active_source(clock.now(), stamps, False)
    assert display == contract.SOURCE_JOY_ROBOT
    assert age == pytest.approx(0.0)


def test_safety_state_decays_to_the_safe_default_after_bringup_stale_s(contract):
    """A dead ugv_bringup must read as locked, not as whatever it last said.

    This is the exact expression cockpit_status evaluates
    (``fresh and self._allow_motion``), driven by a clock the test controls,
    rather than a grep for the constant's name.
    """
    clock = FakeClock()

    # Never heard from bringup at all: not fresh, so locked.
    assert contract.is_fresh(clock.now(), None) is False

    # bringup reports motion ARMED.
    stamp = clock.now()
    reported_allow_motion = True
    assert contract.is_fresh(clock.now(), stamp) is True
    assert (contract.is_fresh(clock.now(), stamp) and reported_allow_motion) is True

    # It keeps reading armed while the message is inside the window, boundary
    # included — one missed 2 Hz tick must not blank the strip.
    clock.advance(contract.BRINGUP_STALE_S)
    assert contract.is_fresh(clock.now(), stamp) is True
    assert (contract.is_fresh(clock.now(), stamp) and reported_allow_motion) is True

    # bringup dies. Past the window the LAST GOOD VALUE IS DISCARDED, not held:
    # a strip showing "motion armed" from a process that died two minutes ago is
    # worse than one showing "unknown".
    clock.advance(0.001)
    assert contract.is_fresh(clock.now(), stamp) is False
    assert (contract.is_fresh(clock.now(), stamp) and reported_allow_motion) is False

    # Same rule, same window, for the watchdog's armed/fired pair.
    for reported in (True, False):
        assert (contract.is_fresh(clock.now(), stamp) and reported) is False


def test_safety_keys_are_absent_until_bringup_has_actually_spoken(contract):
    """Unknown must cross the wire as a MISSING key, never as ``'false'``.

    The client renders an absent key as "unknown" and a present one as a
    reading it can trust. Emitting ``allow_motion: 'false'`` before
    ``/ugv/allow_motion`` has ever produced a message is the cockpit asserting
    a fact it does not have — and asserting the conservative-looking one, which
    is precisely what makes it dangerous: on a robot where these publishers are
    not deployed, the strip shows a confident LOCKED / OFF-LINE forever and
    never says "I cannot see the robot".
    """
    clock = FakeClock()

    assert contract.bringup_key_values(clock.now(), None, False) == ()
    assert contract.bringup_key_values(clock.now(), None, True) == ()
    assert contract.watchdog_key_values(clock.now(), None, False, False) == ()
    assert contract.watchdog_key_values(clock.now(), None, True, True) == ()


def test_safety_keys_appear_on_receipt_and_disappear_again_when_stale(contract):
    """Present -> absent, driven by an injected clock rather than wall time."""
    clock = FakeClock()
    stamp = clock.now()

    assert contract.bringup_key_values(clock.now(), stamp, True) == (
        ('allow_motion', 'true'),
    )
    assert contract.bringup_key_values(clock.now(), stamp, False) == (
        ('allow_motion', 'false'),
    )
    assert contract.watchdog_key_values(clock.now(), stamp, True, False) == (
        ('armed', 'true'), ('fired', 'false'),
    )

    # Inside the window, boundary included: one missed 2 Hz tick must not blank
    # a strip that is being read while the robot drives.
    clock.advance(contract.BRINGUP_STALE_S)
    assert contract.bringup_key_values(clock.now(), stamp, True) == (
        ('allow_motion', 'true'),
    )
    assert len(contract.watchdog_key_values(clock.now(), stamp, True, True)) == 2

    # Past it, the keys GO AWAY. Not 'false' — away. A reading the node can no
    # longer justify must stop being on the wire at all.
    clock.advance(0.001)
    assert contract.bringup_key_values(clock.now(), stamp, True) == ()
    assert contract.watchdog_key_values(clock.now(), stamp, True, True) == ()

    # A fresh message brings them straight back.
    stamp = clock.now()
    assert contract.bringup_key_values(clock.now(), stamp, True) == (
        ('allow_motion', 'true'),
    )
    assert len(contract.watchdog_key_values(clock.now(), stamp, False, True)) == 2


def test_safety_key_names_are_the_ones_the_client_reads(contract):
    """The builders must emit the declared keys, not near-misses."""
    clock = FakeClock()
    stamp = clock.now()

    emitted = [key for key, _ in contract.bringup_key_values(clock.now(), stamp, True)]
    assert emitted == list(contract.DIAG_KEYS[contract.DIAG_BRINGUP])

    emitted = [
        key for key, _ in contract.watchdog_key_values(clock.now(), stamp, True, True)
    ]
    assert emitted == list(contract.DIAG_KEYS[contract.DIAG_WATCHDOG])


def test_status_node_keeps_the_entry_even_when_the_keys_are_gone():
    """Absent keys, present entry: the WARN and its message are the signal.

    Dropping the whole DiagnosticStatus would make a dead ugv_bringup
    indistinguishable from a cockpit_status that simply is not reporting on it.
    """
    source = read(STATUS_NODE)
    assert re.search(r'DiagnosticStatus\(name=DIAG_BRINGUP', source), (
        '%s must always emit the bringup entry, whether or not it has data for '
        'its keys' % STATUS_NODE
    )
    assert re.search(r'DiagnosticStatus\(\s*name=DIAG_WATCHDOG', source), (
        '%s must always emit the watchdog entry' % STATUS_NODE
    )
    assert re.search(r'UNKNOWN, key[s]? omitted', source), (
        "%s: the not-fresh branches must say the keys were omitted, so the gap "
        'is legible in `ros2 topic echo` and not only in the UI' % STATUS_NODE
    )


# --------------------------------------------------------------------------
# (5) the websocket origin policy, executed rather than described
#
# cockpit_rosbridge.py imports rosbridge and cannot load here, which is exactly
# why the DECISION lives in cockpit_contract. test_cockpit_bridge.py proves the
# patch is installed; these prove the rule it installs is the right one.
# --------------------------------------------------------------------------
COCKPIT_ORIGIN = 'https://hangar.example.ts.net'


def test_absent_origin_is_admitted_because_browsers_cannot_omit_it(contract):
    """A missing Origin means a NON-browser client, and that is deliberate.

    Browsers always send Origin on a WebSocket handshake; page JavaScript can
    neither forge nor suppress it. So the drive-by web page — the attacker this
    control exists for — always arrives WITH one. Refusing headerless clients
    would break roslibpy and CLI tooling without closing that hole.

    This is a documented residual, not an oversight: a native client on a
    tailnet-joined machine is still admitted, at the same trust level the old
    reachability-only model extended to everyone.
    """
    allowlist = contract.parse_allowed_origins(COCKPIT_ORIGIN)
    assert contract.origin_is_allowed(None, allowlist) is True
    assert contract.origin_is_allowed('', allowlist) is True
    assert contract.origin_is_allowed('   ', allowlist) is True
    # ...and still admitted when nothing is configured at all.
    assert contract.origin_is_allowed(None, ()) is True


def test_an_unset_allowlist_accepts_every_browser(contract):
    """The tailnet is the perimeter: unset allowlist means ALLOW-ALL.

    tailscale serve is the only path into the loopback bridge, and anyone who
    can reach the tailnet already has the operator's trust level. An empty
    allowlist therefore restores upstream behavior (accept any origin);
    COCKPIT_ALLOWED_ORIGINS is an optional restrict-to-list, not required
    configuration.
    """
    for origin in (
        COCKPIT_ORIGIN,
        'https://evil.example.com',
        'http://localhost:3000',
    ):
        assert contract.origin_is_allowed(origin, ()) is True, (
            'an unset allowlist must admit %r — the tailnet is the perimeter'
            % origin
        )


def test_only_listed_origins_are_admitted(contract):
    allowlist = contract.parse_allowed_origins(
        '%s, https://cockpit.example.ts.net' % COCKPIT_ORIGIN
    )
    assert contract.origin_is_allowed(COCKPIT_ORIGIN, allowlist) is True
    assert contract.origin_is_allowed(
        'https://cockpit.example.ts.net', allowlist
    ) is True

    for origin in (
        'https://evil.example.com',
        # Prefix/suffix lookalikes must not match — this is exact comparison,
        # not `startswith`, for the same reason the topic globs are anchored.
        'https://hangar.example.ts.net.evil.com',
        'https://evil.com/?x=https://hangar.example.ts.net',
        'https://sub.hangar.example.ts.net',
        # Scheme is part of the origin: plain http is a different origin and a
        # downgrade path, so it does not inherit the https entry's trust.
        'http://hangar.example.ts.net',
    ):
        assert contract.origin_is_allowed(origin, allowlist) is False, (
            '%r must not be admitted by an allowlist naming %s'
            % (origin, COCKPIT_ORIGIN)
        )


def test_origin_comparison_is_case_and_trailing_slash_insensitive(contract):
    """Browsers vary on case; an operator will paste a trailing slash."""
    allowlist = contract.parse_allowed_origins('  HTTPS://Hangar.Example.TS.net/ ')
    assert allowlist == ('https://hangar.example.ts.net',)
    assert contract.origin_is_allowed(COCKPIT_ORIGIN, allowlist) is True
    assert contract.origin_is_allowed(COCKPIT_ORIGIN + '/', allowlist) is True
    assert contract.origin_is_allowed(
        'HTTPS://HANGAR.EXAMPLE.TS.NET', allowlist
    ) is True


def test_allowlist_parsing_drops_empty_entries(contract):
    """A trailing comma must not become an entry that matches the empty string."""
    assert contract.parse_allowed_origins('') == ()
    assert contract.parse_allowed_origins('   ') == ()
    assert contract.parse_allowed_origins(',,') == ()
    assert contract.parse_allowed_origins('%s,' % COCKPIT_ORIGIN) == (
        COCKPIT_ORIGIN,
    )
