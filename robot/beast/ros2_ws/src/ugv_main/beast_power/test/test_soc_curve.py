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


def test_deep_discharge_is_low_soc_not_fake_percent():
    """A deeply discharged pack: honest SOC ~0 while fake V/12.6 still reads ~70%."""
    v = 8.8
    assert voltage_to_soc(v) == pytest.approx(0.0)
    fake = legacy_fake_percentage(v)
    assert fake == pytest.approx(8.8 / 12.6, abs=1e-6)
    assert fake > 0.6  # the lie that HonestyRail calls out


def test_nan_voltage_never_reports_full_soc():
    assert math.isnan(voltage_to_soc(math.nan))


def test_legacy_fake_percentage_nan_stays_nan():
    """Pin current behavior: NaN in -> NaN out. A future 'fix' that clamps
    garbage volts to 0/1 would fabricate a percentage for a failed sensor —
    the exact lie this field was replaced to remove."""
    assert math.isnan(legacy_fake_percentage(math.nan))


@pytest.mark.parametrize('bad', [float('inf'), float('-inf'), float('nan')])
def test_non_finite_voltage_returns_nan(bad):
    """Garbage volts must not clamp to 0/1: +inf currently reports '100 %
    battery', -inf '0 %'. Any non-finite input is a failed measurement, so it
    returns NaN like NaN does — never a fabricated SOC."""
    assert math.isnan(voltage_to_soc(bad))


# The 12 OCV knots written out literally, independent of _3S_OCV_SOC, so a
# silent table edit (value, count, or order) fails this file's assertions
# instead of self-validating against the edited table.
_OCV_KNOTS = (
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


@pytest.mark.parametrize('voltage,expected', _OCV_KNOTS)
def test_ocv_table_knot_is_exact(voltage, expected):
    """Exact knot voltage must map to the exact knot SOC — interpolation and
    the clamp bounds (first/last knot) both return the pinned value."""
    assert voltage_to_soc(voltage) == pytest.approx(expected)


def test_ocv_table_is_strictly_sorted_ascending():
    from beast_power.soc import _3S_OCV_SOC

    # Count pinned explicitly so adding/removing a knot is a test failure.
    assert len(_3S_OCV_SOC) == len(_OCV_KNOTS) == 12
    voltages = [v for v, _ in _3S_OCV_SOC]
    assert all(v < nxt for v, nxt in zip(voltages, voltages[1:]))
