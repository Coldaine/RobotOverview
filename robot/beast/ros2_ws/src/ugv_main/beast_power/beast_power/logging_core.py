# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Durable CSV sink and coulomb counter for BEAST-01 pack telemetry.

Replaces ``deploy/diagnostics/power_log.py``, a bench instrument that opened
its own I²C handle and cross-checked the INA219 against ``/ugv/voltage``. After
the 2026-08-07 cutover those became the same sensor, so the cross-check logged
one source twice under two names. This module records the pack from the single
owner (``beast_power``) instead, and adds the integration the old script could
not do.

Two requirements drive the design:

* **Survive the power cut.** A brownout log that loses its tail is worthless —
  the last seconds before collapse are the measurement. Rows are flushed and
  ``fsync``'d, so an unclean shutdown costs at most ``fsync_every_n`` samples.
* **Measure capacity, don't assume it.** ``ChargeIntegrator`` accumulates
  current over time, so a full-to-brownout run yields observed mAh rather than
  an inherited datasheet number.

Pure Python (no rclpy, no smbus) so CI and Windows pytest exercise rotation,
row building, and integration without ROS.
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from typing import Optional, Sequence

COLUMNS: tuple[str, ...] = (
    'utc',
    'mono_s',
    'dt_s',
    'voltage_v',
    'current_a',
    'power_w',
    'percentage',
    'legacy_fake_pct',
    'charge_mah',
    'energy_wh',
    'power_supply_status',
    'power_supply_health',
    'present',
    'charging_active',
    'note',
)


def _num(value: Optional[float], places: int) -> str:
    """Format a float for CSV, rendering None/NaN as an empty cell.

    An empty cell means "not measured". Writing 0.0 for a missing sensor would
    be indistinguishable from a real zero reading, which is exactly the kind of
    fabricated value the power cutover removed.
    """
    if value is None:
        return ''
    if not math.isfinite(value):
        return ''
    return f'{value:.{places}f}'


@dataclass
class ChargeIntegrator:
    """Accumulate charge (mAh) and energy (Wh) from sampled current.

    Sign follows ``BatteryState.current``: positive is into the pack, so a
    discharge run drives ``charge_mah`` negative and observed capacity is its
    magnitude between full and cutoff.

    Absolute scale is only as good as ``RSHUNT`` in ``ina219.py``, which is an
    unverified LeoRover default. The integral is linear in that constant, so a
    later bench measurement rescales any logged run by a single multiply — that
    is why raw samples stay in the CSV.
    """

    max_gap_s: float = 10.0
    charge_mah: float = 0.0
    energy_wh: float = 0.0
    _gaps_clamped: int = 0

    def add(self, current_a: Optional[float], voltage_v: Optional[float],
            dt_s: float) -> None:
        """Integrate one sample over ``dt_s`` seconds.

        Non-finite or non-positive ``dt_s`` contributes nothing. Gaps longer
        than ``max_gap_s`` clamp to ``max_gap_s``: a suspended process or a
        stalled sensor must not invent hours of charge transfer from one stale
        reading.
        """
        if not math.isfinite(dt_s) or dt_s <= 0.0:
            return
        if dt_s > self.max_gap_s:
            dt_s = self.max_gap_s
            self._gaps_clamped += 1

        if current_a is not None and math.isfinite(current_a):
            self.charge_mah += current_a * 1000.0 * (dt_s / 3600.0)
            if voltage_v is not None and math.isfinite(voltage_v):
                self.energy_wh += current_a * voltage_v * (dt_s / 3600.0)

    @property
    def gaps_clamped(self) -> int:
        return self._gaps_clamped


