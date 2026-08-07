# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0

import json
from types import MethodType, SimpleNamespace

import pytest

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


class DummyThread:
    """Thread stand-in that records the constructor args but never runs."""

    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs

    def start(self):
        pass


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
        base_controller=RecordingController(),
        get_logger=lambda: logger,
    )
    harness.send_stop_command = MethodType(ugv_bringup.send_stop_command, harness)
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

    ugv_bringup.cmd_vel_callback(harness, velocity(0.25, -0.5))

    assert harness.base_controller.commands == [{'T': '13', 'X': 0.0, 'Z': 0.0}]
    assert harness.get_logger().warnings == [
        'Rejected non-zero cmd_vel while allow_motion is false'
    ]


def test_motion_gate_allows_command_after_explicit_enable():
    harness = motion_harness(allow_motion=True)

    ugv_bringup.cmd_vel_callback(harness, velocity(0.05, 0.25))

    assert harness.base_controller.commands == [{'T': '13', 'X': 0.05, 'Z': 0.25}]


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


def test_unconditional_boot_stop_sends_stop_even_when_motion_allowed(monkeypatch):
    """The startup stop must run regardless of the allow_motion parameter."""
    from rclpy.node import Node

    class DummyBringup(ugv_bringup):
        def __init__(self):
            pass  # caller invokes ugv_bringup.__init__ manually

    logger = RecordingLogger()
    base_controller = RecordingController()

    def make_param_value(name):
        values = {
            'serial_port': '/dev/fake',
            'baud_rate': 115200,
            'wifi_interface': '',
            'ethernet_interface': '',
            'allow_motion': False,  # prove it is unconditional
        }
        return SimpleNamespace(value=values.get(name))

    node = DummyBringup.__new__(DummyBringup)
    node.base_controller = base_controller
    node.get_logger = lambda: logger
    node.allow_motion = None
    node._applying_allow_motion = False
    node.create_publisher = lambda *args, **kwargs: None
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
        'ugv_bringup.ugv_bringup.BaseController',
        lambda port, baud: base_controller,
    )
    monkeypatch.setattr(
        'ugv_bringup.ugv_bringup.threading.Thread', DummyThread
    )

    ugv_bringup.__init__(node)

    assert node.base_controller.commands[:2] == [
        {'T': 131, 'cmd': 1},
        {'T': '13', 'X': 0.0, 'Z': 0.0},
    ]
    assert node.allow_motion is False


def test_led_ctrl_callback_rejects_short_array():
    harness = motion_harness(allow_motion=True)

    ugv_bringup.led_ctrl_callback(harness, SimpleNamespace(data=[255]))

    assert harness.base_controller.commands == []
    assert any('Malformed led_ctrl' in message
               for message in harness.get_logger().warnings)


def test_pt_steady_ctrl_callback_rejects_short_array():
    harness = motion_harness(allow_motion=True)

    ugv_bringup.pt_steady_ctrl_callback(harness, SimpleNamespace(data=[1]))

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

    ugv_bringup.joint_states_callback(harness, msg)

    assert harness.base_controller.commands == []
    assert any('Malformed joint_states' in message
               for message in harness.get_logger().warnings)
