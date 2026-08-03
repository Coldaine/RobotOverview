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
import os
import subprocess
import signal
import time
import threading
import mediapipe as mp

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

# Initialize mediapipe hands
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=False, max_num_hands=1, min_detection_confidence=0.5)
mp_draw = mp.solutions.drawing_utils

class GestureCtrl(Node):
    def __init__(self):
        super().__init__('gesture_ctrl')
        # Subscribe to the image_raw topic
        self.image_raw_subscription = self.create_subscription(Image,'/image_raw', self.image_callback,10)
        # Create a publisher for the gesture_ctrl/result topic
        self.gesture_ctrl_publisher = self.create_publisher(Image, '/gesture_ctrl/result', 10)
        self.pt_pub = self.create_publisher(Float64MultiArray, '/pt_joint_position_controller/commands', 10)
        self.led_pub = self.create_publisher(Float32MultiArray, '/ugv/led_ctrl', 10)
        self.pt_x = 0.0  
        self.pt_y = 0.0 
        self.x_pid = PID(kp=0.9, ki=0.0, kd=0.1, output_limits=(-math.pi/4, math.pi/4), tolerance=0.02)
        self.y_pid = PID(kp=0.7, ki=0.0, kd=0.05, output_limits=(-math.pi/4, math.pi/4), tolerance=0.02)

        # Create a CvBridge object for converting between ROS Image messages and OpenCV images
        self.bridge = CvBridge()

        self.last_gesture_type = 0
        self.pic_last_time = time.time()
        self.pic_interval = 6

    def detect_gesture(self, hand_landmarks):

        lm = hand_landmarks.landmark
        w, h = 640, 480

        lmlist = [[i, int(p.x * w), int(p.y * h)] for i, p in enumerate(lm)]
        if len(lmlist) != 21:
            return None, None

        tip_ids = [4, 8, 12, 16, 20]  

        is_right_hand = lm[mp_hands.HandLandmark.WRIST].x < \
                        lm[mp_hands.HandLandmark.INDEX_FINGER_MCP].x

        fingers = []

        if is_right_hand:
            fingers.append(lmlist[4][1] < lmlist[3][1])
        else:
            fingers.append(lmlist[4][1] > lmlist[3][1])

        for i in range(1, 5):
            fingers.append(lmlist[tip_ids[i]][2] < lmlist[tip_ids[i] - 2][2])

        finger_count = sum(fingers)

        pip_ids = [3, 6, 10, 14, 18]
        if finger_count == 1:
            idx = fingers.index(True)  

            pip_ids = [3, 6, 10, 14, 18]  

            pip_id = pip_ids[idx]          
            cx, cy = lmlist[pip_id][1], lmlist[pip_id][2]
            return finger_count, (cx, cy)

        return finger_count, None

    def save_image_async(self,path, frame):
        def worker():
            if time.time() - self.pic_last_time > self.pic_interval:
                self.led_ctrl([255.0,255.0])
                time.sleep(0.01)
                cv2.imwrite(path, frame)
                self.led_ctrl([0.0,0.0])
                self.pic_last_time = time.time()

        t = threading.Thread(target=worker)
        t.daemon = True
        t.start()

    def led_ctrl(self, data):
        msg = Float32MultiArray()
        msg.data = data
        self.led_pub.publish(msg)

    def image_callback(self, msg):
        # Convert the ROS Image message to an OpenCV image
        frame = self.bridge.imgmsg_to_cv2(msg, "bgr8")
        # Convert the image to RGB
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        h, w = frame.shape[:2]
        cx, cy = w // 2, h // 2
        # Process the image using mediapipe
        results = hands.process(image_rgb)   
            
        # Check if there are any hands in the image
        if results.multi_hand_landmarks:
            # Loop through the hands
            for hand_landmarks in results.multi_hand_landmarks:
                gesture_type, point_pos = self.detect_gesture(hand_landmarks) 
                print(gesture_type)
                
                # Check the gesture type and send the corresponding goal
                if gesture_type == 1 and point_pos is not None: 
                    x, y = point_pos

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

                elif self.last_gesture_type==1 and gesture_type == 2: 
                    print("take photo")
                    self.save_image_async("output.jpg", frame.copy())
                    
                # Draw the landmarks on the image
                mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)   
            self.last_gesture_type = gesture_type
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

