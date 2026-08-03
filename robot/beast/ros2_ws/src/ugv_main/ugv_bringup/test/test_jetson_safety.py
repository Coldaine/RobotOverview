# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0

import json
import time
from types import MethodType, SimpleNamespace

from ugv_bringup.ugv_bringup import (
    default_serial_port,
    select_interface_ip,
    ugv_bringup,
)


class RecordingController:
    def __init__(self):
        self.commands = []

    def send_command(self, command):
        self.commands.append(json.loads(command.decode()))


class RecordingLogger:
    """Stand-in for rclpy's logger.

    ``**kwargs`` is not decoration: the production handlers pass
    ``throttle_duration_sec``, and ``error`` is only ever reached when
    something has already gone wrong. A logger missing either would turn the
    failure path under test into an AttributeError raised from inside the
    except block — i.e. the harness would manufacture the very crash the code
    exists to prevent, and the test would "prove" the wrong thing.
    """

    def __init__(self):
        self.warnings = []
        self.errors = []

    def warning(self, message, **kwargs):
        self.warnings.append(message)

    def error(self, message, **kwargs):
        self.errors.append(message)


def velocity(linear, angular):
    return SimpleNamespace(
        linear=SimpleNamespace(x=linear),
        angular=SimpleNamespace(z=angular),
    )


def motion_harness(allow_motion, cmd_vel_timeout=0.5):
    logger = RecordingLogger()
    harness = SimpleNamespace(
        allow_motion=allow_motion,
        cmd_vel_timeout=cmd_vel_timeout,
        _motion_reject_warned=False,
        _last_cmd_vel_time=None,
        _cmd_vel_watchdog_armed=False,
        _cmd_vel_watchdog_fired=False,
        _applying_allow_motion=False,
        base_controller=RecordingController(),
        zero_vel_count=0,
        zero_vel_limit=5,
        safety_publish_count=0,
        get_logger=lambda: logger,
    )
    harness.send_stop_command = MethodType(ugv_bringup.send_stop_command, harness)
    harness._publish_safety_state = MethodType(
        lambda self: setattr(
            self, 'safety_publish_count', self.safety_publish_count + 1
        ),
        harness,
    )
    harness._cmd_vel_watchdog_tick = MethodType(
        ugv_bringup._cmd_vel_watchdog_tick, harness
    )
    harness.apply_allow_motion = MethodType(
        ugv_bringup.apply_allow_motion, harness
    )
    return harness


def test_select_interface_ip_handles_predictable_jetson_names():
    ip_map = {
        'l4tbr0': '192.168.55.1',
        'wlP1p1s0': '192.168.20.251',
        'enP8p1s0': '192.168.20.252',
    }

    assert select_interface_ip(ip_map, '', 'wifi') == '192.168.20.251'
    assert select_interface_ip(ip_map, '', 'ethernet') == '192.168.20.252'
    assert select_interface_ip(ip_map, 'wlP1p1s0', 'wifi') == '192.168.20.251'


def test_default_serial_port_uses_jetson_uart(monkeypatch):
    monkeypatch.delenv('UGV_SERIAL_PORT', raising=False)
    monkeypatch.setattr('ugv_bringup.ugv_bringup.os.path.exists', lambda _: True)

    assert default_serial_port() == '/dev/ttyTHS1'


def test_motion_gate_replaces_nonzero_command_with_stop():
    harness = motion_harness(allow_motion=False)
    logger = RecordingLogger()
    harness.get_logger = lambda: logger

    ugv_bringup.cmd_vel_callback(harness, velocity(0.25, -0.5))

    assert harness.base_controller.commands == [{'T': '13', 'X': 0.0, 'Z': 0.0}]
    assert logger.warnings == ['Rejected non-zero cmd_vel while allow_motion is false']


def test_motion_gate_allows_command_after_explicit_enable():
    harness = motion_harness(allow_motion=True)

    ugv_bringup.cmd_vel_callback(harness, velocity(0.05, 0.25))

    assert harness.base_controller.commands == [{'T': '13', 'X': 0.05, 'Z': 0.25}]
    assert harness._cmd_vel_watchdog_armed is True


def test_cmd_vel_watchdog_sends_one_stop_after_timeout(monkeypatch):
    harness = motion_harness(allow_motion=True, cmd_vel_timeout=0.5)
    clock = {'now': 1000.0}
    monkeypatch.setattr(time, 'monotonic', lambda: clock['now'])

    ugv_bringup.cmd_vel_callback(harness, velocity(0.02, 0.0))
    assert harness._cmd_vel_watchdog_armed is True
    assert harness.base_controller.commands == [{'T': '13', 'X': 0.02, 'Z': 0.0}]

    clock['now'] = 1000.4
    harness._cmd_vel_watchdog_tick()
    assert harness.base_controller.commands == [{'T': '13', 'X': 0.02, 'Z': 0.0}]
    assert harness._cmd_vel_watchdog_armed is True

    clock['now'] = 1000.6
    harness._cmd_vel_watchdog_tick()
    assert harness.base_controller.commands == [
        {'T': '13', 'X': 0.02, 'Z': 0.0},
        {'T': '13', 'X': 0.0, 'Z': 0.0},
    ]
    assert harness._cmd_vel_watchdog_armed is False
    assert harness._cmd_vel_watchdog_fired is True
    assert harness.safety_publish_count == 1

    clock['now'] = 1001.5
    harness._cmd_vel_watchdog_tick()
    assert len(harness.base_controller.commands) == 2
    assert harness.safety_publish_count == 1


