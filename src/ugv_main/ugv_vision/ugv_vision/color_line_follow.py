import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image, Imu
from geometry_msgs.msg import Twist
from rcl_interfaces.msg import ParameterDescriptor, SetParametersResult
from cv_bridge import CvBridge

import cv2
import numpy as np
import math
import os
import subprocess
import signal
from collections import deque
from enum import Enum
import json
import yaml
import time
from math import isnan

curpath = os.path.realpath(__file__)
thisPath = os.path.dirname(curpath)

try:
    existing_mediamtx_pids = subprocess.check_output(
        ["pgrep", "-f", "mediamtx"], encoding="utf-8"
    ).splitlines()

    existing_gst_launch_pids = subprocess.check_output(
        ["pgrep", "-f", "gst-launch-1.0"], encoding="utf-8"
    ).splitlines()

    for pid_str in existing_mediamtx_pids:
        pid = int(pid_str)
        print(f"Killing existing mediamtx process: {pid}")
        os.kill(pid, signal.SIGTERM) 

    for pid_str in existing_gst_launch_pids:
        pid = int(pid_str)
        print(f"Killing existing gst-launch-1.0 process: {pid}")
        os.kill(pid, signal.SIGTERM) 
except subprocess.CalledProcessError:
    pass
    
log_file_path = os.path.join(thisPath,"Mediamtx", "mediamtx.log")

with open(log_file_path, "w") as log_file:
    mediamtx_command = [
        os.path.join(thisPath,"Mediamtx", "mediamtx"),
        os.path.join(thisPath,"Mediamtx", "mediamtx.yml"),
    ]
    mediamtx_process = subprocess.Popen(
        mediamtx_command,
        stdout=log_file,
        stderr=log_file
    )
        
gst_command = [
    'gst-launch-1.0',
    'fdsrc', '!',
    'rawvideoparse', 'format=bgr', 'width=640', 'height=480', 'framerate=30/1', '!',
    'videoconvert', '!',
    'x264enc', 'bitrate=1000', 'speed-preset=ultrafast', 'tune=zerolatency', '!',
    'h264parse', '!',
    'rtspclientsink', 'location=rtsp://localhost:8554/cam', 'latency=0'
]

gst_process = subprocess.Popen(gst_command, stdin=subprocess.PIPE)

def angle_diff(a, b):
    return (a - b + math.pi) % (2 * math.pi) - math.pi


def robust_mean_remove_outliers(arr, mz_thresh=3.5, is_angle=False):
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
    TURN = 2

