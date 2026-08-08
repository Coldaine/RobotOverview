# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
#
# Adapted from LeoRover leo_robot-ros2 `leo_bringup/scripts/charging_monitor`
# (MIT, https://github.com/LeoRover/leo_robot-ros2 — 9 stars, ros2 branch,
# charging_monitor merged Dec 2025). Vendored and adapted for BEAST-01:
# injectable bus for fake-bus unit tests, BatteryState/charging topics live
# in power_node.py — this module is the INA219 register layer only.
"""INA219 register access over an SMBus-compatible interface."""

from __future__ import annotations

import struct
from dataclasses import dataclass
from typing import Optional, Protocol, Sequence


CONFIG_VOLTAGE_RANGE_32V = 0b1
CONFIG_GAIN_DIV_8_320MV = 0b11
CONFIG_ADCRES_12BIT_128S = 0b1111
CONFIG_SHUNT_BUS_CONTINUOUS = 0x07
CONFIG_REG_VALUE = (
    (CONFIG_VOLTAGE_RANGE_32V << 13)
    | (CONFIG_GAIN_DIV_8_320MV << 11)
    | (CONFIG_ADCRES_12BIT_128S << 7)
    | (CONFIG_ADCRES_12BIT_128S << 3)
    | CONFIG_SHUNT_BUS_CONTINUOUS
)

SHUNT_VOLTAGE_LSB = 0.00001  # 10 uV / bit
BUS_VOLTAGE_LSB = 0.004  # 4 mV / bit

# 0.010 ohms — VERIFIED 2026-08-07 from the board itself: the sense resistor
# beside the INA219 at the DC 9-12.6 V input is marked "R010" (= 0.010 ohm).
# See public/datacore/beast-driver-board-callouts.png callout 4 and the source
# photo keyArtifactstosort/rawDriverBoardshot.jpg.
#
# The previous value, 0.1, was an inherited LeoRover default and was wrong by
# exactly 10x. It was caught by an energy-balance contradiction: the INA219
# claimed the pack delivered 1.36 W while tegrastats showed the Jetson alone
# drawing VDD_IN 4.74 W on battery, with no other source connected. Bus
# voltage is unaffected — it uses the chip-fixed 4 mV/bit LSB and never
# passes through the shunt.
#
# SCOPE (traced board connectivity, ros_driver_path_edges.csv PWR-E003 +
# PWR-E013..E020): this shunt sits ONLY in the buck/5-V branch — Jetson,
# LiDAR, ESP32, logic. The motor (TB1/TB2 VM), bus-servo (H7/H8) and IO-load
# (J1–J4) branches all tap DC_IN BEFORE R21, so their current never crosses
# this sensor at any RSHUNT value. Currents/mAh/Wh here are the logic-rail
# truth, not the whole-pack truth; a capacity run is only valid while EVERY
# bypassed branch is idle (motors still, servos holding no torque, IO loads
# off). Motor current has no sensor on this board.
RSHUNT = 0.01
# 95 uA/bit gives a signed-16-bit full scale of only +/-3.11 A. That covers
# the ~1.4 A idle logic-rail draw measured 2026-08-07 with headroom; the
# motor branches bypass the shunt entirely (see scope note), so drive loads
# are NOT the saturation risk — a spiking 5-V-rail load (Jetson transients +
# peripherals) is. Raise this (0.0002 -> +/-6.55 A) if rail current ever
# nears the ceiling; left as-is for resolution on the idle/discharge series.
CURRENT_LSB_TARGET = 0.000095
# Raw calibration must fit 16 bits BEFORE masking (bit 0 is not writable).
# A future smaller shunt or finer LSB target grows this value; wrapping it
# silently would corrupt every reading, so fail loudly instead.
_CALIBRATION_RAW = int(0.04096 / (CURRENT_LSB_TARGET * RSHUNT))
if _CALIBRATION_RAW > 0xFFFF:
    raise ValueError(
        f'INA219 calibration 0x{_CALIBRATION_RAW:X} exceeds 16 bits for '
        f'RSHUNT={RSHUNT} at CURRENT_LSB_TARGET={CURRENT_LSB_TARGET}'
    )