def test_cmd_vel_watchdog_resets_timer_on_fresh_command(monkeypatch):
    harness = motion_harness(allow_motion=True, cmd_vel_timeout=0.5)
    clock = {'now': 1000.0}
    monkeypatch.setattr(time, 'monotonic', lambda: clock['now'])

    ugv_bringup.cmd_vel_callback(harness, velocity(0.02, 0.0))
    clock['now'] = 1000.4
    ugv_bringup.cmd_vel_callback(harness, velocity(0.02, 0.0))
    clock['now'] = 1000.7
    harness._cmd_vel_watchdog_tick()

    assert harness._cmd_vel_watchdog_armed is True
    assert harness.base_controller.commands == [
        {'T': '13', 'X': 0.02, 'Z': 0.0},
        {'T': '13', 'X': 0.02, 'Z': 0.0},
    ]


def test_disable_allow_motion_stops_immediately():
    harness = motion_harness(allow_motion=True)
    harness._cmd_vel_watchdog_armed = True

    previous, desired = harness.apply_allow_motion(False, source='test')

    assert previous is True
    assert desired is False
    assert harness.allow_motion is False
    assert harness._cmd_vel_watchdog_armed is False
    assert harness.base_controller.commands == [
        {'T': '13', 'X': 0.0, 'Z': 0.0}
    ]
    assert any('disabled via test' in message
               for message in harness.get_logger().warnings)


def test_enable_allow_motion_does_not_send_stop():
    harness = motion_harness(allow_motion=False)

    previous, desired = harness.apply_allow_motion(True, source='test')

    assert previous is False
    assert desired is True
    assert harness.allow_motion is True
    assert harness.base_controller.commands == []
    assert any('enabled via test' in message
               for message in harness.get_logger().warnings)


def test_idempotent_allow_motion_flip_sends_no_extra_stop():
    harness = motion_harness(allow_motion=False)

    harness.apply_allow_motion(False, source='test')

    assert harness.base_controller.commands == []


def test_watchdog_stop_survives_a_failing_safety_publish(monkeypatch):
    """The stop must not depend on the reporting that follows it.

    ``_publish_safety_state`` touches the DDS stack, which is the most
    failure-prone step in the tick. If it raises, three things must hold: the
    ESP32 already got its stop, the latch is already set, and NOTHING
    propagates — ``main()`` is a bare ``rclpy.spin`` on a single-threaded
    executor, so an escaping exception would kill the process and with it the
    only automatic stop this robot has.
    """
    harness = motion_harness(allow_motion=True, cmd_vel_timeout=0.5)
    logger = RecordingLogger()
    harness.get_logger = lambda: logger

    def exploding_publish(_self):
        raise RuntimeError('rmw publish failed')

    harness._publish_safety_state = MethodType(exploding_publish, harness)

    clock = {'now': 1000.0}
    monkeypatch.setattr(time, 'monotonic', lambda: clock['now'])
    ugv_bringup.cmd_vel_callback(harness, velocity(0.02, 0.0))

    clock['now'] = 1000.6
    harness._cmd_vel_watchdog_tick()  # must return normally

    assert harness.base_controller.commands[-1] == {'T': '13', 'X': 0.0, 'Z': 0.0}, (
        'the stop must already be on the wire before the publish that failed'
    )
    assert harness._cmd_vel_watchdog_fired is True
    assert harness._cmd_vel_watchdog_armed is False
    assert any('rmw publish failed' in message for message in logger.errors), (
        'the failure has to be logged, not swallowed silently'
    )

    # And the tick stays usable afterwards — one stop, not a stop per tick.
    stops = len(harness.base_controller.commands)
    clock['now'] = 1001.5
    harness._cmd_vel_watchdog_tick()
    assert len(harness.base_controller.commands) == stops


# ---------------------------------------------------------------------------
# `armed` semantics. This is the value the cockpit's safety strip renders, and
# it is the one thing about the watchdog that an outside observer cannot
# reconstruct. It means exactly "the automatic stop WILL happen": the timer
# exists, is not cancelled, and the timeout is positive — INDEPENDENT of
# allow_motion.
#
# Both plausible regressions are silent. Hardcoding `armed = True` makes a
# cancelled timer report healthy; restoring the old `allow_motion and timeout >
# 0` makes a parked robot report NOT ARMED as its resting state, which is how
# operators learn to ignore the indicator entirely.
# ---------------------------------------------------------------------------
class RecordingPublisher:
    def __init__(self):
        self.messages = []

    def publish(self, message):
        self.messages.append(message)