class ColorTrackPID(Node):

    def __init__(self):
        super().__init__('color_track_pid')

        self.sub_img = self.create_subscription(Image, '/image_raw', self.image_callback, 10)
        self.sub_imu = self.create_subscription(Imu, '/imu/data', self.imu_callback, 10)
        self.pub_cmd = self.create_publisher(Twist, '/cmd_vel', 10)
        self.pub_img = self.create_publisher(Image, '/color_track_pid/result', 10)

        self.bridge = CvBridge()

        self.state = TrackState.FOLLOW
        self.search_start_time = None

        self.yaw = None
        self.target_yaw = None

        self.kp = 3.0
        self.kd = 0.05
        self.last_error = 0.0

        self.base_speed = 0.2

        self.yaw_buffer = deque(maxlen=10)

        self.declare_parameter("lower_l", 0)
        self.declare_parameter("lower_a", 100)
        self.declare_parameter("lower_b", 187)
        self.declare_parameter("upper_l", 255)
        self.declare_parameter("upper_a", 255)
        self.declare_parameter("upper_b", 255)

        self.lower = np.array([
            self.get_parameter("lower_l").value,
            self.get_parameter("lower_a").value,
            self.get_parameter("lower_b").value
        ], dtype=np.uint8)

        self.upper = np.array([
            self.get_parameter("upper_l").value,
            self.get_parameter("upper_a").value,
            self.get_parameter("upper_b").value
        ], dtype=np.uint8)

        self.roi = [
            (250, 300, 40, 600, 0.1),
            (300, 400, 40, 600, 0.3),
            (400, 480, 40, 600, 0.6),
        ]

        self.turn_timer = self.create_timer(0.02, self.turn_control)

        self.add_on_set_parameters_callback(self.on_param_change)

        self.get_logger().info("ColorTrackPID with FSM started")

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
    
                self.get_logger().info(
                    f"Updated LAB range: lower={self.lower_color}, upper={self.upper_color}"
                )
    
        return SetParametersResult(successful=True)

    def imu_callback(self, msg):
        q = msg.orientation
        siny = 2.0 * (q.w * q.z + q.x * q.y)
        cosy = 1.0 - 2.0 * (q.y * q.y + q.z * q.z)
        self.yaw = math.atan2(siny, cosy)

    def start_turn(self):
        if self.yaw is None:
            return
        self.target_yaw = self.yaw + math.pi
        self.state = TrackState.TURN
        self.get_logger().warn("Start 180° TURN")

    def turn_control(self):
        if self.state != TrackState.TURN or self.yaw is None:
            return

        err = angle_diff(self.target_yaw, self.yaw)
        w = max(-1.5, min(1.5, 1.5 * err))

        twist = Twist()
        twist.angular.z = w

        if abs(err) < math.radians(2):
            twist.angular.z = 0.0
            self.state = TrackState.FOLLOW
            self.get_logger().info("TURN finished")

        self.pub_cmd.publish(twist)

    def image_callback(self, msg):
        frame = self.bridge.imgmsg_to_cv2(msg, "bgr8")

        h, w = frame.shape[:2]
        cx = w // 2

        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)

        weight_sum = 0
        cx_sum = 0
        has_line = False

        for (y1, y2, x1, x2, wt) in self.roi:
            crop = lab[y1:y2, x1:x2]
            mask = cv2.inRange(crop, self.lower, self.upper)
            cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not cnts:
                continue
            c = max(cnts, key=cv2.contourArea)
            if cv2.contourArea(c) < 50:
                continue
            (x, y), _, _ = cv2.minAreaRect(c)
            x += x1
            cx_sum += x * wt
            weight_sum += wt
            has_line = True

        if self.state == TrackState.FOLLOW:
            if not has_line:
                self.state = TrackState.SEARCH_SCAN
                self.search_start_time = self.get_clock().now()
                self.get_logger().warn("Lost line → SEARCH_SCAN")
                return

            x = cx_sum / weight_sum
            err = (x - cx) / cx
            self.yaw_buffer.append(err)
            err_f = robust_mean_remove_outliers(np.array(self.yaw_buffer))

            d = err_f - self.last_error
            self.last_error = err_f

            z = self.kp * err_f + self.kd * d

            twist = Twist()
            twist.linear.x = self.base_speed
            twist.angular.z = -z
            self.pub_cmd.publish(twist)

        elif self.state == TrackState.SEARCH_SCAN:
            if has_line:
                self.state = TrackState.FOLLOW
                self.yaw_buffer.clear()
                self.get_logger().info("Line reacquired")
                return

            dt = (self.get_clock().now() - self.search_start_time).nanoseconds * 1e-9

            twist = Twist()
            if dt < 0.5:
                twist.angular.z = 0.4
            elif dt < 1.0:
                twist.angular.z = -0.4
            elif dt < 1.5:
                twist.angular.z = 0.6
            elif dt < 2.0:
                twist.angular.z = -0.6
            else:
                self.start_turn()
                return

            self.pub_cmd.publish(twist)

        elif self.state == TrackState.TURN:
            return

        cv2.rectangle(frame, (10, 10), (260, 90), (0, 0, 0), -1)

        cv2.putText(
            frame,
            f"STATE: {self.state}",
            (20, 45),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            (0, 255, 0),
            2,
            cv2.LINE_AA
        )    
        
        gst_process.stdin.write(frame.tobytes())
        gst_process.stdin.flush()
        self.pub_img.publish(self.bridge.cv2_to_imgmsg(frame, "bgr8"))

def main(args=None):
    rclpy.init(args=args)
    node = ColorTrackPID()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()