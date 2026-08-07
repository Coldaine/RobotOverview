#!/usr/bin/env python3
"""Aggregate cockpit health that no single ROS topic exposes.

Publishes ``/cockpit/status`` (diagnostic_msgs/DiagnosticArray) carrying the
active twist_mux source, the live ``/cmd_vel`` publisher count, the arming
state, disk headroom, Jetson temperatures, and Wi-Fi RSSI. Using
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

``allow_motion``
    Mirrored from ``/ugv/allow_motion`` (std_msgs/Bool), published
    by ugv_bringup, which is the only process that can observe it.

    This key is OMITTED ENTIRELY until the first real message arrives,
    and omitted again once the last one ages past :data:`BRINGUP_STALE_S`. The
    client renders a missing key as "unknown" and a present one as a reading it
    can trust, so publishing ``false`` before ugv_bringup has ever spoken would
    have the strip stating a fact it does not have — and stating the
    conservative-looking one, which is what makes it dangerous: on a robot
    where these publishers are not deployed yet, the panel reads a confident
    LOCKED / OFF-LINE and never once says "I cannot see the robot". The entry
    itself stays in the array with WARN and a message naming the silent topic.

    CROSS-REPO — THESE TWO HALVES MUST STAY IN LOCKSTEP. Omitting a key is only
    honest if the consumer renders absence as UNKNOWN; a client that defaults a
    missing key to ``false`` would turn this into the same confident lie by a
    different route, and one that defaults it to ``true`` would be far worse.
    The matching client behaviour (absent key -> UNKNOWN, and the drive gate
    keyed on the robot-reported ``allow_motion``) is MERGED on RobotOverview
    main in #148/#149. Do not change the omission rule here without checking
    that repo, and do not "simplify" it back to always emitting the keys.

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
from rclpy.qos import DurabilityPolicy, HistoryPolicy, QoSProfile
from std_msgs.msg import Bool

from ugv_cockpit.cockpit_contract import (
    ALLOW_MOTION_TOPIC,
    BRINGUP_STALE_S,
    DIAG_BRINGUP,
    DIAG_SYSTEM_METRICS,
    DIAG_TWIST_MUX,
    ESTOP_LOCK_TOPIC,
    EXPECTED_MUX_PUBLISHERS,
    KEY_ACTIVE_SOURCE,
    KEY_COMMAND_AGE,
    KEY_CPU_TEMP,
    KEY_DISK_FREE,
    KEY_GPU_TEMP,
    KEY_PUBLISHER_COUNT,
    KEY_WIFI_RSSI,
    MUX_OUTPUT_TOPIC,
    MUX_SOURCES,
    SOURCE_TIMEOUT_S,
    STATUS_TOPIC,
    bringup_key_values,
    format_command_age,
    is_fresh,
    resolve_active_source,
)

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

        # Mux rung observation uses this node's ROS clock, because these stamps
        # are compared against twist_mux's own expiry and twist_mux stamps with
        # rclcpp's Node::now(). Agreeing with the arbiter we claim to mirror is
        # the entire reason; there is no other.
        self._last_command_at = {key: None for key, _, _, _ in MUX_SOURCES}
        self._estop_engaged = False

        self._pub = self.create_publisher(DiagnosticArray, STATUS_TOPIC, 1)
        safety_qos = QoSProfile(
            depth=1,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
            history=HistoryPolicy.KEEP_LAST,
        )
        self.create_subscription(
            Bool, ALLOW_MOTION_TOPIC, self._on_allow, safety_qos
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
            self._last_command_at[key] = self._now_s()
        return callback

    def _on_estop_lock(self, msg: Bool):
        # Mirrors twist_mux's LockTopicHandle with timeout 0.0: the last value
        # received latches, and silence never engages the lock.
        self._estop_engaged = bool(msg.data)

    def _on_allow(self, msg: Bool):
        self._allow_motion = bool(msg.data)
        self._allow_motion_at = self._liveness_now_s()

    def _now_s(self):
        """ROS clock — for the arbitration mirror ONLY.

        twist_mux stamps arrivals with rclcpp's ``Node::now()`` and expires
        rungs against it, so the mirror has to read the same clock or it will
        disagree with the arbiter it exists to reproduce.
        """
        return self.get_clock().now().nanoseconds / 1_000_000_000.0

    def _liveness_now_s(self):
        """Monotonic — for "is ugv_bringup still talking to me".

        Deliberately NOT the ROS clock. These stamps have no twist_mux
        counterpart to agree with; they answer a pure elapsed-time question,
        and the ROS clock is the system clock, which the RTC-less Jetson lets
        chrony STEP once it reaches a time source. A step backwards would make
        a live bringup look stale and blank the safety strip; a step forwards
        would do it for BRINGUP_STALE_S seconds' worth of readings at once.
        time.monotonic() cannot step.

        The mirror accepts that risk knowingly, because agreeing with twist_mux
        matters more there. Here there is nothing to agree with, so there is no
        reason to take it.
        """
        return time.monotonic()

    def _is_fresh(self, stamp):
        """Staleness decay, delegated to the ROS-free rule in the contract."""
        return is_fresh(self._liveness_now_s(), stamp, BRINGUP_STALE_S)

    def _tick(self):
        arr = DiagnosticArray()
        arr.header.stamp = self.get_clock().now().to_msg()
        arr.status = [
            self._mux_status(),
            self._bringup_status(),
            self._metrics_status(),
        ]
        self._pub.publish(arr)

    def _mux_status(self):
        display, age = resolve_active_source(
            self._now_s(),
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
        # '(mirrored)' is on the wire on purpose: this entry is named
        # `twist_mux` but is NOT published by twist_mux, and anyone reading
        # `ros2 topic echo /diagnostics` deserves to know they are looking at an
        # outside reconstruction rather than the arbiter's own account of
        # itself. The client renders the keys, not this string, so saying so
        # costs nothing and breaks nothing.
        mux.message = (
            f'{display}, {pub_count} publisher(s) on {self._cmd_vel_topic} '
            '(mirrored)'
        )
        mux.values = [
            KeyValue(key=KEY_ACTIVE_SOURCE, value=display),
            KeyValue(key=KEY_COMMAND_AGE, value=format_command_age(age)),
            KeyValue(key=KEY_PUBLISHER_COUNT, value=str(pub_count)),
        ]
        return mux

    def _bringup_status(self):
        now = self._liveness_now_s()
        fresh = is_fresh(now, self._allow_motion_at)
        allow_motion = fresh and self._allow_motion

        bringup = DiagnosticStatus(name=DIAG_BRINGUP, hardware_id='ugv_bringup')
        if not fresh:
            bringup.level = DiagnosticStatus.WARN
            bringup.message = (
                f'no {ALLOW_MOTION_TOPIC} in {BRINGUP_STALE_S:.0f}s — '
                'allow_motion UNKNOWN, key omitted'
            )
        else:
            # OK either way. An armed robot is a normal, intended operating
            # state, not a fault, and publishing WARN for it has two costs:
            # every session that actually drives sits at WARN from the moment
            # motion is enabled, which is how operators learn to stop reading
            # the colour; and any consumer that aggregates DiagnosticStatus
            # levels (rqt_robot_monitor, an alerting rule, a future summary
            # entry) inherits that permanent WARN and can no longer surface a
            # real one. The arming state is what `allow_motion` and the message
            # are for — the LEVEL is reserved for "something is wrong".
            bringup.level = DiagnosticStatus.OK
            bringup.message = 'motion armed' if allow_motion else 'motion locked'
        # No key at all until ugv_bringup has actually said something, and none
        # again once it goes quiet — see bringup_key_values. 'false' here would
        # be the cockpit asserting a fact it does not have.
        bringup.values = [
            KeyValue(key=key, value=value)
            for key, value in bringup_key_values(
                now, self._allow_motion_at, self._allow_motion
            )
        ]
        return bringup

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
