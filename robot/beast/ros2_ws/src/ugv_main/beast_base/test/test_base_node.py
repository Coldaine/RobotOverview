# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0

"""Behavioral safety tests for the beast_base ESP32 bridge node.

The whole suite runs without ROS: methods are bound onto tiny harnesses with
fakes for the serial controller, logger, threads, publishers, and clock.  What
is asserted is behavior on the wire — published messages, serial commands, and
their ORDER — never source text (the AST-pinning tests were removed in the
post-#174 cleanup; the load-bearing boot ordering is proven behaviorally below).

Run: ``python3 -m pytest src/ugv_main/beast_base/test`` from the workspace root.
"""

import json
from types import MethodType, SimpleNamespace

import pytest

from beast_base.base_node import (
    default_serial_port,
    select_interface_ip,
    BeastBaseNode,
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


class DummyThread:
    """Thread stand-in that records the constructor args but never runs."""

    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs

    def start(self):
        pass


class RecordingPublisher:
    def __init__(self, name):
        self.name = name
        self.published = []

    def publish(self, msg):
        self.published.append(msg)


class FakeClock:
    class _Stamp:
        def to_msg(self):
            return SimpleNamespace(sec=0, nanosec=0)

    def now(self):
        return self._Stamp()


class FakeRate:
    def __init__(self, max_sleeps):
        self.sleeps = 0
        self.max_sleeps = max_sleeps

    def sleep(self):
        self.sleeps += 1


def velocity(linear, angular):
    return SimpleNamespace(
        linear=SimpleNamespace(x=linear),
        angular=SimpleNamespace(z=angular),
    )


def motion_harness(allow_motion):
    logger = RecordingLogger()
    harness = SimpleNamespace(
        allow_motion=allow_motion,
        _applying_allow_motion=False,
        _disarmed_cmd_warn_interval=5.0,
        _last_disarmed_cmd_warn=0.0,
        base_controller=RecordingController(),
        get_logger=lambda: logger,
    )
    harness.send_stop_command = MethodType(BeastBaseNode.send_stop_command, harness)
    harness.apply_allow_motion = MethodType(
        BeastBaseNode.apply_allow_motion, harness
    )
    return harness


def telemetry_frame():
    return {
        "T": 1001,
        "L": 5, "R": 7,
        "ax": 100, "ay": 200, "az": 900,
        "gx": 1, "gy": 2, "gz": 3,
        "mx": 1000, "my": 2000, "mz": 3000,
        "odl": 125, "odr": 75,
        "v": 1180,  # centivolts
    }


def feedback_harness(controller=None):
    """Node-shaped harness for the 20 Hz feedback loop.

    ``rclpy.ok()`` is monkeypatched per-test so the loop runs a bounded number
    of iterations; the loop re-reads it as a module attribute at call time.
    """
    logger = RecordingLogger()
    publishers = {
        'imu/data': RecordingPublisher('imu/data'),
        'imu/raw': RecordingPublisher('imu/raw'),
        'imu/mag': RecordingPublisher('imu/mag'),
        'odom/odom_raw': RecordingPublisher('odom/odom_raw'),
    }
    harness = SimpleNamespace(
        base_controller=controller or RecordingController(),
        get_logger=lambda: logger,
        get_clock=lambda: FakeClock(),
        imu_data_publisher_=publishers['imu/data'],
        imu_data_raw_publisher_=publishers['imu/raw'],
        imu_mag_publisher_=publishers['imu/mag'],
        odom_publisher_=publishers['odom/odom_raw'],
        _voice=SimpleNamespace(check=lambda data: None),
    )
    harness.publish_imu_data_raw = MethodType(
        BeastBaseNode.publish_imu_data_raw, harness
    )
    harness.publish_imu_mag = MethodType(BeastBaseNode.publish_imu_mag, harness)
    harness.publish_odom_raw = MethodType(BeastBaseNode.publish_odom_raw, harness)
    return harness, publishers, logger


class ScriptedController:
    """feedback_data() returns frames from a script; base_data follows.

    Once the script is exhausted it returns None (like the real controller
    when the serial line is quiet), so a loop only processes as many frames
    as the script holds.
    """

    def __init__(self, frames):
        self.frames = list(frames)
        self.base_data = None

    def feedback_data(self):
        if self.frames:
            self.base_data = self.frames.pop(0)
            return self.base_data
        return None


# ---------------------------------------------------------------------------
# interface + serial-port selection
# ---------------------------------------------------------------------------
def test_select_interface_ip_handles_predictable_jetson_names():
    ip_map = {
        'l4tbr0': '192.168.55.1',
        'wlP1p1s0': '192.168.20.251',
        'enP8p1s0': '192.168.20.252',
    }

    assert select_interface_ip(ip_map, '', 'wifi') == '192.168.20.251'
    assert select_interface_ip(ip_map, '', 'ethernet') == '192.168.20.252'
    assert select_interface_ip(ip_map, 'wlP1p1s0', 'wifi') == '192.168.20.251'


def test_default_serial_port_uses_jetson_by_id_path(monkeypatch):
    """cp210x re-enumeration lands on the by-id path, not ttyTHS1."""
    monkeypatch.delenv('UGV_SERIAL_PORT', raising=False)
    monkeypatch.setattr('beast_base.base_node.os.path.exists', lambda _: True)

    assert default_serial_port() == \
        '/dev/serial/by-id/usb-1a86_USB_Single_Serial_5B5E130201-if00'


def test_default_serial_port_respects_env_override(monkeypatch):
    monkeypatch.setenv('UGV_SERIAL_PORT', '/dev/ttyUSB7')

    assert default_serial_port() == '/dev/ttyUSB7'


def test_default_serial_port_falls_back_to_ama0_off_jetson(monkeypatch):
    monkeypatch.delenv('UGV_SERIAL_PORT', raising=False)
    monkeypatch.setattr('beast_base.base_node.os.path.exists', lambda _: False)

    assert default_serial_port() == '/dev/ttyAMA0'


# ---------------------------------------------------------------------------
# the allow_motion gate
# ---------------------------------------------------------------------------
def test_motion_gate_replaces_nonzero_command_with_stop():
    harness = motion_harness(allow_motion=False)

    BeastBaseNode.cmd_vel_callback(harness, velocity(0.25, -0.5))

    assert harness.base_controller.commands == [{'T': '13', 'X': 0.0, 'Z': 0.0}]
    assert harness.get_logger().warnings == [
        'Rejected non-zero cmd_vel while allow_motion is false'
    ]


def test_motion_gate_allows_command_after_explicit_enable():
    harness = motion_harness(allow_motion=True)

    BeastBaseNode.cmd_vel_callback(harness, velocity(0.05, 0.25))

    assert harness.base_controller.commands == [{'T': '13', 'X': 0.05, 'Z': 0.25}]


def test_motion_gate_throttles_repeated_disarmed_warnings(monkeypatch):
    harness = motion_harness(allow_motion=False)
    clock = {'now': 10.0}
    monkeypatch.setattr(
        'beast_base.base_node.time.monotonic', lambda: clock['now']
    )

    BeastBaseNode.cmd_vel_callback(harness, velocity(0.25, 0.0))
    BeastBaseNode.cmd_vel_callback(harness, velocity(0.25, 0.0))

    message = 'Rejected non-zero cmd_vel while allow_motion is false'
    assert harness.get_logger().warnings == [message]

    clock['now'] = 15.0
    BeastBaseNode.cmd_vel_callback(harness, velocity(0.25, 0.0))
    assert harness.get_logger().warnings == [message, message]


def test_disable_allow_motion_stops_immediately():
    harness = motion_harness(allow_motion=True)

    previous, desired = harness.apply_allow_motion(False, source='test')

    assert previous is True
    assert desired is False
    assert harness.allow_motion is False
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


# ---------------------------------------------------------------------------
# H1: the unconditional boot stop and the load-bearing ordering
# ---------------------------------------------------------------------------
@pytest.mark.parametrize('allow_motion_param', [True, False])
def test_boot_stop_is_unconditional_and_precedes_allow_motion_publisher(
    monkeypatch, allow_motion_param
):
    """The startup stop must run regardless of the allow_motion parameter, and
    the /ugv/allow_motion publisher (whose creation can raise) must come AFTER
    it — telemetry must never precede the robot's own safing."""
    from rclpy.node import Node

    class DummyBringup(BeastBaseNode):
        def __init__(self):
            pass  # caller invokes BeastBaseNode.__init__ manually

    logger = RecordingLogger()
    base_controller = RecordingController()
    timeline = []

    class TimedRecordingController(RecordingController):
        def send_command(self, command):
            payload = json.loads(command.decode())
            super().send_command(command)
            if payload.get('T') == '13':
                timeline.append('stop')

    controller = TimedRecordingController()

    def make_param_value(name):
        values = {
            'serial_port': '/dev/fake',
            'baud_rate': 115200,
            'wifi_interface': '',
            'ethernet_interface': '',
            'allow_motion': allow_motion_param,
        }
        return SimpleNamespace(value=values.get(name))

    def record_create_publisher(msg_type, topic, *args, **kwargs):
        timeline.append('publisher:' + str(topic))
        return RecordingPublisher(topic)

    node = DummyBringup.__new__(DummyBringup)
    node.base_controller = controller
    node.get_logger = lambda: logger
    node.allow_motion = None
    node._applying_allow_motion = False
    node.create_publisher = record_create_publisher
    node.create_subscription = lambda *args, **kwargs: None
    node.create_service = lambda *args, **kwargs: None
    node.declare_parameter = lambda *args, **kwargs: None
    node.get_parameter = make_param_value
    node.add_on_set_parameters_callback = lambda *args, **kwargs: None
    node.set_ugv_version = lambda: None

    monkeypatch.setattr(
        Node, '__init__', lambda self, name: None
    )
    monkeypatch.setattr(
        'beast_base.base_node.BaseController',
        lambda port, baud: controller,
    )
    monkeypatch.setattr(
        'beast_base.base_node.threading.Thread', DummyThread
    )

    BeastBaseNode.__init__(node)

    # The enable command and the unconditional stop are the only boot writes.
    assert controller.commands == [
        {'T': 131, 'cmd': 1},
        {'T': '13', 'X': 0.0, 'Z': 0.0},
    ]
    # The node latches and publishes the enforced gate value it read from parameters.
    assert node.allow_motion is allow_motion_param
    assert [message.data for message in node.allow_motion_publisher_.published] == [
        allow_motion_param
    ]
    # Ordering: the stop precedes the allow_motion publisher, and no other
    # publisher is created after the stop — no telemetry path can beat safing.
    assert timeline.index('stop') < timeline.index('publisher:/ugv/allow_motion')
    after_stop = timeline[timeline.index('stop') + 1:]
    assert after_stop == ['publisher:/ugv/allow_motion']


def test_no_watchdog_release_path_can_leave_the_robot_running(monkeypatch):
    """D8: the cmd_vel watchdog is gone. What remains is a boot that writes
    exactly [enable, stop] to the ESP32 and then creates no publisher except
    the allow_motion gate — so no path in __init__ can release motion or
    publish telemetry before a stop has been sent."""
    from rclpy.node import Node

    class DummyBringup(BeastBaseNode):
        def __init__(self):
            pass

    logger = RecordingLogger()
    controller = RecordingController()
    timeline = []

    class TimedRecordingController(RecordingController):
        def send_command(self, command):
            payload = json.loads(command.decode())
            super().send_command(command)
            timeline.append('write:' + str(payload.get('T')))

    controller = TimedRecordingController()

    def make_param_value(name):
        values = {
            'serial_port': '/dev/fake',
            'baud_rate': 115200,
            'wifi_interface': '',
            'ethernet_interface': '',
            'allow_motion': True,
        }
        return SimpleNamespace(value=values.get(name))

    def record_create_publisher(msg_type, topic, *args, **kwargs):
        timeline.append('publisher:' + str(topic))
        return RecordingPublisher(topic)

    node = DummyBringup.__new__(DummyBringup)
    node.base_controller = controller
    node.get_logger = lambda: logger
    node.allow_motion = None
    node._applying_allow_motion = False
    node.create_publisher = record_create_publisher
    node.create_subscription = lambda *args, **kwargs: None
    node.create_service = lambda *args, **kwargs: None
    node.declare_parameter = lambda *args, **kwargs: None
    node.get_parameter = make_param_value
    node.add_on_set_parameters_callback = lambda *args, **kwargs: None
    node.set_ugv_version = lambda: None

    monkeypatch.setattr(Node, '__init__', lambda self, name: None)
    monkeypatch.setattr(
        'beast_base.base_node.BaseController',
        lambda port, baud: controller,
    )
    monkeypatch.setattr(
        'beast_base.base_node.threading.Thread', DummyThread
    )

    BeastBaseNode.__init__(node)

    # The whole boot conversation with the ESP32 is enable + stop, in that
    # order, and nothing else is ever written during __init__.
    assert controller.commands == [
        {'T': 131, 'cmd': 1},
        {'T': '13', 'X': 0.0, 'Z': 0.0},
    ]
    # Sensor publishers exist before the stop, but the only writes to the
    # ESP32 are enable then stop, and the only publisher created after the
    # stop is the allow_motion gate — no telemetry path and no release path
    # can precede the robot's safing.
    writes = [t for t in timeline if t.startswith('write:')]
    assert writes == ['write:131', 'write:13']
    stop_at = timeline.index('write:13')
    assert timeline[stop_at + 1:] == ['publisher:/ugv/allow_motion']


# ---------------------------------------------------------------------------
# malformed input never raises (H1)
# ---------------------------------------------------------------------------
def test_led_ctrl_callback_rejects_short_array():
    harness = motion_harness(allow_motion=True)

    BeastBaseNode.led_ctrl_callback(harness, SimpleNamespace(data=[255]))

    assert harness.base_controller.commands == []
    assert any('Malformed led_ctrl' in message
               for message in harness.get_logger().warnings)


def test_pt_steady_ctrl_callback_rejects_short_array():
    harness = motion_harness(allow_motion=True)

    BeastBaseNode.pt_steady_ctrl_callback(harness, SimpleNamespace(data=[1]))

    assert harness.base_controller.commands == []
    assert any('Malformed pt_steady_ctrl' in message
               for message in harness.get_logger().warnings)


def test_joint_states_callback_rejects_missing_joints():
    harness = motion_harness(allow_motion=True)
    msg = SimpleNamespace(
        header=SimpleNamespace(
            stamp=SimpleNamespace(sec=0, nanosec=0),
            frame_id='',
        ),
        name=['not_a_pt_joint'],
        position=[0.0],
    )

    BeastBaseNode.joint_states_callback(harness, msg)

    assert harness.base_controller.commands == []
    assert any('Malformed joint_states' in message
               for message in harness.get_logger().warnings)


def test_joint_states_callback_rejects_mismatched_lengths():
    harness = motion_harness(allow_motion=True)
    msg = SimpleNamespace(
        header=SimpleNamespace(
            stamp=SimpleNamespace(sec=0, nanosec=0),
            frame_id='',
        ),
        name=['pt_base_link_to_pt_link1', 'pt_link1_to_pt_link2'],
        position=[0.1],
    )

    BeastBaseNode.joint_states_callback(harness, msg)

    assert harness.base_controller.commands == []
    assert any('Malformed joint_states' in message
               for message in harness.get_logger().warnings)


def test_feedback_loop_survives_garbage_frames(monkeypatch):
    """H1: a garbage frame must be logged, not raise — and the loop must keep
    serving valid telemetry afterwards."""
    ok_calls = {'n': 0}

    def fake_ok():
        ok_calls['n'] += 1
        return ok_calls['n'] <= 3

    class RaisingFeedbackController(ScriptedController):
        """feedback_data() that hard-raises on one garbage frame, like a
        decoder bug would — the loop's own guard must catch it."""

        def feedback_data(self):
            data = super().feedback_data()
            if data == 'not json at all':
                raise json.JSONDecodeError('garbage', 'doc', 0)
            return data

    controller = RaisingFeedbackController([
        None,               # controller-level soft-fail (no frame)
        'not json at all',  # raises out of feedback_data — loop must survive
        telemetry_frame(),  # still works after the bad frame
    ])
    harness, publishers, logger = feedback_harness(controller)
    harness.create_rate = lambda _hz: FakeRate(max_sleeps=3)

    monkeypatch.setattr('beast_base.base_node.rclpy.ok', fake_ok)
    loop = MethodType(BeastBaseNode.feedback_loop_thread, harness)
    loop()  # must not raise

    # the loop logged the error and kept going
    assert any('[feedback_loop_thread] error' in e for e in logger.errors)
    # the good frame still fanned out
    assert len(publishers['imu/data'].published) == 1
    assert len(publishers['imu/mag'].published) == 1
    assert len(publishers['odom/odom_raw'].published) == 1


# ---------------------------------------------------------------------------
# T:1001 feedback fan-out
# ---------------------------------------------------------------------------
def test_feedback_fan_out_publishes_imu_mag_odom_and_imu_data(monkeypatch):
    ok_calls = {'n': 0}

    def fake_ok():
        ok_calls['n'] += 1
        return ok_calls['n'] <= 1

    controller = ScriptedController([telemetry_frame()])
    harness, publishers, logger = feedback_harness(controller)
    harness.create_rate = lambda _hz: FakeRate(max_sleeps=1)

    monkeypatch.setattr('beast_base.base_node.rclpy.ok', fake_ok)
    loop = MethodType(BeastBaseNode.feedback_loop_thread, harness)
    loop()

    assert len(publishers['imu/data'].published) == 1
    assert len(publishers['imu/raw'].published) == 1
    assert len(publishers['imu/mag'].published) == 1
    assert len(publishers['odom/odom_raw'].published) == 1

    imu = publishers['imu/data'].published[0]
    # REP-145 gate: orientation_covariance[0] == -1.0 marks "no orientation" so
    # odom_publisher / the EKF do not treat it as fused.
    assert imu.orientation_covariance[0] == -1.0
    assert imu.header.frame_id == 'base_link'
    # 900 LSB @ 8192 LSB/g → ~1.08 g
    assert abs(imu.linear_acceleration.z - 9.8 * 900 / 8192) < 1e-9

    mag = publishers['imu/mag'].published[0]
    assert abs(mag.magnetic_field.x - 1000 * 0.15) < 1e-9

    odom = publishers['odom/odom_raw'].published[0]
    assert odom.data[0] == pytest.approx(125 / 100)  # odl cm → m
    assert odom.data[1] == pytest.approx(75 / 100)   # odr cm → m
    assert odom.data[2] == 5 and odom.data[3] == 7   # L/R raw


def test_type_identity_frames_are_soft_rejected_and_do_not_wedge_the_loop(
    monkeypatch
):
    """A non-T:1001 frame (e.g. a Type-1 identity/type probe from the ESP32)
    must be ignored without raising, 45 times in a row, and the loop must keep
    serving real telemetry afterwards."""
    frames = [{"T": 1, "type": "identity_probe"}] * 45
    frames.append(telemetry_frame())
    ok_calls = {'n': 0}

    def fake_ok():
        ok_calls['n'] += 1
        return ok_calls['n'] <= len(frames)

    controller = ScriptedController(frames)
    harness, publishers, logger = feedback_harness(controller)
    harness.create_rate = lambda _hz: FakeRate(max_sleeps=len(frames))

    monkeypatch.setattr('beast_base.base_node.rclpy.ok', fake_ok)
    loop = MethodType(BeastBaseNode.feedback_loop_thread, harness)
    loop()  # must not raise

    assert logger.errors == []
    # exactly ONE fan-out: the trailing telemetry frame. All 45 identity
    # probes were soft-rejected (no raise, no publish) and never wedged the
    # loop — 45/45 handled.
    assert len(publishers['imu/data'].published) == 1
    assert len(publishers['odom/odom_raw'].published) == 1


# ---------------------------------------------------------------------------
# OLED T:3 lines only change when the interface IP changes
# ---------------------------------------------------------------------------
def test_oled_ip_lines_only_sent_when_ip_changes(monkeypatch):
    logger = RecordingLogger()
    controller = RecordingController()
    harness = SimpleNamespace(
        wifi_interface='',
        ethernet_interface='',
        base_controller=controller,
        get_logger=lambda: logger,
    )

    ips = iter([
        {'wl0': '192.168.20.251', 'eth0': '192.168.20.252'},
        {'wl0': '192.168.20.251', 'eth0': '192.168.20.252'},
        {'wl0': '192.168.20.251', 'eth0': '192.168.20.252'},
        {'wl0': '192.168.20.1', 'eth0': '192.168.20.252'},
    ])
    ok_calls = {'n': 0}

    def fake_ok():
        ok_calls['n'] += 1
        return ok_calls['n'] <= 4

    monkeypatch.setattr('beast_base.base_node.get_all_ips', lambda: next(ips))
    monkeypatch.setattr('beast_base.base_node.rclpy.ok', fake_ok)

    rate = FakeRate(max_sleeps=4)
    harness.create_rate = lambda _hz: rate
    loop = MethodType(BeastBaseNode.ip_thread_func, harness)
    loop()

    t3_lines = [c for c in controller.commands if c.get('T') == '3']
    assert t3_lines == [
        {'T': '3', 'lineNum': 1, 'Text': 'W:192.168.20.251'},
        {'T': '3', 'lineNum': 0, 'Text': 'E:192.168.20.252'},
        {'T': '3', 'lineNum': 1, 'Text': 'W:192.168.20.1'},
    ]
    # three iterations with unchanged IPs produced no repeats — throttled
    assert len(t3_lines) == 3
