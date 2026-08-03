#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
from nav_msgs.msg import Odometry
from geometry_msgs.msg import Twist
import numpy as np
import math


FORWARD = 0
TURN_LEFT = 1
TURN_RIGHT = 2
TURN_LEFT_180 = 3


class ObstacleAvoidance(Node):
    def __init__(self):
        super().__init__("obstacle_avoidance")

        self.safe_dist = 0.30
        self.front_angle = 60

        self.state = FORWARD
        self.target_yaw = None

        self.current_yaw = 0.0
        self.current_x = 0.0
        self.current_y = 0.0

        # Publishers & Subscribers
        # Command spine: never publish /cmd_vel directly. twist_mux owns that
        # topic (ugv_cockpit/config/twist_mux.yaml). Self-driving demo -> the
        # lowest rung, priority 10; any human teleop input outranks it.
        self.cmd_pub = self.create_publisher(Twist, 'cmd_vel_nav', 10)
        self.create_subscription(LaserScan, "scan", self.cb_scan, 10)
        self.create_subscription(Odometry, "odom", self.cb_odom, 10)

        self.timer = self.create_timer(0.05, self.update)

        self.get_logger().info("Non-blocking Obstacle Avoidance started.")

    def cb_odom(self, msg):
        q = msg.pose.pose.orientation
        siny = 2.0 * (q.w * q.z + q.x * q.y)
        cosy = 1.0 - 2.0 * (q.y * q.y + q.z * q.z)
        self.current_yaw = math.atan2(siny, cosy)

        self.current_x = msg.pose.pose.position.x
        self.current_y = msg.pose.pose.position.y

    def cb_scan(self, scan: LaserScan):
        if self.state != FORWARD:
            return

        ranges = np.array(scan.ranges)
        ranges = ranges[np.isfinite(ranges)]
        if ranges.size == 0:
            return

        center_idx = int((-scan.angle_min - math.pi/2) / scan.angle_increment)
        half_idx = int(math.radians(self.front_angle/2) / scan.angle_increment)

        front = ranges[center_idx-half_idx : center_idx+half_idx]
        left = ranges[center_idx+half_idx : center_idx+half_idx*3]
        right = ranges[center_idx-half_idx*3 : center_idx-half_idx]

        front_min = front.min() if front.size else 999
        left_min = left.min() if left.size else 999
        right_min = right.min() if right.size else 999

        if front_min < self.safe_dist:
            if left_min < self.safe_dist and right_min < self.safe_dist:
                self.start_turn("left", 180)
            elif left_min < self.safe_dist:
                self.start_turn("right", 90)
            elif right_min < self.safe_dist:
                self.start_turn("left", 90)

    def start_turn(self, direction: str, angle_deg: float):
        rad = math.radians(angle_deg)

        if direction == "left":
            self.target_yaw = self.normalize_angle(self.current_yaw + rad)
            self.state = TURN_LEFT if angle_deg == 90 else TURN_LEFT_180
        else:
            self.target_yaw = self.normalize_angle(self.current_yaw - rad)
            self.state = TURN_RIGHT

        self.get_logger().info(f"Start turning {direction} {angle_deg}°, target_yaw={self.target_yaw:.3f}")

    def update(self):
        cmd = Twist()

        if self.state == FORWARD:
            cmd.linear.x = 0.20

        else:
            yaw_error = self.normalize_angle(self.target_yaw - self.current_yaw)

            if abs(yaw_error) < math.radians(5):
                self.state = FORWARD
                self.get_logger().info("Rotation complete → FORWARD")
            else:
                cmd.angular.z = 0.6 if yaw_error > 0 else -0.6

        self.cmd_pub.publish(cmd)

    @staticmethod
    def normalize_angle(angle):
        return (angle + math.pi) % (2 * math.pi) - math.pi

def main(args=None):
    rclpy.init(args=args)
    node = ObstacleAvoidance()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
