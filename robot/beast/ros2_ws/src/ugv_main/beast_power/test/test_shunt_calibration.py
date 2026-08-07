# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Pin the verified shunt value and the calibration it implies.

The rest of the suite drives a fake bus that round-trips through the same
``RSHUNT`` the driver uses, so it stays green for *any* value — which is
exactly how a 10x error survived from the inherited LeoRover default until an
energy-balance check caught it on 2026-08-07. These tests assert the physical
constant itself.
"""

from __future__ import annotations

from beast_power import ina219


def test_rshunt_matches_the_board():
    """R010 on the driver board beside the INA219 = 0.010 ohm.

    Verified from the board image, not inherited. If a future board revision
    changes the sense resistor, this is the assertion that should fail first.
    """
    assert ina219.RSHUNT == 0.01


def test_rshunt_is_not_the_leorover_default():
    """0.1 was wrong by 10x and made every current/mAh/Wh one tenth of truth."""
    assert ina219.RSHUNT != 0.1


def test_calibration_register_fits_16_bits():
    """The INA219 calibration register is 16 bits; overflow silently wraps.

    Lowering RSHUNT raises this value, so it is the constraint that bites when
    someone corrects the shunt downward.
    """
    assert 0 < ina219.CALIBRATION_REG_VALUE <= 0xFFFF
    # Bit 0 is not writable — the driver masks it off.
    assert ina219.CALIBRATION_REG_VALUE % 2 == 0


def test_current_lsb_close_to_target():
    """Quantising the calibration register must not move the LSB much."""
    assert ina219.CURRENT_LSB == float(
        f'{0.04096 / (ina219.CALIBRATION_REG_VALUE * ina219.RSHUNT):.17g}'
    )
    assert abs(ina219.CURRENT_LSB - ina219.CURRENT_LSB_TARGET) < 1e-6


def test_current_full_scale_covers_measured_idle_draw():
    """Signed 16-bit full scale must exceed the ~1.4 A idle draw.

    Measured 2026-08-07: ~1.45 A on battery with the full stack up. Drive loads
    may exceed the resulting +/-3.11 A ceiling — see the CURRENT_LSB_TARGET note
    in ina219.py — but idle and discharge logging must never saturate.
    """
    full_scale_a = 32767 * ina219.CURRENT_LSB
    assert full_scale_a > 2.0


def test_power_lsb_follows_datasheet_ratio():
    assert ina219.POWER_LSB == ina219.CURRENT_LSB * 20
