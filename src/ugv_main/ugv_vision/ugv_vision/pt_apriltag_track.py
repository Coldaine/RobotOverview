#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from cv_bridge import CvBridge
from std_msgs.msg import Float64MultiArray

import cv2
import numpy as np
import json
from dt_apriltags import Detector
import os
import yaml
import subprocess
import signal
import time
import math
from math import isnan
from collections import deque
from .track_pid import PID

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
   
class PtApriltagTrackerNode(Node):
    def __init__(self):
        super().__init__('pt_apriltag_tracker')

        self.image_raw_subscription = self.create_subscription(Image, '/image_raw', self.image_callback, 10)
        self.pt_pub = self.create_publisher(Float64MultiArray, '/pt_joint_position_controller/commands', 10)
        self.image_pub = self.create_publisher(Image, '/pt_apriltag_tracker/result', 10)

        self.get_logger().info("Apriltag Tracker Node Initialized.")
        self.bridge = CvBridge()
        self.detector = Detector(
            families='tag36h11',
            nthreads=2,
            # quad_decimate=1.0,
            # quad_sigma=0.0,
            # refine_edges=1,
            # decode_sharpening=0.25,
            # debug=0
        )

        # === Camera parameters ===
        self.K = np.array([
            [289.11451, 0.0, 347.23664],
            [0.0, 289.75319, 235.67429],
            [0.0, 0.0, 1.0]
        ], dtype=np.float64)

        self.tag_size = 0.028
        self.obj_pts = np.array([
            [-self.tag_size / 2, -self.tag_size / 2, 0],
            [ self.tag_size / 2, -self.tag_size / 2, 0],
            [ self.tag_size / 2,  self.tag_size / 2, 0],
            [-self.tag_size / 2,  self.tag_size / 2, 0]
        ], dtype=np.float32)

        self.pt_x = 0.0  
        self.pt_y = 0.0 

        self.x_pid = PID(kp=0.9, ki=0.0, kd=0.1, output_limits=(-math.pi/4, math.pi/4), tolerance=0.02)
        self.y_pid = PID(kp=0.7, ki=0.0, kd=0.05, output_limits=(-math.pi/4, math.pi/4), tolerance=0.02)

    def image_callback(self, msg):
        frame = self.bridge.imgmsg_to_cv2(msg, desired_encoding='bgr8')

        # self.frame_count = getattr(self, "frame_count", 0)
        # self.frame_count += 1
        # if self.frame_count % 3 != 0:  # 
        #     return

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        gray = cv2.equalizeHist(gray)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)

        # Detect apriltags in the image
        cam_fx = self.K[0, 0]
        cam_fy = self.K[1, 1]
        cam_cx = self.K[0, 2]
        cam_cy = self.K[1, 2]
        camera_params = (cam_fx, cam_fy, cam_cx, cam_cy)

        results = self.detector.detect(gray, False, camera_params, self.tag_size)

        if results:
            for r in results:
                if r.tag_id == 0:
                    corners = r.corners.astype(int)
                    x, y = int(r.center[0]), int(r.center[1])

                    h, w = frame.shape[:2]
                    cx, cy = w // 2, h // 2

                    error_x = 0.1*(x - cx) / cx
                    error_y = 0.1*(y - cy) / cy

                    delta_x = self.x_pid.compute(0.0, error_x)
                    delta_y = self.y_pid.compute(0.0, error_y)

                    self.pt_x += delta_x
                    self.pt_y += delta_y
                    self.pt_x = max(-3.14, min(3.14, self.pt_x))
                    self.pt_y = max(-0.523, min(1.57, self.pt_y))

                    pt_msg = Float64MultiArray()
                    pt_msg.data = [self.pt_x, self.pt_y]
                    self.pt_pub.publish(pt_msg)

                    corners = corners.astype(int)
                    cv2.polylines(frame, [corners], True, (0,255,0), 2)

        img_msg = self.bridge.cv2_to_imgmsg(frame, encoding="bgr8")
        self.image_pub.publish(img_msg)
        gst_process.stdin.write(frame.tobytes())
        gst_process.stdin.flush()

def main(args=None):
    rclpy.init(args=args)
    node = PtApriltagTrackerNode()
    rclpy.spin(node)
    cv2.destroyAllWindows()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
