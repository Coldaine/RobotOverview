# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Pin the deterministic stub-install precedence (conftest.py).

The strict message/node stubs must exist regardless of collection order, and
must never shadow real ROS: conftest installs them only when rclpy is not a
genuinely installed package, and OVERWRITES spec-less injected stubs left by
another suite. These tests pin the ``__spec__``-based detection and both
branches of the decision.
"""

from __future__ import annotations

import importlib.util
import sys
from types import ModuleType

import conftest
from conftest import Node, _is_real_import, _stubs_required


def test_absent_package_is_not_real():
    assert _is_real_import('_beast_power_no_such_package_xyz') is False


def test_real_stdlib_import_is_real():
    # A genuinely installed module always carries __spec__.
    assert _is_real_import('math') is True


def test_spec_less_injected_stub_is_not_real(monkeypatch):
    """Another suite's hand-injected ModuleType stub has no __spec__ and must
    not be trusted as the real package."""
    stub = ModuleType('_bp_spec_less_stub')
    monkeypatch.setitem(sys.modules, '_bp_spec_less_stub', stub)
    assert _is_real_import('_bp_spec_less_stub') is False


def test_spec_ful_module_is_real(monkeypatch):
    module = ModuleType('_bp_spec_ful_stub')
    module.__spec__ = importlib.util.spec_from_loader(
        '_bp_spec_ful_stub', loader=None
    )
    monkeypatch.setitem(sys.modules, '_bp_spec_ful_stub', module)
    assert _is_real_import('_bp_spec_ful_stub') is True


def test_real_rclpy_wins_over_stubs(monkeypatch):
    """If rclpy imports with a proper spec, the stubs must NOT be installed:
    tests then run against the real messages (real ROS always wins)."""
    real_like = ModuleType('rclpy')
    real_like.__spec__ = importlib.util.spec_from_loader('rclpy', loader=None)
    monkeypatch.setitem(sys.modules, 'rclpy', real_like)

    assert _is_real_import('rclpy') is True
    assert _stubs_required() is False


def test_spec_less_rclpy_stub_gets_overwritten(monkeypatch):
    """Collection-order case: another suite already injected a spec-less rclpy
    stub before this conftest ran. Re-running the install must replace it with
    the strict stub, not trust it."""
    dummy = ModuleType('rclpy')
    dummy.node = ModuleType('rclpy.node')
    dummy.injected = True  # marker: survives only if the stub was NOT replaced
    monkeypatch.setitem(sys.modules, 'rclpy', dummy)
    monkeypatch.setitem(sys.modules, 'rclpy.node', dummy.node)
    # Snapshot the live stubs so the install run can restore them afterwards.
    for name in ('sensor_msgs', 'sensor_msgs.msg', 'std_msgs', 'std_msgs.msg'):
        monkeypatch.setitem(sys.modules, name, sys.modules[name])

    assert _stubs_required() is True
    conftest._install_stubs()

    assert sys.modules['rclpy'] is not dummy
    assert not hasattr(sys.modules['rclpy'], 'injected')
    assert sys.modules['rclpy'].node.Node is Node
    assert hasattr(sys.modules['sensor_msgs'].msg, 'BatteryState')
    assert hasattr(sys.modules['std_msgs'].msg, 'Bool')
