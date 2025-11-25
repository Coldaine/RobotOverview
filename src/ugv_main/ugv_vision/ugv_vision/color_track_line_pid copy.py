import rclpy
from rclpy.node import Node
from rclpy.duration import Duration
from sensor_msgs.msg import Image,Imu
from geometry_msgs.msg import Twist
from rcl_interfaces.msg import ParameterDescriptor
from cv_bridge import CvBridge

from roarm_msgs.srv import PickPlaceCmd
from rclpy.callback_groups import ReentrantCallbackGroup

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

        self.ball_diameter = 0.038
        self.target_distance = 0.2
        self.target_yaw = 0.0

        self.distance_pid = PID(kp=1.25, ki=0.0, kd=0.05, output_limits=(-0.3, 0.3), tolerance=0.05)
        self.angle_pid = PID(kp=3.0, ki=0.00, kd=0.05, output_limits=(-3.1416, 3.1416), tolerance=0.1)

        self.distance_buffer = deque(maxlen=10)
        self.yaw_buffer = deque(maxlen=10)

        self.K = np.array([
            [289.11451,   0.     , 347.23664],
            [  0.     , 289.75319, 235.67429],
            [  0.     ,   0.     ,   1.     ]
        ], dtype=np.float64)

        # self.cli_group = ReentrantCallbackGroup()
        # self.pick_cli = self.create_client(PickPlaceCmd, 'pick_place_cmd', callback_group=self.cli_group)

        # # 等待服务
        # while not self.pick_cli.wait_for_service(timeout_sec=1.0):
        #     self.get_logger().warn("⚠️ pick_place_cmd 服务未启动，等待中...")

        # self.pick_req = PickPlaceCmd.Request()
        # self.pick_req.cmd = 3           # 1=pick
        # self.pick_req.target = 1        # 目标编号，可自定义
        # self.pick_req.gripper = 0.4     
        # self.sent_pick_task = False     # 防止重复发送

        self.imu_sub = self.create_subscription(Imu, '/imu/data', self.imu_callback, 10)
        self.yaw = None
        self.initial_yaw = None
        self.target_yaw = None
        self.rotating = False

    def imu_callback(self, msg):
        # 提取四元数
        q = msg.orientation
        qx, qy, qz, qw = q.x, q.y, q.z, q.w

        # === 自行计算 yaw（Z轴欧拉角） ===
        siny_cosp = 2.0 * (qw * qz + qx * qy)
        cosy_cosp = 1.0 - 2.0 * (qy * qy + qz * qz)
        yaw = math.atan2(siny_cosp, cosy_cosp)
        self.yaw = yaw

        if self.rotating and self.target_yaw is not None:
            # 差值归一化到 (-pi, pi)
            error = (self.target_yaw - self.yaw + math.pi) % (2 * math.pi) - math.pi
            twist = Twist()
            if abs(error) > math.radians(2):
                twist.angular.z = 1.5708 * (1 if error > 0 else -1)
            else:
                twist.angular.z = 0.0
                self.rotating = False
                self.get_logger().info("✅ 旋转 180° 完成")
                # 旋转完成后允许下一次 pick 发起（根据你的流程决定是否需要）
                # self.sent_pick_task = False
            self.cmd_vel_pub.publish(twist)


    def rotate_180_with_imu(self):
        if self.yaw is None:
            self.get_logger().warn("⚠️ IMU 数据还没准备好，无法旋转")
            return
        self.initial_yaw = self.yaw
        self.target_yaw = (self.initial_yaw + math.pi) % (2 * math.pi)
        self.rotating = True
        self.get_logger().info("开始原地旋转 180°...")

    def call_pick_place(self):
        if self.sent_pick_task:
            return      # 已经发过，跳过

        self.get_logger().info("📨 发送 pick_place_cmd ...")

        future = self.pick_cli.call_async(self.pick_req)

        def done_cb(fut):
            try:
                resp = fut.result()
                self.get_logger().info(f"✅ pick_place_cmd 回复: success={resp.success} message={resp.message}")
                if resp.success:
                    # 只有在成功后再开始旋转
                    self.rotate_180_with_imu()
                else:
                    self.get_logger().warn("pick_place_cmd 未成功，跳过旋转")
                    # 视情况决定是否允许再次触发
                    self.sent_pick_task = False
            except Exception as e:
                self.get_logger().error(f"❌ pick_place_cmd 调用失败: {e}")
                # 出错恢复状态，允许重试
                self.sent_pick_task = False

        future.add_done_callback(done_cb)
        self.sent_pick_task = True
        
    def image_callback(self, msg):
        cx, cy, w = None, None, None
        frame = self.bridge.imgmsg_to_cv2(msg, "bgr8")
        img_h, img_w = frame.shape[:2]
        
        if getattr(self, "rotating", False):
            twist_stop = Twist()
            twist_stop.linear.x = 0.0
            twist_stop.angular.z = 0.0
            self.cmd_vel_pub.publish(twist_stop)

            # 显示当前画面并返回（不执行巡线控制）
            gst_process.stdin.write(frame.tobytes())
            result_img_msg = self.bridge.cv2_to_imgmsg(frame, encoding="bgr8")
            self.color_track_pid_publisher.publish(result_img_msg)
            return

        self.frame_count = getattr(self, "frame_count", 0)
        self.frame_count += 1
        if self.frame_count % 3 != 0:  # 
            return

        roi = [
            (150,  200,   40, 600, 0.2),
            (200, 250,   40, 600, 0.3),
            (250, 300,   40, 600, 0.5)
        ]

        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)

        # Initialize the lower and upper color arrays with the parameter values
        self.lower_color = np.array([self.get_parameter("lower_l").value, 
                                     self.get_parameter("lower_a").value, 
                                     self.get_parameter("lower_b").value])
        self.upper_color = np.array([self.get_parameter("upper_l").value, 
                                     self.get_parameter("upper_a").value, 
                                     self.get_parameter("upper_b").value])
        # red
        # self.lower_color = np.array([0, 170, 170])  
        # self.upper_color = np.array([255, 255, 255])
        # green
        # self.lower_color = np.array([110, 0, 0])  
        # self.upper_color = np.array([255, 110, 255])  
        # blue
        # self.lower_color = np.array([80, 0, 0])  
        # self.upper_color = np.array([160, 255, 110])  
        # yellow
        self.lower_color = np.array([0, 100, 150])  
        self.upper_color = np.array([255, 120, 255]) 

        self.base_speed = 0.2
        centroid_x_sum = 0
        weight_sum = 0
        center_y_final = None
        line_width_final = 0

        for (y1, y2, x1, x2, wgt) in roi:
            crop = lab[y1:y2, x1:x2]
            mask = cv2.inRange(crop, self.lower_color, self.upper_color)

            erode = cv2.erode(mask, None, iterations=1)
            dilate = cv2.dilate(erode, None, iterations=1)

            contours, _ = cv2.findContours(dilate, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            if not contours:
                continue

            # 找最大面积
            c = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(c)
            if area < 50:
                continue
            
            # 取外接矩形
            rect = cv2.minAreaRect(c)
            box = cv2.boxPoints(rect)
            box = box.astype(np.int32)

            # 将ROI内坐标转回原图
            box[:, 0] += x1
            box[:, 1] += y1

            cv2.drawContours(frame, [box], -1, (0,255,255), 2)

            # 中心点
            (cx_roi, cy_roi), (rw, rh), ang = rect
            cx_roi = int(cx_roi) + x1
            cy_roi = int(cy_roi) + y1

            # 画中心
            cv2.circle(frame, (cx_roi, cy_roi), 4, (0,0,255), -1)

            centroid_x_sum += cx_roi * wgt
            weight_sum += wgt
            center_y_final = cy_roi
            line_width_final = max(rw, rh)

        # 计算加权中心
        if weight_sum > 0:
            cx = int(centroid_x_sum / weight_sum)
            cy = center_y_final
            w = line_width_final

            cv2.circle(frame, (cx, cy), 8, (0,255,0), -1)
            self.get_logger().info(f"[Line] center=({cx},{cy}) width={w}")

        twist = Twist()
        if cx is not None:
            # === 角度误差 ===
            error_x = cx - img_w/2
            current_yaw = math.atan2(error_x, self.K[0,0])

            self.yaw_buffer.append(current_yaw)
            yaw_avg = robust_mean_remove_outliers(
                np.array(self.yaw_buffer), 
                is_angle=True
            )

            # 没有用距离PID，巡线只需要角度控制
            z = self.angle_pid.compute(0.0, yaw_avg)

            twist.linear.x = self.base_speed      # 匀速前进
            twist.angular.z = z
            self.get_logger().info(f"[Follow] z={z:.3f}")
            # self.cmd_vel_pub.publish(twist)

        else:
            twist.linear.x = 0.0
            twist.angular.z = 0.0
            self.get_logger().info("[Lost line] stop")
            # self.cmd_vel_pub.publish(twist)
            # self.call_pick_place()
            # self.rotate_180_with_imu()

        # 显示
        gst_process.stdin.write(frame.tobytes())
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

