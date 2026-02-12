#!/usr/bin/env python3
import rclpy
from rcl_interfaces.msg import ParameterDescriptor
from rclpy.node import Node
from sensor_msgs.msg import Image
from geometry_msgs.msg import Twist,Pose
from nav_msgs.msg import Odometry 

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
        # Create a publisher for the gesture_ctrl/result topic
        self.gesture_ctrl_publisher = self.create_publisher(Image, '/gesture_ctrl/result', 10)
  
        # Create a CvBridge object for converting between ROS Image messages and OpenCV images
        self.bridge = CvBridge()

        self.cmd_vel_pub = self.create_publisher(Twist, '/cmd_vel', 10)

        self.target_yaw = 0.0

        self.angle_pid = PID(kp=2.0, ki=0.00, kd=0.0, output_limits=(-1.5708, 1.5708), tolerance=0.1)
        self.last_gesture_type = 0
        self.create_subscription(Odometry, '/odom', self.odom_callback, 10)

        self.distance = Pose().position
        self.yaw = 0.0

        self.behavior_running = "stop"
        self.behavior_lock = threading.Lock()

        threading.Thread(target=self.behavior_thread, daemon=True).start()

        self.gesture_buffer = []
        self.GESTURE_CONFIRM_COUNT = 3

    def check_gesture_stable(self, gesture_type):

        if gesture_type is None:
            return False

        self.gesture_buffer.append(gesture_type)

        if len(self.gesture_buffer) > self.GESTURE_CONFIRM_COUNT:
            self.gesture_buffer.pop(0)

        if len(self.gesture_buffer) == self.GESTURE_CONFIRM_COUNT and \
        all(g == gesture_type for g in self.gesture_buffer):
            return True

        return False

    def odom_callback(self, msg):
        # Get the orientation of the robot
        q1 = msg.pose.pose.orientation.x
        q2 = msg.pose.pose.orientation.y
        q3 = msg.pose.pose.orientation.z
        q0 = msg.pose.pose.orientation.w

        # Calculate the yaw of the robot
        siny_cosp = 2 * (q0 * q3 + q1 * q2)
        cosy_cosp = 1 - 2 * (q2 * q2 + q3 * q3)
        
        # Store the distance and yaw of the robot
        self.distance = msg.pose.pose.position
        self.yaw = math.atan2(siny_cosp, cosy_cosp)  

    def drive_on_heading(self, distance):
        # Drive the robot on a heading
        print('Drive on heading')
        twist_msg = Twist()
        twist_msg.linear.x = 0.1  
        twist_msg.angular.z = 0.0
        
        # Store the start distance
        start_distance = self.distance
        print('start distance:', start_distance)
           
        # Calculate the delta distance
        delta_distance = 0
        while abs(delta_distance) < abs(distance):
            diff_x = self.distance.x - start_distance.x
            diff_y = self.distance.y - start_distance.y
            delta_distance = math.hypot(diff_x, diff_y)
            
            print('now distance:', self.distance.x, self.distance.y)    
            print('Distance moved:', delta_distance)
            self.cmd_vel_pub.publish(twist_msg)
        self.stop()

    def back_up(self, distance):
        # Back up the robot
        print('Back up')
        twist_msg = Twist()
        twist_msg.linear.x = -0.1  
        twist_msg.angular.z = 0.0
        
        # Store the start distance
        start_distance = self.distance
        print('start distance:', start_distance)
  
        # Calculate the delta distance
        delta_distance = 0
        while abs(delta_distance) < abs(distance):
            diff_x = self.distance.x - start_distance.x
            diff_y = self.distance.y - start_distance.y
            delta_distance = math.hypot(diff_x, diff_y)
            
            print('now distance:', self.distance.x, self.distance.y)    
            print('Distance moved:', delta_distance)
            self.cmd_vel_pub.publish(twist_msg)
        self.stop()
        
    def spin(self, angle):
        # Spin the robot
        print('Spin')
        twist_msg = Twist()
        
        # Determine the direction of the spin
        if angle > 0:
            twist_msg.angular.z = 1.0
        else:
            twist_msg.angular.z = -1.0     
               
        twist_msg.linear.x = 0.0

        # Store the start yaw
        start_yaw = self.yaw
        # Calculate the target yaw
        target_yaw = (start_yaw + math.radians(angle)) % (2 * math.pi)
        
        # Calculate the delta yaw
        delta_yaw = 0.0
        while abs(delta_yaw) < abs(math.radians(angle)):
            delta_yaw = self.yaw - start_yaw
            delta_yaw = (delta_yaw + math.pi) % (2 * math.pi) - math.pi 
            print(f'Rotated angle: {math.degrees(delta_yaw)} degrees')
            self.cmd_vel_pub.publish(twist_msg)
        self.stop()
        
    def stop(self):
        # Stop the robot
        print('Stop')
        twist_msg = Twist()
        twist_msg.linear.x = 0.0
        twist_msg.angular.z = 0.0
        self.cmd_vel_pub.publish(twist_msg)
        self.behavior_done = True 

    def behavior_thread(self):
        while rclpy.ok():
            if self.behavior_running:
                # 有行为要执行
                with self.behavior_lock:
                    behavior = self.behavior_running

                if behavior == "forward":
                    self.drive_on_heading(0.1)

                elif behavior == "backward":
                    self.back_up(-0.1)

                elif behavior == "turn_left":
                    self.spin(30)

                elif behavior == "turn_right":
                    self.spin(-30)

                elif behavior == "stop":
                    self.stop()

                self.behavior_running = False

            time.sleep(0.01)

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

    def image_callback(self, msg):
        # Convert the ROS Image message to an OpenCV image
        frame = self.bridge.imgmsg_to_cv2(msg, "bgr8")
        # Convert the image to RGB
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        h, w = frame.shape[:2]
        cx, cy = w // 2, h // 2
        # Process the image using mediapipe
        results = hands.process(image_rgb)   
            
        twist = Twist()
        # Check if there are any hands in the image
        if results.multi_hand_landmarks:
            # Loop through the hands
            for hand_landmarks in results.multi_hand_landmarks:
                gesture_type, point_pos = self.detect_gesture(hand_landmarks) 
                print(gesture_type)
                
                # Check the gesture type and send the corresponding goal
                if gesture_type == 1 and self.check_gesture_stable(1) and point_pos is not None: 
                    x, y = point_pos
                    error_x = x - w/2
                    yaw = np.arctan2(error_x, K[0,0])
                    z = self.angle_pid.compute(self.target_yaw, yaw)
                    
                    twist.angular.z = z

                elif gesture_type == 3 and self.check_gesture_stable(3):
                    if not self.behavior_running:       
                        self.behavior_running = "forward"
                elif gesture_type == 5 and self.check_gesture_stable(5):
                    if not self.behavior_running:       
                        self.behavior_running = "backward"                                                                       
                # Draw the landmarks on the image
                mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)   
            self.last_gesture_type = gesture_type
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

