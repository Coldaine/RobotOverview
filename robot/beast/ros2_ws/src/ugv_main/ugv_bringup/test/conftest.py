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
    rclpy_parameter = _module('rclpy.parameter')
    rclpy_qos = _module('rclpy.qos')

    class _Placeholder:
        """Accept-anything stub for rclpy classes the tests never introspect."""

        def __init__(self, *args, **kwargs):
            pass

    class _QoS:
        """QoS stand-ins, deliberately NOT the same class as the Node stub.

        Tests monkeypatch ``Node.__init__``; when QoSProfile/DurabilityPolicy/
        HistoryPolicy aliased the Node stub class, that patch clobbered QoS
        construction in ``ugv_bringup.__init__`` with a lambda that rejects
        kwargs. Separate class, carries the enum attributes the node reads and
        swallows ``QoSProfile(depth=..., durability=..., history=...)``.
        """

        TRANSIENT_LOCAL = 'transient_local'
        KEEP_LAST = 'keep_last'

        def __init__(self, *args, **kwargs):
            pass

    class _Message:
        """Enough of a generated message to be built and have fields set.

        ``rclpy`` messages take keyword field values and allow attribute
        assignment afterwards; both forms appear in ugv_bringup. Nothing here
        validates types — these tests assert what the node PUTS in a message,
        not that rosidl would accept it.
        """

        def __init__(self, **fields):
            for name, value in fields.items():
                setattr(self, name, value)

    class _DiagnosticStatus(_Message):
        # The real constants, so a test can tell OK from WARN from ERROR.
        # Values match diagnostic_msgs/msg/DiagnosticStatus.
        OK = 0
        WARN = 1
        ERROR = 2
        STALE = 3

    class _Parameter:
        class Type:
            BOOL = 1

        def __init__(self, name, type_=None, value=None):
            self.name = name
            self.type_ = type_
            self.value = value

    rclpy_node.Node = _Placeholder
    rclpy_parameter.Parameter = _Parameter
    rclpy_qos.DurabilityPolicy = _QoS
    rclpy_qos.HistoryPolicy = _QoS
    rclpy_qos.QoSProfile = _QoS

    _TYPED = {'DiagnosticStatus': _DiagnosticStatus}

    for package, names in {
        'std_msgs.msg': ('Header', 'Bool', 'Float32MultiArray'),
        'geometry_msgs.msg': ('Twist',),
        'sensor_msgs.msg': (
            'Imu', 'MagneticField', 'JointState', 'BatteryState'
        ),
        'diagnostic_msgs.msg': ('DiagnosticStatus', 'KeyValue'),
        'rcl_interfaces.msg': ('SetParametersResult',),
    }.items():
        parent_name, _separator, _child = package.partition('.')
        parent = sys.modules.get(parent_name) or _module(parent_name)
        messages = _module(package)
        parent.msg = messages
        for name in names:
            setattr(messages, name, _TYPED.get(name, _Message))

    std_srvs = _module('std_srvs')
    std_srvs_srv = _module('std_srvs.srv')
    std_srvs.srv = std_srvs_srv
    std_srvs_srv.SetBool = type(
        'SetBool', (), {
            'Request': type('Request', (_Message,), {}),
            'Response': type('Response', (_Message,), {}),
        }
    )

if importlib.util.find_spec('serial') is None:
    serial = _module('serial')
    serial.Serial = object

if importlib.util.find_spec('netifaces') is None:
    netifaces = _module('netifaces')
    netifaces.AF_INET = 2
    netifaces.interfaces = lambda: []
    netifaces.ifaddresses = lambda _interface: {}
