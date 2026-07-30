# ROS Driver for Robots - traced electrical connectivity (revision 1)

## Status

This is a **path trace**, not an OCR/connector inventory. I followed the drawn conductors, same-name net labels, passive components, semiconductor terminal orientation, and conditional switching elements in the supplied Altium-generated PDF. The machine-readable edge table contains **108 traced path edges**.

The trace separates:

1. **Copper equivalence** - terminals on the same physical net.
2. **Always-conductive elements** - resistors, shunts and inductors.
3. **Directional elements** - Schottky and MOSFET body-diode paths.
4. **Conditional elements** - regulators, MOSFET channels, buffers and H-bridges.

## Decisive corrections to the earlier extraction

- `R21` is between `DC_IN` and `VIN`. U6/INA219 senses **only the buck/5-V branch**, not the motor, bus-servo, or switched-IO branches.
- `DC_IN` fans out before the shunt to both TB6612s, H7/H8 servo power, and J1-J4 switched-load power.
- Type-C1 and Type-C2 VBUS enter the **post-M2 5-V rail** through D2 and D1 respectively. They are not merely isolated supplies for the USB bridges.
- The 5-V host-header terminals, H1 LIDAR power, both CH343P VBUS pins and the AMS1117 input share that post-M2 rail.
- H1 is one-way UART: pin 1 `CP_RX` goes through R4 to U3 RXD; U3 TXD is explicitly no-connect. Pin 3 is 5 V, pin 2 is GND, and pin 4 is unused in the drawing.
- J1 and J3 are parallel low-side-switched outputs controlled by IO4/Q4. J2 and J4 are a second parallel group controlled by IO5/Q5. Their pin 2 terminals are always on `DC_IN`; pin 1 is the switched return.
- TB1 and TB2 receive the same `S0..S5` control bus. They provide separate motor outputs, so paired outputs are commanded together.

## Complete supply topology

```text
BARREL H2.1
  -> M1 AO4407 input/reverse-polarity stage
  -> DC_IN
       +-> TB1 VM1/VM2/VM3
       +-> TB2 VM1/VM2/VM3
       +-> H7.2 and H8.2 bus-servo power
       +-> J1.2/J3.2 and J2.2/J4.2 switched-load positive supply
       `-> R21 0.01 ohm shunt
            -> VIN
            -> U5 MP8759 buck switch
            -> SW
            -> L2
            -> VOUT_5V_RAW / 5V_Vout
            -> M2 AO4407 isolation/ideal-diode stage
            -> 5V_MAIN / 5V / VDD5V

TYPE-C1 VBUS / VDDUSB  -> D2 -> 5V_MAIN
TYPE-C2 VBUS / VDDUSB1 -> D1 -> 5V_MAIN
HOST HEADER 5V terminals <------> 5V_MAIN

5V_MAIN
  +-> H1.3 LIDAR power
  +-> U3.9 and U7.9 CH343P VBUS
  +-> host-header 5-V terminals
  `-> AMS1117-3.3 -> 3V3_MAIN
                        `-> RT9193-1.8 -> 1V8
```

## What each source can power

| Source | Definitely reaches | Does not have a direct drawn path to |
|---|---|---|
| Barrel input | `DC_IN` loads and, through buck/M2, all 5-V and 3.3-V loads | USB connector VBUS pins are blocked by D1/D2 reverse polarity |
| Type-C1 VBUS | Post-M2 5-V rail and 3.3-V/1.8-V logic | `DC_IN` motor/servo/IO rail |
| Type-C2 VBUS | Post-M2 5-V rail and 3.3-V/1.8-V logic | `DC_IN` motor/servo/IO rail |
| Host-header 5 V | Post-M2 5-V rail and logic regulators | No direct copper path to `DC_IN` |

The only unresolved reverse-power question in that table is whether the **controlled M2 channel** can be driven on when an external 5-V source is present. Its intrinsic body diode blocks `5V_MAIN -> 5V_Vout`; the Q1/Q2 gate network must be resolved as a truth table before certifying reverse isolation under every startup sequence.

## Signal paths traced

### Board I2C

```text
ESP32 GPIO32 / IIC_SDA
  <-> INA219 SDA
  <-> P3.3
  <-> P4.3
  <-> U4 B3 -> level-shifter channel -> U4 A3 -> ICM-20948 SDA

