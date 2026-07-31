"""UGV bringup — ESP32 serial bridge + sensor republish (runs on the Jetson).

Telemetry honesty (see also RobotOverview docs/beast-ops.md Quick connect):
  REAL     /ugv/voltage.voltage — pack bus volts from ESP32 JSON "v"
  FAKE     /ugv/voltage.percentage — V/12.6, not state-of-charge
  DUMMY    BatteryState current/charge/capacity/temperature/power_supply_status
  ASSUMED  IMU/mag LSB scales (vendor ICM-20948); odom odl/odr ÷100 as cm→m
  HACK     cmd_vel zero-drop after N zeros; ±0.2 yaw deadband boost
  MISSING  true SOC / charging — needs UPS Module 3S I²C telemetry → Orin

Calibration: do not "tune" FAKE/DUMMY fields. Vendor IMU scales are fine to start
(spot-check 1 g at rest). Calibrate wheel odom / EKF before mapping. Mag only if
using compass. Wire UPS I²C before trusting charge/% .

Deploy to beast-01: edit in D:\\_projects\\ugv_ws → push Coldaine/ugv_ws →
ssh → git pull in ~/beast/ugv_ws → colcon build → restart beast-ros-base.service.
Hangar (RobotOverview) never deploys to the robot.
"""

import rclpy
from rclpy.node import Node
from std_msgs.msg import Header, Float32MultiArray
from geometry_msgs.msg import Twist
from sensor_msgs.msg import Imu, MagneticField, JointState, BatteryState

import os
import time
import json
import threading
import subprocess
import netifaces

from .base_ctrl import BaseController

def get_all_ips():
    ip_dict = {}
    interfaces = netifaces.interfaces()
    for iface in interfaces:
        if iface == 'lo':
            continue
        addrs = netifaces.ifaddresses(iface)
        inet = addrs.get(netifaces.AF_INET)
        if inet:
            ip_dict[iface] = inet[0]['addr']
    return ip_dict


def select_interface_ip(ip_map, configured_name, interface_kind):
    if configured_name:
        return ip_map.get(configured_name, "N/A")

    if interface_kind == 'wifi':
        candidates = [
            name for name in ip_map
            if name.startswith('wl')
            or os.path.isdir(f'/sys/class/net/{name}/wireless')
        ]
    else:
        candidates = [
            name for name in ip_map
            if name == 'eth0' or name.startswith('en')
        ]

    return ip_map[sorted(candidates)[0]] if candidates else "N/A"


def default_serial_port():
    configured = os.getenv('UGV_SERIAL_PORT')
    if configured:
        return configured
    if os.path.exists('/etc/nv_tegra_release'):
        return '/dev/ttyTHS1'
    return '/dev/ttyAMA0'


