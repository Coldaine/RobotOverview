import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from geometry_msgs.msg import Twist
from rcl_interfaces.msg import SetParametersResult
from cv_bridge import CvBridge

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
from pathlib import Path
_MODULE_DIR = Path(__file__).resolve().parent
CONFIG_DIR = _MODULE_DIR.parent / "config"
CONFIG_PATH = CONFIG_DIR / "lab_tool_colors.json"
_DEFAULT_LOWER = [0, 100, 187]
_DEFAULT_UPPER = [255, 255, 255]

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
        self.base_speed = 0.2
        self.recover_time = 0.4

        self.scan_dir = 1
        self.scan_yaw_base = 0.5
        self.scan_yaw_max = math.pi
        self.max_scan_time = 10.0

        self._load_colors_from_json()

        self.add_on_set_parameters_callback(self.on_param_change)

        # ROI
        model = os.environ.get('ROARM_MODEL', None)
        if model:
            self.roi = [
                (150,  200, 40, 600, 0.2),
                (200,  250, 40, 600, 0.3),
                (250,  300, 40, 600, 0.5),
            ]
        else:
            self.roi = [
                (250, 300, 40, 600, 0.1),
                (300, 400, 40, 600, 0.3),
                (400, 480, 40, 600, 0.6),
            ]

        self.get_logger().info("ColorTrackPID Node started")

    def _load_colors_from_json(self):
        profile = "yellow"

        if not CONFIG_PATH.is_file():
            self.get_logger().warn(
                f"Config not found: {CONFIG_PATH}, use default LAB"
            )
            self.lower_color = np.array(_DEFAULT_LOWER, dtype=np.uint8)
            self.upper_color = np.array(_DEFAULT_UPPER, dtype=np.uint8)
            return

        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            profiles = json.load(f)

        if profile not in profiles:
            self.get_logger().warn(
                f"Profile '{profile}' not in {CONFIG_PATH}, "
                f"available: {list(profiles.keys())}, use default"
            )
            self.lower_color = np.array(_DEFAULT_LOWER, dtype=np.uint8)
            self.upper_color = np.array(_DEFAULT_UPPER, dtype=np.uint8)
            return

        p = profiles[profile]
        self.lower_color = np.array(p["lower"], dtype=np.uint8)
        self.upper_color = np.array(p["upper"], dtype=np.uint8)
        self.get_logger().info(
            f"LAB from json [{profile}]: lower={self.lower_color.tolist()} "
            f"upper={self.upper_color.tolist()}"
        )

    def on_param_change(self, params):
        reload_needed = False
        for param in params:
            if param.name == "color":
                reload_needed = True
        if reload_needed:
            self._load_colors_from_json()
        return SetParametersResult(successful=True)

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

        gst_process.stdin.write(frame.tobytes())
        gst_process.stdin.flush()
        self.pub_img.publish(self.bridge.cv2_to_imgmsg(frame, "bgr8"))
        self.pub_cmd.publish(twist)

def main(args=None):
    rclpy.init(args=args)
    node = ColorTrackPID()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()
