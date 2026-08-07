# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Map INA219 samples to BatteryState / charging_active fields (pure logic).

Keeps ROS message construction out of the math path so Windows/CI pytest can
assert curve, sign, and absent-sensor behavior without rclpy.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

from beast_power.ina219 import Ina219Reading
from beast_power.soc import voltage_to_soc

# sensor_msgs/BatteryState power_supply_status constants
POWER_SUPPLY_STATUS_UNKNOWN = 0
POWER_SUPPLY_STATUS_CHARGING = 1
POWER_SUPPLY_STATUS_DISCHARGING = 2
POWER_SUPPLY_STATUS_NOT_CHARGING = 3
POWER_SUPPLY_STATUS_FULL = 4

# sensor_msgs/BatteryState power_supply_health
POWER_SUPPLY_HEALTH_UNKNOWN = 0
POWER_SUPPLY_HEALTH_GOOD = 1

# sensor_msgs/BatteryState power_supply_technology
POWER_SUPPLY_TECHNOLOGY_LION = 2


@dataclass(frozen=True)
class BatteryTelemetry:
    """Honest fields destined for /ugv/voltage + /ugv/charging_active."""

    voltage: float
    current: float
    percentage: float
    present: bool
    charging_active: bool
    power_supply_status: int
    power_supply_health: int
    power_supply_technology: int
    design_capacity: float
    charge: float
    capacity: float
    temperature: float
    location: str
    serial_number: str


def is_charging(current_a: float, threshold_a: float) -> bool:
    """Sign convention: positive current = charging.

    ``threshold_a`` must be > 0: it is the deadband that keeps shunt noise
    near 0 A from chattering the flag — at threshold 0, an idle 0.0 A sample
    would read as charging. Current at or above +threshold is charging.
    """
    if threshold_a <= 0:
        raise ValueError('charging_current_threshold_a must be > 0')
    return current_a >= threshold_a


def build_telemetry(
    reading: Optional[Ina219Reading],
    *,
    present: bool,
    charging_current_threshold_a: float = 0.05,
    full_soc: float = 0.98,
) -> BatteryTelemetry:
    """Build published fields from a sample, or a deliberate absent status.

    Absent / failed sensor: ``present=False``, status UNKNOWN, percentage NaN,
    charging_active False — never invent a SOC from garbage volts.
    """
    if not present or reading is None:
        return BatteryTelemetry(
            voltage=0.0,
            current=0.0,
            percentage=float('nan'),
            present=False,
            charging_active=False,
            power_supply_status=POWER_SUPPLY_STATUS_UNKNOWN,
            power_supply_health=POWER_SUPPLY_HEALTH_UNKNOWN,
            power_supply_technology=POWER_SUPPLY_TECHNOLOGY_LION,
            design_capacity=float('nan'),
            charge=float('nan'),
            capacity=float('nan'),
            temperature=float('nan'),
            location='driver_board_ina219',
            serial_number='',
        )

    soc = voltage_to_soc(reading.bus_voltage_v)
    charging = is_charging(reading.current_a, charging_current_threshold_a)

    if charging:
        status = POWER_SUPPLY_STATUS_CHARGING
        if soc >= full_soc:
            status = POWER_SUPPLY_STATUS_FULL
    elif reading.current_a <= -charging_current_threshold_a:
        status = POWER_SUPPLY_STATUS_DISCHARGING
    else:
        status = POWER_SUPPLY_STATUS_NOT_CHARGING

    return BatteryTelemetry(
        voltage=float(reading.bus_voltage_v),
        current=float(reading.current_a),
        percentage=float(soc),
        present=True,
        charging_active=charging,
        power_supply_status=status,
        power_supply_health=POWER_SUPPLY_HEALTH_GOOD,
        power_supply_technology=POWER_SUPPLY_TECHNOLOGY_LION,
        design_capacity=float('nan'),
        charge=float('nan'),
        capacity=float('nan'),
        temperature=float('nan'),
        location='driver_board_ina219',
        serial_number='',
    )


def percentage_is_honest_absent(percentage: float) -> bool:
    """True when absent-sensor path left percentage as non-numeric status."""
    return math.isnan(percentage)
