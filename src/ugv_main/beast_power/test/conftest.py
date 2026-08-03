# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Make ``beast_power`` importable without colcon install (Windows / bare pytest)."""

from __future__ import annotations

import sys
from pathlib import Path
from types import ModuleType

_PKG_ROOT = Path(__file__).resolve().parents[1]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))


class _Message:
    def __init__(self, **values):
        for key, value in values.items():
            setattr(self, key, value)


if 'rclpy' not in sys.modules:
    rclpy = ModuleType('rclpy')
    rclpy.ok = lambda: True
    rclpy.node = ModuleType('rclpy.node')
    rclpy.node.Node = object
    sys.modules['rclpy'] = rclpy
    sys.modules['rclpy.node'] = rclpy.node

    for package, message in (
        ('sensor_msgs', 'BatteryState'),
        ('std_msgs', 'Bool'),
    ):
        parent = ModuleType(package)
        child = ModuleType(f'{package}.msg')
        setattr(child, message, type(message, (_Message,), {}))
        parent.msg = child
        sys.modules[package] = parent
        sys.modules[f'{package}.msg'] = child