ESP32 GPIO33 / IIC_SCL
  <-> INA219 SCL
  <-> P3.4
  <-> P4.4
  <-> U4 B4 -> level-shifter channel -> U4 A4 -> ICM-20948 SCL
```

### ESP32 programming UART

```text
Type-C1 D+/D- <-> U7 CH343P
U7 TXD -> R33 -> ESP U0RX
ESP U0TX -> R34 -> U7 RXD
Host P_TX -> same ESP U0RX node
ESP U0TX -> Host P_RX
U7 DTR/RTS -> VT1/VT2 cross-coupled auto-program circuit -> #EN and IO0
```

Because U7 TXD and host `P_TX` share the ESP receive node, simultaneous active drivers can contend.

### LIDAR USB receive

```text
H1.1 CP_RX -> R4 1k -> U3 RXD -> Type-C2 USB
H1.2 -> GND
H1.3 -> 5V_MAIN
H1.4 -> unused
U3 TXD -> explicit no-connect
```

### Half-duplex bus servo

```text
ESP IO19 / U1TXD -> U8 transmit buffer -> DATA -> H7.1 and H8.1
DATA -> U9 receive buffer -> ESP IO18 / U1RXD
Q3 + R47/R49 derive TXEN from U1TXD
R45 pulls DATA to 3.3 V
H7/H8 pin 2 -> DC_IN; pin 3 -> GND
```

`TXEN=1` enables U8 and disables U9; `TXEN=0` disables U8 and enables U9.

### Motor and encoder paths

Both TB6612s share the same logic bus:

| Signal | Function on both TB1 and TB2 | ESP source |
|---|---|---|
| S0 | PWMA | IO25 |
| S1 | AIN2 | IO17 |
| S2 | AIN1 | IO21 |
| S3 | BIN1 | IO22 |
| S4 | BIN2 | IO23 |
| S5 | PWMB | IO26 |

TB2 outputs go to H5/H3 (`MA1/MA2`, `MB1/MB2`) and include encoder power/returns. TB1 outputs go to H6/H4 (`MA1'/MA2'`, `MB1'/MB2'`).

Encoder paths:

- H5.4 `A_C1` -> R39 -> ESP IO34
- H5.3 `A_C2` -> R40 -> ESP IO35
- H3.4 `B_C1` -> R36 -> ESP IO27
- H3.3 `B_C2` -> R37 -> ESP IO16

### Low-side switched IO

```text
J1.2 and J3.2 -> DC_IN
J1.1 and J3.1 -> Q4 drain; Q4 source -> GND
ESP IO4 -> R54 -> Q4 gate; R56 pulls gate down

J2.2 and J4.2 -> DC_IN
J2.1 and J4.1 -> Q5 drain; Q5 source -> GND
ESP IO5 -> R55 -> Q5 gate; R57 pulls gate down
```

## Remaining items being treated as unresolved rather than guessed

1. The Q1/Q2/M2 operating truth table and reverse-power behavior during all source combinations.
2. Exact P1/P2 40-pin numbering for every pass-through and grounded pin; the mirrored graphical symbols make this a separate geometry-verification task.
3. U4 channels A1/A2 and the `EXT_ICM_INT` / `EXT_ICM_FSYNC` endpoints: the drawn stubs must be checked for intentional no-connect versus omitted labels.
4. Connector-symbol terminals marked `0`: these appear to be shell/mounting-symbol artifacts on several connectors and must not be promoted to physical harness pins without the footprint/library source.
5. Q4/Q5 exact MOSFET part numbers and current/thermal capability; the drawing states 3 A maximum but omits the part number.

## Files

- `ros_driver_path_edges.csv`: one row per traced conductive or conditional edge.
- `ros_driver_traced_graph.json`: the same graph with direction, condition, confidence and notes.
- `ros_driver_source_load_matrix.csv`: source-to-load reachability summary.
