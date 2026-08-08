# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Make ``beast_power`` importable without colcon install (Windows / bare pytest).

Host scaffolding, not a ROS replacement: the message and node stubs here exist
so ``PowerNode.__init__`` really executes and ``_publish_once`` really runs in
tests. The message stubs are deliberately STRICTER than real rclpy generated
messages — only the real field set is accepted, so a typo such as
``precentage`` fails a test instead of silently creating an attribute that
never reaches the wire.

Installation is deterministic, not collection-order dependent: the stubs go
in only when ``rclpy`` is NOT a genuinely installed package, and a spec-less
stub injected by another suite is overwritten. Real ROS always wins (see
``_stubs_required``).
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path
from types import ModuleType

_PKG_ROOT = Path(__file__).resolve().parents[1]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))


class _Message:
    """Strict stand-in for a ROS message class.

    ``_FIELDS`` mirrors the real message's field set. Construction from kwargs
    sets only known fields (an unknown kwarg raises ``AttributeError``), and
    setting or reading any other attribute raises ``AttributeError`` too.
    Defaults that must be fresh per instance are factory callables.
    """

    _FIELDS: dict[str, object] = {}

    def __init__(self, **values):
        for name, default in self._FIELDS.items():
            object.__setattr__(
                self, name, default() if callable(default) else default
            )
        for name, value in values.items():
            setattr(self, name, value)

    def __setattr__(self, name, value):
        if name not in self._FIELDS:
            raise AttributeError(
                f'{type(self).__name__} has no field {name!r} (typo?)'
            )
        object.__setattr__(self, name, value)

    def __getattr__(self, name):
        # Only reached when normal lookup fails: an unknown field.
        raise AttributeError(f'{type(self).__name__} has no field {name!r}')


class _Stamp:
    def __init__(self, sec: int = 0, nanosec: int = 0) -> None:
        self.sec = sec
        self.nanosec = nanosec


class _Header:
    """std_msgs/Header stand-in: the node owns stamp + frame_id."""

    def __init__(self, frame_id: str = '') -> None:
        self.stamp = _Stamp()
        self.frame_id = frame_id


class _Logger:
    """No-op logger; records ``(level, message)`` for tests that care."""

    def __init__(self, name: str) -> None:
        self._name = name
        self.records: list[tuple[str, str]] = []

    def _record(self, level: str, msg: object) -> None:
        self.records.append((level, str(msg)))

    def debug(self, msg, *args, **kwargs):
        self._record('debug', msg)

    def info(self, msg, *args, **kwargs):
        self._record('info', msg)

    def warn(self, msg, *args, **kwargs):
        self._record('warn', msg)

    # rclpy uses warn(); the node code calls warning(). Keep both.
    def warning(self, msg, *args, **kwargs):
        self._record('warning', msg)

    def error(self, msg, *args, **kwargs):
        self._record('error', msg)

    def fatal(self, msg, *args, **kwargs):
        self._record('fatal', msg)


class _ParameterValue:
    """Mirrors rclpy ParameterValue's typed accessors."""

    def __init__(self, value: object) -> None:
        self._value = value

    @property
    def integer_value(self) -> int:
        return int(self._value)

    @property
    def double_value(self) -> float:
        return float(self._value)

    @property
    def string_value(self) -> str:
        return str(self._value)

    @property
    def bool_value(self) -> bool:
        return bool(self._value)


class _Parameter:
    def __init__(self, name: str, value: object) -> None:
        self.name = name
        self._value = value

    def get_parameter_value(self) -> _ParameterValue:
        return _ParameterValue(self._value)


class _Publisher:
    def __init__(self, topic: str, qos: object) -> None:
        self.topic = topic
        self.qos = qos
        self.published: list[object] = []

    def publish(self, msg: object) -> None:
        self.published.append(msg)


class _Subscription:
    def __init__(self, msg_type, topic: str, callback, qos: object) -> None:
        self.msg_type = msg_type
        self.topic = topic
        self.callback = callback
        self.qos = qos


class _Timer:
    def __init__(self, period: float, callback) -> None:
        self.period = period
        self.callback = callback
        self.cancelled = False

    def cancel(self) -> None:
        self.cancelled = True


class _Time:
    def __init__(self) -> None:
        self.sec = 0
        self.nanosec = 0

    def to_msg(self) -> _Stamp:
        return _Stamp(self.sec, self.nanosec)


