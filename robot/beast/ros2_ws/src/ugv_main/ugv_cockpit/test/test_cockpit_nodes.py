"""Unit tests for the cockpit node pure cores (no ROS graph needed).

Guards the two things a live depth stream will break first: NaN/Inf/zero pixels
and empty frames. Mirrors the app-side NaN-defence discipline on the robot side.
"""
import numpy as np
import pytest

pytest.importorskip('cv2')
from ugv_cockpit.depth_ops import colorize_depth, compute_clearance  # noqa: E402


def test_clearance_ignores_zeros_and_nans():
    # 16-row image; top 30% band is int(16*0.30)=4 rows -> rows 0-3. Fill the
    # overhead band with 1.2 m, everything below with 5 m.
    depth = np.full((16, 20), 5.0, dtype=np.float32)
    depth[0:5, :] = 1.2
    depth[0:5, 0:3] = 0.0          # no-measurement pixels must be ignored
    depth[0:5, 3:5] = np.nan       # NaN must be ignored
    clearance = compute_clearance(depth, top_frac=0.30, center_frac=0.6, pct=2.0)
    assert 1.15 <= clearance <= 1.25


def test_clearance_returns_zero_on_no_signal():
    depth = np.zeros((16, 20), dtype=np.float32)
    assert compute_clearance(depth, 0.3, 0.6, 2.0) == 0.0


def test_clearance_handles_empty_and_1d():
    assert compute_clearance(np.array([]), 0.3, 0.6, 2.0) == 0.0
    assert compute_clearance(np.array([1.0, 2.0]), 0.3, 0.6, 2.0) == 0.0


def test_clearance_all_infinite():
    depth = np.full((10, 10), np.inf, dtype=np.float32)
    assert compute_clearance(depth, 0.3, 0.6, 2.0) == 0.0


def test_colorize_produces_jpeg_bytes():
    depth_mm = (np.random.rand(48, 64) * 4000).astype(np.uint16)
    data = colorize_depth(depth_mm, '16UC1', 0.3, 8.0, quality=60)
    assert data is not None and len(data) > 0
    # JPEG SOI marker
    assert data[:2] == b'\xff\xd8'


def test_colorize_survives_nan_and_zero():
    depth = np.full((32, 32), np.nan, dtype=np.float32)
    depth[0:8, 0:8] = 0.0
    depth[8:16, 8:16] = 2.5
    data = colorize_depth(depth, '32FC1', 0.3, 8.0)
    assert data is not None and data[:2] == b'\xff\xd8'