CALIBRATION_REG_VALUE = _CALIBRATION_RAW & 0xFFFE
CURRENT_LSB = 0.04096 / (CALIBRATION_REG_VALUE * RSHUNT)
POWER_LSB = CURRENT_LSB * 20

REG_CONFIG = 0x00
REG_SHUNTVOLTAGE = 0x01
REG_BUSVOLTAGE = 0x02
REG_POWER = 0x03
REG_CURRENT = 0x04
REG_CALIBRATION = 0x05


class SMBusLike(Protocol):
    """Minimal smbus2.SMBus surface used by Ina219."""

    def open(self, bus_nr: int) -> None: ...

    def close(self) -> None: ...

    def write_i2c_block_data(
        self, address: int, register: int, data: Sequence[int]
    ) -> None: ...

    def read_i2c_block_data(
        self, address: int, register: int, length: int
    ) -> list[int]: ...


@dataclass(frozen=True)
class Ina219Reading:
    shunt_voltage_v: float
    bus_voltage_v: float
    current_a: float
    power_w: float


class Ina219:
    """LeoRover-style INA219 driver with an injectable bus."""

    def __init__(
        self,
        bus: SMBusLike,
        sensor_address: int = 0x40,
        *,
        current_sign: float = 1.0,
    ) -> None:
        """Create a driver.

        ``current_sign`` flips the raw INA219 current so that published
        amperes follow the BEAST convention: **positive = charging**.
        Set to ``-1.0`` if the UPS shunt orientation reports the opposite.
        """
        self._bus = bus
        self.sensor_address = int(sensor_address)
        self.current_sign = float(current_sign)
        self._opened = False

    def open(self, bus_nr: int) -> None:
        # Guard against double-open: re-opening without closing first would
        # leak the previous bus fd (smbus2 does not close on re-open).
        self.close()
        self._bus.open(bus_nr)
        self._opened = True
        try:
            self._write_reg16(REG_CONFIG, CONFIG_REG_VALUE)
            self._write_reg16(REG_CALIBRATION, CALIBRATION_REG_VALUE)
        except OSError:
            self.close()
            raise

    def close(self) -> None:
        if self._opened:
            self._bus.close()
            self._opened = False

    def ensure_ready(self) -> bool:
        """Re-apply config/calibration after a soft reset. False on I²C fail.

        A short/garbled read buffer raises ``struct.error`` from the unpack,
        not ``OSError`` — that is still an I²C failure, so it lands on the
        same False path instead of crashing the caller's publish tick.
        """
        try:
            config = self._read_reg16_u(REG_CONFIG)
            calib = self._read_reg16_u(REG_CALIBRATION)
        except (OSError, struct.error):
            return False

        if config != CONFIG_REG_VALUE or calib != CALIBRATION_REG_VALUE:
            try:
                self._write_reg16(REG_CONFIG, CONFIG_REG_VALUE)
                self._write_reg16(REG_CALIBRATION, CALIBRATION_REG_VALUE)
            except OSError:
                return False
        return True

    def read(self) -> Ina219Reading:
        shunt_raw = self._read_reg16_s(REG_SHUNTVOLTAGE)
        bus_reg = self._read_reg16_u(REG_BUSVOLTAGE)
        current_raw = self._read_reg16_s(REG_CURRENT)
        # Power register: the datasheet defines it as unsigned, so a discharge's
        # negative power WRAPS to a large positive on the chip. Decode it signed
        # (same two's complement as the current register) to restore the
        # physical sign — negative on discharge, positive on charge.
        power_raw = self._read_reg16_s(REG_POWER)

        return Ina219Reading(
            shunt_voltage_v=shunt_raw * SHUNT_VOLTAGE_LSB,
            bus_voltage_v=(bus_reg >> 3) * BUS_VOLTAGE_LSB,
            current_a=current_raw * CURRENT_LSB * self.current_sign,
            power_w=power_raw * POWER_LSB,
        )

    def _write_reg16(self, register: int, value: int) -> None:
        data = struct.pack('>H', value & 0xFFFF)
        self._bus.write_i2c_block_data(
            self.sensor_address, register, list(data)
        )

    def _read_reg16_u(self, register: int) -> int:
        data = self._bus.read_i2c_block_data(self.sensor_address, register, 2)
        return struct.unpack('>H', bytes(data))[0]

    def _read_reg16_s(self, register: int) -> int:
        data = self._bus.read_i2c_block_data(self.sensor_address, register, 2)
        return struct.unpack('>h', bytes(data))[0]


