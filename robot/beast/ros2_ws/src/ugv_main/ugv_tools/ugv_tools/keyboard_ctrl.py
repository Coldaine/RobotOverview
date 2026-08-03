#!/usr/bin/env python3
# encoding: utf-8
import atexit
import signal
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
s/S : toggle stop. Engaging it clears the latched drive, sends a short zero
      burst, then goes quiet — releasing it needs a fresh drive key
space key, k : stop motion (zero velocity)

Control Your Pt!
---------------------------
0 : Reset pt to [0, 0]
1 : Increase Joint1 (X)
2 : Increase Joint2 (Y)
r : Reverse direction

Drive keys latch until Space/k stops.
No auto-stop on key release.

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

# How many consecutive zero Twists to send after the command returns to zero,
# before going silent. Mirrors ugv_bringup's own `zero_vel_limit = 5`.
#
# WHY THIS EXISTS (twist_mux starvation): twist_mux awards /cmd_vel to the
# highest-priority source that has not expired, and *any* message — including a
# zero Twist — refreshes that source's timestamp. keyboard_ctrl sits at priority
# 100; if it published every 20 ms forever, it would hold the floor forever and
# nav (10) and the UI rung (50) could never get a command through, even with the
# operator's hands off the keyboard. Publishing a bounded tail of zeros and then
# STOPPING lets this source expire after twist_mux's 0.5 s timeout and hands the
# floor back down the ladder.
#
# The tail is not decoration: it is the command that actually stops the robot
# (5 x 20 ms = 100 ms, well inside the 0.5 s watchdog). ugv_bringup's cmd_vel
# watchdog is the backstop if even the tail is lost.
ZERO_TAIL_LIMIT = 5

# Keys that re-arm the zero tail — i.e. the ones that are a drive command or an
# explicit stop. Only these may put this node back on the priority-100 rung.
#
# WHY THIS IS NARROW: re-arming on *any* keystroke means the pan-tilt keys
# (0/1/2/r) and the speed-scale keys (q/z/w/x/e/c) each fire a fresh 5-zero
# burst on cmd_vel_joy_operator. Those zeros outrank the UI (50) and nav (10)
# rungs, so nudging the gimbal or trimming the speed while something else is
# driving would interrupt it — and holding a pan key would pin the robot
# stopped without ever touching a drive key. Gimbal and speed keys change no
# velocity, so they must not claim the velocity rung.
#
# Space and k are zero-velocity *commands* (an explicit stop the operator asked
# for), and s/S toggles the stop latch, so all three belong here: each one has
# to reach the wire even if the node had already fallen silent.
MOTION_KEYS = frozenset(moveBindings) | {" ", "k", "s", "S"}


def _rearms_zero_tail(key):
    """True if `key` is a motion command or an explicit stop.

    See MOTION_KEYS: this is the guard on re-arming the zero tail, deliberately
    not `if chunk` — a keystroke is not automatically drive activity.
    """
    return key in MOTION_KEYS


class _TerminalSettings:
    """Save/restore TTY attributes so the shell keeps echo after exit."""

    def __init__(self, fd):
        self._fd = fd
        self._saved = termios.tcgetattr(fd)
        self._restored = False

    def set_cbreak(self):
        tty.setcbreak(self._fd)

    def restore(self):
        if self._restored:
            return
        try:
            termios.tcsetattr(self._fd, termios.TCSAFLUSH, self._saved)
        except termios.error:
            pass
        self._restored = True


class UgvKeyboard(Node):
    def __init__(self, name):
        super().__init__(name)
        # Command spine: never publish /cmd_vel directly. twist_mux owns that
        # topic (ugv_cockpit/config/twist_mux.yaml). Keyboard teleop is the
        # remote operator's direct drive path -> priority 100.
        self.pub = self.create_publisher(Twist, "cmd_vel_joy_operator", 1)
        self.pub_pt_joint = self.create_publisher(
            Float64MultiArray, "pt_joint_position_controller/commands", 10
        )

        self.declare_parameter("linear_speed_limit", 1.0)
        self.declare_parameter("angular_speed_limit", 1.0)

        self.linear_speed_limit = (
            self.get_parameter("linear_speed_limit").get_parameter_value().double_value
        )
        self.angular_speed_limit = (
            self.get_parameter("angular_speed_limit").get_parameter_value().double_value
        )

        self.pt_pose_x = 0.0
        self.pt_pose_y = 0.0
        self.pt_reverse = False

    def drain_keys(self):
        buf = []
        while True:
            rlist, _, _ = select.select([sys.stdin], [], [], 0)
            if not rlist:
                break
            c = sys.stdin.read(1)
            if c:
                buf.append(c)
        return "".join(buf)

    def vels(self, speed, turn):
        return "currently:\tspeed %s\tturn %s " % (speed, turn)


