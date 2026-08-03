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
from rclpy.parameter import Parameter
from rclpy.qos import DurabilityPolicy, HistoryPolicy, QoSProfile
from rcl_interfaces.msg import SetParametersResult
from std_msgs.msg import Header, Bool, Float32MultiArray
from std_srvs.srv import SetBool
from geometry_msgs.msg import Twist
from sensor_msgs.msg import Imu, MagneticField, JointState, BatteryState
from diagnostic_msgs.msg import DiagnosticStatus, KeyValue

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
        # Canonical topic is imu/data (EKF / rf2o / odom_publisher / cockpit).
        # imu/raw is a same-payload alias for acceptance scripts that still echo it.
        self.imu_data_publisher_ = self.create_publisher(Imu, "imu/data", 20)
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
        self.allow_motion = bool(self.get_parameter('allow_motion').value)
        self.cmd_vel_timeout = float(self.get_parameter('cmd_vel_timeout').value)
        self._motion_reject_warned = False
        self._last_cmd_vel_time = None
        self._cmd_vel_watchdog_armed = False
        # Latched: the watchdog issued a stop and nothing has driven since.
        # Cleared when a fresh non-zero command is accepted. Only this node can
        # observe it — the stop it sends is byte-identical to an operator's, so
        # no outside watcher could tell them apart from /cmd_vel.
        self._cmd_vel_watchdog_fired = False
        self._applying_allow_motion = False

        # Initialize the base controller with the UART port and baud rate
        self.base_controller = BaseController(serial_port_name, baud_rate)
        request_data = json.dumps({"T":131,"cmd":1}) + "\n"
        self.base_controller.send_command(request_data.encode())
        if not self.allow_motion:
            self.send_stop_command()

        # Safety state for the cockpit. These two topics exist so the browser
        # cockpit can gate its drive controls on what the ROBOT reports rather
        # than on what the UI last sent — see ugv_cockpit/cockpit_status.py and
        # docs/cockpit.md. TRANSIENT_LOCAL with depth 1 so a client that
        # connects between ticks gets the current state immediately instead of
        # rendering "unknown" for up to half a second; the periodic republish
        # below is what lets a consumer detect that this node has died.
        #
        # ORDERING IS LOAD-BEARING: these two create_publisher calls come AFTER
        # the serial port is open and the startup stop has been sent. Creating a
        # publisher can raise (QoS/RMW/name errors), and a raise here before the
        # stop would leave a robot whose ESP32 is still latching whatever
        # velocity it held at power-on, with no node alive to stop it. Telemetry
        # for the cockpit is never allowed to precede the robot's own safing.
        safety_qos = QoSProfile(
            depth=1,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
            history=HistoryPolicy.KEEP_LAST,
        )
        self.allow_motion_publisher_ = self.create_publisher(
            Bool, '/ugv/allow_motion', safety_qos
        )
        self.watchdog_state_publisher_ = self.create_publisher(
            DiagnosticStatus, '/ugv/watchdog_state', safety_qos
        )
        self.create_service(
            SetBool, '/ugv/set_allow_motion', self._set_allow_motion_cb
        )
        self.add_on_set_parameters_callback(self._on_set_parameters)

        # Timer to periodically execute the feedback loop
        self.feedback_thread = threading.Thread(target=self.feedback_loop_thread, daemon=True)
        self.feedback_thread.start()
        self.ip_thread = threading.Thread(target=self.ip_thread_func, daemon=True)
        self.ip_thread.start()
        # Stale-cmd_vel watchdog: ESP32 latches last velocity with no firmware timeout
        self._cmd_vel_watchdog_timer = self.create_timer(0.1, self._cmd_vel_watchdog_tick)
        # 2 Hz safety heartbeat. Deliberately faster than the cockpit's 3 s
        # staleness window, so one dropped tick never reads as "bringup is gone".
        self._safety_state_timer = self.create_timer(0.5, self._publish_safety_state)
        self._publish_safety_state()

        self.set_ugv_version()

    def apply_allow_motion(self, allow, source='unknown'):
        """Flip the enforced motion gate and stop immediately when disabling."""
        desired = bool(allow)
        previous = bool(self.allow_motion)
        if desired == previous:
            self._publish_safety_state()
            return previous, desired

        self.allow_motion = desired
        if previous and not desired:
            self.send_stop_command()
            self._cmd_vel_watchdog_armed = False
            self._motion_reject_warned = False
            self.get_logger().warning(
                f'allow_motion disabled via {source}; stop sent immediately'
            )
        elif not previous and desired:
            self._motion_reject_warned = False
            self.get_logger().warning(f'allow_motion enabled via {source}')
        self._publish_safety_state()
        return previous, desired

    def _set_allow_motion_cb(self, request, response):
        previous, desired = self.apply_allow_motion(
            request.data, source='service:/ugv/set_allow_motion'
        )
        if previous != desired:
            self._applying_allow_motion = True
            try:
                self.set_parameters([
                    Parameter('allow_motion', Parameter.Type.BOOL, desired)
                ])
            finally:
                self._applying_allow_motion = False
        response.success = True
        response.message = (
            f'allow_motion={str(desired).lower()} '
            f'(was {str(previous).lower()})'
        )
        return response

    def _on_set_parameters(self, params):
        result = SetParametersResult(successful=True)
        if self._applying_allow_motion:
            return result
        for param in params:
            if param.name != 'allow_motion':
                continue
            if param.type_ != Parameter.Type.BOOL:
                result.successful = False
                result.reason = 'allow_motion must be a bool'
                return result
            self.apply_allow_motion(
                param.value, source='parameter:allow_motion'
            )
        return result

    def _publish_safety_state(self):
        """Publish the arming gate and the cmd_vel watchdog state.

        Both values are read from this node's own state, which is the only
        place either one exists:

          * `allow_motion` is the parameter this node latched at startup and
            actually enforces in cmd_vel_callback — not the parameter server's
            current value, which nothing re-reads. Publishing the enforced
            value is what makes the cockpit's gate honest.
          * `armed` means exactly "the automatic stop-on-silence WILL happen":
            the watchdog timer exists, is not cancelled, and has a positive
            timeout. Deliberately INDEPENDENT of allow_motion. The old
            definition ANDed in allow_motion, which made amber "not armed" the
            normal resting state of a parked robot — and a state an operator
            sees every day is a state they stop reading, so a real watchdog
            failure would have arrived looking exactly like Tuesday. The UI
            renders allow_motion separately from its own entry; this key
            answers one question only, and false must always mean "nothing will
            stop this robot automatically".
          * `watching` is the transient internal flag: a non-zero command is in
            flight and the next tick will time it. It flips on every zero
            command, which is why `armed` is the stable value the UI reads.
          * `fired` latches the watchdog's own stop until something drives
            again.

        The whole body is wrapped: this runs on the same single-threaded
        executor as _cmd_vel_watchdog_tick, and main() is a bare rclpy.spin, so
        an exception escaping here would kill the process and take the only
        automatic stop on the robot down with it. Losing a telemetry tick is
        survivable; losing the watchdog is not.
        """
        try:
            self.allow_motion_publisher_.publish(
                Bool(data=bool(self.allow_motion))
            )

            status = DiagnosticStatus()
            status.name = 'cmd_vel_watchdog'
            status.hardware_id = 'ugv_bringup'
            armed = (
                self.cmd_vel_timeout > 0.0
                and self._cmd_vel_watchdog_timer is not None
                and not self._cmd_vel_watchdog_timer.is_canceled()
            )
            if self._cmd_vel_watchdog_fired:
                status.level = DiagnosticStatus.ERROR
                status.message = 'watchdog stopped the robot; no command since'
            elif armed:
                # OK whether or not motion is allowed: a parked robot with a
                # live watchdog is healthy, not a warning. WARN is reserved for
                # the one case that is genuinely wrong — no automatic stop.
                status.level = DiagnosticStatus.OK
                status.message = (
                    'armed; motion allowed' if self.allow_motion
                    else 'armed; motion locked'
                )
            else:
                status.level = DiagnosticStatus.WARN
                status.message = 'NOT armed — no automatic stop on cmd_vel silence'
            status.values = [
                KeyValue(key='armed', value=str(armed).lower()),
                KeyValue(
                    key='fired', value=str(self._cmd_vel_watchdog_fired).lower()
                ),
                KeyValue(
                    key='watching', value=str(self._cmd_vel_watchdog_armed).lower()
                ),
                KeyValue(key='timeout', value=f'{self.cmd_vel_timeout:.2f}'),
            ]
            self.watchdog_state_publisher_.publish(status)
        except Exception as exc:
            self.get_logger().warning(
                f'safety state publish failed: {exc}',
                throttle_duration_sec=5.0,
            )

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
                   
        # REP-145: orientation_covariance[0] < 0 means orientation is not provided.
        msg.orientation_covariance[0] = -1.0
        # Conservative diagonal cov so EKF does not treat gyros as perfect.
        msg.angular_velocity_covariance[0] = 0.02
        msg.angular_velocity_covariance[4] = 0.02
        msg.angular_velocity_covariance[8] = 0.02
        msg.linear_acceleration_covariance[0] = 0.04
        msg.linear_acceleration_covariance[4] = 0.04
        msg.linear_acceleration_covariance[8] = 0.04

        if hasattr(self, "imu_data_publisher_"):
            self.imu_data_publisher_.publish(msg)
        self.imu_data_raw_publisher_.publish(msg)
        
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
        if self._cmd_vel_watchdog_armed:
            # Something is driving again, so the previous watchdog stop is
            # history rather than the current state of the robot.
            self._cmd_vel_watchdog_fired = False

    def _cmd_vel_watchdog_tick(self):
        """Stop the robot when nobody has driven it for cmd_vel_timeout.

        This is the ONLY automatic stop on BEAST-01 — the ESP32 latches the
        last velocity it was given and has no firmware timeout of its own. Two
        rules follow from that and are not negotiable:

          1. send_stop_command() runs FIRST, before any bookkeeping, logging or
             publishing. Everything after it is reporting; the stop itself must
             not sit behind a line that can raise.
          2. Nothing propagates out of here. main() is a bare rclpy.spin on a
             single-threaded executor with no exception handling, so an
             exception escaping this callback would tear down the process and
             with it the only thing that stops this robot.
        """
        try:
            if not self.allow_motion or not self._cmd_vel_watchdog_armed:
                return
            if self._last_cmd_vel_time is None:
                return
            if (time.monotonic() - self._last_cmd_vel_time) < self.cmd_vel_timeout:
                return
            self.send_stop_command()
            self._cmd_vel_watchdog_armed = False
            self._cmd_vel_watchdog_fired = True
            self.get_logger().warning(
                f'cmd_vel watchdog stop after {self.cmd_vel_timeout:.2f}s silence'
            )
            # Report it immediately rather than waiting up to 0.5 s for the next
            # heartbeat: this is the one transition the cockpit must not lag on.
            # Last, and after the log line: the forensic record of the stop is
            # worth more than the cockpit's half-second head start, and
            # _publish_safety_state touches the DDS stack, which is the part of
            # this sequence most likely to fail.
            self._publish_safety_state()
        except Exception as exc:
            self.get_logger().error(
                f'cmd_vel watchdog tick failed: {exc}',
                throttle_duration_sec=5.0,
            )
            return

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
