# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0

import json
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


def motion_harness(allow_motion):
    harness = SimpleNamespace(
        allow_motion=allow_motion,
        _motion_reject_warned=False,
        base_controller=RecordingController(),
        zero_vel_count=0,
        zero_vel_limit=5,
        get_logger=lambda: RecordingLogger(),
    )
    harness.send_stop_command = MethodType(ugv_bringup.send_stop_command, harness)
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