class FakeTimer:
    def __init__(self, canceled=False):
        self._canceled = canceled

    def is_canceled(self):
        return self._canceled


_LIVE_TIMER = object()  # sentinel: None is a meaningful value here, not "default"


def safety_harness(allow_motion, cmd_vel_timeout=0.5, timer=_LIVE_TIMER, fired=False):
    logger = RecordingLogger()
    harness = SimpleNamespace(
        allow_motion=allow_motion,
        cmd_vel_timeout=cmd_vel_timeout,
        _cmd_vel_watchdog_timer=FakeTimer() if timer is _LIVE_TIMER else timer,
        _cmd_vel_watchdog_fired=fired,
        _cmd_vel_watchdog_armed=False,
        allow_motion_publisher_=RecordingPublisher(),
        watchdog_state_publisher_=RecordingPublisher(),
        get_logger=lambda: logger,
    )
    harness._publish_safety_state = MethodType(
        ugv_bringup._publish_safety_state, harness
    )
    return harness


def published_watchdog(harness):
    harness._publish_safety_state()
    status = harness.watchdog_state_publisher_.messages[-1]
    return status, {kv.key: kv.value for kv in status.values}


def test_armed_is_true_on_a_locked_robot_with_a_live_watchdog():
    """The regression that matters: motion locked must NOT read as not-armed."""
    from diagnostic_msgs.msg import DiagnosticStatus

    harness = safety_harness(allow_motion=False)
    status, values = published_watchdog(harness)

    assert values['armed'] == 'true', (
        'a parked robot whose watchdog is running is ARMED. ANDing allow_motion '
        'back into this makes NOT-ARMED the everyday resting state, and an '
        'indicator that is always amber is an indicator nobody reads.'
    )
    assert status.message == 'armed; motion locked'
    assert status.level == DiagnosticStatus.OK, (
        'a locked robot is a normal operating state, not a warning'
    )
    assert harness.allow_motion_publisher_.messages[-1].data is False


def test_armed_is_true_and_message_says_so_when_motion_is_allowed():
    from diagnostic_msgs.msg import DiagnosticStatus

    harness = safety_harness(allow_motion=True)
    status, values = published_watchdog(harness)

    assert values['armed'] == 'true'
    assert status.message == 'armed; motion allowed'
    assert status.level == DiagnosticStatus.OK
    assert harness.allow_motion_publisher_.messages[-1].data is True


def test_armed_is_false_when_the_timer_is_cancelled():
    """The case a hardcoded `armed = True` would report as healthy."""
    from diagnostic_msgs.msg import DiagnosticStatus

    for allow_motion in (True, False):
        harness = safety_harness(
            allow_motion=allow_motion, timer=FakeTimer(canceled=True)
        )
        status, values = published_watchdog(harness)
        assert values['armed'] == 'false', (
            'a cancelled timer will never fire, so nothing stops this robot '
            'automatically — that is precisely what armed=false must mean'
        )
        assert status.level == DiagnosticStatus.WARN
        assert 'NOT armed' in status.message


def test_armed_is_false_when_there_is_no_timer_or_no_timeout():
    """No timer at all, and a non-positive timeout, both mean no automatic stop."""
    for allow_motion in (True, False):
        assert published_watchdog(
            safety_harness(allow_motion=allow_motion, timer=None)
        )[1]['armed'] == 'false'
        assert published_watchdog(
            safety_harness(allow_motion=allow_motion, cmd_vel_timeout=0.0)
        )[1]['armed'] == 'false'


def test_armed_does_not_depend_on_allow_motion():
    """Same watchdog state, both gate positions, same answer."""
    for timer, expected in ((FakeTimer(), 'true'), (FakeTimer(canceled=True), 'false')):
        answers = {
            published_watchdog(
                safety_harness(allow_motion=allow_motion, timer=timer)
            )[1]['armed']
            for allow_motion in (True, False)
        }
        assert answers == {expected}, (
            'armed changed with allow_motion (%s). It answers one question — '
            'will the automatic stop happen — and allow_motion is rendered '
            'separately from its own topic.' % answers
        )


def test_fired_latch_outranks_armed_in_the_reported_level():
    from diagnostic_msgs.msg import DiagnosticStatus

    harness = safety_harness(allow_motion=True, fired=True)
    status, values = published_watchdog(harness)

    assert values['fired'] == 'true'
    assert status.level == DiagnosticStatus.ERROR
    assert status.message == 'watchdog stopped the robot; no command since'


def test_safety_publish_never_propagates():
    """Same executor as the watchdog tick, so it must not raise either."""
    harness = safety_harness(allow_motion=True)
    logger = RecordingLogger()
    harness.get_logger = lambda: logger

    class ExplodingPublisher:
        def publish(self, message):
            raise RuntimeError('rmw publish failed')

    harness.watchdog_state_publisher_ = ExplodingPublisher()
    harness._publish_safety_state()  # must return normally

    assert any('rmw publish failed' in message for message in logger.warnings)
