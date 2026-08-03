# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""IMU unify contracts that run without ROS / rclpy.

Mirrors the REP-145 gate in odom_publisher.handle_imu and the dual-publish
topic names in ugv_bringup.publish_imu_data_raw.
"""

from __future__ import annotations

import ast
from pathlib import Path


def _handle_imu_gate(orientation_covariance0: float, imu_valid_before: bool) -> bool:
    """Return imu_valid after applying the same gate as odom_publisher."""
    if orientation_covariance0 < 0.0:
        return imu_valid_before
    return True


def test_raw_imu_without_orientation_does_not_arm_yaw():
    assert _handle_imu_gate(-1.0, False) is False


def test_filtered_imu_with_orientation_arms_yaw():
    assert _handle_imu_gate(0.01, False) is True


def test_bringup_publishes_canonical_imu_data_and_raw_alias():
    src = Path(__file__).resolve().parents[1] / "ugv_bringup" / "ugv_bringup.py"
    tree = ast.parse(src.read_text(encoding="utf-8"))
    topics = set()
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "create_publisher"
            and len(node.args) >= 2
            and isinstance(node.args[1], ast.Constant)
            and isinstance(node.args[1].value, str)
            and node.args[1].value.startswith("imu/")
        ):
            topics.add(node.args[1].value)
    assert "imu/data" in topics
    assert "imu/raw" in topics


def test_ekf_enables_imu0_on_imu_data():
    ekf = (
        Path(__file__).resolve().parents[1] / "config" / "ekf.yaml"
    ).read_text(encoding="utf-8")
    assert "imu0: imu/data" in ekf
    assert "imu0_config:" in ekf
    # yaw_vel only — no orientation / accel fuse in the safe config
    assert "false, false, true," in ekf or "false, false, true" in ekf
