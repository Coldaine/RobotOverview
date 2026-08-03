#!/usr/bin/env python3
"""Colorize the OAK-D aligned depth stream into a browser-friendly JPEG.

Raw 16UC1 depth (~614 KB/frame) is unusable in a browser: mono16 PNG renders
near-black and the payload stalls the rosbridge WebSocket. This node clips depth
to a sane range, applies a perceptual colormap, JPEG-encodes, and republishes on
``/cockpit/depth/compressed`` at a throttled rate the cockpit can consume.

Source topic is ``/oak/stereo/image_raw`` (16UC1, millimetres, aligned to RGB).
"""
import time

import rclpy
from cv_bridge import CvBridge
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from sensor_msgs.msg import CompressedImage, Image

from ugv_cockpit.depth_ops import colorize_depth


class DepthColorizer(Node):
    def __init__(self):
        super().__init__('depth_colorizer')

        self.declare_parameter('input_topic', '/oak/stereo/image_raw')
        self.declare_parameter('output_topic', '/cockpit/depth/compressed')
        # Clip window in metres; anything outside is clamped for stable coloring.
        self.declare_parameter('min_range_m', 0.3)
        self.declare_parameter('max_range_m', 8.0)
        self.declare_parameter('publish_hz', 6.0)
        self.declare_parameter('jpeg_quality', 70)

        self._input = self.get_parameter('input_topic').value
        self._output = self.get_parameter('output_topic').value
        self._min_m = float(self.get_parameter('min_range_m').value)
        self._max_m = float(self.get_parameter('max_range_m').value)
        self._min_period = 1.0 / max(0.5, float(self.get_parameter('publish_hz').value))
        self._quality = int(self.get_parameter('jpeg_quality').value)

        self._bridge = CvBridge()
        self._last_pub = 0.0

        sensor_qos = QoSProfile(
            reliability=ReliabilityPolicy.BEST_EFFORT,
            history=HistoryPolicy.KEEP_LAST,
            depth=1,
        )
        self._pub = self.create_publisher(CompressedImage, self._output, 1)
        self._sub = self.create_subscription(
            Image, self._input, self._on_depth, sensor_qos
        )
        self.get_logger().info(
            f'depth_colorizer: {self._input} -> {self._output} '
            f'@ ~{1.0 / self._min_period:.1f} Hz, clip {self._min_m}-{self._max_m} m'
        )

    def _on_depth(self, msg: Image):
        now = time.monotonic()
        if now - self._last_pub < self._min_period:
            return
        self._last_pub = now

        try:
            depth = self._bridge.imgmsg_to_cv2(msg, desired_encoding='passthrough')
        except Exception as exc:  # noqa: BLE001 - log and skip a bad frame
            self.get_logger().warn(f'depth decode failed: {exc}')
            return

        data = colorize_depth(
            depth, msg.encoding, self._min_m, self._max_m, self._quality
        )
        if data is None:
            self.get_logger().warn('jpeg encode failed')
            return

        out = CompressedImage()
        out.header = msg.header
        out.format = 'jpeg'
        out.data = data
        self._pub.publish(out)


def main(args=None):
    rclpy.init(args=args)
    node = DepthColorizer()
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
