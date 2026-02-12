#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from cv_bridge import CvBridge
import cv2
import depthai as dai
import numpy as np
import time
from geometry_msgs.msg import Twist
from rcl_interfaces.msg import ParameterDescriptor, SetParametersResult

import json
import os
import yaml
import subprocess
import signal
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

class OakYoloNode(Node):
    def __init__(self):
        super().__init__('oak_yolo_node')
        # Create a publisher to publish the tracked image to the color_track_pid/result topic
        self.color_track_pid_publisher = self.create_publisher(Image, '/color_track_pid/result', 10)
        # Create a CvBridge object to convert between ROS Image messages and OpenCV images
        self.bridge = CvBridge()
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

        self.cmd_vel_pub = self.create_publisher(Twist, '/cmd_vel', 10)

        self.target_distance = 0.25
        self.target_yaw = 0.0

        self.distance_pid = PID(kp=1.25, ki=0.0, kd=0.05, output_limits=(-0.2, 0.2), tolerance=0.05)
        self.angle_pid = PID(kp=2.0, ki=0.00, kd=0.0, output_limits=(-1.5708, 1.5708), tolerance=0.05)

        self.distance_buffer = deque(maxlen=10)

        self.topLeft = dai.Point2f(0.4, 0.4)
        self.bottomRight = dai.Point2f(0.6, 0.6)
        self.calculationAlgorithm = dai.SpatialLocationCalculatorAlgorithm.MIN
        self.stepSize = 0.05
        self.color = (0, 255, 0)

        self.create_pipeline()

        self.timer = self.create_timer(0.03, self.process_frames)

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

    def create_pipeline(self):
        pipeline = dai.Pipeline()
        
        camRgb = pipeline.create(dai.node.ColorCamera)
        monoLeft = pipeline.create(dai.node.MonoCamera)
        monoRight = pipeline.create(dai.node.MonoCamera)
        stereo = pipeline.create(dai.node.StereoDepth)
        spatialLocationCalculator = pipeline.create(dai.node.SpatialLocationCalculator)

        xoutRgb = pipeline.create(dai.node.XLinkOut)
        xoutDepth = pipeline.create(dai.node.XLinkOut)
        xoutSpatialData = pipeline.create(dai.node.XLinkOut)
        xinSpatialCalcConfig = pipeline.create(dai.node.XLinkIn)

        xoutRgb.setStreamName("rgb")
        xoutDepth.setStreamName("depth")
        xoutSpatialData.setStreamName("spatialData")
        xinSpatialCalcConfig.setStreamName("spatialCalcConfig")

        camRgb.setPreviewSize(640, 480)
        camRgb.setPreviewKeepAspectRatio(False)
        camRgb.setResolution(dai.ColorCameraProperties.SensorResolution.THE_1080_P)
        camRgb.setInterleaved(False)
        camRgb.setColorOrder(dai.ColorCameraProperties.ColorOrder.BGR)
        camRgb.setFps(5)

        monoLeft.setResolution(dai.MonoCameraProperties.SensorResolution.THE_400_P)
        monoLeft.setCamera("left")
        monoRight.setResolution(dai.MonoCameraProperties.SensorResolution.THE_400_P)
        monoRight.setCamera("right")

        stereo.setDefaultProfilePreset(dai.node.StereoDepth.PresetMode.HIGH_DENSITY)
        stereo.setLeftRightCheck(True)
        stereo.setExtendedDisparity(True)
        stereo.setSubpixel(True)
        stereo.setDepthAlign(dai.CameraBoardSocket.CAM_A)
        stereo.setOutputSize(monoLeft.getResolutionWidth(), monoLeft.getResolutionHeight())

        self.config = dai.SpatialLocationCalculatorConfigData()
        self.config.depthThresholds.lowerThreshold = 100
        self.config.depthThresholds.upperThreshold = 10000
        self.config.roi = dai.Rect(self.topLeft, self.bottomRight)
        self.config.calculationAlgorithm = self.calculationAlgorithm

        spatialLocationCalculator.inputConfig.setWaitForMessage(False)
        spatialLocationCalculator.initialConfig.addROI(self.config)

        camRgb.preview.link(xoutRgb.input)
        monoLeft.out.link(stereo.left)
        monoRight.out.link(stereo.right)

        spatialLocationCalculator.passthroughDepth.link(xoutDepth.input)
        stereo.depth.link(spatialLocationCalculator.inputDepth)

        spatialLocationCalculator.out.link(xoutSpatialData.input)
        xinSpatialCalcConfig.out.link(spatialLocationCalculator.inputConfig)
        # -----------------------------------

        self.device = dai.Device(pipeline)

        self.previewQueue = self.device.getOutputQueue(name="rgb", maxSize=4, blocking=False)
        self.depthQueue = self.device.getOutputQueue(name="depth", maxSize=4, blocking=False)
        self.spatialCalcQueue = self.device.getOutputQueue("spatialData", maxSize=4, blocking=False)
        self.spatialCalcConfigInQueue = self.device.getInputQueue("spatialCalcConfig")

    def process_frames(self):
        cx, cy, w = None, None, None
        inPreview = self.previewQueue.get()
        frame = inPreview.getCvFrame() 

        inDepth = self.depthQueue.get()
        depthFrame = inDepth.getFrame() # depthFrame values are in millimeters

        depth_downscaled = depthFrame[::4]
        if np.all(depth_downscaled == 0):
            min_depth = 0  # Set a default minimum depth value when all elements are zero
        else:
            min_depth = np.percentile(depth_downscaled[depth_downscaled != 0], 1)
        max_depth = np.percentile(depth_downscaled, 99)
        depthFrameColor = np.interp(depthFrame, (min_depth, max_depth), (0, 255)).astype(np.uint8)
        depthFrameColor = cv2.applyColorMap(depthFrameColor, cv2.COLORMAP_HOT)

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
                    cv2.circle(frame, (cx, cy), int(radius), self.color, 2)
                    cv2.circle(frame, (cx, cy), 3, self.color, -1)
                    self.get_logger().info(f'Tracking ball at ({cx}, {cy}), area={area:.1f}, circularity={circularity:.2f}')

        twist = Twist()

        spatialData = self.spatialCalcQueue.get().getSpatialLocations()
        for depthData in spatialData:
            if depthData.spatialCoordinates.z < 1000:
                if cx is not None:
                    self.topLeft.x = (cx - radius)/img_w
                    self.topLeft.y = (cy - radius)/img_h
                    self.bottomRight.x = (cx + radius)/img_w
                    self.bottomRight.y = (cy + radius)/img_h
                    self.config.roi = dai.Rect(self.topLeft, self.bottomRight)
                    cfg = dai.SpatialLocationCalculatorConfig()
                    cfg.addROI(self.config)
                    self.spatialCalcConfigInQueue.send(cfg)

                    roi = depthData.config.roi
                    roi = roi.denormalize(width=frame.shape[1], height=frame.shape[0])
                    xmin = int(roi.topLeft().x)
                    ymin = int(roi.topLeft().y)
                    xmax = int(roi.bottomRight().x)
                    ymax = int(roi.bottomRight().y)

                    depthMin = depthData.depthMin
                    depthMax = depthData.depthMax

                    self.distance_buffer.append(depthData.spatialCoordinates.z/1000)
                    distance_avg = robust_mean_remove_outliers(np.array(self.distance_buffer))

                    error_x = (cx - img_w/2)/img_w
        
                    v = self.distance_pid.compute(self.target_distance, distance_avg)
                    z = self.angle_pid.compute(self.target_yaw, error_x)
                    twist.linear.x = -v
                    twist.angular.z = z
                    print(f"Measured={distance_avg:.2f}m, v={-v:.2f}, z={-z:.2f}")
                    fontType = cv2.FONT_HERSHEY_TRIPLEX
                    cv2.rectangle(frame, (xmin, ymin), (xmax, ymax), self.color, 1)
                    cv2.putText(frame, f"X: {int(depthData.spatialCoordinates.x)} mm", (xmin + 10, ymin + 20), fontType, 0.5, self.color)
                    cv2.putText(frame, f"Y: {int(depthData.spatialCoordinates.y)} mm", (xmin + 10, ymin + 35), fontType, 0.5, self.color)
                    cv2.putText(frame, f"Z: {int(depthData.spatialCoordinates.z)} mm", (xmin + 10, ymin + 50), fontType, 0.5, self.color)

            else:
                twist.linear.x = 0.0
                twist.angular.z = 0.0

        self.cmd_vel_pub.publish(twist)
        result_img_msg = self.bridge.cv2_to_imgmsg(frame, encoding="bgr8")
        self.color_track_pid_publisher.publish(result_img_msg)
        gst_process.stdin.write(frame.tobytes())
        gst_process.stdin.flush()

    def destroy_node(self):
        super().destroy_node()
        cv2.destroyAllWindows()


def main(args=None):
    rclpy.init(args=args)
    node = OakYoloNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
