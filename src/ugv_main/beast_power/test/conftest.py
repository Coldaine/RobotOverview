# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
"""Make ``beast_power`` importable without colcon install (Windows / bare pytest)."""

from __future__ import annotations

import sys
from pathlib import Path

_PKG_ROOT = Path(__file__).resolve().parents[1]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))
