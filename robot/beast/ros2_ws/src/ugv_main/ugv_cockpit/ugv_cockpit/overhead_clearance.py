#!/usr/bin/env python3
"""Publish the free overhead clearance in front of the robot, in metres.

Mission Undercroft's defining question is "will I fit under this duct?". The OAK
aligned depth image already answers it: crop the upper band of the frame (what is
above the robot as it approaches), drop no-measurement zeros, and take a robust
minimum. This is a pure image-space measurement on raw depth.

We deliberately do NOT project through camera_info: the driver's intrinsics are
provably wrong on this unit (fy short ~1.33x, cy shifted ~60 px), so a metric
reprojection would report confident-but-false clearances. Image-space min on the
raw range values is the honest measurement.
"""
import numpy as np
import rclpy
from cv_bridge import CvBridge
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from sensor_msgs.msg import Image
from std_msgs.msg import Float32

from ugv_cockpit.depth_ops import compute_clearance


class OverheadClearance(Node):
    def __init__(self):
        super().__init__('overhead_clearance')

        self.declare_parameter('input_topic', '/oak/stereo/image_raw')
        self.declare_parameter('output_topic', '/cockpit/overhead_clearance')
        # Fraction of image height treated as "overhead" (top band).
        self.declare_parameter('top_band_fraction', 0.30)
        # Central horizontal fraction to ignore side walls.
        self.declare_parameter('center_width_fraction', 0.60)
        # Robust minimum percentile (guards against single-pixel speckle).
        self.declare_parameter('min_percentile', 2.0)
        self.declare_parameter('publish_hz', 5.0)

        self._input = self.get_parameter('input_topic').value
        self._output = self.get_parameter('output_topic').value
        self._top_frac = float(self.get_parameter('top_band_fraction').value)
        self._center_frac = float(self.get_parameter('center_width_fraction').value)
        self._pct = float(self.get_parameter('min_percentile').value)
        min_period = 1.0 / max(0.5, float(self.get_parameter('publish_hz').value))
        self._min_period = min_period

        self._bridge = CvBridge()
        self._last = 0.0

        sensor_qos = QoSProfile(
            reliability=ReliabilityPolicy.BEST_EFFORT,
            history=HistoryPolicy.KEEP_LAST,
            depth=1,
        )
        self._pub = self.create_publisher(Float32, self._output, 1)
        self._sub = self.create_subscription(
            Image, self._input, self._on_depth, sensor_qos
        )
        self.get_logger().info(
            f'overhead_clearance: {self._input} -> {self._output} '
            f'(top {self._top_frac:.0%} band, center {self._center_frac:.0%})'
        )

    def _on_depth(self, msg: Image):
        stamp = self.get_clock().now().nanoseconds / 1e9
        if stamp - self._last < self._min_period:
            return
        self._last = stamp

        try:
            depth = self._bridge.imgmsg_to_cv2(msg, desired_encoding='passthrough')
        except Exception as exc:  # noqa: BLE001
            self.get_logger().warn(f'depth decode failed: {exc}')
            return

        depth_m = depth.astype(np.float32)
        if msg.encoding in ('16UC1', 'mono16'):
            depth_m /= 1000.0

        out = Float32()
        out.data = compute_clearance(
            depth_m, self._top_frac, self._center_frac, self._pct
        )
        self._pub.publish(out)


def main(args=None):
    rclpy.init(args=args)
    node = OverheadClearance()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
