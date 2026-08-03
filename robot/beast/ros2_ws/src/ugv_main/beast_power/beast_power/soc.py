# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""3S Li-ion state-of-charge from pack bus voltage.

Curve source (document in-code per PR-2a):
  Piecewise-linear open-circuit voltage (OCV) model for a typical NMC/Li-ion
  cell, scaled ×3 for a series-3 pack. Cell knees follow widely published
  resting OCV tables (≈4.20 V = 100 % … ≈3.00 V = 0 %), not a pack-specific
  fuel-gauge calibration from BEAST-01. Under load the bus sags and SOC will
  read low; under charge it reads high — that is expected for OCV-only SOC
  until Wave 2 compares against the 2026-07-31 ~8.8 V brownout and refines
  the table from logged samples.

This module is pure Python (no rclpy / smbus) so CI and Windows pytest can
exercise it without ROS.
"""

from __future__ import annotations

import math

# (pack_voltage_V, soc_fraction 0..1), sorted ascending by voltage.
# Cell × 3: 3.00 → 9.00 V … 4.20 → 12.60 V.
_3S_OCV_SOC: tuple[tuple[float, float], ...] = (
    (9.00, 0.00),
    (9.60, 0.01),
    (9.90, 0.04),
    (10.20, 0.08),
    (10.50, 0.15),
    (10.80, 0.25),
    (11.10, 0.40),
    (11.40, 0.55),
    (11.70, 0.70),
    (12.00, 0.80),
    (12.30, 0.90),
    (12.60, 1.00),
)

# Nominal full-charge pack voltage used by the legacy fake % (V/12.6).
PACK_FULL_V = 12.6
PACK_EMPTY_V = 9.0


def voltage_to_soc(voltage_v: float) -> float:
    """Map pack bus volts to SOC fraction in [0, 1] via the 3S OCV table.

    Values outside the table clamp to 0 or 1. Linear interpolation between
    knots. Does not invent a reading for a missing sensor — callers must not
    call this when ``present`` is false.
    """
    if math.isnan(voltage_v):
        return math.nan
    if voltage_v <= _3S_OCV_SOC[0][0]:
        return 0.0
    if voltage_v >= _3S_OCV_SOC[-1][0]:
        return 1.0

    for i in range(1, len(_3S_OCV_SOC)):
        v0, s0 = _3S_OCV_SOC[i - 1]
        v1, s1 = _3S_OCV_SOC[i]
        if voltage_v <= v1:
            t = (voltage_v - v0) / (v1 - v0)
            return s0 + t * (s1 - s0)

    return 1.0


def legacy_fake_percentage(voltage_v: float) -> float:
    """Reproduce ugv_bringup's fake V/12.6 field for brownout comparisons."""
    return float(voltage_v) / PACK_FULL_V
