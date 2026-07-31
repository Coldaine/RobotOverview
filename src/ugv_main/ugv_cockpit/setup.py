from setuptools import find_packages, setup
import os
from glob import glob

package_name = 'ugv_cockpit'

setup(
    name=package_name,
    # Keep in lockstep with <version> in package.xml — ament reads the manifest,
    # pip/setuptools reads this, and a mismatch means the installed dist reports
    # a different version than the package it came from.
    version='0.0.1',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        (os.path.join('share',package_name,'launch'),glob(os.path.join('launch','*launch.py'))),
        (os.path.join('share', package_name, 'config'), glob(os.path.join('config', '*.yaml'))),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Coldaine',
    maintainer_email='pmaclyman@gmail.com',
    description='BEAST-01 command spine: twist_mux arbitration in front of /cmd_vel.',
    license='Apache-2.0',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
        ],
    },
)
