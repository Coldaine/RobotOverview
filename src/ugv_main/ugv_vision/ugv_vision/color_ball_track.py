import rclpy
from rclpy.node import Node
from rclpy.duration import Duration
from sensor_msgs.msg import Image
from geometry_msgs.msg import Twist
from rcl_interfaces.msg import ParameterDescriptor, SetParametersResult
from cv_bridge import CvBridge

from .track_pid import PID

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
from pathlib import Path
_MODULE_DIR = Path(__file__).resolve().parent
CONFIG_DIR = _MODULE_DIR.parent / "config"
CONFIG_PATH = CONFIG_DIR / "lab_tool_colors.json"

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

K = np.array([
    [289.11451,   0.     , 347.23664],
    [  0.     , 289.75319, 235.67429],
    [  0.     ,   0.     ,   1.     ]
], dtype=np.float64)

def robust_mean_remove_outliers(arr, mz_thresh=3.5, is_angle=False):
    if arr.size == 0:
        return 0.0

    if is_angle:
        sin_vals = np.sin(arr)
        cos_vals = np.cos(arr)
        arr = np.arctan2(sin_vals, cos_vals)  

    med = np.median(arr)
    mad = np.median(np.abs(arr - med))

    if mad == 0:
        if arr.size >= 3:
            s = np.sort(arr)
            mean_val = float(np.mean(s[1:-1]))
        else:
            mean_val = float(np.mean(arr))
    else:
        mod_z = 0.6745 * (arr - med) / mad
        filtered = arr[np.abs(mod_z) <= mz_thresh]
        if filtered.size == 0:
            mean_val = float(np.mean(arr))
        else:
            mean_val = float(np.mean(filtered))

    if is_angle:
        sin_vals = np.sin(arr)
        cos_vals = np.cos(arr)
        mean_val = np.arctan2(np.mean(sin_vals), np.mean(cos_vals))

    return mean_val

class ColorTrackPID(Node):
    def __init__(self):
        super().__init__('color_track_pid')
        # Create a subscription to the image_raw topic
        # self.image_rect_subscription = self.create_subscription(Image,'/image_rect', self.image_callback,10)
        self.image_raw_subscription = self.create_subscription(Image,'/image_raw', self.image_callback,10)
        # Create a publisher to publish the tracked image to the color_track_pid/result topic
        self.color_track_pid_publisher = self.create_publisher(Image, '/color_track_pid/result', 10)
        # Create a CvBridge object to convert between ROS Image messages and OpenCV images
        self.bridge = CvBridge()

        self.declare_parameter(
            "color", "green",
            ParameterDescriptor(description="Key in config/lab_tool_colors.json")
        )
        self._load_colors_from_json()

        self.cmd_vel_pub = self.create_publisher(Twist, '/cmd_vel', 10)

        self.ball_diameter = 0.038
        self.target_distance = 0.2
        self.target_yaw = 0.0

        self.distance_pid = PID(kp=1.25, ki=0.0, kd=0.05, output_limits=(-0.3, 0.3), tolerance=0.05)
        self.angle_pid = PID(kp=2.0, ki=0.00, kd=0.0, output_limits=(-1.5708, 1.5708), tolerance=0.1)

        self.distance_buffer = deque(maxlen=10)
        self.yaw_buffer = deque(maxlen=10)
        self.add_on_set_parameters_callback(self.on_param_change)

    def _load_colors_from_json(self):
        profile = self.get_parameter("color").get_parameter_value().string_value

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
        cx, cy, w = None, None, None
        frame = self.bridge.imgmsg_to_cv2(msg, "bgr8")
        
        self.frame_count = getattr(self, "frame_count", 0)
        self.frame_count += 1
        if self.frame_count % 3 != 0:  
            return

        img_h, img_w = frame.shape[:2]
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
 
        mask = cv2.inRange(lab, self.lower_color, self.upper_color)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if contours:
            c = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(c)
            if area > 100:  
                ((x, y), radius) = cv2.minEnclosingCircle(c)
                circularity = area / (math.pi * radius * radius)
                if 0.5 < circularity < 1.3:  
                    cx, cy, w = int(x), int(y), int(radius*2)

                    cv2.circle(frame, (cx, cy), int(radius), (0, 255, 0), 2)
                    cv2.circle(frame, (cx, cy), 3, (255, 0, 0), -1)
                    # self.get_logger().info(f'Tracking ball at ({cx}, {cy}), area={area:.1f}, circularity={circularity:.2f}')

        twist = Twist()
        if cx is not None:
            distance_m = (self.ball_diameter * K[0,0]) / w
            self.distance_buffer.append(distance_m)
            distance_avg = robust_mean_remove_outliers(np.array(self.distance_buffer))

            error_x = cx - img_w/2
            current_yaw = np.arctan2(error_x, K[0,0])
            self.yaw_buffer.append(current_yaw)
            yaw_avg = robust_mean_remove_outliers(np.array(self.yaw_buffer), is_angle=True)

            v = self.distance_pid.compute(self.target_distance, distance_avg)
            z = self.angle_pid.compute(self.target_yaw, yaw_avg)
            twist.linear.x = -v
            twist.angular.z = z
            # self.get_logger().info(f"Measured={distance_avg:.2f}m, v={-v:.2f}, z={-z:.2f}")
        else:
            twist.linear.x = 0.0
            twist.angular.z = 0.0

        self.cmd_vel_pub.publish(twist)

        gst_process.stdin.write(frame.tobytes())
        gst_process.stdin.flush()
        result_img_msg = self.bridge.cv2_to_imgmsg(frame, encoding="bgr8")
        self.color_track_pid_publisher.publish(result_img_msg)

def main(args=None):
    # Initialize the ROS 2 client library
    rclpy.init(args=args)
    # Create a ColorTrackPID node
    color_track_pid = ColorTrackPID()
    # Spin the node
    rclpy.spin(color_track_pid)
    # Destroy the node
    color_track_pid.destroy_node()
    # Shutdown the ROS 2 client library
    rclpy.shutdown()

if __name__ == '__main__':
    main()

