"""Low-battery voice + OLED warning for beast_base (runs on the Jetson).

The ESP32 JSON "v" field (centivolts, ~1.2% low vs the INA219) drives only this
voice warning — ``/ugv/voltage`` is beast_power's since the 2026-08-07 cutover,
so this module never publishes BatteryState. The OLED "V:" line (T:3, lineNum 2)
is written on the serial link after the voice command succeeds.

Fire rules:
  * only when 0.1 < voltage < 9 V — a real low-cell read, not a glitch or a
    full-pack float
  * at most once per ``_warn_interval`` (5 s) — the double-fire guard against
    the ESP32 streaming the same low value at 20 Hz
  * the voice command runs in a daemon thread so a hung ``spd-say`` can never
    stall the feedback loop
"""

import json
import subprocess
import threading
import time


class LowBatteryVoice:
    """Gated 'low battery' voice + OLED line, driven by the ESP32 "v" field."""

    def __init__(self, send_command, get_logger):
        self._send_command = send_command
        self._get_logger = get_logger
        self._warn_interval = 5.0
        self._last_warn = 0.0

    def check(self, voltage_data):
        """Feed one ESP32 feedback frame (T:1001) — fires the warning if low."""
        self._maybe_low_battery_warning(float(voltage_data["v"] / 100))

    def _maybe_low_battery_warning(self, voltage_value: float):
        if not (0.1 < voltage_value < 9):
            return
        now = time.monotonic()
        if now - self._last_warn < self._warn_interval:
            return
        self._last_warn = now
        threading.Thread(
            target=self._low_battery_warn_worker,
            args=(voltage_value,),
            daemon=True,
        ).start()

    def _low_battery_warn_worker(self, voltage_value: float):
        try:
            subprocess.run(
                ['spd-say', 'low battery'],
                check=False,
                timeout=10,
            )
            data = json.dumps({'T': '3', 'lineNum': 2, 'Text': f"V:{voltage_value}"}) + "\n"
            self._send_command(data.encode())
        except Exception as e:
            self._get_logger().error(f"Failed low battery warning: {e}")
