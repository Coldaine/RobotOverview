# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Datasheet vectors: raw INA219 registers -> engineering values, literal math.

The rest of the suite drives a fake bus that round-trips through the SAME
constants the driver uses, so a wrong constant cancels out — a 10x RSHUNT
error survived for weeks because of exactly that circularity (see
``test_shunt_calibration``). Every constant in this file is written LITERALLY,
never imported from ``ina219.py``, and the vectors are pushed through the real
driver decode path (``Ina219.read`` on a bus that returns these literal raw
register bytes). A wrong driver constant fails here even though the fake-bus
round-trip stays green.
"""

from __future__ import annotations

import struct

import pytest

from beast_power import ina219
from beast_power.ina219 import Ina219

# --- Literal constants, by hand from the INA219 datasheet ----------------
# Calibration register:  calibration = 0.04096 / (LSB_target * RSHUNT)
#     = 0.04096 / (95e-6 A/bit * 0.010 ohm) = 43115.79... -> 43115 (0xA86B).
#     Bit 0 is not writable on the INA219, so the programmed value is masked
#     even: 43114 = 0xA86A. The resulting LSB is ~95 uA/bit.
CALIBRATION_REG_VALUE = 0xA86A
CURRENT_LSB = 0.04096 / (CALIBRATION_REG_VALUE * 0.010)

# Register numbers (INA219 datasheet table 2), written out literally.
REG_SHUNTVOLTAGE = 0x01
REG_BUSVOLTAGE = 0x02
REG_POWER = 0x03
REG_CURRENT = 0x04


class _VectorBus:
    """Minimal SMBus stand-in returning this file's literal raw registers.

    Config/calibration writes are accepted and ignored; the four measurement
    registers are the fixed literals each vector test provides.
    """

    def __init__(self, registers: dict[int, int]) -> None:
        self._registers = registers

    def open(self, bus_nr: int) -> None:
        pass

    def close(self) -> None:
        pass

    def write_i2c_block_data(self, address, register, data) -> None:
        pass

    def read_i2c_block_data(self, address, register, length):
        raw = self._registers[register]
        return list(struct.pack('>H', raw & 0xFFFF))


def test_bus_voltage_register_decodes_4mv_per_bit():
    """11.4 V: ADC value 2850 (0x0B22) left-shifted 3 bits -> 0x5910.

    Bits 2..0 of the bus-voltage register are the conversion-ready flag, not
    part of the ADC value: 0x5916 is 0x5910 with junk low bits set and must
    decode to the same 11.4 V (2850 * 0.004 V/bit). A wrong LSB or a missing
    ``>> 3`` fails this vector.
    """
    bus = _VectorBus(
        {
            REG_SHUNTVOLTAGE: 0x0000,
            REG_BUSVOLTAGE: 0x5916,
            REG_CURRENT: 0x0000,
            REG_POWER: 0x0000,
        }
    )
    sensor = Ina219(bus, 0x41)
    sensor.open(7)
    reading = sensor.read()

    assert reading.bus_voltage_v == pytest.approx(11.4, rel=1e-9)
    assert reading.shunt_voltage_v == 0.0
    assert reading.current_a == 0.0


def test_signed_shunt_and_current_registers_discharge_case():
    """-0.8 A discharge: shunt reg -800 (0xFCE0), current reg -8421 (0xDF1B).

    Shunt voltage = -800 * 10 uV/bit = -0.008 V; I = V_shunt / RSHUNT
    = -0.008 / 0.010 ohm = -0.8 A. The chip derives the current register as
    round(shunt_raw * calibration / 4096) = round(-800 * 0xA86A / 4096)
    = -8421, so decoding the current register must agree with the shunt.
    Power = V_bus * I = 11.4 * -0.8 = -9.12 W -> raw round(-9.12 /
    POWER_LSB) = -4800; the chip's power register is unsigned and wraps, so
    the raw value on the wire is the two's complement 0xED40. Shunt/current
    raw values are two's complement too.
    """
    bus = _VectorBus(
        {
            REG_SHUNTVOLTAGE: -800,  # 0xFCE0
            REG_BUSVOLTAGE: 0x5910,  # 2850 << 3 = 11.4 V
            REG_CURRENT: -8421,  # 0xDF1B
            REG_POWER: -4800,  # 0xED40; wrapped two's complement of -9.12 W
        }
    )
    sensor = Ina219(bus, 0x41)
    sensor.open(7)
    reading = sensor.read()

    assert reading.shunt_voltage_v == pytest.approx(-0.008, rel=1e-9)
    # Chip law: I = V_shunt / RSHUNT, RSHUNT = 0.010 ohm literal.
    assert reading.current_a == pytest.approx(-0.8, abs=1e-4)
    assert reading.shunt_voltage_v / 0.010 == pytest.approx(
        reading.current_a, abs=1e-4
    )
    # The raw current register is negative, so the wrapped power raw 0xED40
    # unwraps to -4800 and decodes with POWER_LSB = 20 * CURRENT_LSB as
    # -4800 * 20 * 9.50039430347451e-05 = -9.1204 W. A straight unsigned
    # decode (the pre-fix behavior) would read 0xED40 as +115.4 W — this
    # vector fails against that.
    assert reading.power_w == pytest.approx(-9.12, abs=1e-3)
    assert reading.power_w < 0


def test_power_register_charge_case_decodes_positive():
    """+0.4 A charge @ 12.3 V: power = +4.92 W, raw 2589 (0x0A1D).

    The positive/charge direction must decode positive — same decode path
    as the discharge vector, mirrored sign. Derivation: 4.92 / POWER_LSB
    = 4.92 / (20 * 9.50039430347451e-05) = 2589.4... -> 2589 (0x0A1D).
    """
    bus = _VectorBus(
        {
            REG_SHUNTVOLTAGE: 400,  # 0x0190; +0.4 A * 0.010 ohm = 4 mV
            REG_BUSVOLTAGE: 0x6018,  # 3075 << 3 = 12.3 V
            REG_CURRENT: 4210,  # 0x1072; round(0.4 / 9.50039430347451e-05)
            REG_POWER: 2589,  # 0x0A1D
        }
    )
    sensor = Ina219(bus, 0x41)
    sensor.open(7)
    reading = sensor.read()

    assert reading.bus_voltage_v == pytest.approx(12.3, rel=1e-9)
    assert reading.current_a == pytest.approx(0.4, abs=1e-4)
    assert reading.power_w > 0
    assert reading.power_w == pytest.approx(4.92, abs=1e-3)


def test_power_high_positive_raw_stays_positive_with_positive_current():
    """Raw >= 0x8000 with NON-negative current is a legit large positive.

    Power full scale at the 32 V bus range exceeds 0x7FFF (this vector: 35200
    = 0x8980 -> 66.88 W), so the high bit alone must not mean "negative".
    Only a negative CURRENT register unwraps the power raw. A straight signed
    decode (raw 0x8980 -> -27648) would corrupt this to -52.5 W.
    Derivation: current raw 22000 (0x55F0) at bus ADC 8000 (32.0 V);
    power_raw = round(8000 * 22000 / 5000) = 35200 (0x8980).
    """
    bus = _VectorBus(
        {
            REG_SHUNTVOLTAGE: 2090,  # 0x082A; ~2.09 A * 0.010 ohm / 10 uV
            REG_BUSVOLTAGE: 0xFA00,  # 8000 << 3 = 32.0 V
            REG_CURRENT: 22000,  # 0x55F0; round(2.0901 / 9.50039430347451e-05)
            REG_POWER: 0x8980,  # 35200; round(8000 * 22000 / 5000)
        }
    )
    sensor = Ina219(bus, 0x41)
    sensor.open(7)
    reading = sensor.read()

    assert reading.bus_voltage_v == pytest.approx(32.0, rel=1e-9)
    assert reading.current_a == pytest.approx(2.09, abs=1e-3)
    assert reading.power_w > 0
    assert reading.power_w == pytest.approx(66.88, abs=0.01)


def test_current_sign_flip_flips_current_and_power_together():
    """current_sign=-1 (reversed shunt): current AND power flip signs together.

    Same raw registers as the discharge vector — the unwrap keys off the raw
    current register, not the convention — so current_a goes +0.8 A and
    power_w +9.12 W consistently. A decode that applied current_sign to
    current but not to power would leave the two disagreeing.
    """
    bus = _VectorBus(
        {
            REG_SHUNTVOLTAGE: -800,  # 0xFCE0
            REG_BUSVOLTAGE: 0x5910,  # 2850 << 3 = 11.4 V
            REG_CURRENT: -8421,  # 0xDF1B
            REG_POWER: -4800,  # 0xED40; wrapped two's complement of -9.12 W
        }
    )
    sensor = Ina219(bus, 0x41, current_sign=-1.0)
    sensor.open(7)
    reading = sensor.read()

    assert reading.current_a == pytest.approx(0.8, abs=1e-4)
    assert reading.power_w > 0
    assert reading.power_w == pytest.approx(9.12, abs=1e-3)


def test_calibration_register_matches_datasheet_formula():
    """The driver's calibration and LSB must equal the literal derivation.

    0.04096 / (95 uA/bit * 0.010 ohm) = 43115.79... -> 0xA86B, masked even
    (bit 0 not writable) -> 0xA86A. That gives a ~95 uA/bit LSB and a signed
    16-bit full scale of ~+/-3.11 A, covering the ~1.4 A idle logic-rail draw
    measured 2026-08-07.
    """
    assert ina219.CALIBRATION_REG_VALUE == CALIBRATION_REG_VALUE
    assert ina219.CURRENT_LSB == pytest.approx(CURRENT_LSB, rel=1e-12)
    assert CURRENT_LSB == pytest.approx(0.000095, rel=1e-3)
    assert 32767 * CURRENT_LSB == pytest.approx(3.1129942014194927, rel=1e-12)
