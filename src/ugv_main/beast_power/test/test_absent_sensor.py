# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Sensor-absent path publishes status, not garbage SOC."""

from __future__ import annotations

import math
from types import SimpleNamespace

import pytest

from beast_power.ina219 import FakeSMBus, Ina219
from beast_power.power_node import PowerNode
from beast_power.telemetry import (
    POWER_SUPPLY_STATUS_UNKNOWN,
    build_telemetry,
    percentage_is_honest_absent,
)


def test_absent_build_telemetry_is_status_not_soc():
    tel = build_telemetry(None, present=False)
    assert tel.present is False
    assert tel.charging_active is False
    assert tel.power_supply_status == POWER_SUPPLY_STATUS_UNKNOWN
    assert tel.voltage == 0.0
    assert tel.current == 0.0
    assert percentage_is_honest_absent(tel.percentage)
    assert math.isnan(tel.percentage)


def test_fake_bus_absent_open_fails_cleanly():
    bus = FakeSMBus(absent=True)
    sensor = Ina219(bus, 0x40)
    with pytest.raises(OSError):
        sensor.open(7)


def test_fake_bus_absent_read_fails_after_force_open_regs():
    """Mid-run disappearance: ensure_ready / read raise OSError, no invented V."""
    bus = FakeSMBus(bus_voltage_v=12.0, current_a=0.0, absent=False)
    sensor = Ina219(bus, 0x40)
    sensor.open(7)
    assert sensor.ensure_ready() is True

    bus.absent = True
    assert sensor.ensure_ready() is False
    with pytest.raises(OSError):
        sensor.read()


def test_absent_never_uses_zero_volts_as_empty_pack_soc():
    """0.0 V with present=False must not look like a drained pack at 0 % SOC."""
    tel = build_telemetry(None, present=False)
    # Callers must gate on present / isnan — not treat percentage as 0.0.
    assert not (tel.present is False and tel.percentage == 0.0)
    assert math.isnan(tel.percentage)


def test_power_node_retries_initial_open_after_backoff(monkeypatch):
    clock = {'now': 100.0}
    monkeypatch.setattr(
        'beast_power.power_node.time.monotonic', lambda: clock['now']
    )
    bus = FakeSMBus(absent=True)
    node = object.__new__(PowerNode)
    node._sensor = Ina219(bus, 0x40)
    node._sensor_ok = False
    node._i2c_bus_nr = 7
    node._sensor_address = 0x40
    node._rate_hz = 1.0
    node._reconnect_interval_sec = 5.0
    node._next_open_attempt = 0.0
    node.get_logger = lambda: SimpleNamespace(
        error=lambda *_args, **_kwargs: None,
        info=lambda *_args, **_kwargs: None,
    )

    assert node._try_open_sensor() is False
    bus.absent = False
    clock['now'] = 104.9
    assert node._try_open_sensor() is False
    clock['now'] = 105.0
    assert node._try_open_sensor() is True
    assert node._sensor_ok is True
