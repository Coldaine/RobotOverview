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
    def __init__(self):
        self.warnings = []

    def warning(self, message):
        self.warnings.append(message)


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
