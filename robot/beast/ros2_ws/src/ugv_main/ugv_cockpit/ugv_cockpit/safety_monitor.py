# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""ugv_safety_monitor — client of /ugv/set_allow_motion, never a second authority.

Interlocks (Set 1c):
  * Ethernet carrier up  → ask bringup to disarm (ETHERNET_LOCK)
  * Ethernet carrier unknown/unreadable → disarm (fail closed)
  * /ugv/charging_active → ask bringup to disarm (CHARGING_LOCK) when present;
    absent topic → no charging lock
  * interlock_override launch parameter → startup-only maintenance override

Normal bringup starts motion-enabled. When Ethernet or charging is observed,
this monitor asks ugv_bringup to disable motion. It does not auto-arm when an
interlock later clears; ugv_bringup remains the sole motion authority.
"""

from __future__ import annotations

import os
from typing import Optional

import rclpy
from diagnostic_msgs.msg import DiagnosticArray, DiagnosticStatus, KeyValue
from rclpy.callback_groups import ReentrantCallbackGroup
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, HistoryPolicy, QoSProfile
from std_msgs.msg import Bool
from std_srvs.srv import SetBool

from .safety_logic import (
    LOCK_NONE,
    SafetyState,
    carrier_path,
    diagnostic_values,
    read_carrier_file,
    resolve_ethernet_iface,
)


class SafetyMonitor(Node):
    def __init__(self):
        super().__init__('ugv_safety_monitor')

        self.declare_parameter('ethernet_interface', '')
        self.declare_parameter('carrier_poll_hz', 2.0)
        self.declare_parameter('charging_topic', '/ugv/charging_active')
        self.declare_parameter('interlock_override', False)
        self.declare_parameter(
            'set_allow_motion_service', '/ugv/set_allow_motion'
        )

        configured = self.get_parameter('ethernet_interface').value or os.getenv(
            'UGV_ETHERNET_INTERFACE', ''
        )
        sys_names = []
        try:
            sys_names = os.listdir('/sys/class/net')
        except OSError:
            pass
        self._iface = resolve_ethernet_iface(configured, sys_names)
        self._carrier_path = carrier_path(self._iface)
        self._charging_topic = self.get_parameter('charging_topic').value
        self._set_service_name = self.get_parameter(
            'set_allow_motion_service'
        ).value

        self._state = SafetyState(
            override_active=bool(
                self.get_parameter('interlock_override').value
            )
        )
        self._last_disarm_reason: Optional[str] = None
        self._disarm_in_flight = False

        self._cb_group = ReentrantCallbackGroup()

        latched = QoSProfile(
            depth=1,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
            history=HistoryPolicy.KEEP_LAST,
        )
        # /diagnostics — Hangar already subscribes; cockpit_status owns
        # /cockpit/status, so we publish compatible DiagnosticArray entries
        # here rather than competing on that topic.
        self._diag_pub = self.create_publisher(DiagnosticArray, '/diagnostics', 10)
        self._reason_pub = self.create_publisher(
            DiagnosticStatus, '/ugv/safety/status', latched
        )

        self.create_subscription(
            Bool, '/ugv/allow_motion', self._on_allow_motion, latched
        )
        self.create_subscription(
            Bool, self._charging_topic, self._on_charging, 10
        )

        self._set_client = self.create_client(
            SetBool,
            self._set_service_name,
            callback_group=self._cb_group,
        )

        poll_hz = max(0.5, float(self.get_parameter('carrier_poll_hz').value))
        self.create_timer(1.0 / poll_hz, self._tick, callback_group=self._cb_group)

        self.get_logger().info(
            f'ugv_safety_monitor: iface={self._iface} path={self._carrier_path} '
            f'(client of {self._set_service_name}; disables only active locks)'
        )
        if self._state.override_active:
            self.get_logger().warning(
                'interlock_override=true at process startup; physical '
                'ethernet/charging locks will be reported but not enforced'
            )

    def _on_allow_motion(self, msg: Bool):
        self._state.allow_motion = bool(msg.data)
        decision = self._state.evaluate()
        self._publish_status(decision)
        self._enforce(decision)

    def _on_charging(self, msg: Bool):
        self._state.note_charging(bool(msg.data))

    def _tick(self):
        carrier = read_carrier_file(self._carrier_path)
        self._state.ethernet_carrier = carrier
        decision = self._state.evaluate()
        self._publish_status(decision)
        self._enforce(decision)

    def _enforce(self, decision):
        if not decision.should_disarm:
            self._last_disarm_reason = None
            return
        # Already disarmed — nothing to ask. If an operator re-arms while the
        # lock still holds, allow_motion becomes True and we call again.
        if self._state.allow_motion is False:
            return
        if self._disarm_in_flight or not self._set_client.service_is_ready():
            return
        reason = decision.primary_reason
        # While bringup has not published yet, only ask once per reason.
        if (
            self._state.allow_motion is None
            and self._last_disarm_reason == reason
        ):
            return

        req = SetBool.Request()
        req.data = False
        self._disarm_in_flight = True
        self._last_disarm_reason = reason
        self.get_logger().warning(
            f'interlock {reason}: requesting allow_motion=false via '
            f'{self._set_service_name}'
        )
        future = self._set_client.call_async(req)
        future.add_done_callback(self._disarm_done)

    def _disarm_done(self, future):
        self._disarm_in_flight = False
        try:
            result = future.result()
        except Exception as exc:
            self.get_logger().error(f'set_allow_motion call failed: {exc}')
            self._last_disarm_reason = None
            return
        if result is None or not result.success:
            self.get_logger().error(
                f'set_allow_motion rejected: {getattr(result, "message", result)}'
            )
            self._last_disarm_reason = None

    def _publish_status(self, decision):
        status = DiagnosticStatus()
        status.name = 'ugv_safety_monitor'
        status.hardware_id = self._iface
        if decision.should_disarm:
            status.level = DiagnosticStatus.WARN
            status.message = decision.primary_reason
        elif decision.override_active and decision.locks:
            status.level = DiagnosticStatus.WARN
            status.message = f'OVERRIDE active; suppressed {decision.primary_reason}'
        else:
            status.level = DiagnosticStatus.OK
            status.message = LOCK_NONE
        status.values = [
            KeyValue(key=k, value=v) for k, v in diagnostic_values(decision)
        ]
        # Also surface ethernet/charging for Hangar system_metrics parsers.
        status.values.extend([
            KeyValue(
                key='ethernet_connected',
                value=str(self._state.ethernet_carrier is True).lower(),
            ),
            KeyValue(
                key='ethernet_verified',
                value=str(self._state.ethernet_carrier is not None).lower(),
            ),
            KeyValue(
                key='charging',
                value=str(self._state.charging_active is True).lower(),
            ),
        ])

        self._reason_pub.publish(status)

        arr = DiagnosticArray()
        arr.header.stamp = self.get_clock().now().to_msg()
        arr.status = [status]
        self._diag_pub.publish(arr)


def main(args=None):
    rclpy.init(args=args)
    node = SafetyMonitor()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
