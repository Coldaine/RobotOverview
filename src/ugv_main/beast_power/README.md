# beast_power

Standalone UPS Module 3S power telemetry for BEAST-01 (PR-2a).

Vendors/adapts LeoRover’s INA219 `charging_monitor` ([LeoRover/leo_robot-ros2](https://github.com/LeoRover/leo_robot-ros2), 9 stars) into an ament_python package that publishes:

| Topic | Type | Meaning |
| --- | --- | --- |
| `/ugv/voltage` | `sensor_msgs/BatteryState` | Pack bus V, signed current (A), OCV SOC in `percentage`, status |
| `/ugv/charging_active` | `std_msgs/Bool` | `true` when current ≥ charging threshold (positive = charging) |

## Coexistence with `ugv_bringup` (locked for Wave 1)

**Choice: eventual sole owner = `beast_power`. Not switched this session.**

- Today (and until PR-2b): `ugv_bringup` remains the live publisher of
  `/ugv/voltage` (real volts from ESP32 `v`, **fake** `percentage = V/12.6`,
  dummy current/status). Stock bringup launch does **not** start this package.
- This package’s launch file is opt-in for bench/CI. **Do not** run
  `beast_power` and bringup’s voltage publisher together — two writers on
  `/ugv/voltage` is undefined.
- PR-2b: stop inventing BatteryState fields in `ugv_bringup`; start
  `beast_power` from bringup (or a sibling launch) so it is the sole owner.
  `ugv_safety_monitor` then consumes `/ugv/charging_active` for `CHARGING_LOCK`.

## Parameters

See `config/beast_power.yaml`. Defaults: `i2c_bus_nr:=7`, `sensor_address:=0x40`,
`data_publish_rate:=1.0`. Wave 2 hardware must confirm bus/address with
`i2cdetect` after wiring (UPS 3→J12-6 GND, 7→J12-5 SCL, 8→J12-3 SDA; omit UPS
5 V / 3V3 — no back-feed).

## Tests (no hardware)

Pure-logic + fake-bus tests (no rclpy required):

```bash
python -m pytest src/ugv_main/beast_power/test -q
```

On the robot after `colcon build --packages-select beast_power`:

```bash
colcon test --packages-select beast_power
```

## Wave 2+ hardware prerequisites

1. Wire UPS Module 3S I²C header → Jetson 40-pin (GND/SCL/SDA only).
2. Verify 3.3 V levels; `i2cdetect` → record bus + address in `docs/beast-ops.md`.
3. Confirm shunt sign (`current_sign`) so positive amps = charging.
4. Refine 3S OCV table against logged pack voltage (incl. 2026-07-31 ~8.8 V note).
5. PR-2b sole-owner cutover + safety-monitor `CHARGING_LOCK` plumb.