class _Clock:
    def now(self) -> _Time:
        return _Time()


class Node:
    """Functional stand-in for ``rclpy.node.Node`` (host scaffolding).

    Parameters are dict-backed: ``declare_parameter`` stores the default,
    ``get_parameter`` returns it or a later ``set_parameter`` override.
    Publishers, subscriptions and timers record their arguments so tests can
    drive the recorded timer callback and read published messages back.
    """

    def __init__(self, node_name: str) -> None:
        self.node_name = node_name
        self._parameters: dict[str, object] = {}
        self.publishers: list[tuple[object, _Publisher]] = []
        self.subscriptions: list[_Subscription] = []
        self.timers: list[_Timer] = []
        self._logger = _Logger(node_name)
        self._clock = _Clock()

    def declare_parameter(self, name: str, default: object) -> object:
        # First declaration wins; re-declaring keeps the stored value.
        return self._parameters.setdefault(name, default)

    def set_parameter(self, name: str, value: object) -> None:
        self._parameters[name] = value

    def get_parameter(self, name: str) -> _Parameter:
        if name not in self._parameters:
            raise RuntimeError(f'parameter {name!r} was never declared')
        return _Parameter(name, self._parameters[name])

    def create_publisher(self, msg_type, topic: str, qos: object = 10) -> _Publisher:
        pub = _Publisher(topic, qos)
        self.publishers.append((msg_type, pub))
        return pub

    def create_subscription(self, msg_type, topic: str, callback, qos: object = 10) -> _Subscription:
        sub = _Subscription(msg_type, topic, callback, qos)
        self.subscriptions.append(sub)
        return sub

    def create_timer(self, period: float, callback) -> _Timer:
        timer = _Timer(period, callback)
        self.timers.append(timer)
        return timer

    def get_logger(self) -> _Logger:
        return self._logger

    def get_clock(self) -> _Clock:
        return self._clock


def _battery_state_fields() -> dict[str, object]:
    # Mirrors sensor_msgs/BatteryState.msg (humble): header + 15 fields, in
    # the message's field order (temperature sits between voltage and current).
    return {
        'header': _Header,
        'voltage': 0.0,
        'temperature': 0.0,
        'current': 0.0,
        'charge': 0.0,
        'capacity': 0.0,
        'design_capacity': 0.0,
        'percentage': 0.0,
        'power_supply_status': 0,
        'power_supply_health': 0,
        'power_supply_technology': 0,
        'present': False,
        'cell_voltage': list,
        'cell_temperature': list,
        'location': '',
        'serial_number': '',
    }


def _is_real_import(name: str) -> bool:
    """True when ``name`` is a genuinely installed package, not an injected stub.

    Tries the real import path. An ImportError means not installed. A module
    that comes back WITHOUT ``__spec__`` is a sys.modules-injected stub from
    another suite — hand-injected ``ModuleType`` stubs have no spec, real
    installed packages always do — so report False and let the caller
    overwrite it.
    """
    try:
        module = importlib.import_module(name)
    except ImportError:
        return False
    return getattr(module, '__spec__', None) is not None


def _stubs_required() -> bool:
    """True when the strict stubs must be installed for this session.

    Real ROS always wins: if rclpy imports as a genuinely installed package
    (has ``__spec__``), leave ``sys.modules`` alone and run against the real
    messages. Otherwise — no ROS installed, or a spec-less injected stub from
    another suite — install/overwrite the strict stubs so collection order
    cannot decide whether they exist.
    """
    return not _is_real_import('rclpy')


def _install_stubs() -> None:
    """Install the strict rclpy / sensor_msgs / std_msgs stand-ins."""
    rclpy = ModuleType('rclpy')
    rclpy.ok = lambda: True
    rclpy.node = ModuleType('rclpy.node')
    rclpy.node.Node = Node
    sys.modules['rclpy'] = rclpy
    sys.modules['rclpy.node'] = rclpy.node

    for package, message, fields in (
        ('sensor_msgs', 'BatteryState', _battery_state_fields()),
        ('std_msgs', 'Bool', {'data': False}),
    ):
        parent = ModuleType(package)
        child = ModuleType(f'{package}.msg')
        setattr(child, message, type(message, (_Message,), {'_FIELDS': fields}))
        parent.msg = child
        sys.modules[package] = parent
        sys.modules[f'{package}.msg'] = child


if _stubs_required():
    _install_stubs()
