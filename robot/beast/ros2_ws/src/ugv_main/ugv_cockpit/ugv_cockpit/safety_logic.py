# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Pure interlock logic for ugv_safety_monitor (no ROS imports).

ugv_bringup owns allow_motion. This module only decides *whether* the monitor
should ask bringup to disarm, and which reason code to publish. It never
auto-arms — that stays illegal until the crawl+kill re-gate passes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Optional, Sequence, Tuple

LOCK_ETHERNET = 'ETHERNET_LOCK'
LOCK_CHARGING = 'CHARGING_LOCK'
LOCK_NONE = 'NONE'

# Priority when multiple locks are active (first wins for the UI string).
LOCK_PRIORITY = (LOCK_ETHERNET, LOCK_CHARGING)


def read_carrier_file(path: str) -> Optional[bool]:
    """Return True/False from a sysfs carrier file, or None if unreadable."""
    try:
        with open(path, 'r', encoding='ascii') as handle:
            raw = handle.read().strip()
    except OSError:
        return None
    if raw == '1':
        return True
    if raw == '0':
        return False
    return None


def resolve_ethernet_iface(
    configured: str,
    sys_net_names: Sequence[str],
) -> str:
    """Pick the ethernet iface to poll for carrier.

    Prefer an explicit name; otherwise eth0, then the first en* name.
    """
    if configured:
        return configured
    names = list(sys_net_names)
    if 'eth0' in names:
        return 'eth0'
    for name in sorted(names):
        if name.startswith('en'):
            return name
    return 'eth0'


def carrier_path(iface: str) -> str:
    return f'/sys/class/net/{iface}/carrier'


@dataclass
class SafetyDecision:
    """Result of one interlock evaluation."""

    locks: Tuple[str, ...] = ()
    primary_reason: str = LOCK_NONE
    should_disarm: bool = False
    override_active: bool = False


@dataclass
class SafetyState:
    """Latched interlock inputs. Unknown carrier is unsafe; default disarmed."""

    ethernet_carrier: Optional[bool] = None
    charging_active: Optional[bool] = None
    override_active: bool = False
    # Observed allow_motion from bringup (None until first message).
    allow_motion: Optional[bool] = None
    _seen_charging_topic: bool = field(default=False, repr=False)

    def note_charging(self, active: bool) -> None:
        self._seen_charging_topic = True
        self.charging_active = bool(active)

    def evaluate(self) -> SafetyDecision:
        locks = []
        # Missing interface, unreadable sysfs, and malformed carrier values are
        # all uncertainty about a physical interlock and therefore fail closed.
        if self.ethernet_carrier is not False:
            locks.append(LOCK_ETHERNET)
        # Absent charging topic → no lock (fail-open; default disarmed is the guard).
        if self._seen_charging_topic and self.charging_active is True:
            locks.append(LOCK_CHARGING)

        ordered = tuple(lock for lock in LOCK_PRIORITY if lock in locks)
        primary = ordered[0] if ordered else LOCK_NONE
        should_disarm = bool(ordered) and not self.override_active
        return SafetyDecision(
            locks=ordered,
            primary_reason=primary,
            should_disarm=should_disarm,
            override_active=bool(self.override_active),
        )


def diagnostic_values(decision: SafetyDecision) -> Iterable[Tuple[str, str]]:
    """Key/value pairs for a DiagnosticStatus the Hangar can render."""
    yield ('lock_reason', decision.primary_reason)
    yield ('locks', ','.join(decision.locks) if decision.locks else LOCK_NONE)
    yield ('override', str(decision.override_active).lower())
    yield ('should_disarm', str(decision.should_disarm).lower())
    yield ('ethernet_lock', str(LOCK_ETHERNET in decision.locks).lower())
    yield ('charging_lock', str(LOCK_CHARGING in decision.locks).lower())
