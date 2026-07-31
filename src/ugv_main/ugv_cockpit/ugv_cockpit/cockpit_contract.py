"""The ``/cockpit/status`` wire contract — importable without ROS.

Every string the browser cockpit switches on lives here as a module-level
constant, and the rule ``cockpit_status`` uses to reproduce twist_mux's
arbitration lives here as a pure function. Nothing in this module imports
rclpy, numpy or cv2, so test/test_cockpit_status_contract.py can assert the
exact bytes on a bare CI runner with no ROS installed.

The indirection is the point: the display strings are compared with ``===`` on
the client (SafetyStrip.tsx, CommandRail.tsx in Coldaine/RobotOverview), so a
typo does not degrade gracefully — the UI falls straight through to its "NONE"
rendering and shows an idle command source on a robot that is driving.

Source of truth for the names and keys: ``src/lib/ros/client.ts`` in
Coldaine/RobotOverview, the ``/cockpit/status`` branch of its message handler.
"""
import math

# ---------------------------------------------------------------------------
# DiagnosticArray entry names (DiagnosticStatus.name)
# ---------------------------------------------------------------------------
STATUS_TOPIC = '/cockpit/status'

DIAG_WATCHDOG = 'cockpit_safety_watchdog'
DIAG_TWIST_MUX = 'twist_mux'
DIAG_BRINGUP = 'bringup'
DIAG_SYSTEM_METRICS = 'system_metrics'

DIAG_NAMES = (
    DIAG_WATCHDOG,
    DIAG_TWIST_MUX,
    DIAG_BRINGUP,
    DIAG_SYSTEM_METRICS,
)

# ---------------------------------------------------------------------------
# KeyValue keys, per entry. Every value crosses the wire as a string.
# ---------------------------------------------------------------------------
KEY_ARMED = 'armed'
KEY_FIRED = 'fired'

KEY_ACTIVE_SOURCE = 'active_source'
KEY_COMMAND_AGE = 'command_age'
KEY_PUBLISHER_COUNT = 'publisher_count'

KEY_ALLOW_MOTION = 'allow_motion'

KEY_WIFI_RSSI = 'wifi_rssi'
KEY_DISK_FREE = 'disk_free'
KEY_CPU_TEMP = 'cpu_temp'
KEY_GPU_TEMP = 'gpu_temp'

DIAG_KEYS = {
    DIAG_WATCHDOG: (KEY_ARMED, KEY_FIRED),
    DIAG_TWIST_MUX: (KEY_ACTIVE_SOURCE, KEY_COMMAND_AGE, KEY_PUBLISHER_COUNT),
    DIAG_BRINGUP: (KEY_ALLOW_MOTION,),
    DIAG_SYSTEM_METRICS: (KEY_WIFI_RSSI, KEY_DISK_FREE, KEY_CPU_TEMP, KEY_GPU_TEMP),
}

# Booleans cross the wire as these exact lowercase strings — the client tests
# ``values.armed === 'true'``, which Python's ``str(True)`` would fail.
TRUE = 'true'
FALSE = 'false'

# Topics ugv_bringup publishes so this node can report armed / fired /
# allow_motion honestly instead of guessing from the outside.
ALLOW_MOTION_TOPIC = '/ugv/allow_motion'
WATCHDOG_STATE_TOPIC = '/ugv/watchdog_state'


def boolean(value):
    """Render a Python bool as the exact string the client compares against."""
    return TRUE if value else FALSE


# ---------------------------------------------------------------------------
# active_source display strings.
#
# DISPLAY strings, not topic names: the client renders them verbatim and
# compares them with ``===``. SOURCE_JOY_ROBOT contains U+00B7 MIDDLE DOT
# (UTF-8 0xC2 0xB7) between "pad" and "robot" — not a period, not a bullet
# (U+2022), not a katakana middle dot (U+30FB). The contract test pins the
# exact codepoint.
# ---------------------------------------------------------------------------
SOURCE_ESTOP = 'E-STOP lock'
SOURCE_JOY_ROBOT = 'BT pad · robot'
SOURCE_JOY_OPERATOR = 'Operator pad'
SOURCE_UI = 'UI teleop'
SOURCE_NAV = 'nav2'
SOURCE_NONE = 'NONE'

