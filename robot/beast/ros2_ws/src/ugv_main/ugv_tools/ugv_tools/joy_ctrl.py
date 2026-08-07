#!/usr/bin/env python
# encoding: utf-8

import os
import time
import getpass
import threading
from time import sleep

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from sensor_msgs.msg import Joy
from rcl_interfaces.msg import ParameterDescriptor, SetParametersResult
from std_msgs.msg import Float32, Float32MultiArray, Float64MultiArray
import pygame

def get_joystick_names():
	pygame.init()
	pygame.joystick.init()

	joystick_names = []
	joystick_count = pygame.joystick.get_count()

	if joystick_count == 0:
		print("no joystick found")
	else:
		for i in range(joystick_count):
			joystick = pygame.joystick.Joystick(i)
			joystick.init()
			joystick_names.append(joystick.get_name())

	pygame.quit()
	return joystick_names


SHANWAN_Android_Gamepad = {
    "LEFT_STICK_X": 0,
    "LEFT_STICK_Y": 1,
    "RIGHT_STICK_X": 2,
    "RIGHT_STICK_Y": 3,
    "LEFT_TRIGGER": 5,
    "RIGHT_TRIGGER": 4,
    "D_PAD_X": 6,
    "D_PAD_Y": 7,
    "A": 0,
    "B": 1,
    "X": 3,
    "Y": 4,
    "LEFT_BUMPER": 6,
    "RIGHT_BUMPER": 7,
    "SELECT": 10,
    "START": 11,
    "HOME": 12,
    "LEFT_STICK_CLICK": 13,
    "RIGHT_STICK_CLICK": 14,
}

Xbox_360_Controller = {
    "LEFT_STICK_X": 0,
    "LEFT_STICK_Y": 1,
    "RIGHT_STICK_X": 3,
    "RIGHT_STICK_Y": 4,
    "LEFT_TRIGGER": 2,
    "RIGHT_TRIGGER": 5,
    "D_PAD_X": 6,
    "D_PAD_Y": 7,
    "A": 0,
    "B": 1,
    "X": 2,
    "Y": 3,
    "LEFT_BUMPER": 4,
    "RIGHT_BUMPER": 5,
    "SELECT": 6,
    "START": 7,
    "HOME": 8,
    "LEFT_STICK_CLICK": 9,
    "RIGHT_STICK_CLICK": 10,
}


# How many consecutive zero Twists to publish after the sticks return to
# centre, before going silent. Mirrors keyboard_ctrl's ZERO_TAIL_LIMIT — keep
# the two the same number. (ugv_bringup's zero-drop hack this once mirrored was
# removed 2026-08-07.)
#
# WHY THIS EXISTS (twist_mux starvation): twist_mux gives /cmd_vel to the
# highest-priority source that has not expired, and any message — a zero Twist
# included — refreshes that source's timestamp. joy_ctrl sits at priority 150,
# the top drive rung, and publishes once per /joy message. A pad sitting on the
# desk still produces /joy traffic (joy_node republishes on any axis jitter, and
# with autorepeat_rate > 0 it synthesises messages even with no input at all),
# so without this bound an untouched gamepad would hold the floor forever and
# nav, the UI rung and keyboard teleop would never get a command through.
#
# The tail is what stops the robot: there is no software watchdog backstop
# (removed 2026-08-07) — the ESP32 latches its last command, so a lost tail
# means a held velocity until the next command or a reboot's startup stop.
ZERO_TAIL_LIMIT = 5


def get_joystick_mapping(name):
	if name == "SHANWAN Android Gamepad":
		return SHANWAN_Android_Gamepad
	elif name == "Xbox 360 Controller":
		return Xbox_360_Controller
	else:
		print(f"Unknown joystick type: {name}, defaulting to Xbox mapping")
		return Xbox_360_Controller