def main():
    if not sys.stdin.isatty():
        print(
            "keyboard_ctrl needs an interactive terminal (stdin must be a TTY).\n"
            "Use a desktop terminal with docker exec -it (ros2.sh → Enter container)."
        )
        return 1

    tty_fd = sys.stdin.fileno()
    term = _TerminalSettings(tty_fd)
    atexit.register(term.restore)

    rclpy.init()
    node = UgvKeyboard("keyboard_ctrl")

    def _exit_signal_handler(signum, _frame):
        term.restore()
        raise SystemExit(128 + signum)

    signal.signal(signal.SIGINT, _exit_signal_handler)
    signal.signal(signal.SIGTERM, _exit_signal_handler)

    xspeed_switch = True
    speed, turn = 0.2, 0.5
    x, th = 0, 0
    status = 0
    stop = False
    twist = Twist()
    quit_requested = False
    # Start already silent: a keyboard_ctrl nobody has touched yet must not
    # claim the priority-100 rung and mask nav/UI just by being running.
    zero_tail = ZERO_TAIL_LIMIT

    try:
        term.set_cbreak()
        print(msg)
        print(node.vels(speed, turn))

        while rclpy.ok():
            chunk = node.drain_keys()

            if "\x03" in chunk:
                quit_requested = True

            for key in chunk:
                if key == "t" or key == "T":
                    xspeed_switch = not xspeed_switch
                elif key == "s" or key == "S":
                    stop = not stop
                    if stop:
                        # Drop the latched command as well as gating output.
                        # Otherwise toggling stop back off silently resumes the
                        # speed that was latched before — the robot drives away
                        # on a keystroke that reads as "release the stop", with
                        # no fresh drive key from the operator.
                        x, th = 0, 0
                    print("stop keyboard control: {}".format(stop))
                elif key in moveBindings:
                    x = moveBindings[key][0]
                    th = moveBindings[key][1]
                elif key in speedBindings:
                    speed *= speedBindings[key][0]
                    turn *= speedBindings[key][1]
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

            if xspeed_switch:
                twist.linear.x = float(speed * x)
                twist.linear.y = 0.0
            else:
                twist.linear.x = 0.0
                twist.linear.y = float(speed * x)
            twist.angular.z = float(turn * th)

            outgoing = Twist() if stop else twist
            commanding = (
                outgoing.linear.x != 0.0
                or outgoing.linear.y != 0.0
                or outgoing.angular.z != 0.0
            )

            # Re-arm the zero tail on drive/stop keys only, so a fresh Space/k
            # always puts a stop command on the wire even if we had already
            # fallen silent. See MOTION_KEYS: pan-tilt and speed-scale keys are
            # excluded on purpose — they command no velocity, so they must not
            # take the priority-100 rung back from nav or the UI.
            if any(_rearms_zero_tail(key) for key in chunk):
                zero_tail = 0

            if commanding:
                # Actively driving — stream at the loop rate and keep the rung.
                node.pub.publish(outgoing)
                zero_tail = 0
            elif zero_tail < ZERO_TAIL_LIMIT:
                # Command just returned to zero. Send a short, bounded burst of
                # zeros so the robot stops by command rather than by watchdog...
                node.pub.publish(outgoing)
                zero_tail += 1
            # ...then go silent. See ZERO_TAIL_LIMIT: an idle-but-publishing
            # source at priority 100 would mask every lower twist_mux rung
            # forever. Silence lets this source expire (0.5 s) and hands the
            # floor back to nav / the UI.

            if quit_requested:
                break

            time.sleep(LOOP_PERIOD)

    except (KeyboardInterrupt, SystemExit):
        pass
    except Exception as e:
        print(e)
    finally:
        term.restore()
        try:
            node.pub.publish(Twist())
        except Exception:
            pass
        try:
            node.destroy_node()
        except Exception:
            pass
        if rclpy.ok():
            rclpy.shutdown()

    return 0