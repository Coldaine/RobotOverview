# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0

"""Minimal ROS import stubs for the bare-Python watchdog merge gate.

The behavioral tests bind selected ``ugv_bringup`` methods onto a tiny harness;
they never construct a ROS node or message.  CI intentionally has no ROS install,
so provide only the names needed to import the production module.  On a real ROS
Humble system these stubs are not installed and the actual packages are used.
"""

import importlib.util
import sys
from types import ModuleType


def _module(name):
    module = ModuleType(name)
    sys.modules[name] = module
    return module


if importlib.util.find_spec('rclpy') is None:
    rclpy = _module('rclpy')
    rclpy_node = _module('rclpy.node')
    rclpy_qos = _module('rclpy.qos')

    class _Placeholder:
        pass

    rclpy_node.Node = _Placeholder
    rclpy_qos.DurabilityPolicy = _Placeholder
    rclpy_qos.HistoryPolicy = _Placeholder
    rclpy_qos.QoSProfile = _Placeholder

    for package, names in {
        'std_msgs.msg': ('Header', 'Bool', 'Float32MultiArray'),
        'geometry_msgs.msg': ('Twist',),
        'sensor_msgs.msg': (
            'Imu', 'MagneticField', 'JointState', 'BatteryState'
        ),
        'diagnostic_msgs.msg': ('DiagnosticStatus', 'KeyValue'),
    }.items():
        parent_name, _separator, _child = package.partition('.')
        parent = sys.modules.get(parent_name) or _module(parent_name)
        messages = _module(package)
        parent.msg = messages
        for name in names:
            setattr(messages, name, _Placeholder)

if importlib.util.find_spec('serial') is None:
    serial = _module('serial')
    serial.Serial = object

if importlib.util.find_spec('netifaces') is None:
    netifaces = _module('netifaces')
    netifaces.AF_INET = 2
    netifaces.interfaces = lambda: []
    netifaces.ifaddresses = lambda _interface: {}
