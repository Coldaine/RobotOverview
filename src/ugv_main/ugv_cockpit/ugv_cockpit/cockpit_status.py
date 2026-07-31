#!/usr/bin/env python3
"""Aggregate cockpit health that no single ROS topic exposes.

Publishes ``/cockpit/status`` (diagnostic_msgs/DiagnosticArray) carrying the
active twist_mux source, the live ``/cmd_vel`` publisher count, the arming and
watchdog state, disk headroom, Jetson temperatures, and Wi-Fi RSSI. Using
DiagnosticArray avoids shipping a custom interface package just for a handful
of scalars.

Every name, key and display string comes from :mod:`ugv_cockpit.cockpit_contract`,
which imports nothing from ROS so the wire format can be asserted by a test on
a runner with no rclpy.

WHAT THIS NODE IS
-----------------
An observer. It publishes no velocity, holds no lock, and changes no parameter.
Everything it reports is reconstructed from what it can already see, which is
why the honesty rules below matter — a status panel that guesses is worse than
one that says "unknown".

WHERE EACH FACT COMES FROM
--------------------------
``active_source`` / ``command_age``
    Derived by mirroring twist_mux's arbitration over the four rung topics plus
    the e-stop lock (see :func:`cockpit_contract.resolve_active_source`, whose
    docstring explains why twist_mux's own ``/diagnostics`` output cannot be
    used instead). This is an outside reconstruction: it applies the same rule
    to the same messages, but it is a separate DDS subscriber, so its arrival
    stamps can differ from twist_mux's by delivery jitter.

``allow_motion``, ``armed``, ``fired``
    Mirrored from ``/ugv/allow_motion`` (std_msgs/Bool) and
    ``/ugv/watchdog_state`` (diagnostic_msgs/DiagnosticStatus), both published
    by ugv_bringup, which is the only process that can observe them. If those
    topics go silent — bringup down, or a build without them — the values
    revert to their safe defaults after :data:`BRINGUP_STALE_S` rather than
    latching the last good reading. A cockpit that shows "motion armed" because
    bringup died two minutes ago is worse than one that shows "unknown".

Host metrics
    Read straight off ``/proc`` and ``/sys``. Anything unreadable falls back to
    the value the client itself uses as its "no data" default, and the entry is
    marked WARN with the unreadable metrics named in its message, so the gap is
    visible in ``ros2 topic echo`` as well as in the cockpit.
"""
import shutil
import time

import rclpy
from diagnostic_msgs.msg import DiagnosticArray, DiagnosticStatus, KeyValue
from geometry_msgs.msg import Twist
from rclpy.node import Node
from std_msgs.msg import Bool

from ugv_cockpit.cockpit_contract import (
    ALLOW_MOTION_TOPIC,
    DIAG_BRINGUP,
    DIAG_SYSTEM_METRICS,
    DIAG_TWIST_MUX,
    DIAG_WATCHDOG,
    ESTOP_LOCK_TOPIC,
    EXPECTED_MUX_PUBLISHERS,
    KEY_ACTIVE_SOURCE,
    KEY_ALLOW_MOTION,
    KEY_ARMED,
    KEY_COMMAND_AGE,
    KEY_CPU_TEMP,
    KEY_DISK_FREE,
    KEY_FIRED,
    KEY_GPU_TEMP,
    KEY_PUBLISHER_COUNT,
    KEY_WIFI_RSSI,
    MUX_OUTPUT_TOPIC,
    MUX_SOURCES,
    SOURCE_TIMEOUT_S,
    STATUS_TOPIC,
    WATCHDOG_STATE_TOPIC,
    boolean,
    format_command_age,
    resolve_active_source,
)

# An arming/watchdog message older than this is treated as no message at all.
# Long enough to ride out a missed tick at ugv_bringup's 2 Hz, short enough
# that a dead bringup shows up on the safety strip within a few seconds.
BRINGUP_STALE_S = 3.0

# The values the cockpit client falls back to when a metric key is missing.
# Reusing them keeps an unreadable sensor rendering identically whether the key
# is absent or present-but-unknown, so neither looks like a real measurement.
UNKNOWN_RSSI_DBM = -100.0
UNKNOWN_TEMP_C = 0.0
UNKNOWN_DISK_FREE = 'unknown'


def _read_first_float(path, scale=1.0, default=0.0):
    try:
        with open(path, 'r') as handle:
            return float(handle.readline().strip()) * scale
    except (OSError, ValueError):
        return default


