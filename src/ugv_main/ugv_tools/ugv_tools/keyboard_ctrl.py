#!/usr/bin/env python3
# encoding: utf-8
import sys
import select
import termios
import tty
import time

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from std_msgs.msg import Float64MultiArray

msg = """
Control Your Car!
---------------------------
Moving around:
   u    i    o
   j    k    l
   m    ,    .

q/z : increase/decrease max speeds by 10%
w/x : increase/decrease only linear speed by 10%
e/c : increase/decrease only angular speed by 10%
t/T : x and y speed switch
s/S : stop keyboard control
space key, k : force stop
unknown keys : stop smoothly (after several in one poll)

Control Your Pt!
---------------------------
0 : Reset pt to [0, 0]
1 : Increase Joint1 (X)
2 : Increase Joint2 (Y)
r : Reverse direction

SSH: tune drive_idle_timeout if it stops while you still hold a key
     (larger = safer hold, slower stop after real release).

CTRL-C to quit
"""

moveBindings = {
    "i": (1, 0),
    "o": (1, -1),
    "j": (0, 1),
    "l": (0, -1),
    "u": (1, 1),
    ",": (-1, 0),
    ".": (-1, 1),
    "m": (-1, -1),
    "I": (1, 0),
    "O": (1, -1),
    "J": (0, 1),
    "L": (0, -1),
    "U": (1, 1),
    "M": (-1, -1),
}

speedBindings = {
    "Q": (1.1, 1.1),
    "Z": (0.9, 0.9),
    "W": (1.1, 1),
    "X": (0.9, 1),
    "E": (1, 1.1),
    "C": (1, 0.9),
    "q": (1.1, 1.1),
    "z": (0.9, 0.9),
    "w": (1.1, 1),
    "x": (0.9, 1),
    "e": (1, 1.1),
    "c": (1, 0.9),
}

LOOP_PERIOD = 0.02


class UgvKeyboard(Node):
    def __init__(self, name):
        super().__init__(name)
        self.pub = self.create_publisher(Twist, "cmd_vel", 1)
        self.pub_pt_joint = self.create_publisher(
            Float64MultiArray, "pt_joint_position_controller/commands", 10
        )

        self.declare_parameter("linear_speed_limit", 1.0)
        self.declare_parameter("angular_speed_limit", 1.0)
        self.declare_parameter("drive_idle_timeout", 1.2)

        self.linear_speed_limit = (
            self.get_parameter("linear_speed_limit").get_parameter_value().double_value
        )
        self.angular_speed_limit = (
            self.get_parameter("angular_speed_limit").get_parameter_value().double_value
        )
        self.drive_idle_timeout = (
            self.get_parameter("drive_idle_timeout").get_parameter_value().double_value
        )

        self.settings = termios.tcgetattr(sys.stdin)

        self.pt_pose_x = 0.0
        self.pt_pose_y = 0.0
        self.pt_reverse = False

    def drain_keys(self):
        tty.setraw(sys.stdin.fileno())
        buf = []
        try:
            while True:
                rlist, _, _ = select.select([sys.stdin], [], [], 0)
                if not rlist:
                    break
                c = sys.stdin.read(1)
                if c:
                    buf.append(c)
        finally:
            termios.tcsetattr(sys.stdin, termios.TCSADRAIN, self.settings)
        return "".join(buf)

    def vels(self, speed, turn):
        return "currently:\tspeed %s\tturn %s " % (speed, turn)


def main():
    rclpy.init()
    node = UgvKeyboard("keyboard_ctrl")

    xspeed_switch = True
    speed, turn = 0.2, 0.5
    x, th = 0, 0
    status = 0
    stop = False
    count = 0
    twist = Twist()
    quit_requested = False

    last_move_cmd_ts = time.monotonic()

    try:
        print(msg)
        print(node.vels(speed, turn))

        while True:
            node.drive_idle_timeout = (
                node.get_parameter("drive_idle_timeout").get_parameter_value().double_value
            )

            chunk = node.drain_keys()
            now = time.monotonic()

            if "\x03" in chunk:
                quit_requested = True

            for key in chunk:
                if key == "t" or key == "T":
                    xspeed_switch = not xspeed_switch
                elif key == "s" or key == "S":
                    stop = not stop
                    print("stop keyboard control: {}".format(stop))
                elif key in moveBindings:
                    x = moveBindings[key][0]
                    th = moveBindings[key][1]
                    count = 0
                    last_move_cmd_ts = now
                elif key in speedBindings:
                    speed *= speedBindings[key][0]
                    turn *= speedBindings[key][1]
                    count = 0
                    if speed > node.linear_speed_limit:
                        speed = node.linear_speed_limit
                        print("Linear speed limit reached!")
                    if turn > node.angular_speed_limit:
                        turn = node.angular_speed_limit
                        print("Angular speed limit reached!")
                    print(node.vels(speed, turn))
                    if status == 14:
                        print(msg)
                    status = (status + 1) % 15
                elif key == " " or key == "k":
                    x, th = 0, 0
                    count = 0
                    last_move_cmd_ts = now
                elif key in {"r", "0", "1", "2"}:
                    if key == "r":
                        node.pt_reverse = not node.pt_reverse
                    direction = -1.0 if node.pt_reverse else 1.0
                    change_x = 0.0
                    change_y = 0.0
                    if key == "1":
                        change_x = 0.025
                    elif key == "2":
                        change_y = 0.025
                    elif key == "0":
                        node.pt_pose_x = 0.0
                        node.pt_pose_y = 0.0
                    if key in {"1", "2"}:
                        node.pt_pose_x += direction * change_x
                        node.pt_pose_y += direction * change_y
                        node.pt_pose_x = max(-3.14, min(3.14, node.pt_pose_x))
                        node.pt_pose_y = max(-0.523, min(1.57, node.pt_pose_y))
                    pt_msg = Float64MultiArray()
                    pt_msg.data = [node.pt_pose_x, node.pt_pose_y]
                    node.pub_pt_joint.publish(pt_msg)
                else:
                    count += 1
                    if count > 4:
                        x, th = 0, 0
                        last_move_cmd_ts = now

            if (x, th) != (0, 0) and (now - last_move_cmd_ts) > node.drive_idle_timeout:
                x, th = 0, 0
                count = 0

            if xspeed_switch:
                twist.linear.x = float(speed * x)
                twist.linear.y = 0.0
            else:
                twist.linear.x = 0.0
                twist.linear.y = float(speed * x)
            twist.angular.z = float(turn * th)

            if not stop:
                node.pub.publish(twist)
            else:
                node.pub.publish(Twist())

            if quit_requested:
                break

            time.sleep(LOOP_PERIOD)

    except Exception as e:
        print(e)
    finally:
        node.pub.publish(Twist())
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, node.settings)
        node.destroy_node()
        rclpy.shutdown()
