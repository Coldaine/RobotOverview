from setuptools import find_packages, setup
import os
from glob import glob

package_name = 'beast_power'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        (os.path.join('share', package_name, 'launch'),
            glob(os.path.join('launch', '*launch.py'))),
        (os.path.join('share', package_name, 'config'),
            glob(os.path.join('config', '*'))),
    ],
    install_requires=['setuptools', 'smbus2'],
    zip_safe=True,
    maintainer='Coldaine',
    maintainer_email='pmaclyman@gmail.com',
    description=(
        'BEAST-01 driver-board INA219 power telemetry '
        '(BatteryState + charging_active).'
    ),
    license='Apache-2.0',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'power_node = beast_power.power_node:main',
            'power_logger = beast_power.logger_node:main',
        ],
    },
)