# One rung of the ladder: (key, topic, priority, display string). Highest
# priority first — resolve_active_source returns on the first live rung, so the
# order is load-bearing. Mirrors config/twist_mux.yaml exactly; the contract
# test cross-checks this table against that YAML so the two cannot drift. A
# rung added there without a display string here would surface in the cockpit
# as "NONE" while that rung drives the robot.
MUX_SOURCES = (
    ('joy_robot', 'cmd_vel_joy_robot', 150, SOURCE_JOY_ROBOT),
    ('joy_operator', 'cmd_vel_joy_operator', 100, SOURCE_JOY_OPERATOR),
    ('ui', 'cmd_vel_ui', 50, SOURCE_UI),
    ('nav', 'cmd_vel_nav', 10, SOURCE_NAV),
)

# std_msgs/Bool lock topic. Engaged (``data: true``) masks every source whose
# priority is below ESTOP_LOCK_PRIORITY, which is all of them.
ESTOP_LOCK_TOPIC = 'cmd_vel_estop_lock'
ESTOP_LOCK_PRIORITY = 255

# twist_mux's per-source expiry, and ugv_bringup's watchdog period. The same
# number on purpose — see config/twist_mux.yaml.
SOURCE_TIMEOUT_S = 0.5

# The topic twist_mux publishes on, i.e. the one whose publisher count the
# cockpit renders as "/cmd_vel publishers". Exactly 1 is healthy.
MUX_OUTPUT_TOPIC = '/cmd_vel'
EXPECTED_MUX_PUBLISHERS = 1

# ``command_age`` when nothing is driving. The client maps any negative value
# to a "—" placeholder rather than rendering "0.00 s", which would read as a
# command that arrived this instant.
NO_COMMAND_AGE = '-1'


def format_command_age(age_s):
    """Render a command age for the wire, or the no-command sentinel.

    ``None`` and non-finite ages both render as :data:`NO_COMMAND_AGE`. There
    is deliberately no "0" fallback: a fabricated zero is indistinguishable
    from a command that landed a millisecond ago.
    """
    if age_s is None or not math.isfinite(age_s):
        return NO_COMMAND_AGE
    return '%.3f' % max(0.0, float(age_s))


def resolve_active_source(now, last_command_at, estop_engaged,
                          timeout_s=SOURCE_TIMEOUT_S):
    """Reproduce twist_mux's arbitration from the outside.

    Mirrors ``TwistMux::hasPriority`` (twist_mux.cpp, humble branch): the
    winner is the highest-priority source that is neither expired nor masked by
    an engaged lock, where "expired" means no message within ``timeout_s``.

    Args:
        now: monotonic seconds, on the same clock as ``last_command_at``.
        last_command_at: rung key -> arrival time of its last message, or
            ``None``/absent when that rung has never published.
        estop_engaged: last value seen on the lock topic. The lock ships with
            ``timeout: 0.0``, so twist_mux latches the last received value and
            never engages on silence; this mirrors that, including the initial
            "no message ever received" state, which is RELEASED.
        timeout_s: per-source expiry.

    Returns:
        ``(display_string, age_of_winning_command_or_None)``. The age is
        ``None`` whenever no source is driving, the engaged-lock case included:
        nothing is on the floor, so there is no command age to report.

    Honesty note: this is an OBSERVER's reconstruction, not twist_mux's own
    state. cockpit_status is a separate DDS subscriber, so its arrival stamps
    can differ from twist_mux's by message-delivery jitter, and it cannot see
    twist_mux's internals at all. twist_mux's own ``/diagnostics`` output does
    not close that gap: it publishes ``current priority`` as a bare integer
    that (a) is refreshed only inside ``hasPriority``, i.e. when a command
    arrives, so it goes stale rather than falling to zero when every source
    stops, and (b) collapses to 0 both for "nothing active" and for "lock
    engaged, all sources masked" — the two states the cockpit most needs to
    tell apart.
    """
    if estop_engaged:
        return SOURCE_ESTOP, None

    for key, _topic, _priority, display in MUX_SOURCES:
        stamp = last_command_at.get(key)
        if stamp is None:
            continue
        age = now - stamp
        if age > timeout_s:
            continue
        return display, age

    return SOURCE_NONE, None
