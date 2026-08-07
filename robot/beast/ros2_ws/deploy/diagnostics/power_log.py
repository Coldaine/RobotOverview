#!/usr/bin/env python3
# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Log BEAST-01 pack power from both independent sources onto one timeline.

This is an **instrument, not product code**. It exists to answer one question
that two snapshots could not: when the charger is connected, does the pack the
INA219 sits on actually charge?

On 2026-08-07 the two sources moved in opposite directions over a charging
period -- the ESP32 side rose 0.16 V while the INA219 side fell 0.05 V and drew
current out the whole time. They also sit ~0.14 V apart at ~33 mA, which is far
too much drop for wire, so something real (diode, protection FET, or the UPS
module's output stage) separates them. A time series settles it; inference did
not.

Sources
-------
* **INA219** on ``/dev/i2c-7`` address ``0x41`` -- the UPS Module 3S pack side.
  Read by shelling out to ``i2cget`` because ``python3-smbus2`` is *not*
  installed on the Jetson (``beast_power/package.xml`` declares it, but no
  script in this repo installs it).
* **``/ugv/voltage``** from ``ugv_bringup`` -- the ESP32 driver-board side.
  Real volts; its ``percentage`` field is a fabricated ``V / 12.6`` and is
  logged only so the lie stays visible next to the truth.

Raw registers are logged alongside derived values on purpose. ``RSHUNT`` is an
unverified LeoRover default (``beast_power/ina219.py:37``), so every derived
current here is provisional -- keeping the raw counts means the series can be
recomputed if the real shunt value turns out to differ.

Requires membership of the ``i2c`` group. No sudo, so it survives an overnight
run without a cached credential.

Usage
-----
    python3 power_log.py --out /home/beast/power-log.csv --interval 5
"""

from __future__ import annotations

import argparse
import csv
import os
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone

I2C_BUS = 7
INA219_ADDR = 0x41
REG_SHUNT = 0x01
REG_BUS = 0x02

SHUNT_LSB_V = 0.00001  # 10 uV per bit
BUS_LSB_V = 0.004  # 4 mV per bit, value sits in bits 15..3
RSHUNT_OHMS = 0.1  # UNVERIFIED -- LeoRover default, not measured on this board

_running = True


def _stop(_signum, _frame) -> None:
    global _running
    _running = False


def _swap16(value: int) -> int:
    """i2cget word mode returns the bytes swapped vs the INA219's big-endian order."""
    return ((value & 0xFF) << 8) | ((value >> 8) & 0xFF)


def _to_signed16(value: int) -> int:
    return value - 0x10000 if value & 0x8000 else value


def read_ina219() -> dict:
    """Return raw registers plus derived values, or an error note. Never raises."""
    out = {
        'ina_reg01_raw': '',
        'ina_reg02_raw': '',
        'ina_bus_v': '',
        'ina_shunt_mv': '',
        'ina_current_ma': '',
        'note': '',
    }
    try:
        raw = {}
        for label, reg in (('ina_reg01_raw', REG_SHUNT), ('ina_reg02_raw', REG_BUS)):
            result = subprocess.run(
                ['i2cget', '-y', str(I2C_BUS), hex(INA219_ADDR), hex(reg), 'w'],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode != 0:
                out['note'] = 'i2cget rc=%d %s' % (
                    result.returncode,
                    result.stderr.strip()[:80],
                )
                return out
            value = _swap16(int(result.stdout.strip(), 16))
            raw[reg] = value
            out[label] = '0x%04x' % value

        shunt_counts = _to_signed16(raw[REG_SHUNT])
        shunt_v = shunt_counts * SHUNT_LSB_V
        out['ina_shunt_mv'] = '%.3f' % (shunt_v * 1000.0)
        out['ina_current_ma'] = '%.1f' % (shunt_v / RSHUNT_OHMS * 1000.0)
        out['ina_bus_v'] = '%.3f' % ((raw[REG_BUS] >> 3) * BUS_LSB_V)
    except (subprocess.TimeoutExpired, ValueError, OSError) as exc:
        out['note'] = '%s: %s' % (type(exc).__name__, str(exc)[:80])
    return out


class PackListener:
    """Latest /ugv/voltage sample, or None if bringup has never published."""

    def __init__(self) -> None:
        self.voltage = None
        self.percentage = None
        self.at = None
        self._node = None
        self._rclpy = None
        self._shutdown_exc = ()

    def start(self) -> bool:
        try:
            import rclpy
            from rclpy.executors import ExternalShutdownException
            from sensor_msgs.msg import BatteryState
        except ImportError as exc:
            print('rclpy unavailable (%s); logging INA219 only' % exc, file=sys.stderr)
            return False

        self._rclpy = rclpy
        # rclpy installs its own SIGINT/SIGTERM handling, which pre-empts ours and
        # surfaces as ExternalShutdownException out of spin_once. Treat it as a
        # normal stop rather than letting it traceback on every clean shutdown.
        self._shutdown_exc = (ExternalShutdownException,)
        rclpy.init(args=None)
        self._node = rclpy.create_node('beast_power_log')
        self._node.create_subscription(BatteryState, '/ugv/voltage', self._on_msg, 10)
        return True

    def _on_msg(self, msg) -> None:
        self.voltage = float(msg.voltage)
        self.percentage = float(msg.percentage)
        self.at = time.monotonic()

    def pump(self, seconds: float) -> None:
        """Service callbacks for `seconds`, or just sleep if ROS is unavailable."""
        if self._node is None:
            time.sleep(seconds)
            return
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline and _running:
            try:
                self._rclpy.spin_once(self._node, timeout_sec=0.2)
            except self._shutdown_exc:
                _stop(None, None)
                return

    def snapshot(self) -> dict:
        if self.voltage is None:
            return {'esp32_v': '', 'esp32_fake_pct': '', 'esp32_age_s': ''}
        return {
            'esp32_v': '%.3f' % self.voltage,
            'esp32_fake_pct': '%.4f' % self.percentage,
            'esp32_age_s': '%.1f' % (time.monotonic() - self.at),
        }

    def stop(self) -> None:
        if self._node is not None:
            self._node.destroy_node()
            if self._rclpy.ok():
                self._rclpy.shutdown()


FIELDS = [
    'utc',
    'ina_reg01_raw',
    'ina_reg02_raw',
    'ina_bus_v',
    'ina_shunt_mv',
    'ina_current_ma',
    'esp32_v',
    'esp32_fake_pct',
    'esp32_age_s',
    'note',
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', default='/home/beast/power-log.csv')
    parser.add_argument('--interval', type=float, default=5.0)
    args = parser.parse_args()

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    listener = PackListener()
    listener.start()

    fresh = not os.path.exists(args.out) or os.path.getsize(args.out) == 0
    with open(args.out, 'a', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        if fresh:
            writer.writeheader()
            handle.flush()

        while _running:
            row = {'utc': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
            row.update(read_ina219())
            row.update(listener.snapshot())
            writer.writerow(row)
            handle.flush()
            os.fsync(handle.fileno())
            listener.pump(args.interval)

    listener.stop()
    return 0


if __name__ == '__main__':
    sys.exit(main())
