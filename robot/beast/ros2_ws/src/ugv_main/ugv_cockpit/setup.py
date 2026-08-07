from setuptools import find_packages, setup
import os
from glob import glob

package_name = 'ugv_cockpit'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        (os.path.join('share', package_name, 'launch'), glob(os.path.join('launch', '*launch.py'))),
        (os.path.join('share', package_name, 'config'), glob(os.path.join('config', '*'))),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Coldaine',
    maintainer_email='pmaclyman@gmail.com',
    description='BEAST-01 Command Deck cockpit: nodes and twist_mux spine.',
    license='Apache-2.0',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'depth_colorizer = ugv_cockpit.depth_colorizer:main',
            'overhead_clearance = ugv_cockpit.overhead_clearance:main',
            'cockpit_status = ugv_cockpit.cockpit_status:main',
            'cockpit_rosbridge = ugv_cockpit.cockpit_rosbridge:main',
        ],
    },
)