class JoyTeleop(Node):
	def __init__(self, name):
		super().__init__(name)
		self.prev_ltrigger_pressed = False
		self.prev_lbumper_pressed = False
		self.prev_rtrigger_pressed = False
		self.prev_rbumper_pressed = False
		self.Joy_active = True
		# Consecutive zero Twists published since the sticks last moved. Starts
		# at the limit so a joy_ctrl nobody has touched yet is already silent
		# and does not mask lower twist_mux rungs just by being running.
		self.zero_tail = ZERO_TAIL_LIMIT
		self.user_name = getpass.getuser()
		self.linear_Gear = 0.25
		self.angular_Gear = 0.25
		self.led_Gear = 0.0

		# Command spine: never publish /cmd_vel directly. twist_mux owns that
		# topic (ugv_cockpit/config/twist_mux.yaml). joy_node runs on the robot,
		# so this is the on-site pad -> priority 150, the highest drive rung.
		self.pub_cmdVel = self.create_publisher(Twist, 'cmd_vel_joy_robot', 10)
		self.pub_ledCtrl = self.create_publisher(Float32MultiArray, 'ugv/led_ctrl', 10)
		self.pub_ptJointStateCtrl = self.create_publisher(Float64MultiArray, 'pt_joint_position_controller/commands', 10)
		self.sub_Joy = self.create_subscription(Joy, 'joy', self.buttonCallback, 10)

		self.declare_parameter('xspeed_limit', 1.0)
		self.declare_parameter('yspeed_limit', 1.0)
		self.declare_parameter('angular_speed_limit', 3.14)
		self.xspeed_limit = self.get_parameter('xspeed_limit').value
		self.yspeed_limit = self.get_parameter('yspeed_limit').value
		self.angular_speed_limit = self.get_parameter('angular_speed_limit').value
		self.led_limit = 255.0

		joysticks = get_joystick_names()
		self.joystick_name = joysticks[0] if len(joysticks) > 0 else "Xbox 360 Controller"
		self.mapping = get_joystick_mapping(self.joystick_name)

		self.ptPoseState = type('', (), {})()  
		self.ptPoseState.x = 0.0
		self.ptPoseState.y = 0.0
		self.add_on_set_parameters_callback(self.on_param_change)

	def on_param_change(self, params):
		for param in params:
			if param.name in (
				"xspeed_limit", "yspeed_limit", "angular_speed_limit",
			):
				self.xspeed_limit = self.get_parameter('xspeed_limit').value
				self.yspeed_limit = self.get_parameter('yspeed_limit').value
				self.angular_speed_limit = self.get_parameter('angular_speed_limit').value
				
				self.get_logger().info(
					f"Updated speed_limit: xspeed_limit={self.xspeed_limit}, yspeed_limit={self.yspeed_limit}, angular_speed_limit={self.angular_speed_limit}"
				)

		return SetParametersResult(successful=True)

	def buttonCallback(self, joy_data):
		if not isinstance(joy_data, Joy):
			return
		self.handle_common_control(joy_data)

	def handle_common_control(self, joy_data):
		ltrigger_pressed = joy_data.axes[self.mapping["LEFT_TRIGGER"]] == -1.0
		if ltrigger_pressed and not self.prev_ltrigger_pressed:
			self.linear_Gear = self.next_gear(self.linear_Gear, [1.0 / 4, 1.0 / 2, 3.0 / 4, 1.0])
			self.angular_Gear = self.next_gear(self.angular_Gear, [1.0 / 4, 1.0 / 2, 3.0 / 4, 1.0])
			self.show_gear("speed")
		self.prev_ltrigger_pressed = ltrigger_pressed

		lb_pressed = joy_data.buttons[self.mapping["LEFT_BUMPER"]] == 1
		if lb_pressed and not self.prev_lbumper_pressed:
			self.linear_Gear = self.down_gear(self.linear_Gear, [1.0 / 4, 1.0 / 2, 3.0 / 4, 1.0])
			self.angular_Gear = self.down_gear(self.angular_Gear, [1.0 / 4, 1.0 / 2, 3.0 / 4, 1.0])
			self.show_gear("speed")

		self.prev_lbumper_pressed = lb_pressed
		x = self.filter_data(joy_data.axes[self.mapping["LEFT_STICK_Y"]]) * self.xspeed_limit * self.linear_Gear
		# y = self.filter_data(joy_data.axes[self.mapping["LEFT_STICK_X"]]) * self.yspeed_limit * self.linear_Gear
		angular = self.filter_data(joy_data.axes[self.mapping["LEFT_STICK_X"]]) * self.angular_speed_limit * self.angular_Gear

		twist = Twist()
		twist.linear.x = max(-self.xspeed_limit, min(self.xspeed_limit, x))
		# twist.linear.y = max(-self.yspeed_limit, min(self.yspeed_limit, y))
		twist.angular.z = max(-self.angular_speed_limit, min(self.angular_speed_limit, angular))

		commanding = (
			twist.linear.x != 0.0
			or twist.linear.y != 0.0
			or twist.angular.z != 0.0
		)

		if self.Joy_active:
			if commanding:
				# Sticks are off centre — stream and hold the rung.
				self.pub_cmdVel.publish(twist)
				self.zero_tail = 0
			elif self.zero_tail < ZERO_TAIL_LIMIT:
				# Sticks just returned to centre. Send a bounded burst of zeros
				# so the robot stops by command...
				self.pub_cmdVel.publish(twist)
				self.zero_tail += 1
			# ...then stay silent while the pad is idle. See ZERO_TAIL_LIMIT:
			# publishing zeros forever at priority 150 starves every lower rung.
			# Note this deliberately skips only the Twist publish — LED and
			# pan-tilt below still run on every /joy message, because they are
			# not arbitrated by twist_mux.


		rtrigger_pressed = joy_data.axes[self.mapping["RIGHT_TRIGGER"]] == -1.0
		rb_pressed = joy_data.buttons[self.mapping["RIGHT_BUMPER"]] == 1

		gear_levels = [round(i / 25.0, 3) for i in range(0, 26)]  

		if rtrigger_pressed and not self.prev_rtrigger_pressed:
			self.led_Gear = self.next_gear(self.led_Gear, gear_levels)
			self.show_gear("led")

		if rb_pressed and not self.prev_rbumper_pressed:
			self.led_Gear = self.down_gear(self.led_Gear, gear_levels)
			self.show_gear("led")

		self.prev_rtrigger_pressed = rtrigger_pressed
		self.prev_rbumper_pressed = rb_pressed

		led_data = self.led_limit * self.led_Gear
		led_msg = Float32MultiArray()
		led_msg.data = [led_data, led_data]
		self.pub_ledCtrl.publish(led_msg)

		change_x = joy_data.axes[self.mapping["RIGHT_STICK_X"]]
		change_y = joy_data.axes[self.mapping["RIGHT_STICK_Y"]]

		self.ptPoseState.x += 0.025*change_x
		self.ptPoseState.y += 0.025*change_y

		pt_position_msg = Float64MultiArray()

		self.ptPoseState.x = max(-3.14, min(3.14, self.ptPoseState.x))
		self.ptPoseState.y = max(-0.523, min(1.57, self.ptPoseState.y))	

		if joy_data.buttons[self.mapping["RIGHT_STICK_CLICK"]]:
			self.ptPoseState.x = 0.0
			self.ptPoseState.y = 0.0
			
		pt_position_msg.data = [self.ptPoseState.x, self.ptPoseState.y]

		self.pub_ptJointStateCtrl.publish(pt_position_msg)

	def next_gear(self, current, options):
		if current in options:
			idx = options.index(current)
			if idx < len(options) - 1:
				return options[idx + 1]
		return current 

	def down_gear(self, current, options):
		if current in options:
			idx = options.index(current)
			if idx > 0:
				return options[idx - 1]
		return current  

	def show_gear(self, type):
		if type=="speed":
			print(f"[Gear] Linear: {self.linear_Gear}, Angular: {self.angular_Gear}")
		if type=="led":
			print(f"[Gear] LED: {self.led_Gear}")

	def filter_data(self, value):
		return value if abs(value) >= 0.2 else 0.0


def main():
	rclpy.init()
	joy_ctrl = JoyTeleop('joy_ctrl')
	rclpy.spin(joy_ctrl)
	joy_ctrl.destroy_node()
	rclpy.shutdown()
