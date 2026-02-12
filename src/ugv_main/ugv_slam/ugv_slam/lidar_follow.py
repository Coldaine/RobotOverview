#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
from geometry_msgs.msg import Twist
import numpy as np
import math
from .track_pid import PID  

class LidarFollower(Node):
    def __init__(self):
        super().__init__("lidar_follower")

        self.target_dist = 0.2     
        self.min_dist = 0.1       
        self.max_dist = 0.5        

        self.pid_angle = PID(
            kp=1.2, ki=0.0, kd=0.25,
            output_limits=(-1.5, 1.5),  
            tolerance=math.pi/6
        )

        self.pid_dist = PID(
            kp=1.0, ki=0.0, kd=0.1,
            output_limits=(-0.3, 0.35), 
            tolerance=0.02
        )

        self.last_ranges = None
        self.angle_min = None
        self.angle_increment = None

        self.cmd_pub = self.create_publisher(Twist, "/cmd_vel", 10)
        self.create_subscription(LaserScan, "/scan", self.cb_scan, 10)

        self.timer = self.create_timer(0.05, self.control_loop)

        self.get_logger().info("Lidar follower with PID started (full scan mode).")

    @staticmethod
    def normalize_angle(angle):
        return (angle + math.pi) % (2 * math.pi) - math.pi

    def cb_scan(self, scan: LaserScan):
        ranges = np.array(scan.ranges, dtype=float)

        ranges = np.where(np.isfinite(ranges), ranges, 10.0)
        ranges = np.where(ranges > 0.01, ranges, 10.0)

        self.last_ranges = ranges
        self.angle_min = float(scan.angle_min)
        self.angle_increment = float(scan.angle_increment)

    def control_loop(self):
        if self.last_ranges is None or self.angle_min is None or self.angle_increment is None:
            return

        cmd = Twist()

        n = len(self.last_ranges)
        if n == 0:
            return

        try:
            dist = float(np.min(self.last_ranges))
            index = int(np.argmin(self.last_ranges))

        except Exception as e:
            self.get_logger().warning(f"Failed to compute min index within 0.3m: {e}")
            return

        try:
            offset = int(round((math.pi / 2) / self.angle_increment))
        except Exception as e:
            self.get_logger().warning(f"angle_increment invalid: {e}")
            return

        index_corrected = (index - offset) % n

        angle = self.angle_min + index_corrected * self.angle_increment
        angle = self.normalize_angle(math.pi+angle)

        self.get_logger().debug(f"raw_idx={index}, corrected_idx={index_corrected}, angle_deg={math.degrees(angle):+.1f}, dist={dist:.3f}")

        ang_speed = self.pid_angle.compute(setpoint=0.0, measurement=angle)
        cmd.angular.z = -ang_speed

        lin_speed = self.pid_dist.compute(setpoint=self.target_dist, measurement=dist)
        cmd.linear.x = -lin_speed

        if abs(cmd.angular.z) < 0.02:
            cmd.angular.z = 0.0
        if abs(cmd.linear.x) < 0.03:
            cmd.linear.x = 0.0

        self.cmd_pub.publish(cmd)

def main(args=None):
    rclpy.init(args=args)
    node = LidarFollower()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
