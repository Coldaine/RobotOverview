# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Unit tests for ugv_safety_monitor pure interlock logic (no ROS graph)."""

from pathlib import Path

from ugv_cockpit.safety_logic import (
    LOCK_CHARGING,
    LOCK_ETHERNET,
    LOCK_NONE,
    SafetyState,
    carrier_path,
    diagnostic_values,
    read_carrier_file,
    resolve_ethernet_iface,
)


def test_resolve_ethernet_prefers_configured():
    assert resolve_ethernet_iface('enP8p1s0', ['eth0', 'enP8p1s0']) == 'enP8p1s0'


def test_resolve_ethernet_falls_back_to_eth0_then_en():
    assert resolve_ethernet_iface('', ['lo', 'wl0', 'eth0']) == 'eth0'
    assert resolve_ethernet_iface('', ['lo', 'enP8p1s0', 'wl0']) == 'enP8p1s0'
    assert resolve_ethernet_iface('', ['lo', 'wl0']) == 'eth0'


def test_carrier_path():
    assert carrier_path('enP8p1s0') == '/sys/class/net/enP8p1s0/carrier'


def test_read_carrier_file(tmp_path):
    carrier = tmp_path / 'carrier'
    carrier.write_text('1\n', encoding='ascii')
    assert read_carrier_file(str(carrier)) is True
    carrier.write_text('0\n', encoding='ascii')
    assert read_carrier_file(str(carrier)) is False
    assert read_carrier_file(str(tmp_path / 'missing')) is None


def test_ethernet_carrier_requests_disarm():
    state = SafetyState(ethernet_carrier=True)
    decision = state.evaluate()
    assert decision.should_disarm is True
    assert decision.primary_reason == LOCK_ETHERNET
    assert decision.locks == (LOCK_ETHERNET,)


def test_absent_charging_topic_does_not_lock():
    state = SafetyState(ethernet_carrier=False)
    decision = state.evaluate()
    assert decision.should_disarm is False
    assert decision.primary_reason == LOCK_NONE
    assert LOCK_CHARGING not in decision.locks


def test_charging_active_locks_when_topic_seen():
    state = SafetyState()
    state.note_charging(True)
    decision = state.evaluate()
    assert decision.should_disarm is True
    assert decision.primary_reason == LOCK_CHARGING


def test_charging_false_clears_lock():
    state = SafetyState()
    state.note_charging(True)
    state.note_charging(False)
    decision = state.evaluate()
    assert decision.should_disarm is False
    assert decision.primary_reason == LOCK_NONE


def test_override_suppresses_disarm_but_keeps_reason():
    state = SafetyState(ethernet_carrier=True, override_active=True)
    decision = state.evaluate()
    assert decision.should_disarm is False
    assert decision.override_active is True
    assert decision.primary_reason == LOCK_ETHERNET
    assert decision.locks == (LOCK_ETHERNET,)


def test_ethernet_priority_over_charging():
    state = SafetyState(ethernet_carrier=True)
    state.note_charging(True)
    decision = state.evaluate()
    assert decision.primary_reason == LOCK_ETHERNET
    assert decision.locks == (LOCK_ETHERNET, LOCK_CHARGING)


def test_clearing_carrier_does_not_auto_arm():
    """Locks clear → should_disarm false; caller must NOT set allow_motion true."""
    state = SafetyState(ethernet_carrier=True, allow_motion=False)
    assert state.evaluate().should_disarm is True
    state.ethernet_carrier = False
    decision = state.evaluate()
    assert decision.should_disarm is False
    assert decision.primary_reason == LOCK_NONE
    # State machine leaves allow_motion untouched — still false.
    assert state.allow_motion is False


def test_diagnostic_values_include_lock_reason():
    state = SafetyState(ethernet_carrier=True)
    values = dict(diagnostic_values(state.evaluate()))
    assert values['lock_reason'] == LOCK_ETHERNET
    assert values['ethernet_lock'] == 'true'
    assert values['should_disarm'] == 'true'


def test_safety_monitor_is_client_not_authority():
    monitor_src = Path(__file__).resolve().parents[1] / 'ugv_cockpit' / 'safety_monitor.py'
    text = monitor_src.read_text(encoding='utf-8')
    assert '/ugv/set_allow_motion' in text
    assert 'create_client' in text
    assert "req.data = False" in text
    # Must never publish allow_motion itself or default-arm.
    assert "create_publisher(\n            Bool, '/ugv/allow_motion'" not in text
    assert 'allow_motion' not in text or 'allow_motion=false' in text.lower() or \
        'client of' in text
    assert 'Does NOT auto-arm' in text or 'does not auto-arm' in text.lower()


def test_bringup_launch_defaults_disarmed_and_wires_monitor():
    launch = (
        Path(__file__).resolve().parents[2]
        / 'ugv_bringup'
        / 'launch'
        / 'bringup_lidar.launch.py'
    )
    text = launch.read_text(encoding='utf-8')
    assert "'allow_motion', default_value='false'" in text
    assert 'ugv_safety_monitor' in text
    assert 'use_safety_monitor' in text
