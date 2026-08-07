# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Tests for the durable power-log sink and coulomb counter."""

from __future__ import annotations

import math
import os

import pytest

from beast_power.logging_core import (
    COLUMNS,
    ChargeIntegrator,
    DurableCsvWriter,
    build_row,
)


def _row(**overrides):
    base = dict(
        utc='2026-08-07T22:48:17.000Z',
        mono_s=1.0,
        dt_s=1.0,
        voltage_v=10.25,
        current_a=-0.14,
        percentage=0.09,
        legacy_fake_pct=0.813,
        charge_mah=-1.5,
        energy_wh=-0.015,
        power_supply_status=2,
        power_supply_health=1,
        present=True,
        charging_active=False,
        note='',
    )
    base.update(overrides)
    return build_row(**base)


class TestChargeIntegrator:
    def test_discharge_accumulates_negative_mah(self):
        acc = ChargeIntegrator()
        # 1.0 A out for 3600 s = -1000 mAh.
        for _ in range(3600):
            acc.add(-1.0, 12.0, 1.0)
        assert acc.charge_mah == pytest.approx(-1000.0, rel=1e-9)
        assert acc.energy_wh == pytest.approx(-12.0, rel=1e-9)

    def test_charge_accumulates_positive(self):
        acc = ChargeIntegrator()
        acc.add(2.0, 12.6, 1800.0)
        # dt clamps to max_gap_s (10 s), not 1800 s.
        assert acc.charge_mah == pytest.approx(2.0 * 1000.0 * (10.0 / 3600.0))
        assert acc.gaps_clamped == 1

    def test_long_gap_cannot_fabricate_capacity(self):
        """A suspended logger must not invent charge from one stale sample."""
        acc = ChargeIntegrator(max_gap_s=5.0)
        acc.add(-1.0, 12.0, 86400.0)
        assert abs(acc.charge_mah) < 2.0
        assert acc.gaps_clamped == 1

    @pytest.mark.parametrize('dt', [0.0, -1.0, math.nan, math.inf])
    def test_bad_dt_contributes_nothing(self, dt):
        acc = ChargeIntegrator()
        acc.add(-1.0, 12.0, dt)
        assert acc.charge_mah == 0.0
        assert acc.energy_wh == 0.0

    def test_absent_current_contributes_nothing(self):
        acc = ChargeIntegrator()
        acc.add(None, 12.0, 1.0)
        acc.add(math.nan, 12.0, 1.0)
        assert acc.charge_mah == 0.0

    def test_absent_voltage_still_counts_charge(self):
        """Charge needs only current; energy needs both."""
        acc = ChargeIntegrator()
        acc.add(-1.0, None, 3600.0)
        assert acc.charge_mah != 0.0
        assert acc.energy_wh == 0.0


class TestBuildRow:
    def test_column_count_matches_header(self):
        assert len(_row()) == len(COLUMNS)

    def test_power_is_voltage_times_current(self):
        cells = _row(voltage_v=10.0, current_a=-0.5)
        assert cells[COLUMNS.index('power_w')] == '-5.0000'

    def test_missing_sensor_writes_empty_not_zero(self):
        """Empty cell = not measured; 0.0 would read as a real measurement."""
        cells = _row(voltage_v=None, current_a=math.nan, present=False)
        assert cells[COLUMNS.index('voltage_v')] == ''
        assert cells[COLUMNS.index('current_a')] == ''
        assert cells[COLUMNS.index('power_w')] == ''
        assert cells[COLUMNS.index('present')] == '0'

    def test_unknown_charging_is_empty_not_false(self):
        cells = _row(charging_active=None)
        assert cells[COLUMNS.index('charging_active')] == ''
        assert _row(charging_active=False)[COLUMNS.index('charging_active')] == '0'


class TestDurableCsvWriter:
    def test_writes_header_once_and_appends(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path)
        w.write_row(_row())
        w.close()

        w2 = DurableCsvWriter(path)
        w2.write_row(_row())
        w2.close()

        lines = open(path).read().strip().split('\n')
        assert lines[0] == ','.join(COLUMNS)
        assert len(lines) == 3

    def test_creates_parent_directory(self, tmp_path):
        path = str(tmp_path / 'nested' / 'deeper' / 'p.csv')
        DurableCsvWriter(path).close()
        assert os.path.exists(path)

    def test_row_is_durable_before_next_sample(self, tmp_path):
        """The brownout guarantee: a row is on disk before the next is taken."""
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path, fsync_every_n=1)
        w.write_row(_row())
        # Read through a separate handle without closing the writer.
        assert len(open(path).read().strip().split('\n')) == 2
        w.close()

    def test_rotation_keeps_backups(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path, max_bytes=400, backup_count=2)
        for _ in range(60):
            w.write_row(_row())
        w.close()

        assert os.path.exists(path)
        assert os.path.exists(path + '.1')
        assert os.path.exists(path + '.2')
        assert not os.path.exists(path + '.3')

    def test_rotated_file_has_header(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path, max_bytes=400, backup_count=1)
        for _ in range(40):
            w.write_row(_row())
        w.close()
        assert open(path).readline().strip() == ','.join(COLUMNS)

    def test_zero_backups_truncates_and_cannot_fill_disk(self, tmp_path):
        path = str(tmp_path / 'p.csv')
        w = DurableCsvWriter(path, max_bytes=400, backup_count=0)
        for _ in range(80):
            w.write_row(_row())
        w.close()
        assert os.path.getsize(path) < 1200
        assert not os.path.exists(path + '.1')

    @pytest.mark.parametrize(
        'kwargs',
        [
            {'max_bytes': 0},
            {'backup_count': -1},
            {'fsync_every_n': 0},
        ],
    )
    def test_rejects_invalid_config(self, tmp_path, kwargs):
        with pytest.raises(ValueError):
            DurableCsvWriter(str(tmp_path / 'p.csv'), **kwargs)