class FakeSMBus:
    """In-memory I²C bus for unit tests (no hardware, no smbus2)."""

    def __init__(
        self,
        *,
        bus_voltage_v: float = 12.0,
        current_a: float = 0.0,
        absent: bool = False,
    ) -> None:
        self.bus_voltage_v = bus_voltage_v
        self.current_a = current_a
        self.absent = absent
        self.opened_bus: Optional[int] = None
        self.closed = False
        self.close_count = 0
        self._regs: dict[int, int] = {
            REG_CONFIG: 0,
            REG_CALIBRATION: 0,
            REG_SHUNTVOLTAGE: 0,
            REG_BUSVOLTAGE: 0,
            REG_CURRENT: 0,
            REG_POWER: 0,
        }
        self._sync_measurement_regs()

    def open(self, bus_nr: int) -> None:
        if self.absent:
            raise OSError('FakeSMBus: no such device')
        self.opened_bus = int(bus_nr)
        self.closed = False

    def close(self) -> None:
        self.closed = True
        self.close_count += 1

    def write_i2c_block_data(
        self, address: int, register: int, data: Sequence[int]
    ) -> None:
        self._raise_if_absent()
        value = struct.unpack('>H', bytes(data[:2]))[0]
        self._regs[register] = value

    def read_i2c_block_data(
        self, address: int, register: int, length: int
    ) -> list[int]:
        self._raise_if_absent()
        if register in (REG_SHUNTVOLTAGE, REG_BUSVOLTAGE, REG_CURRENT, REG_POWER):
            self._sync_measurement_regs()
        value = self._regs.get(register, 0) & 0xFFFF
        packed = struct.pack('>H', value)
        return list(packed[:length])

    def set_reading(self, bus_voltage_v: float, current_a: float) -> None:
        self.bus_voltage_v = bus_voltage_v
        self.current_a = current_a
        self._sync_measurement_regs()

    def _raise_if_absent(self) -> None:
        if self.absent:
            raise OSError('FakeSMBus: I2C transfer failed (sensor absent)')

    def _sync_measurement_regs(self) -> None:
        # Bus voltage register: bits 15..3 hold the ADC value.
        bus_raw = int(round(self.bus_voltage_v / BUS_VOLTAGE_LSB))
        self._regs[REG_BUSVOLTAGE] = (bus_raw & 0x1FFF) << 3

        current_raw = int(round(self.current_a / CURRENT_LSB))
        current_raw = max(-32768, min(32767, current_raw))
        self._regs[REG_CURRENT] = current_raw & 0xFFFF

        # Approximate shunt from I·R for completeness.
        shunt_v = self.current_a * RSHUNT
        shunt_raw = int(round(shunt_v / SHUNT_VOLTAGE_LSB))
        shunt_raw = max(-32768, min(32767, shunt_raw))
        self._regs[REG_SHUNTVOLTAGE] = shunt_raw & 0xFFFF

        # Power register: the chip's register is unsigned and WRAPS for
        # negative (discharge) power, so emit the same two's complement the
        # silicon would — raw = round(power / POWER_LSB) masked to 16 bits.
        # The driver's signed decode (see read()) then restores the sign.
        power_w = self.bus_voltage_v * self.current_a
        power_raw = int(round(power_w / POWER_LSB))
        self._regs[REG_POWER] = power_raw & 0xFFFF
