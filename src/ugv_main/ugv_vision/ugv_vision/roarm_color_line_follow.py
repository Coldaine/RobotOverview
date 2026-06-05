import rclpy
from rclpy.node import Node
from rclpy.duration import Duration
from sensor_msgs.msg import Image
from geometry_msgs.msg import Twist
from rcl_interfaces.msg import SetParametersResult
from cv_bridge import CvBridge
from tf2_ros import Buffer, TransformListener
from tf2_ros import TransformException
from roarm_msgs.srv import PickPlaceCmd

import cv2
import numpy as np
import json
import os
import math
import time
from collections import deque
from enum import Enum
from pathlib import Path
_MODULE_DIR = Path(__file__).resolve().parent
CONFIG_DIR = _MODULE_DIR.parent / "config"
CONFIG_PATH = CONFIG_DIR / "lab_tool_colors.json"

curpath = os.path.realpath(__file__)
thisPath = os.path.dirname(curpath)

def robust_mean_remove_outliers(arr, mz_thresh=3.5):
    if arr.size == 0:
        return 0.0
    med = np.median(arr)
    mad = np.median(np.abs(arr - med))
    if mad == 0:
        return float(np.mean(arr))
    mod_z = 0.6745 * (arr - med) / mad
    filtered = arr[np.abs(mod_z) <= mz_thresh]
    return float(np.mean(filtered)) if filtered.size > 0 else float(np.mean(arr))


class TrackState(Enum):
    FOLLOW = 0
    SEARCH_SCAN = 1
    RECOVER = 2

    ALIGN_PICK = 9       
    OBJECT_FOUND = 10
    PICKING = 11
    CARRY_FOLLOW = 12
    ALIGN_PLACE = 13     
    PLACING = 14


