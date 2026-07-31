#!/usr/bin/env python3
"""Aggregate cockpit health that no single ROS topic exposes.

Publishes ``/cockpit/status`` (diagnostic_msgs/DiagnosticArray) carrying the
active twist_mux source, the live ``/cmd_vel`` publisher count, disk headroom,
Jetson temperatures, and Wi-Fi RSSI. Using DiagnosticArray avoids shipping a
custom interface package just for a handful of scalars.

Optional inputs (present once the arming PR lands) are consumed if advertised:
``/ugv/allow_motion`` (std_msgs/Bool) and ``/ugv/watchdog_state``
(diagnostic_msgs/DiagnosticStatus). Absent, the node still reports everything it
can measure directly, so the cockpit degrades gracefully rather than blanking.
"""
import shutil

import rclpy
from diagnostic_msgs.msg import DiagnosticArray, DiagnosticStatus, KeyValue
from rclpy.node import Node
from std_msgs.msg import Bool


def _read_first_float(path, scale=1.0, default=0.0):
    try:
        with open(path, 'r') as handle:
            return float(handle.readline().strip()) * scale
    except (OSError, ValueError):
        return default


def _read_wifi_rssi(default=-100.0):
    # /proc/net/wireless line 3+: iface: status link level noise ...
    try:
        with open('/proc/net/wireless', 'r') as handle:
            lines = handle.readlines()
        for line in lines[2:]:
            parts = line.split()
            if len(parts) >= 4:
                # "level" column (index 3) can carry a trailing '.'
                return float(parts[3].rstrip('.'))
    except (OSError, ValueError, IndexError):
        pass
    return default


def _read_jetson_temp(zone_hint, default=0.0):
    # Jetson thermal zones live under /sys/class/thermal/thermal_zone*/temp (millidegC).
    import glob
    for base in glob.glob('/sys/class/thermal/thermal_zone*'):
        try:
            with open(f'{base}/type', 'r') as handle:
                zone_type = handle.read().strip().lower()
            if zone_hint in zone_type:
                return _read_first_float(f'{base}/temp', scale=0.001, default=default)
        except OSError:
            continue
    return default


class CockpitStatus(Node):
    def __init__(self):
        super().__init__('cockpit_status')

        self.declare_parameter('publish_hz', 2.0)
        self.declare_parameter('cmd_vel_topic', '/cmd_vel')
        self.declare_parameter('disk_path', '/')

        self._cmd_vel_topic = self.get_parameter('cmd_vel_topic').value
        self._disk_path = self.get_parameter('disk_path').value

        self._allow_motion = False
        self._watchdog_armed = False
        self._watchdog_fired = False

        self._pub = self.create_publisher(DiagnosticArray, '/cockpit/status', 1)
        self.create_subscription(Bool, '/ugv/allow_motion', self._on_allow, 1)
        self.create_subscription(
            DiagnosticStatus, '/ugv/watchdog_state', self._on_watchdog, 1
        )

        period = 1.0 / max(0.5, float(self.get_parameter('publish_hz').value))
        self.create_timer(period, self._tick)
        self.get_logger().info('cockpit_status: publishing /cockpit/status')

    def _on_allow(self, msg: Bool):
        self._allow_motion = bool(msg.data)

    def _on_watchdog(self, msg: DiagnosticStatus):
        values = {kv.key: kv.value for kv in msg.values}
        self._watchdog_armed = values.get('armed', 'false') == 'true'
        self._watchdog_fired = values.get('fired', 'false') == 'true'

    def _tick(self):
        arr = DiagnosticArray()
        arr.header.stamp = self.get_clock().now().to_msg()

        pub_count = self.count_publishers(self._cmd_vel_topic)
        mux = DiagnosticStatus(name='twist_mux', hardware_id='cmd_vel')
        mux.level = DiagnosticStatus.OK if pub_count <= 1 else DiagnosticStatus.WARN
        mux.message = f'{pub_count} publisher(s) on {self._cmd_vel_topic}'
        # We can count publishers, but without twist_mux diagnostics we do NOT
        # know which source is arbitrating or the true command age. Report those
        # as unknown rather than fabricating a fresh 0.0s — a fake "live" age on
        # a safety strip is exactly the dishonesty the honesty rail exists to
        # prevent. Wire real values here once the twist_mux spine lands.
        mux.values = [
            KeyValue(key='active_source', value='NONE'),
            KeyValue(key='command_age', value='-1'),
            KeyValue(key='publisher_count', value=str(pub_count)),
        ]

        bringup = DiagnosticStatus(name='bringup', hardware_id='ugv_bringup')
        bringup.level = (
            DiagnosticStatus.WARN if self._allow_motion else DiagnosticStatus.OK
        )
        bringup.message = 'motion armed' if self._allow_motion else 'motion locked'
        bringup.values = [
            KeyValue(key='allow_motion', value=str(self._allow_motion).lower()),
        ]

        watchdog = DiagnosticStatus(
            name='cockpit_safety_watchdog', hardware_id='cmd_vel_timeout'
        )
        watchdog.level = (
            DiagnosticStatus.ERROR if self._watchdog_fired else DiagnosticStatus.OK
        )
        watchdog.values = [
            KeyValue(key='armed', value=str(self._watchdog_armed).lower()),
            KeyValue(key='fired', value=str(self._watchdog_fired).lower()),
        ]

        try:
            usage = shutil.disk_usage(self._disk_path)
            disk_free = f'{usage.free / 1e12:.2f} TB'
        except OSError:
            disk_free = 'unknown'

        metrics = DiagnosticStatus(name='system_metrics', hardware_id='jetson')
        metrics.level = DiagnosticStatus.OK
        metrics.values = [
            KeyValue(key='wifi_rssi', value=f'{_read_wifi_rssi():.0f}'),
            KeyValue(key='disk_free', value=disk_free),
            KeyValue(key='cpu_temp', value=f'{_read_jetson_temp("cpu"):.1f}'),
            KeyValue(key='gpu_temp', value=f'{_read_jetson_temp("gpu"):.1f}'),
        ]

        arr.status = [mux, bringup, watchdog, metrics]
        self._pub.publish(arr)


def main(args=None):
    rclpy.init(args=args)
    node = CockpitStatus()
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
