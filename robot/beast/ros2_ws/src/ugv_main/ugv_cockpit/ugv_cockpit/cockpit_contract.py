"""The ``/cockpit/status`` wire contract — importable without ROS.

Every string the browser cockpit switches on lives here as a module-level
constant, and the rules the cockpit's ROS nodes apply live here as pure
functions: twist_mux arbitration and safety-state staleness for
``cockpit_status``, and the websocket origin policy for ``cockpit_rosbridge``.
Nothing in this module imports rclpy, numpy, cv2 or rosbridge, so
test/test_cockpit_status_contract.py can assert the exact bytes and exercise
the real decision functions on a bare CI runner with no ROS installed.

That is why the origin policy lives in a "wire contract" module rather than
next to the monkeypatch that installs it: a security rule nothing can execute
in CI is a security rule nothing checks.

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

DIAG_TWIST_MUX = 'twist_mux'
DIAG_BRINGUP = 'bringup'
DIAG_SYSTEM_METRICS = 'system_metrics'

DIAG_NAMES = (
    DIAG_TWIST_MUX,
    DIAG_BRINGUP,
    DIAG_SYSTEM_METRICS,
)

# ---------------------------------------------------------------------------
# KeyValue keys, per entry. Every value crosses the wire as a string.
# ---------------------------------------------------------------------------
KEY_ACTIVE_SOURCE = 'active_source'
KEY_COMMAND_AGE = 'command_age'
KEY_PUBLISHER_COUNT = 'publisher_count'

KEY_ALLOW_MOTION = 'allow_motion'

KEY_WIFI_RSSI = 'wifi_rssi'
KEY_DISK_FREE = 'disk_free'
KEY_CPU_TEMP = 'cpu_temp'
KEY_GPU_TEMP = 'gpu_temp'

DIAG_KEYS = {
    DIAG_TWIST_MUX: (KEY_ACTIVE_SOURCE, KEY_COMMAND_AGE, KEY_PUBLISHER_COUNT),
    DIAG_BRINGUP: (KEY_ALLOW_MOTION,),
    DIAG_SYSTEM_METRICS: (KEY_WIFI_RSSI, KEY_DISK_FREE, KEY_CPU_TEMP, KEY_GPU_TEMP),
}

# Booleans cross the wire as these exact lowercase strings — the client tests
# ``values.armed === 'true'``, which Python's ``str(True)`` would fail.
TRUE = 'true'
FALSE = 'false'

# Topics ugv_bringup publishes so this node can report allow_motion honestly
# instead of guessing from the outside.
ALLOW_MOTION_TOPIC = '/ugv/allow_motion'


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

# twist_mux's per-source expiry — the same number on purpose for all rungs,
# see config/twist_mux.yaml.
SOURCE_TIMEOUT_S = 0.5

# An arming message older than this is treated as no message at all.
# Long enough to ride out a missed tick at ugv_bringup's 2 Hz, short enough that
# a dead bringup shows up on the safety strip within a few seconds. Lives here
# rather than in cockpit_status so the decay rule can be exercised with an
# injected clock on a runner with no rclpy.
BRINGUP_STALE_S = 3.0


def is_fresh(now, stamp, stale_s=BRINGUP_STALE_S):
    """Is a mirrored safety-state stamp still worth believing?

    ``stamp`` is ``None`` until the first message arrives, which is NOT fresh:
    a cockpit that has never heard from ugv_bringup must show that it does not
    know, not a default. Both arguments are on the caller's clock — no time
    source is read here, so a test can drive the decay deterministically.
    """
    return stamp is not None and (now - stamp) <= stale_s


# ---------------------------------------------------------------------------
# ABSENCE IS A VALUE. The builder below returns NO PAIRS AT ALL until a
# real message has been mirrored, and goes back to returning none once that
# message ages past BRINGUP_STALE_S.
#
# This is a wire-level distinction, not a cosmetic one. The client renders a
# MISSING key as "unknown" and a PRESENT key as a reading it can trust, so
# emitting `allow_motion: 'false'` before ugv_bringup has ever spoken is the
# cockpit stating, confidently, a fact it does not have — on a robot where
# these publishers simply are not deployed yet, the strip reads a definite
# LOCKED / OFF-LINE and never once says "I cannot see the robot".
#
# 'false' is the conservative rendering, which is exactly what makes it
# dangerous: it looks correct, so nobody investigates. Same rule the host
# metrics already follow (an unreadable thermal zone must not render as a cold
# SoC) and the same rule ugv_bringup follows in publishing what it ENFORCES
# rather than what was configured. Missing data gets reported as missing.
#
# The entry itself stays in the array either way, with WARN and a message
# naming the silent topic, so the gap is visible in `ros2 topic echo` too.
# ---------------------------------------------------------------------------
def bringup_key_values(now, stamp, allow_motion, stale_s=BRINGUP_STALE_S):
    """(key, value) pairs for the ``bringup`` entry. Empty when not fresh."""
    if not is_fresh(now, stamp, stale_s):
        return ()
    return ((KEY_ALLOW_MOTION, boolean(allow_motion)),)


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
    twist_mux's internals at all.

    Why mirror instead of reading twist_mux's own ``/diagnostics`` (corrected
    against ros-teleop/twist_mux, ``humble`` branch — an earlier revision of
    this docstring got both of these facts wrong):

      * ``updateDiagnostics`` runs on a 1 Hz wall timer
        (``DIAGNOSTICS_PERIOD = 1s`` in twist_mux_diagnostics.hpp), NOT only
        when a command arrives. It does not go stale on silence.
      * ``getLockPriority()`` returns 255 while the estop lock is engaged and 0
        otherwise, so lock-engaged and idle ARE distinguishable.

    The real reasons the diagnostics cannot drive a safety strip:

      * ``current priority`` is the LOCK priority, not the winning source's.
        It carries no information about which velocity rung holds the floor —
        the single fact ``active_source`` exists to report. Four rungs all map
        to the same published number.
      * The per-topic ``velocity <name>`` keys do expose masked/unmasked, but
        only at 1 Hz and only as formatted human-readable strings. That is half
        the rate of this node's 2 Hz publish (so the strip would lag its own
        cadence by a whole tick) and it would make the cockpit's arbitration
        display depend on parsing upstream's diagnostic prose, which is not a
        wire contract and can be reworded in any release.

    Mirroring the documented arbitration rule over the same topics is coarser
    in no dimension and does not depend on upstream's presentation strings.
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


# ---------------------------------------------------------------------------
# WEBSOCKET ORIGIN POLICY
#
# "Only reachable over the tailnet" does NOT gate a browser. Verified against
# RobotWebTools/rosbridge_suite, ``humble`` branch (the source ros-humble-
# rosbridge-suite is built from), rosbridge_server/src/rosbridge_server/
# websocket_handler.py:
#
#     @log_exceptions
#     def check_origin(self, origin: str) -> bool:  # noqa: ARG002
#         return True
#
# Tornado calls check_origin on every WebSocket handshake and upstream accepts
# unconditionally. WebSocket handshakes are ALSO exempt from the same-origin
# policy — there is no CORS preflight, and a cross-origin ``new WebSocket(...)``
# is not blocked by the browser. So any web page loaded in any tab on a
# tailnet-joined machine can open wss:// to the robot and start publishing.
# Reachability gates the NETWORK; it does not gate the PAGE.
#
# What that actually buys an attacker here is bounded by the publish glob:
# /cmd_vel_ui is mux rung 50, outranked by both the robot-side pad (150) and
# the operator pad (100), and still gated by allow_motion. So
# the ladder holds and this is not an arbitration bypass.
#
# POLICY: the tailnet is the perimeter. ``tailscale serve`` is the only way in,
# and anyone who can reach the tailnet already has the operator's trust level.
# So an UNSET allowlist accepts every browser origin — upstream behavior — and
# COCKPIT_ALLOWED_ORIGINS exists only as an OPTIONAL restrict-to-list for an
# operator who wants to name specific origins. There is no fail-closed default
# to trip over: unset means it just works.
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS_ENV = 'COCKPIT_ALLOWED_ORIGINS'


def parse_allowed_origins(raw):
    """Parse the comma-separated allowlist into a normalised tuple.

    Origins are compared case-insensitively and without a trailing slash,
    because that is how browsers serialise the ``Origin`` header
    (``scheme://host[:port]``, no path).
    """
    if not raw:
        return ()
    return tuple(
        item.strip().rstrip('/').lower()
        for item in raw.split(',')
        if item.strip()
    )


def origin_is_allowed(origin, allowlist):
    """Decide one WebSocket handshake. Replaces upstream's ``return True``.

    The tailnet is the perimeter: ``tailscale serve`` is the only path in, so
    anyone presenting an Origin here has already reached the operator's trust
    level. An EMPTY ALLOWLIST therefore accepts every browser origin (upstream
    behavior). A NON-EMPTY allowlist restricts to the named origins — an
    optional hardening knob, not a required configuration.

    Args:
        origin: the ``Origin`` header, or ``None`` when absent.
        allowlist: normalised origins from :func:`parse_allowed_origins`.
    """
    if not allowlist:
        return True
    if origin is None or not origin.strip():
        return True
    return origin.strip().rstrip('/').lower() in allowlist