# ROS node class for bringing up the UGV system and publishing sensor data
class ugv_bringup(Node):
    def __init__(self):
        super().__init__('ugv_bringup')
        # Publishers for IMU data, magnetic field data, odometry, and voltage
        # self.imu_data_raw_publisher_ = self.create_publisher(Imu, "imu/data_raw", 20)
        self.imu_data_raw_publisher_ = self.create_publisher(Imu, "imu/raw", 20)
        self.imu_mag_publisher_ = self.create_publisher(MagneticField, "imu/mag", 20)
        self.odom_publisher_ = self.create_publisher(Float32MultiArray, "odom/odom_raw", 20)
        self.voltage_publisher_ = self.create_publisher(BatteryState, "ugv/voltage", 20)
        self._low_battery_warn_interval = 5.0
        self._last_low_battery_warn = 0.0

        # Subscribe to velocity commands (cmd_vel topic)
        self.cmd_vel_sub_ = self.create_subscription(Twist, "cmd_vel", self.cmd_vel_callback, 20)
        self.zero_vel_count = 0
        self.zero_vel_limit = 5
        # Subscribe to joint states (joint_states topic)
        self.joint_states_sub = self.create_subscription(JointState, 'joint_states', self.joint_states_callback, 20)
        self.last_pt_sent_data = None
        # Subscribe to LED control data (ugv/led_ctrl topic)
        self.led_ctrl_sub = self.create_subscription(Float32MultiArray, 'ugv/led_ctrl', self.led_ctrl_callback, 20)
        
        self.pt_steady_ctrl_sub = self.create_subscription(Float32MultiArray, 'ugv/pt_steady_ctrl', self.pt_steady_ctrl_callback, 20)
        
        self.declare_parameter('serial_port', default_serial_port())
        self.declare_parameter('baud_rate', 115200)
        self.declare_parameter('wifi_interface', '')
        self.declare_parameter('ethernet_interface', '')
        self.declare_parameter('allow_motion', False)
        self.declare_parameter('cmd_vel_timeout', 0.5)
        serial_port_name = self.get_parameter('serial_port').value
        baud_rate = self.get_parameter('baud_rate').value
        self.wifi_interface = self.get_parameter('wifi_interface').value
        self.ethernet_interface = self.get_parameter('ethernet_interface').value
        self.allow_motion = self.get_parameter('allow_motion').value
        self.cmd_vel_timeout = float(self.get_parameter('cmd_vel_timeout').value)
        self._motion_reject_warned = False
        self._last_cmd_vel_time = None
        self._cmd_vel_watchdog_armed = False
                        
        # Initialize the base controller with the UART port and baud rate
        self.base_controller = BaseController(serial_port_name, baud_rate)
        request_data = json.dumps({"T":131,"cmd":1}) + "\n"
        self.base_controller.send_command(request_data.encode())
        if not self.allow_motion:
            self.send_stop_command()
        # Timer to periodically execute the feedback loop
        self.feedback_thread = threading.Thread(target=self.feedback_loop_thread, daemon=True)
        self.feedback_thread.start()
        self.ip_thread = threading.Thread(target=self.ip_thread_func, daemon=True)
        self.ip_thread.start()
        # Stale-cmd_vel watchdog: ESP32 latches last velocity with no firmware timeout
        self._cmd_vel_watchdog_timer = self.create_timer(0.1, self._cmd_vel_watchdog_tick)

        self.set_ugv_version()

    def set_ugv_version(self):
        model = os.getenv("UGV_MODEL", "ugv_rover")
        ugv_main = 2

        if model == "ugv_rover":
            ugv_main = 2
        elif model == "ugv_beast":
            ugv_main = 3
        elif model == "rasp_rover":
            ugv_main = 1
        else:
            ugv_main = 2

        version_data = json.dumps({"T":900,"main":ugv_main,"module":"0"}) + "\n"
        self.base_controller.send_command(version_data.encode())   
        
    def feedback_loop_thread(self):
        rate = self.create_rate(20)
        while rclpy.ok():
            try:
                data = self.base_controller.feedback_data()
                self.base_controller.base_data = data
                if data and data["T"] == 1001:
                    self.publish_imu_mag()
                    self.publish_odom_raw()
                    self.publish_voltage()
                    self.publish_imu_data_raw()
                
            except Exception as e:
                self.get_logger().error(f"[feedback_loop_thread] error: {e}")
            rate.sleep()

    def ip_thread_func(self):
        last_wlan_ip = None
        last_eth_ip = None

        rate = self.create_rate(20)

        while rclpy.ok():
            ip_map = get_all_ips()
            wlan_ip = select_interface_ip(ip_map, self.wifi_interface, 'wifi')
            eth_ip = select_interface_ip(ip_map, self.ethernet_interface, 'ethernet')

            if wlan_ip != last_wlan_ip:
                last_wlan_ip = wlan_ip
                data = json.dumps({'T': '3', 'lineNum': 1, 'Text': f"W:{wlan_ip}"}) + "\n"
                self.base_controller.send_command(data.encode())

            if eth_ip != last_eth_ip:
                last_eth_ip = eth_ip
                data = json.dumps({'T': '3', 'lineNum': 0, 'Text': f"E:{eth_ip}"}) + "\n"
                self.base_controller.send_command(data.encode())

            rate.sleep()

    # Publish IMU data to the ROS topic "imu/data_raw"
    def publish_imu_data_raw(self):
        msg = Imu()
        msg.header = Header()
        msg.header.stamp = self.get_clock().now().to_msg()  # Get the current timestamp
        # ASSUMED: sensor is not at the chassis origin; covariances left at msg defaults (0).
        msg.header.frame_id = "base_link"
        imu_raw_data = self.base_controller.base_data
                
        # ASSUMED vendor scale (ICM-20948 ±4g / 8192 LSB/g) — not calibrated on this robot.
        msg.linear_acceleration.x = 9.8 * float(imu_raw_data["ax"]) / 8192
        msg.linear_acceleration.y = 9.8 * float(imu_raw_data["ay"]) / 8192
        msg.linear_acceleration.z = 9.8 * float(imu_raw_data["az"]) / 8192
        
        # ASSUMED vendor scale (±2000 dps / 16.4 LSB/dps) — not calibrated on this robot.
        msg.angular_velocity.x = 3.1415926 * float(imu_raw_data["gx"]) / (16.4 * 180)
        msg.angular_velocity.y = 3.1415926 * float(imu_raw_data["gy"]) / (16.4 * 180)
        msg.angular_velocity.z = 3.1415926 * float(imu_raw_data["gz"]) / (16.4 * 180)
                   
        self.imu_data_raw_publisher_.publish(msg)  # Publish the IMU data
        
    # Publish magnetic field data to the ROS topic "imu/mag"
    def publish_imu_mag(self):
        msg = MagneticField()
        msg.header = Header()
        msg.header.stamp = self.get_clock().now().to_msg()  # Get the current timestamp
        # ASSUMED: same frame_id caveat as imu/raw; covariances left at defaults.
        msg.header.frame_id = "base_link"
        imu_raw_data = self.base_controller.base_data

        # ASSUMED vendor scale (0.15 µT/LSB) — not calibrated on this robot.
        msg.magnetic_field.x = float(imu_raw_data["mx"]) * 0.15
        msg.magnetic_field.y = float(imu_raw_data["my"]) * 0.15
        msg.magnetic_field.z = float(imu_raw_data["mz"]) * 0.15
              
        self.imu_mag_publisher_.publish(msg)  # Publish the magnetic field data

    # Publish odometry data to the ROS topic "odom/odom_raw" m
    def publish_odom_raw(self):
        odom_raw_data = self.base_controller.base_data
        # ASSUMED: odl/odr are cm from firmware (/100 → m). L/R are ESP32-reported wheel
        # speeds as-is — not fused odometry; EKF consumers must not treat this as ground truth.
        array = [odom_raw_data["odl"]/100, odom_raw_data["odr"]/100,odom_raw_data["L"], odom_raw_data["R"]]
        msg = Float32MultiArray(data=array)
        self.odom_publisher_.publish(msg)  # Publish the odometry data

    def _maybe_low_battery_warning(self, voltage_value: float):
        if not (0.1 < voltage_value < 9):
            return
        now = time.monotonic()
        if now - self._last_low_battery_warn < self._low_battery_warn_interval:
            return
        self._last_low_battery_warn = now
        threading.Thread(
            target=self._low_battery_warn_worker,
            args=(voltage_value,),
            daemon=True,
        ).start()

    def _low_battery_warn_worker(self, voltage_value: float):
        try:
            subprocess.run(
                ['spd-say', 'low battery'],
                check=False,
                timeout=10,
            )
            data = json.dumps({'T': '3', 'lineNum': 2, 'Text': f"V:{voltage_value}"}) + "\n"
            self.base_controller.send_command(data.encode())
        except Exception as e:
            self.get_logger().error(f"Failed low battery warning: {e}")

    # Publish voltage data to the ROS topic "ugv/voltage"
    def publish_voltage(self):
        voltage_data = self.base_controller.base_data
        msg = BatteryState()
        msg.header = Header()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = "base_link"
        # REAL: pack bus voltage from ESP32 JSON field "v" (centivolts → volts).
        msg.voltage = float(voltage_data["v"] / 100)
        # FAKE: not state-of-charge. Linear open-circuit guess V / 12.6 V. Lies under load
        # and while charging. No fuel gauge / UPS I²C current is wired to the Orin yet.
        msg.percentage = float(voltage_data["v"] / 1260)
        # DUMMY: left at BatteryState defaults — current, charge, capacity, temperature,
        # power_supply_status (charging vs not) are unset/zero. present=True only means
        # "we got a voltage sample," not "healthy pack."
        msg.present = True
        self.voltage_publisher_.publish(msg)
        self._maybe_low_battery_warning(msg.voltage)

    # Callback for processing velocity commands m/s
    def cmd_vel_callback(self, msg):
        linear_velocity = msg.linear.x
        angular_velocity = msg.angular.z

        if not self.allow_motion:
            if linear_velocity != 0.0 or angular_velocity != 0.0:
                if not self._motion_reject_warned:
                    self.get_logger().warning(
                        'Rejected non-zero cmd_vel while allow_motion is false'
                    )
                    self._motion_reject_warned = True
                self.send_stop_command()
            return

        self._last_cmd_vel_time = time.monotonic()

        # HACK: after zero_vel_limit consecutive zeros, drop further zero cmds (silent).
        if linear_velocity == 0.0 and angular_velocity == 0.0:
            self.zero_vel_count += 1
            if self.zero_vel_count > self.zero_vel_limit:
                return  
        else:
            self.zero_vel_count = 0  

        # HACK: deadband boost — tiny yaw when not translating is forced to ±0.2.
        if linear_velocity == 0.0:
            if 0 < angular_velocity < 0.2:
                angular_velocity = 0.2
            elif -0.2 < angular_velocity < 0:
                angular_velocity = -0.2

        # Send the velocity data to the UGV as a JSON string
        data = json.dumps({'T': '13', 'X': linear_velocity, 'Z': angular_velocity}) + "\n"
        self.base_controller.send_command(data.encode())
        self._cmd_vel_watchdog_armed = not (
            linear_velocity == 0.0 and angular_velocity == 0.0
        )

    def _cmd_vel_watchdog_tick(self):
        if not self.allow_motion or not self._cmd_vel_watchdog_armed:
            return
        if self._last_cmd_vel_time is None:
            return
        if (time.monotonic() - self._last_cmd_vel_time) < self.cmd_vel_timeout:
            return
        self.send_stop_command()
        self._cmd_vel_watchdog_armed = False
        self.get_logger().warning(
            f'cmd_vel watchdog stop after {self.cmd_vel_timeout:.2f}s silence'
        )

    def send_stop_command(self):
        data = json.dumps({'T': '13', 'X': 0.0, 'Z': 0.0}) + "\n"
        self.base_controller.send_command(data.encode())

    def joint_states_callback(self, msg):
        header = {
            'stamp': {
                'sec': msg.header.stamp.sec,
                'nanosec': msg.header.stamp.nanosec,
            },
            'frame_id': msg.header.frame_id,
        }

        # Extract joint positions and convert to degrees
        name = msg.name
        position = msg.position

        x_rad = position[name.index('pt_base_link_to_pt_link1')]
        y_rad = position[name.index('pt_link1_to_pt_link2')]

        x_degree = (180 * x_rad) / 3.1415926
        y_degree = (180 * y_rad) / 3.1415926

        # Send the joint data as a JSON string to the UGV
        joint_data = json.dumps({
            'T': 133, 
            'X': -x_degree, 
            'Y': y_degree, 
            "SPD": 0,
            "ACC": 0,
        }) + "\n"

        if joint_data == self.last_pt_sent_data:
            return  

        self.last_pt_sent_data = joint_data
                
        self.base_controller.send_command(joint_data.encode())

    # Callback for processing LED control commands 0-255
    def led_ctrl_callback(self, msg):
        IO4 = msg.data[0]
        IO5 = msg.data[1]

        IO4 = max(0, min(IO4, 255))
        IO5 = max(0, min(IO5, 255))     
                
        # Send LED control data as a JSON string to the UGV
        led_ctrl_data = json.dumps({
            'T': 132, 
            "IO4": IO4,
            "IO5": IO5,
        }) + "\n"
           
        self.base_controller.send_command(led_ctrl_data.encode())


    def pt_steady_ctrl_callback(self, msg):
        mode = int(msg.data[0])
        y_value = msg.data[1]

        mode = max(0, min(mode, 1)) 
                
        # Send LED control data as a JSON string to the UGV
        pt_steady_ctrl_data = json.dumps({
            'T': 137, 
            "s": mode,
            "y": y_value,
        }) + "\n"
           
        self.base_controller.send_command(pt_steady_ctrl_data.encode())

    # Callback for processing voltage data
    def voltage_callback(self, msg):
        voltage_value = msg.voltage

        # If voltage drops below a threshold, play a low battery warning sound
        if 0.1 < voltage_value < 9:
            try:
                subprocess.run(['spd-say', 'low battery'], check=True)
                data = json.dumps({'T': '3', 'lineNum': 2, 'Text': f"V:{voltage_value}"}) + "\n"
                self.base_controller.send_command(data.encode())
            except Exception as e:
                self.get_logger().error(f"Failed to say low battery warning: {e}")
            time.sleep(5)
                                    
# Main function to initialize the ROS node and start spinning
def main(args=None):
    rclpy.init(args=args)  # Initialize ROS
    node = ugv_bringup()  # Create the UGV bringup node
    rclpy.spin(node)  # Keep the node running
    #node.destroy_node()  # (optional) Shutdown the node
    rclpy.shutdown()  # Shutdown ROS

if __name__ == '__main__':
    main()