def _read_wifi_rssi(default=None):
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


def _read_jetson_temp(zone_hint, default=None):
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
    """Publish the cockpit's safety summary once or twice a second."""

    def __init__(self):
        super().__init__('cockpit_status')

        self.declare_parameter('publish_hz', 2.0)
        self.declare_parameter('cmd_vel_topic', MUX_OUTPUT_TOPIC)
        self.declare_parameter('disk_path', '/')
        self.declare_parameter('source_timeout_s', SOURCE_TIMEOUT_S)

        self._cmd_vel_topic = self.get_parameter('cmd_vel_topic').value
        self._disk_path = self.get_parameter('disk_path').value
        self._source_timeout_s = float(self.get_parameter('source_timeout_s').value)

        self._allow_motion = False
        self._allow_motion_at = None
        self._watchdog_armed = False
        self._watchdog_fired = False
        self._watchdog_at = None

        # Mux rung observation. time.monotonic() rather than the ROS clock on
        # purpose: these ages are compared against twist_mux's wall-clock
        # expiry, and the panel must keep reporting sensibly if /clock is
        # absent or jumps.
        self._last_command_at = {key: None for key, _, _, _ in MUX_SOURCES}
        self._estop_engaged = False

        self._pub = self.create_publisher(DiagnosticArray, STATUS_TOPIC, 1)
        self.create_subscription(Bool, ALLOW_MOTION_TOPIC, self._on_allow, 1)
        self.create_subscription(
            DiagnosticStatus, WATCHDOG_STATE_TOPIC, self._on_watchdog, 1
        )

        # Read-only taps on the arbitration inputs. Depth 10 and default
        # (reliable) QoS to match the teleop publishers; this node never
        # publishes on any of them.
        self._command_subs = [
            self.create_subscription(
                Twist, topic, self._make_command_callback(key), 10
            )
            for key, topic, _priority, _display in MUX_SOURCES
        ]
        self._estop_sub = self.create_subscription(
            Bool, ESTOP_LOCK_TOPIC, self._on_estop_lock, 10
        )

        period = 1.0 / max(0.5, float(self.get_parameter('publish_hz').value))
        self.create_timer(period, self._tick)
        self.get_logger().info(
            f'cockpit_status: publishing {STATUS_TOPIC}, mirroring '
            f'{len(MUX_SOURCES)} twist_mux rungs + {ESTOP_LOCK_TOPIC}'
        )

    def _make_command_callback(self, key):
        def callback(_msg):
            self._last_command_at[key] = time.monotonic()
        return callback

    def _on_estop_lock(self, msg: Bool):
        # Mirrors twist_mux's LockTopicHandle with timeout 0.0: the last value
        # received latches, and silence never engages the lock.
        self._estop_engaged = bool(msg.data)

    def _on_allow(self, msg: Bool):
        self._allow_motion = bool(msg.data)
        self._allow_motion_at = time.monotonic()

    def _on_watchdog(self, msg: DiagnosticStatus):
        values = {kv.key: kv.value for kv in msg.values}
        self._watchdog_armed = values.get(KEY_ARMED, 'false') == 'true'
        self._watchdog_fired = values.get(KEY_FIRED, 'false') == 'true'
        self._watchdog_at = time.monotonic()

    @staticmethod
    def _is_fresh(stamp):
        return stamp is not None and (time.monotonic() - stamp) <= BRINGUP_STALE_S

    def _tick(self):
        arr = DiagnosticArray()
        arr.header.stamp = self.get_clock().now().to_msg()
        arr.status = [
            self._mux_status(),
            self._bringup_status(),
            self._watchdog_status(),
            self._metrics_status(),
        ]
        self._pub.publish(arr)

    def _mux_status(self):
        display, age = resolve_active_source(
            time.monotonic(),
            self._last_command_at,
            self._estop_engaged,
            self._source_timeout_s,
        )
        pub_count = self.count_publishers(self._cmd_vel_topic)

        mux = DiagnosticStatus(name=DIAG_TWIST_MUX, hardware_id='cmd_vel')
        # More than one publisher on the mux output means something bypassed
        # arbitration; zero means twist_mux is not running and nothing can drive.
        mux.level = (
            DiagnosticStatus.OK if pub_count == EXPECTED_MUX_PUBLISHERS
            else DiagnosticStatus.WARN
        )
        mux.message = (
            f'{display}, {pub_count} publisher(s) on {self._cmd_vel_topic}'
        )
        mux.values = [
            KeyValue(key=KEY_ACTIVE_SOURCE, value=display),
            KeyValue(key=KEY_COMMAND_AGE, value=format_command_age(age)),
            KeyValue(key=KEY_PUBLISHER_COUNT, value=str(pub_count)),
        ]
        return mux

    def _bringup_status(self):
        fresh = self._is_fresh(self._allow_motion_at)
        allow_motion = fresh and self._allow_motion

        bringup = DiagnosticStatus(name=DIAG_BRINGUP, hardware_id='ugv_bringup')
        if not fresh:
            bringup.level = DiagnosticStatus.WARN
            bringup.message = (
                f'no {ALLOW_MOTION_TOPIC} in {BRINGUP_STALE_S:.0f}s — '
                'reporting motion locked'
            )
        else:
            bringup.level = (
                DiagnosticStatus.WARN if allow_motion else DiagnosticStatus.OK
            )
            bringup.message = 'motion armed' if allow_motion else 'motion locked'
        bringup.values = [
            KeyValue(key=KEY_ALLOW_MOTION, value=boolean(allow_motion)),
        ]
        return bringup

    def _watchdog_status(self):
        fresh = self._is_fresh(self._watchdog_at)
        armed = fresh and self._watchdog_armed
        fired = fresh and self._watchdog_fired

        watchdog = DiagnosticStatus(
            name=DIAG_WATCHDOG, hardware_id='cmd_vel_timeout'
        )
        if fired:
            watchdog.level = DiagnosticStatus.ERROR
            watchdog.message = 'cmd_vel watchdog stopped the robot'
        elif not fresh:
            watchdog.level = DiagnosticStatus.WARN
            watchdog.message = (
                f'no {WATCHDOG_STATE_TOPIC} in {BRINGUP_STALE_S:.0f}s — '
                'watchdog state unknown'
            )
        else:
            watchdog.level = DiagnosticStatus.OK
            watchdog.message = 'watchdog armed' if armed else 'no live command to watch'
        watchdog.values = [
            KeyValue(key=KEY_ARMED, value=boolean(armed)),
            KeyValue(key=KEY_FIRED, value=boolean(fired)),
        ]
        return watchdog

    def _metrics_status(self):
        rssi = _read_wifi_rssi()
        cpu_temp = _read_jetson_temp('cpu')
        gpu_temp = _read_jetson_temp('gpu')
        try:
            usage = shutil.disk_usage(self._disk_path)
            disk_free = f'{usage.free / 1e12:.2f} TB'
        except OSError:
            disk_free = None

        unreadable = [
            key for key, value in (
                (KEY_WIFI_RSSI, rssi),
                (KEY_DISK_FREE, disk_free),
                (KEY_CPU_TEMP, cpu_temp),
                (KEY_GPU_TEMP, gpu_temp),
            ) if value is None
        ]

        metrics = DiagnosticStatus(name=DIAG_SYSTEM_METRICS, hardware_id='jetson')
        # WARN, not OK-with-a-plausible-number: an unreadable thermal zone that
        # publishes 0.0 reads as a cold SoC, which is the exact dishonesty the
        # honesty rail exists to prevent. The value still goes out (the client
        # needs a parseable string) but the entry says it is not a measurement.
        metrics.level = (
            DiagnosticStatus.WARN if unreadable else DiagnosticStatus.OK
        )
        metrics.message = (
            'unreadable: ' + ', '.join(unreadable) if unreadable
            else 'all host metrics readable'
        )
        metrics.values = [
            KeyValue(
                key=KEY_WIFI_RSSI,
                value=f'{UNKNOWN_RSSI_DBM if rssi is None else rssi:.0f}',
            ),
            KeyValue(
                key=KEY_DISK_FREE,
                value=UNKNOWN_DISK_FREE if disk_free is None else disk_free,
            ),
            KeyValue(
                key=KEY_CPU_TEMP,
                value=f'{UNKNOWN_TEMP_C if cpu_temp is None else cpu_temp:.1f}',
            ),
            KeyValue(
                key=KEY_GPU_TEMP,
                value=f'{UNKNOWN_TEMP_C if gpu_temp is None else gpu_temp:.1f}',
            ),
        ]
        return metrics


def main(args=None):
    """Spin the aggregator until interrupted."""
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
