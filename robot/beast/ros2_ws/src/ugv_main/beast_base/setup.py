from setuptools import find_packages, setup

package_name = 'beast_base'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Coldaine',
    maintainer_email='pmaclyman@gmail.com',
    description='BEAST-01 ESP32 serial bridge + sensor republish (base node).',
    license='Apache-2.0',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'beast_base = beast_base.base_node:main',
        ],
    },
)
