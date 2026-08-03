# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0

"""Make ``ugv_cockpit`` importable when this suite runs as bare pytest.

Under ``colcon test`` the package is already on the path. Under the bare-pytest
gate (.github/workflows/spine-tests.yml, which runs on a runner with no ROS)
it is not, so ``from ugv_cockpit.depth_ops import ...`` in test_cockpit_nodes.py
would be a COLLECTION ERROR that takes the whole suite down — including the
whitelist and arbitration tests that are the actual merge gate.

Adding the package root here rather than skipping the import means those depth
tests really run in CI instead of quietly reporting green as a skip.
"""

import os
import sys

_PACKAGE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if _PACKAGE_ROOT not in sys.path:
    sys.path.insert(0, _PACKAGE_ROOT)
