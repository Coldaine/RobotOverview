#!/usr/bin/env python3
import rclpy
from rcl_interfaces.msg import ParameterDescriptor
from rclpy.node import Node
from sensor_msgs.msg import Image
from std_msgs.msg import Float32MultiArray,Float64MultiArray
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

class GestureCtrl(Node):
    def __init__(self):
        super().__init__('gesture_ctrl')
        # Subscribe to the image_raw topic
        self.image_raw_subscription = self.create_subscription(Image,'/image_raw', self.image_callback,10)
        # Create a publisher for the gesture_ctrl/result topic
        self.gesture_ctrl_publisher = self.create_publisher(Image, '/gesture_ctrl/result', 10)
        self.pt_pub = self.create_publisher(Float64MultiArray, '/pt_joint_position_controller/commands', 10)
        self.pt_x = 0.0  
        self.pt_y = 0.0 
        self.x_pid = PID(kp=0.9, ki=0.0, kd=0.1, output_limits=(-math.pi/4, math.pi/4), tolerance=0.02)
        self.y_pid = PID(kp=0.7, ki=0.0, kd=0.05, output_limits=(-math.pi/4, math.pi/4), tolerance=0.02)

        # Create a CvBridge object for converting between ROS Image messages and OpenCV images
        self.bridge = CvBridge()

        self.last_gesture_type = 0
        self.face_detector = UltraFaceNcnn(thisPath + '/models/ultraface-ncnn/RFB-320.param',thisPath + '/models/ultraface-ncnn/RFB-320.bin', input_size=(320,240), threshold=0.7, nms_threshold=0.3)

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
        if len(faces):
            for face in faces:
                score = face.score              # 置信度
                area = (face.x2 - face.x1) * (face.y2 - face.y1)   # 面积
                
                combined = score * area         # 综合评分（可以调整策略）

                if combined > best_value:
                    best_value = combined
                    best_face = face

            if best_face:
                x = int((best_face.x1 + best_face.x2) / 2)
                y = int((best_face.y1 + best_face.y2) / 2)

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

                cv2.rectangle(frame,(int(best_face.x1),int(best_face.y1)),(int(best_face.x2),int(best_face.y2)),(64,128,255),1)
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

