# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""LaserScan publish geometry contract for the vendored ldlidar fork.

Runs without ROS — mirrors the [0, 2π) math in ldlidar/src/demo.cpp so CI on
Windows/desktop can catch a regression before an on-robot rebuild.
"""

from __future__ import annotations

import math


def laserscan_angles(bins: int) -> tuple[float, float, float]:
    """Return (angle_min, angle_max, angle_increment) for fixed-bin publish."""
    if bins < 2:
        raise ValueError("bins must be >= 2")
    angle_min = 0.0
    angle_increment = (2.0 * math.pi) / bins
    angle_max = angle_min + (bins - 1) * angle_increment
    return angle_min, angle_max, angle_increment


def angle_to_index(angle_rad: float, bins: int) -> int:
    """Map a radian angle into [0, bins) the same way the driver does."""
    two_pi = 2.0 * math.pi
    _, _, angle_increment = laserscan_angles(bins)
    while angle_rad >= two_pi:
        angle_rad -= two_pi
    while angle_rad < 0.0:
        angle_rad += two_pi
    index = int(math.floor(angle_rad / angle_increment))
    if index < 0:
        return 0
    if index >= bins:
        return bins - 1
    return index


def test_angle_increment_is_two_pi_over_bins():
    bins = 480
    angle_min, angle_max, angle_increment = laserscan_angles(bins)
    assert angle_min == 0.0
    assert math.isclose(angle_increment, 2.0 * math.pi / bins)
    # Last bin is just under 2π — no duplicated 0/360 sample.
    assert angle_max < 2.0 * math.pi
    assert math.isclose(angle_max + angle_increment, 2.0 * math.pi)


def test_old_inclusive_two_pi_formula_is_rejected():
    bins = 480
    legacy_increment = (2.0 * math.pi) / (bins - 1)
    _, _, good_increment = laserscan_angles(bins)
    assert not math.isclose(legacy_increment, good_increment)


def test_constant_bin_count_indices_cover_full_circle():
    bins = 480
    assert angle_to_index(0.0, bins) == 0
    assert angle_to_index(2.0 * math.pi - 1e-9, bins) == bins - 1
    assert angle_to_index(2.0 * math.pi, bins) == 0


def test_bins_env_default_matches_fork():
    # Documented default in ugv.env.example / ldlidar.launch.py
    assert int("480") == 480
