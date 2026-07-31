#!/usr/bin/env python3
"""Run rosbridge with only the topic operations the cockpit uses.

rosbridge 2.0.7 always registers service and action capabilities, and it
force-adds ``/rosapi/*`` even when ``services_glob`` is ``[]``.  A topic-only
protocol removes those opcodes altogether, so a rosapi node elsewhere in the
ROS domain cannot widen this bridge.
"""
import os
import runpy
import sys

from ament_index_python.packages import get_package_prefix
from rosbridge_library.capabilities.advertise import Advertise
from rosbridge_library.capabilities.defragmentation import Defragment
from rosbridge_library.capabilities.publish import Publish
from rosbridge_library.capabilities.subscribe import Subscribe
from rosbridge_library.rosbridge_protocol import RosbridgeProtocol


TOPIC_ONLY_CAPABILITIES = (Advertise, Publish, Subscribe, Defragment)


def main():
    """Patch the upstream protocol before executing its websocket server."""
    RosbridgeProtocol.rosbridge_capabilities = TOPIC_ONLY_CAPABILITIES
    executable = os.path.join(
        get_package_prefix('rosbridge_server'),
        'lib',
        'rosbridge_server',
        'rosbridge_websocket',
    )
    sys.argv[0] = executable
    runpy.run_path(executable, run_name='__main__')


if __name__ == '__main__':
    main()
