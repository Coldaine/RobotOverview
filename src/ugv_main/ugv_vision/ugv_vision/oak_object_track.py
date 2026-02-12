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
from rcl_interfaces.msg import ParameterDescriptor,SetParametersResult

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
        self.labelMap = ["background", "aeroplane", "bicycle", "bird", "boat", "bottle", "bus", "car", "cat", "chair", "cow",
                    "diningtable", "dog", "horse", "motorbike", "person", "pottedplant", "sheep", "sofa", "train", "tvmonitor"]

        self.cmd_vel_pub = self.create_publisher(Twist, '/cmd_vel', 10)

        self.target_distance = 0.30
        self.target_yaw = 0.0

        self.distance_pid = PID(kp=1.25, ki=0.0, kd=0.05, output_limits=(-0.3, 0.3), tolerance=0.01)
        self.angle_pid = PID(kp=2.0, ki=0.00, kd=0.0, output_limits=(-1.5708, 1.5708), tolerance=0.05)

        self.distance_buffer = deque(maxlen=10)
        self.yaw_buffer = deque(maxlen=10)

        self.color = (0, 255, 0)

        self.declare_parameter("track_id", 12, ParameterDescriptor(description="Track Id"))

        self.track_id = int(self.get_parameter("track_id").value)

        self.create_pipeline()

        self.timer = self.create_timer(0.05, self.process_frames)

    def create_pipeline(self):
        pipeline = dai.Pipeline()

        camRgb = pipeline.create(dai.node.ColorCamera)
        spatialDetectionNetwork = pipeline.create(dai.node.MobileNetSpatialDetectionNetwork)
        monoLeft = pipeline.create(dai.node.MonoCamera)
        monoRight = pipeline.create(dai.node.MonoCamera)
        stereo = pipeline.create(dai.node.StereoDepth)
        objectTracker = pipeline.create(dai.node.ObjectTracker)

        xoutRgb = pipeline.create(dai.node.XLinkOut)
        trackerOut = pipeline.create(dai.node.XLinkOut)

        xoutRgb.setStreamName("preview")
        trackerOut.setStreamName("tracklets")

        camRgb.setPreviewSize(300,300)
        # camRgb.setPreviewKeepAspectRatio(False)
        camRgb.setResolution(dai.ColorCameraProperties.SensorResolution.THE_1080_P)
        camRgb.setInterleaved(False)
        camRgb.setColorOrder(dai.ColorCameraProperties.ColorOrder.BGR)
        camRgb.setFps(5)

        monoLeft.setResolution(dai.MonoCameraProperties.SensorResolution.THE_400_P)
        monoLeft.setCamera("left")
        monoRight.setResolution(dai.MonoCameraProperties.SensorResolution.THE_400_P)
        monoRight.setCamera("right")

        stereo.setDefaultProfilePreset(dai.node.StereoDepth.PresetMode.HIGH_DENSITY)
        # stereo.setLeftRightCheck(True)
        # stereo.setExtendedDisparity(True)
        # stereo.setSubpixel(True)
        stereo.setDepthAlign(dai.CameraBoardSocket.CAM_A)
        stereo.setOutputSize(monoLeft.getResolutionWidth(), monoLeft.getResolutionHeight())

        spatialDetectionNetwork.setBlobPath(thisPath + '/models/oak/mobilenet-ssd_openvino_2021.4_5shave.blob')
        spatialDetectionNetwork.setConfidenceThreshold(0.5)
        spatialDetectionNetwork.input.setBlocking(False)
        spatialDetectionNetwork.setBoundingBoxScaleFactor(0.5)
        spatialDetectionNetwork.setDepthLowerThreshold(100)
        spatialDetectionNetwork.setDepthUpperThreshold(5000)

        objectTracker.setDetectionLabelsToTrack([self.track_id])
        objectTracker.setTrackerType(dai.TrackerType.ZERO_TERM_COLOR_HISTOGRAM)
        objectTracker.setTrackerIdAssignmentPolicy(dai.TrackerIdAssignmentPolicy.SMALLEST_ID)

        monoLeft.out.link(stereo.left)
        monoRight.out.link(stereo.right)

        camRgb.preview.link(spatialDetectionNetwork.input)
        objectTracker.passthroughTrackerFrame.link(xoutRgb.input)
        objectTracker.out.link(trackerOut.input)

        spatialDetectionNetwork.passthrough.link(objectTracker.inputTrackerFrame)
        spatialDetectionNetwork.passthrough.link(objectTracker.inputDetectionFrame)
        spatialDetectionNetwork.out.link(objectTracker.inputDetections)
        stereo.depth.link(spatialDetectionNetwork.inputDepth)

        self.device = dai.Device(pipeline)

        self.previewQueue = self.device.getOutputQueue(name="preview", maxSize=4, blocking=False)
        self.trackletsQueue = self.device.getOutputQueue(name="tracklets", maxSize=4, blocking=False)

    def process_frames(self):
        cx, cy, w = None, None, None
        inPreview = self.previewQueue.get()
        track = self.trackletsQueue.get()
        
        frame = inPreview.getCvFrame() 
        trackletsData = track.tracklets

        img_h, img_w = frame.shape[:2]

        twist = Twist()

        for t in trackletsData:
            roi = t.roi.denormalize(frame.shape[1], frame.shape[0])
            x1 = int(roi.topLeft().x)
            y1 = int(roi.topLeft().y)
            x2 = int(roi.bottomRight().x)
            y2 = int(roi.bottomRight().y)

            try:
                label = labelMap[t.label]
            except:
                label = t.label

            cv2.putText(frame, str(label), (x1 + 10, y1 + 20), cv2.FONT_HERSHEY_TRIPLEX, 0.5, 255)
            cv2.putText(frame, f"ID: {[t.id]}", (x1 + 10, y1 + 35), cv2.FONT_HERSHEY_TRIPLEX, 0.5, 255)
            cv2.putText(frame, t.status.name, (x1 + 10, y1 + 50), cv2.FONT_HERSHEY_TRIPLEX, 0.5, 255)
            cv2.rectangle(frame, (x1, y1), (x2, y2), self.color, cv2.FONT_HERSHEY_SIMPLEX)

            cv2.putText(frame, f"X: {int(t.spatialCoordinates.x)} mm", (x1 + 10, y1 + 65), cv2.FONT_HERSHEY_TRIPLEX, 0.5, 255)
            cv2.putText(frame, f"Y: {int(t.spatialCoordinates.y)} mm", (x1 + 10, y1 + 80), cv2.FONT_HERSHEY_TRIPLEX, 0.5, 255)
            cv2.putText(frame, f"Z: {int(t.spatialCoordinates.z)} mm", (x1 + 10, y1 + 95), cv2.FONT_HERSHEY_TRIPLEX, 0.5, 255)

            if t.spatialCoordinates.z < 1000 and t.status.name != "LOST" :

                self.distance_buffer.append(t.spatialCoordinates.z/1000)
                distance_avg = robust_mean_remove_outliers(np.array(self.distance_buffer))

                # error_x = ((x1+x2) - img_w)/2
                error_x = ((x1+x2) - img_w)/img_w
                # current_yaw = np.arctan2(error_x, 337.0)
                # self.yaw_buffer.append(current_yaw)
                # yaw_avg = robust_mean_remove_outliers(np.array(self.yaw_buffer), is_angle=True)

                v = self.distance_pid.compute(self.target_distance, distance_avg)
                z = self.angle_pid.compute(self.target_yaw, error_x)
                twist.linear.x = -v
                twist.angular.z = z
                print(f"Measured={distance_avg:.2f}m, v={-v:.2f}, z={-z:.2f}")
      
            else:
                twist.linear.x = 0.0
                twist.angular.z = 0.0

        resize_frame = cv2.resize(frame,(640,480))

        self.cmd_vel_pub.publish(twist)
        gst_process.stdin.write(resize_frame.tobytes())
        gst_process.stdin.flush()
        result_img_msg = self.bridge.cv2_to_imgmsg(resize_frame, encoding="bgr8")
        self.color_track_pid_publisher.publish(result_img_msg)

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
