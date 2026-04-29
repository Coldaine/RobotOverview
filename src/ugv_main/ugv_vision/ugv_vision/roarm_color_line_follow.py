import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from geometry_msgs.msg import Twist
from rcl_interfaces.msg import SetParametersResult
from cv_bridge import CvBridge
from tf2_ros import Buffer, TransformListener
from tf2_ros import TransformException
from roarm_msgs.srv import PickPlaceCmd

import cv2
import numpy as np
import json
import os
import yaml
import subprocess
import signal
import time
import math
from math import isnan
from collections import deque
from enum import Enum

def robust_mean_remove_outliers(arr, mz_thresh=3.5):
    if arr.size == 0:
        return 0.0
    med = np.median(arr)
    mad = np.median(np.abs(arr - med))
    if mad == 0:
        return float(np.mean(arr))
    mod_z = 0.6745 * (arr - med) / mad
    filtered = arr[np.abs(mod_z) <= mz_thresh]
    return float(np.mean(filtered)) if filtered.size > 0 else float(np.mean(arr))


class TrackState(Enum):
    FOLLOW = 0
    SEARCH_SCAN = 1
    RECOVER = 2

    OBJECT_FOUND = 10
    PICKING = 11
    PLACING = 12

class ColorTrackPID(Node):
    def __init__(self):
        super().__init__('color_track_pid')

        self.sub_img = self.create_subscription(Image, '/image_raw', self.image_callback, 10)
        self.pub_cmd = self.create_publisher(Twist, '/cmd_vel', 10)
        self.pub_img = self.create_publisher(Image, '/color_track_pid/result', 10)
        self.bridge = CvBridge()

        self.state = TrackState.FOLLOW
        self.yaw_buffer = deque(maxlen=10)
        self.last_error = 0.0
        self.search_start_time = 0.0
        self.recover_start_time = 0.0

        self.kp = 3.0
        self.kd = 0.05
        self.base_speed = 0.1
        self.recover_time = 0.4

        self.scan_dir = 1
        self.scan_yaw_base = 0.5
        self.scan_yaw_max = math.pi
        self.max_scan_time = 10.0

        self.declare_parameter("lower_l", 0)
        self.declare_parameter("lower_a", 100)
        self.declare_parameter("lower_b", 187)
        self.declare_parameter("upper_l", 255)
        self.declare_parameter("upper_a", 255)
        self.declare_parameter("upper_b", 255)

        self.lower_color = np.array([
            self.get_parameter("lower_l").value,
            self.get_parameter("lower_a").value,
            self.get_parameter("lower_b").value
        ], dtype=np.uint8)

        self.upper_color = np.array([
            self.get_parameter("upper_l").value,
            self.get_parameter("upper_a").value,
            self.get_parameter("upper_b").value
        ], dtype=np.uint8)

        self.add_on_set_parameters_callback(self.on_param_change)

        # ROI
        self.roi = [
            (150,  200, 40, 600, 0.2),
            (200,  250, 40, 600, 0.3),
            (250,  300, 40, 600, 0.5),
        ]

        self.get_logger().info("ColorTrackPID Node started")

        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.target_detected = False
        self.task_busy = False
        self.pick_started = False
        self.last_task_time = 0
        self.task_cooldown = 3.0
        self.tf_timer = self.create_timer(0.1, self.check_target_tf)
        self.pick_client = self.create_client(PickPlaceCmd, 'pick_place_cmd')
        while not self.pick_client.wait_for_service(timeout_sec=1.0):
            self.get_logger().info('Waiting for pick_place_cmd service...')

    def on_param_change(self, params):
        for param in params:
            if param.name in (
                "lower_l", "lower_a", "lower_b",
                "upper_l", "upper_a", "upper_b"
            ):
                self.lower_color = np.array([
                    self.get_parameter("lower_l").value,
                    self.get_parameter("lower_a").value,
                    self.get_parameter("lower_b").value
                ], dtype=np.uint8)

                self.upper_color = np.array([
                    self.get_parameter("upper_l").value,
                    self.get_parameter("upper_a").value,
                    self.get_parameter("upper_b").value
                ], dtype=np.uint8)

                self.get_logger().info(f"Updated LAB range: lower={self.lower_color}, upper={self.upper_color}")

        return SetParametersResult(successful=True)

    def call_pick(self, target=1, gripper=0.0):

        req = PickPlaceCmd.Request()
        req.cmd = 1
        req.target = target
        req.gripper = gripper

        future = self.pick_client.call_async(req)

        return future

    def call_place(self):

        req = PickPlaceCmd.Request()
        req.cmd = 2

        future = self.pick_client.call_async(req)

        return future

    def check_target_tf(self):

        if self.task_busy:
            return

        try:
            trans = self.tf_buffer.lookup_transform(
                "ugv_roarm_base_link",
                "object_1",
                rclpy.time.Time()
            )

            x = trans.transform.translation.x
            y = trans.transform.translation.y
            z = trans.transform.translation.z

            min_radius = 0.15
            max_radius = 0.40
        
            dist = math.sqrt(x**2 + y**2 + z**2)
        
            if min_radius <= dist <= max_radius:
                self.target_detected = True
            else:
                self.target_detected = False

        except TransformException:
            self.target_detected = False

    def image_callback(self, msg):
        frame = self.bridge.imgmsg_to_cv2(msg, "bgr8")
        h, w = frame.shape[:2]
        cx = w // 2

        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)

        weight_sum = 0.0
        cx_sum = 0.0
        has_line = False

        for (y1, y2, x1, x2, wt) in self.roi:
            crop = lab[y1:y2, x1:x2]
            mask = cv2.inRange(crop, self.lower_color, self.upper_color)
            cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not cnts:
                continue

            c = max(cnts, key=cv2.contourArea)
            if cv2.contourArea(c) < 50:
                continue

            c = c.astype(np.float32)
            c[:, :, 0] += x1
            c[:, :, 1] += y1
            c = c.astype(np.int32)

            (x, y), _, _ = cv2.minAreaRect(c)
            cx_sum += x * wt
            weight_sum += wt
            has_line = True

        twist = Twist()

        if self.state == TrackState.FOLLOW:
            if self.target_detected and not self.task_busy \
            and time.time() - self.last_task_time > self.task_cooldown:

                self.get_logger().info("Target detected → PICK")

                self.state = TrackState.OBJECT_FOUND
                self.task_busy = True
                twist.linear.x = 0.0
                twist.angular.z = 0.0

                self.pub_cmd.publish(twist)
                return

            if has_line and weight_sum > 0:
                x_avg = cx_sum / weight_sum
                err = (x_avg - cx) / cx
                self.yaw_buffer.append(err)
                err_f = robust_mean_remove_outliers(np.array(self.yaw_buffer))

                d = err_f - self.last_error
                self.last_error = err_f

                z = self.kp * err_f + self.kd * d
                twist.linear.x = self.base_speed
                twist.angular.z = -z
            else:
                self.state = TrackState.SEARCH_SCAN
                self.search_start_time = time.time()
                self.scan_dir = 1 if self.last_error > 0 else -1
                self.get_logger().warn("Lost line → SEARCH_SCAN")
                twist.linear.x = 0.0
                twist.angular.z = 0.0

        elif self.state == TrackState.SEARCH_SCAN:
            dt = time.time() - self.search_start_time
            yaw = max(self.scan_yaw_max * (1 - dt / self.max_scan_time), self.scan_yaw_base)
            twist.linear.x = 0.0
            twist.angular.z = self.scan_dir * yaw

            if has_line and weight_sum > 0:
                self.state = TrackState.RECOVER
                self.recover_start_time = time.time()
                self.last_error = 0.0
                self.yaw_buffer.clear()
                self.get_logger().info("Line found → RECOVER")

        elif self.state == TrackState.RECOVER:
            dt = time.time() - self.recover_start_time
            if has_line and weight_sum > 0:
                x_avg = cx_sum / weight_sum
                err = (x_avg - cx) / cx
                z = 0.5 * self.kp * err
                twist.linear.x = 0.0
                twist.angular.z = -z

                if dt > self.recover_time:
                    self.state = TrackState.FOLLOW
                    self.last_error = 0.0
                    self.yaw_buffer.clear()
            else:
                self.state = TrackState.SEARCH_SCAN
                self.search_start_time = time.time()
                self.scan_dir = 1 if self.last_error > 0 else -1
                twist.linear.x = 0.0
                twist.angular.z = self.scan_dir * self.scan_yaw_base
                self.get_logger().warn("Lost line during RECOVER → SEARCH_SCAN")

        elif self.state == TrackState.OBJECT_FOUND:

            twist.linear.x = 0.0
            twist.angular.z = 0.0

            if not self.pick_started:

                self.pick_future = self.call_pick(target=1, gripper=0.25)
                self.pick_started = True
                self.state = TrackState.PICKING

        elif self.state == TrackState.PICKING:

            twist.linear.x = 0.0
            twist.angular.z = 0.0

            if self.pick_future.done():

                result = self.pick_future.result()

                if result.success:
                    self.get_logger().info("Pick success")
                    self.place_future = self.call_place()
                    self.state = TrackState.PLACING
                else:
                    self.get_logger().warn("Pick failed")
                    self.state = TrackState.FOLLOW

        elif self.state == TrackState.PLACING:

            twist.linear.x = 0.0
            twist.angular.z = 0.0

            if self.place_future.done():

                result = self.place_future.result()

                if result.success:
                    self.get_logger().info("Place success")

                self.last_task_time = time.time()

                self.task_busy = False
                self.pick_started = False
                self.state = TrackState.FOLLOW

        cv2.rectangle(frame, (10, 10), (260, 90), (0, 0, 0), -1)
        cv2.putText(
            frame,
            f"STATE: {self.state.name}",
            (20, 45),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            (0, 255, 0),
            2,
            cv2.LINE_AA
        )

        self.pub_img.publish(self.bridge.cv2_to_imgmsg(frame, "bgr8"))
        self.pub_cmd.publish(twist)

def main(args=None):
    rclpy.init(args=args)
    node = ColorTrackPID()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()