class ColorTrackPID(Node):
    def __init__(self):
        super().__init__('color_track_pid')

        self.sub_img = self.create_subscription(
            Image, '/image_raw', self.image_callback, 10
        )
        self.pub_cmd = self.create_publisher(Twist, '/cmd_vel', 10)
        self.pub_img = self.create_publisher(Image, '/color_track_pid/result', 10)
        self.bridge = CvBridge()

        self.state = TrackState.FOLLOW
        self.yaw_buffer = deque(maxlen=10)
        self.last_error = 0.0
        self.integral_err = 0.0
        self.last_control_time = time.time()

        self.search_start_time = 0.0
        self.recover_start_time = 0.0
        self.recover_time = 0.4

        self.kp = 4.0
        self.ki = 0.8
        self.kd = 0.12
        self.ki_max = 0.6
        self.err_deadband = 0.02
        self.base_speed = 0.08

        self.scan_dir = 1
        self.scan_yaw_base = 0.5
        self.scan_yaw_max = math.pi
        self.max_scan_time = 10.0

        self.center_err_thresh = 0.06
        self.center_hold_time = 0.4
        self.center_hold_pick = 0.0
        self.center_hold_place = 0.0

        self.turn_err_thresh = 0.35
        self.turn_angular_thresh = 0.9
        self.turn_hold_time = 0.35
        self.turn_detect_start = 0.0
        self.turn_pending = False

        self._load_colors_from_json()

        self.add_on_set_parameters_callback(self.on_param_change)

        self.roi = [
            (150, 200, 120, 520, 0.15),
            (200, 250, 100, 540, 0.35),
            (250, 300,  80, 560, 0.50),
        ]

        self.get_logger().info("ColorTrackPID Node started")

        self.tf_buffer = Buffer(cache_time=Duration(seconds=0.6))
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.target_detected = False
        self.task_busy = False
        self.pick_started = False
        self.carrying = False
        self.last_task_time = 0.0
        self.task_cooldown = 3.0
        self.pick_future = None
        self.place_future = None

        self.tf_timer = self.create_timer(0.1, self.check_target_tf)
        self.pick_client = self.create_client(PickPlaceCmd, 'pick_place_cmd')
        while not self.pick_client.wait_for_service(timeout_sec=1.0):
            self.get_logger().info('Waiting for pick_place_cmd service...')

    def _load_colors_from_json(self):
        profile = "yellow"

        if not CONFIG_PATH.is_file():
            self.get_logger().warn(
                f"Config not found: {CONFIG_PATH}, use default LAB"
            )
            self.lower_color = np.array(_DEFAULT_LOWER, dtype=np.uint8)
            self.upper_color = np.array(_DEFAULT_UPPER, dtype=np.uint8)
            return

        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            profiles = json.load(f)

        if profile not in profiles:
            self.get_logger().warn(
                f"Profile '{profile}' not in {CONFIG_PATH}, "
                f"available: {list(profiles.keys())}, use default"
            )
            self.lower_color = np.array(_DEFAULT_LOWER, dtype=np.uint8)
            self.upper_color = np.array(_DEFAULT_UPPER, dtype=np.uint8)
            return

        p = profiles[profile]
        self.lower_color = np.array(p["lower"], dtype=np.uint8)
        self.upper_color = np.array(p["upper"], dtype=np.uint8)
        self.get_logger().info(
            f"LAB from json [{profile}]: lower={self.lower_color.tolist()} "
            f"upper={self.upper_color.tolist()}"
        )

    def on_param_change(self, params):
        reload_needed = False
        for param in params:
            if param.name == "color":
                reload_needed = True
        if reload_needed:
            self._load_colors_from_json()
        return SetParametersResult(successful=True)

    def reset_line_control(self):
        self.yaw_buffer.clear()
        self.last_error = 0.0
        self.integral_err = 0.0
        self.last_control_time = time.time()

    def reset_center_timers(self):
        self.center_hold_pick = 0.0
        self.center_hold_place = 0.0
        self.turn_detect_start = 0.0
        self.turn_pending = False

    def reset_task(self):
        self.task_busy = False
        self.pick_started = False
        self.carrying = False
        self.pick_future = None
        self.place_future = None
        self.reset_center_timers()

    def call_pick(self, target=1, gripper=0.25):
        req = PickPlaceCmd.Request()
        req.cmd = 1
        req.target = target
        req.gripper = gripper
        return self.pick_client.call_async(req)

    def call_place(self):
        req = PickPlaceCmd.Request()
        req.cmd = 2
        return self.pick_client.call_async(req)

    def detect_line(self, lab):
        weight_sum = 0.0
        cx_sum = 0.0
        has_line = False
        for (y1, y2, x1, x2, wt) in self.roi:
            crop = lab[y1:y2, x1:x2]
            mask = cv2.inRange(crop, self.lower_color, self.upper_color)
            cnts, _ = cv2.findContours(
                mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            if not cnts:
                continue
            c = max(cnts, key=cv2.contourArea)
            if cv2.contourArea(c) < 50:
                continue
            c = c.astype(np.float32)
            c[:, :, 0] += x1
            c[:, :, 1] += y1
            c = c.astype(np.int32)
            (x, y), _, _ = cv2.minAreaRect(c)
            cx_sum += x * wt
            weight_sum += wt
            has_line = True
        return has_line, cx_sum, weight_sum

    def follow_line(self, cx_sum, weight_sum, cx, twist, kp_scale=1.0, speed_scale=1.0):
        x_avg = cx_sum / weight_sum
        err = (x_avg - cx) / float(cx)

        self.yaw_buffer.append(err)
        err_f = robust_mean_remove_outliers(np.array(self.yaw_buffer))

        now = time.time()
        dt = max(now - self.last_control_time, 1e-3)
        self.last_control_time = now

        if abs(err_f) > self.err_deadband:
            self.integral_err += err_f * dt
            self.integral_err = float(np.clip(
                self.integral_err, -self.ki_max, self.ki_max
            ))
        else:
            self.integral_err *= 0.9

        d = (err_f - self.last_error) / dt
        d = max(-3.0, min(3.0, d))
        self.last_error = err_f

        u = (
            kp_scale * self.kp * err_f
            + self.ki * self.integral_err
            + self.kd * d
        )

        twist.linear.x = speed_scale * self.base_speed
        twist.angular.z = -u
        return err_f, u, x_avg

    def is_centered(self, err_f, has_line, timer_attr):
        if not has_line:
            setattr(self, timer_attr, 0.0)
            return False
        if abs(err_f) <= self.center_err_thresh:
            now = time.time()
            t0 = getattr(self, timer_attr)
            if t0 == 0.0:
                setattr(self, timer_attr, now)
            return (now - getattr(self, timer_attr)) >= self.center_hold_time
        setattr(self, timer_attr, 0.0)
        return False

    def at_turn(self, err_f, angular_z, has_line):
        if not has_line or not self.carrying:
            self.turn_detect_start = 0.0
            return False
        turning = (
            abs(err_f) >= self.turn_err_thresh
            or abs(angular_z) >= self.turn_angular_thresh
        )
        now = time.time()
        if turning:
            if self.turn_detect_start == 0.0:
                self.turn_detect_start = now
            return (now - self.turn_detect_start) >= self.turn_hold_time
        self.turn_detect_start = 0.0
        return False

    def line_follow_or_search(self, has_line, cx_sum, weight_sum, cx, twist,
                              speed_scale=1.0, kp_scale=1.0):
        err_f = self.last_error
        x_avg = None
        if has_line and weight_sum > 0:
            err_f, _, x_avg = self.follow_line(
                cx_sum, weight_sum, cx, twist,
                kp_scale=kp_scale, speed_scale=speed_scale,
            )
        else:
            self.state = TrackState.SEARCH_SCAN
            self.search_start_time = time.time()
            self.scan_dir = 1 if self.last_error > 0 else -1
            twist.linear.x = 0.0
            twist.angular.z = 0.0
            self.get_logger().warn("Lost line → SEARCH_SCAN")
        return err_f, x_avg

    def check_target_tf(self):
        if self.task_busy:
            return
        try:
            trans = self.tf_buffer.lookup_transform(
                "ugv_roarm_base_link", "object_1", rclpy.time.Time()
            )
            x = trans.transform.translation.x
            y = trans.transform.translation.y
            z = trans.transform.translation.z
            r_min, r_max = 0.25, 0.35
            dist = math.sqrt(x * x + y * y + z * z)
            alpha = math.radians(30.0)
            if x <= 0.0:
                self.target_detected = False
                return
            in_cone = abs(y) <= x * math.tan(alpha)
            in_range = r_min <= dist <= r_max
            self.target_detected = in_cone and in_range
        except TransformException:
            self.target_detected = False

    def image_callback(self, msg):
        frame = self.bridge.imgmsg_to_cv2(msg, "bgr8")
        h, w = frame.shape[:2]
        cx = w // 2
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)

        has_line, cx_sum, weight_sum = self.detect_line(lab)
        twist = Twist()
        err_f = self.last_error
        x_avg_vis = None

        if self.state == TrackState.FOLLOW:
            if (
                not self.carrying
                and self.target_detected
                and not self.task_busy
                and time.time() - self.last_task_time > self.task_cooldown
            ):
                self.get_logger().info("Target detected → ALIGN_PICK (center first)")
                self.state = TrackState.ALIGN_PICK
                self.task_busy = True
                self.reset_center_timers()

            elif has_line and weight_sum > 0:
                err_f, _, x_avg_vis = self.follow_line(
                    cx_sum, weight_sum, cx, twist
                )
            else:
                self.state = TrackState.SEARCH_SCAN
                self.search_start_time = time.time()
                self.scan_dir = 1 if self.last_error > 0 else -1
                self.get_logger().warn("Lost line → SEARCH_SCAN")
                twist.linear.x = 0.0
                twist.angular.z = 0.0

        elif self.state == TrackState.ALIGN_PICK:
            if not self.target_detected:
                self.get_logger().warn("Target lost during ALIGN_PICK → FOLLOW")
                self.reset_task()
                self.state = TrackState.FOLLOW
                twist.linear.x = 0.0
                twist.angular.z = 0.0
            elif has_line and weight_sum > 0:
                err_f, _, x_avg_vis = self.follow_line(
                    cx_sum, weight_sum, cx, twist, speed_scale=0.06
                )
                if self.is_centered(err_f, has_line, "center_hold_pick"):
                    self.get_logger().info("Centered → PICK")
                    twist.linear.x = 0.0
                    twist.angular.z = 0.0
                    self.state = TrackState.OBJECT_FOUND
            else:
                err_f, x_avg_vis = self.line_follow_or_search(
                    has_line, cx_sum, weight_sum, cx, twist, speed_scale=0.06
                )

        elif self.state == TrackState.SEARCH_SCAN:
            dt = time.time() - self.search_start_time
            yaw = max(
                self.scan_yaw_max * (1 - dt / self.max_scan_time),
                self.scan_yaw_base,
            )
            twist.linear.x = 0.0
            twist.angular.z = self.scan_dir * yaw

            if has_line and weight_sum > 0:
                self.state = TrackState.RECOVER
                self.recover_start_time = time.time()
                self.reset_line_control()
                self.get_logger().info("Line found → RECOVER")

        elif self.state == TrackState.RECOVER:
            dt = time.time() - self.recover_start_time
            if has_line and weight_sum > 0:
                err_f, _, x_avg_vis = self.follow_line(
                    cx_sum, weight_sum, cx, twist,
                    kp_scale=0.5, speed_scale=0.0,
                )
                if dt > self.recover_time:
                    if self.state != TrackState.SEARCH_SCAN:
                        self.state = (
                            TrackState.ALIGN_PLACE if self.turn_pending
                            else (
                                TrackState.ALIGN_PICK
                                if self.task_busy and not self.carrying
                                else (
                                    TrackState.CARRY_FOLLOW
                                    if self.carrying
                                    else TrackState.FOLLOW
                                )
                            )
                        )
                    self.reset_line_control()
            else:
                self.state = TrackState.SEARCH_SCAN
                self.search_start_time = time.time()
                self.scan_dir = 1 if self.last_error > 0 else -1
                twist.linear.x = 0.0
                twist.angular.z = self.scan_dir * self.scan_yaw_base
                self.get_logger().warn("Lost line during RECOVER → SEARCH_SCAN")

        elif self.state == TrackState.OBJECT_FOUND:
            twist.linear.x = 0.0
            twist.angular.z = 0.0
            if not self.pick_started:
                self.pick_future = self.call_pick(target=1, gripper=0.25)
                self.pick_started = True
                self.state = TrackState.PICKING

        elif self.state == TrackState.PICKING:
            twist.linear.x = 0.0
            twist.angular.z = 0.0
            if self.pick_future is not None and self.pick_future.done():
                result = self.pick_future.result()
                if result.success:
                    self.get_logger().info("Pick success → CARRY_FOLLOW")
                    self.carrying = True
                    self.turn_pending = False
                    self.reset_center_timers()
                    self.reset_line_control()
                    self.state = TrackState.CARRY_FOLLOW
                else:
                    self.get_logger().warn("Pick failed")
                    self.last_task_time = time.time()
                    self.reset_task()
                    self.reset_line_control()
                    self.state = TrackState.FOLLOW

        elif self.state == TrackState.CARRY_FOLLOW:
            if has_line and weight_sum > 0:
                err_f, _, x_avg_vis = self.follow_line(
                    cx_sum, weight_sum, cx, twist,
                    kp_scale=1.0, speed_scale=0.9,
                )
                if self.at_turn(err_f, twist.angular.z, has_line):
                    self.get_logger().info("Turn detected → ALIGN_PLACE (center first)")
                    self.turn_pending = True
                    self.center_hold_place = 0.0
                    self.state = TrackState.ALIGN_PLACE
            else:
                err_f, x_avg_vis = self.line_follow_or_search(
                    has_line, cx_sum, weight_sum, cx, twist, speed_scale=0.9
                )

        elif self.state == TrackState.ALIGN_PLACE:
            if has_line and weight_sum > 0:
                err_f, _, x_avg_vis = self.follow_line(
                    cx_sum, weight_sum, cx, twist, speed_scale=0.06
                )
                if self.is_centered(err_f, has_line, "center_hold_place"):
                    self.get_logger().info("Centered → PLACE")
                    twist.linear.x = 0.0
                    twist.angular.z = 0.0
                    self.place_future = self.call_place()
                    self.turn_pending = False
                    self.state = TrackState.PLACING
            else:
                err_f, x_avg_vis = self.line_follow_or_search(
                    has_line, cx_sum, weight_sum, cx, twist, speed_scale=0.06
                )

        elif self.state == TrackState.PLACING:
            twist.linear.x = 0.0
            twist.angular.z = 0.0
            if self.place_future is not None and self.place_future.done():
                result = self.place_future.result()
                if result.success:
                    self.get_logger().info("Place success")
                else:
                    self.get_logger().warn("Place failed")
                self.last_task_time = time.time()
                self.reset_task()
                self.reset_line_control()
                self.state = TrackState.FOLLOW

        cv2.line(frame, (cx, 0), (cx, h), (0, 255, 255), 2)
        if x_avg_vis is not None:
            cv2.circle(frame, (int(x_avg_vis), h // 2), 8, (0, 0, 255), -1)

        centered = (
            self.is_centered(err_f, has_line, "center_hold_pick")
            if self.state == TrackState.ALIGN_PICK
            else (
                self.is_centered(err_f, has_line, "center_hold_place")
                if self.state == TrackState.ALIGN_PLACE
                else False
            )
        )
        label = self.state.name
        if self.carrying:
            label += " [CARRY]"
        if centered:
            label += " [OK]"

        cv2.rectangle(frame, (10, 10), (420, 100), (0, 0, 0), -1)
        cv2.putText(
            frame,
            f"STATE: {label}  err:{err_f:+.3f}",
            (20, 45),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )

        self.pub_img.publish(self.bridge.cv2_to_imgmsg(frame, "bgr8"))
        self.pub_cmd.publish(twist)

def main(args=None):
    rclpy.init(args=args)
    node = ColorTrackPID()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()