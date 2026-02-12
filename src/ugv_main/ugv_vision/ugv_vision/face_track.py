#!/usr/bin/env python3
import rclpy
from rcl_interfaces.msg import ParameterDescriptor
from rclpy.node import Node
from sensor_msgs.msg import Image
from std_msgs.msg import Float64MultiArray
from geometry_msgs.msg import Twist
from cv_bridge import CvBridge
import cv2
import numpy as np
import math

from .track_pid import PID
from .UltraFaceNcnn import UltraFaceNcnn
import os
import subprocess
import signal
import time
import threading

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

curpath = os.path.realpath(__file__)
thisPath = os.path.dirname(curpath)

K = np.array([
    [289.11451,   0.     , 347.23664],
    [  0.     , 289.75319, 235.67429],
    [  0.     ,   0.     ,   1.     ]
], dtype=np.float64)

class GestureCtrl(Node):
    def __init__(self):
        super().__init__('gesture_ctrl')
        # Subscribe to the image_raw topic
        self.image_raw_subscription = self.create_subscription(Image,'/image_raw', self.image_callback,10)
        # Create a CvBridge object for converting between ROS Image messages and OpenCV images
        self.bridge = CvBridge()
        self.gesture_ctrl_publisher = self.create_publisher(Image, '/gesture_ctrl/result', 10)

        self.face_detector = UltraFaceNcnn(thisPath + '/models/ultraface-ncnn/RFB-320.param',thisPath + '/models/ultraface-ncnn/RFB-320.bin', input_size=(320,240), threshold=0.7, nms_threshold=0.3)
        self.cmd_vel_pub = self.create_publisher(Twist, '/cmd_vel', 10)

        self.target_distance = 0.5
        self.target_yaw = 0.0
        self.face_w = 0.15

        self.distance_pid = PID(kp=1.25, ki=0.0, kd=0.05, output_limits=(-0.15, 0.15), tolerance=0.05)
        self.angle_pid = PID(kp=2.0, ki=0.00, kd=0.0, output_limits=(-1.5708, 1.5708), tolerance=0.1)

    def image_callback(self, msg):
        # Convert the ROS Image message to an OpenCV image
        frame = self.bridge.imgmsg_to_cv2(msg, "bgr8")
        # Convert the image to RGB
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        h, w = frame.shape[:2]
        cx, cy = w // 2, h // 2
        # Process the image using mediapipe
        faces = self.face_detector.detect(frame)
        best_value = 0
        # Check if there are any hands in the image
        twist = Twist()
        if len(faces):
            for face in faces:
                score = face.score             
                area = (face.x2 - face.x1) * (face.y2 - face.y1)   
                
                combined = score * area         

                if combined > best_value:
                    best_value = combined
                    best_face = face

            if best_face:
                x = int((best_face.x1 + best_face.x2) / 2)
                y = int((best_face.y1 + best_face.y2) / 2)

                distance = (self.face_w * K[0,0]) / (best_face.x2 - best_face.x1)
                error_x = x - w/2
                yaw = np.arctan2(error_x, K[0,0])

                v = self.distance_pid.compute(self.target_distance, distance)
                z = self.angle_pid.compute(self.target_yaw, yaw)
                # twist.linear.x = -v
                twist.angular.z = z
                cv2.rectangle(frame,(int(best_face.x1),int(best_face.y1)),(int(best_face.x2),int(best_face.y2)),(64,128,255),1)
            
            else:
                twist.linear.x = 0.0
                twist.angular.z = 0.0
        self.cmd_vel_pub.publish(twist)
        # Convert the image back to a ROS Image message
        result_img_msg = self.bridge.cv2_to_imgmsg(frame, encoding="bgr8")                                                                                      
        # Publish the image
        self.gesture_ctrl_publisher.publish(result_img_msg)
        gst_process.stdin.write(frame.tobytes())
        gst_process.stdin.flush()

def main(args=None):
    # Initialize the ROS client library
    rclpy.init(args=args)
    # Create a GestureCtrl node
    gesture_ctrl = GestureCtrl()
    # Spin the node
    rclpy.spin(gesture_ctrl)
    # Destroy the node
    gesture_ctrl.destroy_node()
    # Shutdown the ROS client library
    rclpy.shutdown()

if __name__ == '__main__':
    # Run the main function
    main()

