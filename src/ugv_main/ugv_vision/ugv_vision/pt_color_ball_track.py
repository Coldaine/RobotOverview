#!/usr/bin/env python3
import rclpy
from rcl_interfaces.msg import ParameterDescriptor,SetParametersResult
from rclpy.node import Node
from sensor_msgs.msg import Image
from std_msgs.msg import Float64MultiArray
from cv_bridge import CvBridge
import cv2
import numpy as np
import math

from geometry_msgs.msg import Twist

from .track_pid import PID
import os
import subprocess
import signal

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

class PtColorTrackerNode(Node):
    def __init__(self):
        super().__init__('pt_color_tracker')

        # Declare parameters for lower and upper hue, saturation, and value
        self.declare_parameter("lower_l", 110, ParameterDescriptor(description="Lower L"))
        self.declare_parameter("lower_a", 0, ParameterDescriptor(description="Lower A"))
        self.declare_parameter("lower_b", 0, ParameterDescriptor(description="Lower B"))
        
        self.declare_parameter("upper_l", 255, ParameterDescriptor(description="Upper L"))
        self.declare_parameter("upper_a", 110, ParameterDescriptor(description="Upper A"))
        self.declare_parameter("upper_b", 255, ParameterDescriptor(description="Upper B"))

        # Initialize the lower and upper color arrays with the parameter values
        self.lower_color = np.array([self.get_parameter("lower_l").value, 
                                     self.get_parameter("lower_a").value, 
                                     self.get_parameter("lower_b").value])
        self.upper_color = np.array([self.get_parameter("upper_l").value, 
                                     self.get_parameter("upper_a").value, 
                                     self.get_parameter("upper_b").value])

        self.pt_x = 0.0  
        self.pt_y = 0.0 

        self.bridge = CvBridge()

        self.create_subscription(Image, '/image_raw', self.image_callback, 10)

        self.pt_pub = self.create_publisher(Float64MultiArray, '/pt_joint_position_controller/commands', 10)

        self.image_pub = self.create_publisher(Image, '/pt_color_tracker/image_debug', 10)

        self.get_logger().info("Color Tracker Node Initialized.")

        self.min_area = 1000
        self.max_area = 20000

        self.x_pid = PID(kp=0.9, ki=0.0, kd=0.1, output_limits=(-math.pi/4, math.pi/4), tolerance=0.02)
        self.y_pid = PID(kp=0.7, ki=0.0, kd=0.05, output_limits=(-math.pi/4, math.pi/4), tolerance=0.02)
        self.add_on_set_parameters_callback(self.on_param_change)

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
        
    def image_callback(self, msg):
        frame = self.bridge.imgmsg_to_cv2(msg, desired_encoding='bgr8')

        # self.frame_count = getattr(self, "frame_count", 0)
        # self.frame_count += 1
        # if self.frame_count % 2 != 0:  # 
        #     return

        h, w = frame.shape[:2]
        cx, cy = w // 2, h // 2
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
 
        mask = cv2.inRange(lab, self.lower_color, self.upper_color)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if contours:
            c = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(c)
            
            if self.min_area <= area <= self.max_area:
                print
                (x, y), radius = cv2.minEnclosingCircle(c)

                if radius > 5:

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

                    cv2.circle(frame, (int(x), int(y)), int(radius), (0, 255, 0), 2)
                    cv2.line(frame, (int(x), int(y)), (cx, cy), (255, 0, 0), 2)

        img_msg = self.bridge.cv2_to_imgmsg(frame, encoding="bgr8")
        self.image_pub.publish(img_msg)
        gst_process.stdin.write(frame.tobytes())
        gst_process.stdin.flush()

def main(args=None):
    rclpy.init(args=args)
    node = PtColorTrackerNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    cv2.destroyAllWindows()
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
