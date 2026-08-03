import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from cv_bridge import CvBridge
from geometry_msgs.msg import Twist, PoseStamped
from scipy.spatial.transform import Rotation as Rscipy

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
    'rawvideoparse', 'format=bgr', 'width=640', 'height=480', 'framerate=10/1', '!',
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
    
class ApriltagTrackPid(Node):
    def __init__(self):
        super().__init__('apriltag_track_pid')
        self.image_raw_subscription = self.create_subscription(
            Image, '/image_raw', self.image_callback, 10)
        self.apriltag_track_pid_publisher = self.create_publisher(
            Image, '/apriltag_track_pid/result', 10)
        # Command spine: never publish /cmd_vel directly. twist_mux owns that
        # topic (ugv_cockpit/config/twist_mux.yaml). Self-driving demo -> the
        # lowest rung, priority 10; any human teleop input outranks it.
        self.cmd_vel_pub = self.create_publisher(Twist, '/cmd_vel_nav', 10)

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

        # === PID Setup ===
        self.target_distance = 0.3
        self.target_yaw = 0.0
        self.distance_pid = PID(kp=1.25, ki=0.0, kd=0.05, output_limits=(-0.3, 0.3), tolerance=0.05)
        self.angle_pid = PID(kp=2.0, ki=0.00, kd=0.0, output_limits=(-1.5708, 1.5708), tolerance=0.1)

    def image_callback(self, msg):
        frame = self.bridge.imgmsg_to_cv2(msg, "bgr8")

        # self.frame_count = getattr(self, "frame_count", 0)
        # self.frame_count += 1
        # if self.frame_count % 3 != 0:  # 
        #     return

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        gray = cv2.equalizeHist(gray)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)

        # Detect apriltags in the image
        fx = self.K[0, 0]
        fy = self.K[1, 1]
        cx = self.K[0, 2]
        cy = self.K[1, 2]
        camera_params = (fx, fy, cx, cy)

        results = self.detector.detect(gray, False, camera_params, self.tag_size)
        twist = Twist()

        if results:
            for r in results:
                if r.tag_id == 0:
                    # Get the corners of the apriltag
                    corners = r.corners.astype(int)
                    center_x, center_y = int(r.center[0]), int(r.center[1])

                    # --- Improved PnP with RANSAC + refine ---
                    image_pts = np.array(corners, dtype=np.float32).reshape(-1, 2)
                    object_pts = self.obj_pts.reshape(-1, 3).astype(np.float32)
                    dist = np.zeros((5,), dtype=np.float32)
                    cam = self.K

                    success, rvec, tvec, inliers = cv2.solvePnPRansac(
                        object_pts, image_pts, cam, dist,
                        flags=cv2.SOLVEPNP_IPPE_SQUARE,
                        reprojectionError=3.0,    
                        confidence=0.99,
                        iterationsCount=200,
                    )

                    if not success:
                        self.get_logger().warn("solvePnPRansac failed.")
                        return
                    else:

                        n_inliers = 0 if inliers is None else len(inliers)
                        self.get_logger().info(f"PnPRansac success with {n_inliers} inliers")

                        try:
                            rvec, tvec = cv2.solvePnPRefineLM(
                                object_pts[inliers[:, 0]], image_pts[inliers[:, 0]],
                                cam, dist, rvec, tvec
                            )
                        except Exception:
                            pass
                        
                        R, _ = cv2.Rodrigues(rvec)
                        U, _, Vt = np.linalg.svd(R)
                        R_ortho = U @ Vt
                        rvec, _ = cv2.Rodrigues(R_ortho)

                        proj, _ = cv2.projectPoints(object_pts, rvec, tvec, cam, dist)
                        err = np.linalg.norm(proj.reshape(-1, 2) - image_pts, axis=1)
                        self.get_logger().info(f"mean reproj err = {err.mean():.2f}px")

                        print(tvec)
                        x_b, y_b, z_b = tvec.flatten()

                        error_x = center_x - 320
                        yaw_b = np.arctan2(error_x, self.K[0,0])

                        corners = corners.astype(int)
                        cv2.polylines(frame, [corners], True, (0,255,0), 2)
                        cv2.putText(frame, f"dist={z_b:.2f} yaw={yaw_b:.2f}",
                                    (corners[0][0], corners[0][1]-10),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,0), 1)

                        v = self.distance_pid.compute(self.target_distance, z_b)
                        z = self.angle_pid.compute(self.target_yaw, yaw_b)

                        twist.linear.x = -v
                        twist.angular.z = z

        self.cmd_vel_pub.publish(twist)

        gst_process.stdin.write(frame.tobytes())
        gst_process.stdin.flush()

        result_msg = self.bridge.cv2_to_imgmsg(frame, encoding="bgr8")
        self.apriltag_track_pid_publisher.publish(result_msg)


def main(args=None):
    # Initialize the ROS client library
    rclpy.init(args=args)
    apriltag_track_pid = ApriltagTrackPid()
    # Spin the node
    rclpy.spin(apriltag_track_pid)
    # Destroy the node
    apriltag_track_pid.destroy_node()
    # Shutdown the ROS client library
    rclpy.shutdown()

if __name__ == '__main__':
    # Run the main function
    main()