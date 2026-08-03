import os
import rclpy
from rclpy.node import Node

from sensor_msgs.msg import JointState
from control_msgs.action import FollowJointTrajectory, GripperCommand
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint

from rclpy.action import ActionClient

class ArmGripperController(Node):
    def __init__(self):
        super().__init__('web_roarm_control')

        self.subscription = self.create_subscription(
            JointState,
            '/web/joint_states',
            self.joint_state_callback,
            10)

        self.arm_client = ActionClient(self, FollowJointTrajectory, '/hand_controller/follow_joint_trajectory')

        self.gripper_client = ActionClient(self, GripperCommand, '/gripper_controller/gripper_cmd')
        self.roarm_type = os.environ['ROARM_MODEL']

    def joint_state_callback(self, msg: JointState):
        gripper_joint = {
            "roarm_m2": "link3_to_gripper_link",
            "roarm_m3": "link5_to_gripper_link",
        }.get(self.roarm_type, None)

        if gripper_joint is None:
            self.get_logger().warn(f"Unknown roarm_type: {self.roarm_type}")
            return

        filtered_names = []
        filtered_positions = []
        gripper_position = None

        for name, pos in zip(msg.name, msg.position):
            if name == gripper_joint:
                gripper_position = pos
            else:
                filtered_names.append(name)
                filtered_positions.append(pos)

        goal_msg = FollowJointTrajectory.Goal()
        trajectory = JointTrajectory()
        trajectory.joint_names = filtered_names

        point = JointTrajectoryPoint()
        point.positions = filtered_positions
        point.time_from_start.sec = 0
        point.time_from_start.nanosec = 150000000
        trajectory.points.append(point)

        goal_msg.trajectory = trajectory

        self.arm_client.wait_for_server()
        send_goal_future = self.arm_client.send_goal_async(goal_msg)
        send_goal_future.add_done_callback(self.arm_response_callback)

        if gripper_position is not None:
            self.send_gripper_command(position=gripper_position)


    def arm_response_callback(self, future):
        goal_handle = future.result()
        if not goal_handle.accepted:
            self.get_logger().error('Arm trajectory goal was rejected')
            return

        self.get_logger().info('Arm trajectory goal was accepted')
        result_future = goal_handle.get_result_async()
        result_future.add_done_callback(self.arm_result_callback)

    def arm_result_callback(self, future):
        result = future.result().result
        self.get_logger().info(f'Arm trajectory action completed, result: {result}')

    def send_gripper_command(self, position: float, max_effort: float = 10.0):
        goal_msg = GripperCommand.Goal()
        goal_msg.command.position = position
        goal_msg.command.max_effort = max_effort

        self.gripper_client.wait_for_server()
        send_goal_future = self.gripper_client.send_goal_async(goal_msg)
        send_goal_future.add_done_callback(self.gripper_response_callback)

    def gripper_response_callback(self, future):
        goal_handle = future.result()
        if not goal_handle.accepted:
            self.get_logger().error('Gripper goal was rejected')
            return

        self.get_logger().info('Gripper goal was accepted')
        result_future = goal_handle.get_result_async()
        result_future.add_done_callback(self.gripper_result_callback)

    def gripper_result_callback(self, future):
        result = future.result().result
        self.get_logger().info(f'Gripper action completed, result: {result}')

def main(args=None):
    rclpy.init(args=args)
    node = ArmGripperController()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
