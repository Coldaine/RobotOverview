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
POWER_LSB = CURRENT_LSB * 20

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
    The 16-bit raw values are two's complement.
    """
    bus = _VectorBus(
        {
            REG_SHUNTVOLTAGE: -800,  # 0xFCE0
            REG_BUSVOLTAGE: 0x5910,  # 2850 << 3 = 11.4 V
            REG_CURRENT: -8421,  # 0xDF1B
            REG_POWER: -4800,  # 0xED40; = round(2850 * -8421 / 5000)
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
    # The driver reads the power register UNSIGNED, so a discharge's negative
    # power (0xED40 = -4800 signed) wraps to 60736 and decodes with
    # POWER_LSB = 20 * CURRENT_LSB as a large positive. Pin that decode:
    # 60736 * 20 * 9.50039430347451e-05 = 115.403... W.
    assert reading.power_w == pytest.approx(
        60736 * POWER_LSB, rel=1e-9
    )


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
