# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""3S OCV SOC curve math — no hardware, no ROS."""

from __future__ import annotations

import math
import pytest

from beast_power.soc import legacy_fake_percentage, voltage_to_soc


def test_full_and_empty_clamp():
    assert voltage_to_soc(12.6) == pytest.approx(1.0)
    assert voltage_to_soc(13.0) == pytest.approx(1.0)
    assert voltage_to_soc(9.0) == pytest.approx(0.0)
    assert voltage_to_soc(8.0) == pytest.approx(0.0)


def test_nominal_pack_is_mid_curve():
    # 11.1 V ≈ 3.7 V/cell → ~40 % on the documented OCV table.
    assert voltage_to_soc(11.1) == pytest.approx(0.40, abs=0.01)


def test_interpolation_between_knots():
    # Midpoint 12.0–12.3 V → midway 0.80–0.90.
    mid = voltage_to_soc(12.15)
    assert mid == pytest.approx(0.85, abs=0.02)


def test_brownout_voltage_is_low_soc_not_fake_percent():
    """2026-07-31 ~8.8 V incident: honest SOC is ~0, fake V/12.6 still looks ok."""
    v = 8.8
    assert voltage_to_soc(v) == pytest.approx(0.0)
    fake = legacy_fake_percentage(v)
    assert fake == pytest.approx(8.8 / 12.6, abs=1e-6)
    assert fake > 0.6  # the lie that HonestyRail calls out


def test_nan_voltage_never_reports_full_soc():
    assert math.isnan(voltage_to_soc(math.nan))
