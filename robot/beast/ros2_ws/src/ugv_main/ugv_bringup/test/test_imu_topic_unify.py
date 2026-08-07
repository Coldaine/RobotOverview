# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""IMU unify contracts that run without ROS / rclpy.

Mirrors the REP-145 gate in odom_publisher.handle_imu and the dual-publish
topic names in beast_base.base_node.publish_imu_data_raw (the ESP32 bridge node
moved to the beast_base package in Phase 1; the fan-out itself is covered
behaviorally in beast_base/test/test_base_node.py).
"""

from __future__ import annotations

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


def test_ekf_enables_imu0_on_imu_data():
    ekf = (
        Path(__file__).resolve().parents[1] / "config" / "ekf.yaml"
    ).read_text(encoding="utf-8")
    assert "imu0: imu/data" in ekf
    assert "imu0_config:" in ekf
    # yaw_vel only — no orientation / accel fuse in the safe config
    assert "false, false, true," in ekf or "false, false, true" in ekf