def build_row(
    *,
    utc: str,
    mono_s: float,
    dt_s: float,
    voltage_v: Optional[float],
    current_a: Optional[float],
    percentage: Optional[float],
    legacy_fake_pct: Optional[float],
    charge_mah: float,
    energy_wh: float,
    power_supply_status: Optional[int],
    power_supply_health: Optional[int],
    present: bool,
    charging_active: Optional[bool],
    note: str = '',
) -> list[str]:
    """Render one telemetry sample as CSV cells ordered per ``COLUMNS``."""
    if (voltage_v is not None and math.isfinite(voltage_v)
            and current_a is not None and math.isfinite(current_a)):
        power_w: Optional[float] = voltage_v * current_a
    else:
        power_w = None

    return [
        utc,
        _num(mono_s, 3),
        _num(dt_s, 3),
        _num(voltage_v, 4),
        _num(current_a, 5),
        _num(power_w, 4),
        _num(percentage, 5),
        _num(legacy_fake_pct, 5),
        _num(charge_mah, 4),
        _num(energy_wh, 5),
        '' if power_supply_status is None else str(power_supply_status),
        '' if power_supply_health is None else str(power_supply_health),
        '1' if present else '0',
        '' if charging_active is None else ('1' if charging_active else '0'),
        note,
    ]


class DurableCsvWriter:
    """Append-only CSV with size rotation and explicit durability.

    ``fsync_every_n=1`` (the default) means every sample is on stable storage
    before the next one is taken, which is the point: this file has to be
    readable after the pack collapses mid-write, not after a clean shutdown.
    Raise it only if the write rate is high enough for fsync to hurt.
    """

    def __init__(
        self,
        path: str,
        *,
        columns: Sequence[str] = COLUMNS,
        max_bytes: int = 64 * 1024 * 1024,
        backup_count: int = 5,
        fsync_every_n: int = 1,
    ) -> None:
        if max_bytes <= 0:
            raise ValueError('max_bytes must be positive')
        if backup_count < 0:
            raise ValueError('backup_count must be >= 0')
        if fsync_every_n < 1:
            raise ValueError('fsync_every_n must be >= 1')

        self._path = path
        self._columns = list(columns)
        self._max_bytes = max_bytes
        self._backup_count = backup_count
        self._fsync_every_n = fsync_every_n
        self._since_sync = 0
        self._handle = None

        parent = os.path.dirname(os.path.abspath(path))
        if parent:
            os.makedirs(parent, exist_ok=True)
        self._open()

    @property
    def path(self) -> str:
        return self._path

    def _open(self) -> None:
        needs_header = (
            not os.path.exists(self._path)
            or os.path.getsize(self._path) == 0
        )
        self._handle = open(self._path, 'a', encoding='utf-8', newline='')
        if needs_header:
            self._handle.write(','.join(self._columns) + '\n')
            self._sync_now()

    def _sync_now(self) -> None:
        if self._handle is None:
            return
        self._handle.flush()
        os.fsync(self._handle.fileno())
        self._since_sync = 0

    def _rotate(self) -> None:
        """Shift ``path`` to ``path.1`` … dropping the oldest backup.

        With ``backup_count == 0`` the file is simply truncated, so an
        unattended logger can never fill the disk.
        """
        if self._handle is not None:
            self._sync_now()
            self._handle.close()
            self._handle = None

        if self._backup_count == 0:
            if os.path.exists(self._path):
                os.remove(self._path)
            self._open()
            return

        oldest = f'{self._path}.{self._backup_count}'
        if os.path.exists(oldest):
            os.remove(oldest)
        for index in range(self._backup_count - 1, 0, -1):
            src = f'{self._path}.{index}'
            if os.path.exists(src):
                os.replace(src, f'{self._path}.{index + 1}')
        if os.path.exists(self._path):
            os.replace(self._path, f'{self._path}.1')
        self._open()

    def write_row(self, cells: Sequence[str]) -> None:
        if self._handle is None:
            self._open()
        if self._handle.tell() >= self._max_bytes:
            self._rotate()

        self._handle.write(','.join(cells) + '\n')
        self._since_sync += 1
        if self._since_sync >= self._fsync_every_n:
            self._sync_now()

    def close(self) -> None:
        if self._handle is not None:
            self._sync_now()
            self._handle.close()
            self._handle = None
