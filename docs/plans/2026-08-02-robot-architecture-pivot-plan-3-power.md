# Plan 3: I2C UPS Telemetry & Powertrain Visibility

## Executive Summary
Currently, the Orin Nano pulls power from the UPS Module 3S via the barrel jack, but the I2C control pins are **not wired on the live robot**, so the OS is blind to the physical charging status. Battery percentages are "faked" via simple voltage math in the code. We will establish the physical data link and write the driver to gain true insight into the power states.

## Physical Wiring (The Blocker)
Before software can work, the connection must be pinned between the Jetson Carrier (J12) and the UPS Module 3S.
- **UPS Pin 3 (GND)** → **Jetson J12 Pin 6 (GND)**
- **UPS Pin 7 (SCL)** → **Jetson J12 Pin 5 (SCL)**
- **UPS Pin 8 (SDA)** → **Jetson J12 Pin 3 (SDA)**
*(Power leads to the UPS 5V/3V3 pins must explicitly be omitted to avoid backfeeding the Jetson's regulated rails).*

## Software Implementation

### 1. INA219 I2C Diagnostics Node
The UPS board utilizes INA219 chips to measure current and voltage.
- Develop a Python ROS 2 node that periodically polls the I2C bus (`/dev/i2c-X`) using the `smbus2` or `adafruit-circuitpython-ina219` libraries.
- The node calculates true SOC (State of Charge) based on the 3S battery discharge curve, not just a raw voltage assumption.

### 2. Detecting "Charging" State
- Read the current direction. If the net current through the INA219 is *charging* the cells (positive flow into the battery array), or an external voltage on the DC_IN rail is detected via the chip, the system flags `charging_active = True`.

### 3. Publishing to `ugv_ws`
- Publish `sensor_msgs/msg/BatteryState` properly to `/ugv/voltage`.
- Feed the `charging_active` boolean directly into the `ugv_safety_monitor` (Plan 1) to natively disable motion when wall-power is fed.