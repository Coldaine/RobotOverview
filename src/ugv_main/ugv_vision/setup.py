from setuptools import find_packages, setup
import os
from glob import glob

package_name = 'ugv_vision'

setup(
    name=package_name,
    version='0.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        (os.path.join('share',package_name,'launch'),glob(os.path.join('launch','*launch.py'))),
        (os.path.join('share', package_name, 'config'), glob(os.path.join('config', '*'))),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='dudu',
    maintainer_email='dudu@todo.todo',
    description='TODO: Package description',
    license='TODO: License declaration',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'cam_webrtc = ugv_vision.cam_webrtc:main',
            'cam_oak_webrtc = ugv_vision.cam_oak_webrtc:main',
            'color_track_pid = ugv_vision.color_track_pid:main',
            'color_track_line_pid = ugv_vision.color_track_line_pid:main',
            'pt_color_track = ugv_vision.pt_color_track:main',
            'apriltag_track_pid = ugv_vision.apriltag_track_pid:main',
            'apriltag_track_nav2 = ugv_vision.apriltag_track_nav2:main'
        ],
    },
)
