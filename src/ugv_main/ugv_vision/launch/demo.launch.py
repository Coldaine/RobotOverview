import os
from launch import LaunchDescription
from launch_ros.actions import Node
from launch.substitutions import LaunchConfiguration
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.substitutions import LaunchConfiguration
from launch.launch_description_sources import PythonLaunchDescriptionSource
from ament_index_python.packages import get_package_share_directory

def generate_launch_description():

    package = "ugv_vision"
    package_shared_path = get_package_share_directory(package)

    cam_bringup_launch = IncludeLaunchDescription(
         PythonLaunchDescriptionSource(
             os.path.join(get_package_share_directory(package), 'launch', 'camera.launch.py')
         ),
    )

    node = Node(
        package=package,
        executable=LaunchConfiguration("exe"),
        output="screen",
        parameters=[

        ],
    )

    arg = DeclareLaunchArgument(name="exe")
    return LaunchDescription([
        cam_bringup_launch,
        arg, 
        node
    ])
