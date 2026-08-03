# Set 2 — Power telemetry (bench hardware + `beast_power`)

**Parent:** [master plan](2026-08-02-beast-agent-architecture.md). Parallel with Set 1.
Replaces the fake `V/12.6` SOC and gives the safety spine a real charging signal.

## Inputs

- Wiring research already in repo: `public/beast-ups-i2c-wiring.svg`,
  `ups-module-3s-header.png`; back-feed rules in `docs/beast-ops.md` and the
  `ins-beast-uart-5v-hazard` insight class (never land 5 V on Jetson pins).
- Telemetry honesty table, `docs/beast-ops.md`: `%` is fake, most `BatteryState`
  fields are dummy — root cause is the unwired UPS I²C.

## Work items

### Bench session (hardware, no PR) — wire the UPS I²C
- UPS Module 3S header → Jetson 40-pin (J12): UPS **3 (GND)→ J12 6**, **7 (SCL) → J12 5**,
  **8 (SDA) → J12 3**. Omit the UPS 5 V/3V3 pins entirely (no back-feed).
- Verify level compatibility before connecting (Jetson header I²C is 3.3 V); confirm
  with `i2cdetect` which bus (`/dev/i2c-X`) and INA219 addresses appear.
- Record pinout + bus in `docs/beast-ops.md` (dated).

### PR-2a — `beast_power` package (ugv_ws)
- Standalone package (NOT inside `ugv_bringup`). **Vendor, don't rewrite:** copy
  LeoRover's INA219 `charging_monitor` node ([leo_robot-ros2](https://github.com/LeoRover/leo_robot-ros2),
  merged Dec 2025, `smbus2`, ~176 lines) into `beast_power` and adapt — addresses,
  rate, topics, SOC curve. Do not depend on the Galactic-era Pet-Series package.
- Configurable bus/address, sane publish rate (1–2 Hz).
- True SOC from the 3S discharge curve (document the curve source in-code), real
  current with sign convention: positive = charging.
- Publishes: honest `sensor_msgs/BatteryState` on `/ugv/voltage`, and
  `std_msgs/Bool charging_active` on `/ugv/charging_active`.
- Fake-bus unit tests (no hardware needed in CI): curve math, sign convention,
  sensor-absent behavior (publish status, not garbage).

### PR-2b — Plumb it through (ugv_ws + RobotOverview)
- `ugv_bringup` stops inventing battery fields; `/ugv/voltage` is owned solely by
  `beast_power` (or bringup relays verbatim — pick sole-owner, document choice).
- `ugv_safety_monitor` (Set 1c) consumes `charging_active` → `CHARGING_LOCK`.
- Hangar HonestyRail: remove the "fake SOC" warning once true SOC lands; keep the
  label until then. Type contract in `src/lib/ros/client.ts` unchanged (same topic/type).

## Done when

- `ros2 topic echo /ugv/voltage` shows SOC that moves believably under load/charge.
- Charger plugged → `/ugv/charging_active` true → (post Set 1) motion locks with
  `CHARGING_LOCK`; unplugged → clears.
- Brownout history (2026-07-31 ~8.8 V incident) gets a dated follow-up note in
  beast-ops comparing old fake % vs new SOC at the same pack voltage.
