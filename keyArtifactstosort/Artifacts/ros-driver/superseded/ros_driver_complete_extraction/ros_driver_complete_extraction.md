# Waveshare ROS Driver for Robots - complete logical extraction
**Primary interchange form:** EDIF 2 0 0 logical netlist.  This document is the human-readable rendering of the same component/pin/net model.
## Extraction boundary
- Captures every reference designator and value visible on the one-page PDF, connector pin assignments, named rails/signals, passive networks, IC pin connections, functional blocks, and engineering notes.
- Does not invent PCB coordinates, footprints, board revision, mating-view orientation, wire gauge/color/length, or omitted part numbers.
- `NC` means explicitly unconnected/not used in the source drawing. Private `HEADER_PASS_n` nets are the unlabeled P1-to-P2 pass-through conductors.
## Inventory summary

- Components/reference objects: **153**
- Logical nets (including private pass-through nets): **130**
- Connectors: **18**

## Functional blocks and components

### 10DOF / I2C

| Ref | Value / part | Type |
|---|---|---|
| `C1` | 1uF | capacitor |
| `C2` | 100nF | capacitor |
| `C3` | 10uF | capacitor |
| `C4` | 1uF | capacitor |
| `C5` | 1uF | capacitor |
| `C6` | 0.1uF | capacitor |
| `C7` | 22nF | capacitor |
| `C11` | 100nF | capacitor |
| `C12` | 100nF | capacitor |
| `C14` | 100nF | capacitor |
| `R1` | 10k | resistor |
| `R2` | 10k | resistor |
| `R3` | 10k | resistor |
| `R5` | 4.7k | resistor |
| `R6` | 4.7k | resistor |
| `R7` | 4.7k | resistor |
| `R8` | 4.7k | resistor |
| `R9` | 10k | resistor |
| `U1` | ICM-20948 | IMU |
| `U2` | RT9193-1.8GB | LDO |
| `U4` | LSF0204PWR | level translator |
| `P3` | PH2.0 4P vertical | connector |
| `P4` | PH2.0 4P vertical | connector |

### PWR-IN / 5V-5A

| Ref | Value / part | Type |
|---|---|---|
| `C15` | 220nF | capacitor |
| `C16` | NC/220pF | capacitor |
| `C17` | 22uF | capacitor |
| `C18` | 22uF | capacitor |
| `C19` | 100nF | capacitor |
| `C20` | 100uF/10V | capacitor |
| `C21` | 100nF | capacitor |
| `C22` | 22uF | capacitor |
| `C23` | 22uF | capacitor |
| `C24` | 22uF | capacitor |
| `C25` | 22uF | capacitor |
| `C26` | 100nF | capacitor |
| `C27` | 10uF | capacitor |
| `C28` | 100nF | capacitor |
| `C29` | 1uF | capacitor |
| `C30` | 100nF (104) | capacitor |
| `R10` | 3.3R | resistor |
| `R12` | NC/499k | resistor |
| `R13` | 1.5M | resistor |
| `R14` | 75k 1% | resistor |
| `R15` | 2k | resistor |
| `R16` | NC/499R | resistor |
| `R17` | 10k 1% | resistor |
| `R18` | 100k | resistor |
| `R19` | 470k | resistor |
| `R20` | NS | resistor |
| `R21` | 0.01R 1%, 2512, 2W alloy | resistor |
| `R22` | 100k | resistor |
| `R25` | NS | resistor |
| `R26` | NS | resistor |
| `L2` | 1.5uH, 7x7x5 | inductor |
| `H2` | 5.5x2.1 DC005 barrel jack | connector |
| `M1` | AO4407 P-MOS | MOSFET |
| `M2` | AO4407 P-MOS | MOSFET |
| `Q1` | MMBT3906 | PNP transistor |
| `Q2` | MMBT3906 | PNP transistor |
| `U5` | MP8759GD | buck regulator |
| `U6` | INA219BIDR (SOP-8), address 0x42 | current monitor |

### LIDAR USB-UART

| Ref | Value / part | Type |
|---|---|---|
| `C8` | 1uF | capacitor |
| `C9` | 1uF | capacitor |
| `C10` | 100nF (104) | capacitor |
| `C13` | 100nF (104) | capacitor |
| `R4` | 1k | resistor |
| `U3` | CH343P | USB-UART bridge |
| `H1` | PH2.0 4P vertical | connector |

### USB Type-C

| Ref | Value / part | Type |
|---|---|---|
| `C31` | 10uF | capacitor |
| `C32` | 10uF | capacitor |
| `R23` | 5.1k | resistor |
| `R24` | 5.1k | resistor |
| `R27` | 5.1k | resistor |
| `R28` | 5.1k | resistor |
| `Type_C1` | USB Type-C receptacle, 16P SMT | connector |
| `Type_C2` | USB Type-C receptacle, 16P SMT | connector |

### Main 3.3V Power

| Ref | Value / part | Type |
|---|---|---|
| `PWR1` | 10uF | capacitor |
| `PWR2` | 100nF (104) | capacitor |
| `PWR3` | 10uF | capacitor |
| `PWR4` | 100nF (104) | capacitor |
| `D1` | MBR230LSFT1G (marking L3N) | Schottky diode |
| `D2` | MBR230LSFT1G (marking L3N) | Schottky diode |
| `AMS-1` | AMS1117-3.3 | LDO |
| `LED1` | Red LED, 0402 | LED |
| `R11` | 2.2k | resistor |
| `TVS1` | LTVS16H5.0ET5G | TVS diode |

### ESP32 / USB-UART

| Ref | Value / part | Type |
|---|---|---|
| `C33` | 100nF (104) | capacitor |
| `C34` | NC/100nF (NC/104) | capacitor |
| `C35` | 1uF | capacitor |
| `C36` | 1uF | capacitor |
| `C37` | 100nF (104) | capacitor |
| `C38` | 100nF (104) | capacitor |
| `R29` | 10k | resistor |
| `R30` | 10k | resistor |
| `R31` | NC/10k | resistor |
| `R32` | 10k | resistor |
| `R33` | 22R/1k option | resistor |
| `R34` | 22R/1k option | resistor |
| `R35` | 12k | resistor |
| `R38` | 12k | resistor |
| `U7` | CH343P | USB-UART bridge |
| `M3` | ESP32-WROOM-32UE | MCU module |
| `VT1` | S8050 | NPN transistor |
| `VT2` | S8050 | NPN transistor |
| `S1` | 2-pin SMD pushbutton, 3x4x2 | switch |
| `S2` | 2-pin SMD pushbutton, 3x4x2 | switch |

### Bus Servo

| Ref | Value / part | Type |
|---|---|---|
| `C40` | 330uF/6.3V | capacitor |
| `C41` | 100nF (104) | capacitor |
| `C42` | 100nF (104) | capacitor |
| `C43` | 100nF (104) | capacitor |
| `C44` | 1uF | capacitor |
| `R45` | 10k | resistor |
| `R46` | 10k | resistor |
| `R47` | 10k | resistor |
| `R48` | 10k | resistor |
| `R49` | 20k | resistor |
| `Q3` | MMBT3906 | PNP transistor |
| `U8` | SN74LVC1G126DBV | tri-state buffer |
| `U9` | SN74LVC1G125DBV | tri-state buffer |
| `D3` | B5819WS | Schottky diode |
| `D4` | B5819WS | Schottky diode |
| `D8` | NC/LM3Z3V6T1G, 3.6V | zener/TVS |
| `H7` | 3-pin 2.5mm 5264-3A | connector |
| `H8` | 3-pin 2.5mm 5264-3A | connector |

### IO Control

| Ref | Value / part | Type |
|---|---|---|
| `R54` | 10R | resistor |
| `R55` | 10R | resistor |
| `R56` | 10k | resistor |
| `R57` | 10k | resistor |
| `Q4` | N-channel MOSFET, part not shown | MOSFET |
| `Q5` | N-channel MOSFET, part not shown | MOSFET |
| `J1` | 2-pin connector + shell pin 0 | connector |
| `J2` | 2-pin connector + shell pin 0 | connector |
| `J3` | 2-pin connector + shell pin 0 | connector |
| `J4` | 2-pin connector + shell pin 0 | connector |

### Host Headers

| Ref | Value / part | Type |
|---|---|---|
| `P1` | 40-pin header | connector |
| `P2` | 40-pin header | connector |

### Motor Drivers

| Ref | Value / part | Type |
|---|---|---|
| `C45` | 10uF/50V | capacitor |
| `C47` | 10uF/50V | capacitor |
| `C48` | 100nF (104) | capacitor |
| `C49` | 100nF (104) | capacitor |
| `C50` | 100nF (104) | capacitor |
| `C51` | 100nF (104) | capacitor |
| `TB1` | TB6612FNG | dual H-bridge |
| `TB2` | TB6612FNG | dual H-bridge |
| `H3` | PH2.0 6P vertical | connector |
| `H4` | PH2.0 6P vertical | connector |
| `H5` | PH2.0 6P vertical | connector |
| `H6` | PH2.0 6P vertical | connector |
| `R36` | 10R | resistor |
| `R37` | 10R | resistor |
| `R39` | 10R | resistor |
| `R40` | 10R | resistor |

### Document

| Ref | Value / part | Type |
|---|---|---|
| `logo1` | Waveshare logo / title graphic | graphic |

## Connector pinout tables

### P3 - PH2.0 4P vertical

| Pin | Net |
|---:|---|
| `0` | `GND` |
| `1` | `3V3` |
| `2` | `GND` |
| `3` | `IIC_SDA` |
| `4` | `IIC_SCL` |

### P4 - PH2.0 4P vertical

| Pin | Net |
|---:|---|
| `0` | `GND` |
| `1` | `3V3` |
| `2` | `GND` |
| `3` | `IIC_SDA` |
| `4` | `IIC_SCL` |

### H2 - 5.5x2.1 DC005 barrel jack

| Pin | Net |
|---:|---|
| `0` | `GND` |
| `1` | `VDD_DC_JACK` |
| `2` | `GND` |

### H1 - PH2.0 4P vertical

| Pin | Net |
|---:|---|
| `0` | `GND` |
| `1` | `CP_RX` |
| `2` | `NC` |
| `3` | `GND` |
| `4` | `5V` |

### Type_C1 - USB Type-C receptacle, 16P SMT

| Pin | Net |
|---:|---|
| `A1/B12` | `GND` |
| `A12/B1` | `GND` |
| `A4/B9` | `VDDUSB` |
| `A5` | `IP0` |
| `A6` | `USBD_P` |
| `A7` | `USBD_N` |
| `A8` | `NC` |
| `A9/B4` | `VDDUSB` |
| `B5` | `IP1` |
| `B6` | `USBD_P` |
| `B7` | `USBD_N` |
| `B8` | `NC` |
| `MTB` | `GND` |

### Type_C2 - USB Type-C receptacle, 16P SMT

| Pin | Net |
|---:|---|
| `A1/B12` | `GND` |
| `A12/B1` | `GND` |
| `A4/B9` | `VDDUSB1` |
| `A5` | `CC1` |
| `A6` | `D_P` |
| `A7` | `D_N` |
| `A8` | `NC` |
| `A9/B4` | `VDDUSB1` |
| `B5` | `CC2` |
| `B6` | `D_P` |
| `B7` | `D_N` |
| `B8` | `NC` |
| `MTB` | `GND` |

### H7 - 3-pin 2.5mm 5264-3A

| Pin | Net |
|---:|---|
| `1` | `DATA` |
| `2` | `DC_IN` |
| `3` | `GND` |

### H8 - 3-pin 2.5mm 5264-3A

| Pin | Net |
|---:|---|
| `1` | `DATA` |
| `2` | `DC_IN` |
| `3` | `GND` |

### J1 - 2-pin connector + shell pin 0

| Pin | Net |
|---:|---|
| `0` | `GND` |
| `1` | `IO4_SWITCHED` |
| `2` | `DC_IN` |

### J2 - 2-pin connector + shell pin 0

| Pin | Net |
|---:|---|
| `0` | `GND` |
| `1` | `IO5_SWITCHED` |
| `2` | `DC_IN` |

### J3 - 2-pin connector + shell pin 0

| Pin | Net |
|---:|---|
| `0` | `GND` |
| `1` | `IO4_SWITCHED` |
| `2` | `DC_IN` |

### J4 - 2-pin connector + shell pin 0

| Pin | Net |
|---:|---|
| `0` | `GND` |
| `1` | `IO5_SWITCHED` |
| `2` | `DC_IN` |

### P1 - 40-pin header

| Pin | Net |
|---:|---|
| `1` | `5V` |
| `2` | `HEADER_PASS_2` |
| `3` | `5V` |
| `4` | `IIC_SDA` |
| `5` | `GND` |
| `6` | `IIC_SCL` |
| `7` | `U0RX` |
| `8` | `HEADER_PASS_8` |
| `9` | `U0TX` |
| `10` | `GND` |
| `11` | `HEADER_PASS_11` |
| `12` | `HEADER_PASS_12` |
| `13` | `HEADER_PASS_13` |
| `14` | `HEADER_PASS_14` |
| `15` | `HEADER_PASS_15` |
| `16` | `HEADER_PASS_16` |
| `17` | `HEADER_PASS_17` |
| `18` | `HEADER_PASS_18` |
| `19` | `GND` |
| `20` | `HEADER_PASS_20` |
| `21` | `HEADER_PASS_21` |
| `22` | `HEADER_PASS_22` |
| `23` | `HEADER_PASS_23` |
| `24` | `HEADER_PASS_24` |
| `25` | `HEADER_PASS_25` |
| `26` | `GND` |
| `27` | `HEADER_PASS_27` |
| `28` | `HEADER_PASS_28` |
| `29` | `GND` |
| `30` | `HEADER_PASS_30` |
| `31` | `HEADER_PASS_31` |
| `32` | `HEADER_PASS_32` |
| `33` | `GND` |
| `34` | `HEADER_PASS_34` |
| `35` | `HEADER_PASS_35` |
| `36` | `HEADER_PASS_36` |
| `37` | `HEADER_PASS_37` |
| `38` | `HEADER_PASS_38` |
| `39` | `GND` |
| `40` | `GND` |

### P2 - 40-pin header

| Pin | Net |
|---:|---|
| `1` | `5V` |
| `2` | `HEADER_PASS_2` |
| `3` | `5V` |
| `4` | `IIC_SDA` |
| `5` | `GND` |
| `6` | `IIC_SCL` |
| `7` | `U0RX` |
| `8` | `HEADER_PASS_8` |
| `9` | `U0TX` |
| `10` | `GND` |
| `11` | `HEADER_PASS_11` |
| `12` | `HEADER_PASS_12` |
| `13` | `HEADER_PASS_13` |
| `14` | `HEADER_PASS_14` |
| `15` | `HEADER_PASS_15` |
| `16` | `HEADER_PASS_16` |
| `17` | `HEADER_PASS_17` |
| `18` | `HEADER_PASS_18` |
| `19` | `GND` |
| `20` | `HEADER_PASS_20` |
| `21` | `HEADER_PASS_21` |
| `22` | `HEADER_PASS_22` |
| `23` | `HEADER_PASS_23` |
| `24` | `HEADER_PASS_24` |
| `25` | `HEADER_PASS_25` |
| `26` | `GND` |
| `27` | `HEADER_PASS_27` |
| `28` | `HEADER_PASS_28` |
| `29` | `GND` |
| `30` | `HEADER_PASS_30` |
| `31` | `HEADER_PASS_31` |
| `32` | `HEADER_PASS_32` |
| `33` | `GND` |
| `34` | `HEADER_PASS_34` |
| `35` | `HEADER_PASS_35` |
| `36` | `HEADER_PASS_36` |
| `37` | `HEADER_PASS_37` |
| `38` | `HEADER_PASS_38` |
| `39` | `GND` |
| `40` | `GND` |

### H3 - PH2.0 6P vertical

| Pin | Net |
|---:|---|
| `0` | `GND` |
| `1` | `MB2` |
| `2` | `GND` |
| `3` | `B_C2_CONN` |
| `4` | `B_C1_CONN` |
| `5` | `3V3` |
| `6` | `MB1` |

### H4 - PH2.0 6P vertical

| Pin | Net |
|---:|---|
| `0` | `GND` |
| `1` | `MB2_PRIME` |
| `2` | `NC` |
| `3` | `NC` |
| `4` | `NC` |
| `5` | `NC` |
| `6` | `MB1_PRIME` |

### H5 - PH2.0 6P vertical

| Pin | Net |
|---:|---|
| `0` | `GND` |
| `1` | `MA2` |
| `2` | `GND` |
| `3` | `A_C2_CONN` |
| `4` | `A_C1_CONN` |
| `5` | `3V3` |
| `6` | `MA1` |

### H6 - PH2.0 6P vertical

| Pin | Net |
|---:|---|
| `0` | `GND` |
| `1` | `MA2_PRIME` |
| `2` | `NC` |
| `3` | `NC` |
| `4` | `NC` |
| `5` | `NC` |
| `6` | `MA1_PRIME` |

## Net-by-net connectivity

### `GND` - Main ground and connector shells

`U2.2`, `C3.2`, `C4.2`, `C5.2`, `C6.2`, `C7.2`, `U1.18`, `C1.2`, `C2.2`, `R1.2`, `C11.2`, `R2.2`, `R3.2`, `U4.7`, `C12.2`, `C14.2`, `P3.0`, `P3.2`, `P4.0`, `P4.2`, `H2.0`, `H2.2`, `R15.2`, `U6.1`, `U6.2`, `U6.6`, `C30.2`, `C17.2`, `C18.2`, `C19.2`, `U5.2`, `R17.2`, `C21.2`, `C22.2`, `C23.2`, `C24.2`, `C25.2`, `C26.2`, `C27.2`, `C20.2`, `C28.2`, `R18.2`, `R19.2`, `U3.0`, `U3.2`, `C8.2`, `C9.2`, `C10.2`, `C13.2`, `H1.0`, `H1.3`, `Type_C1.A1/B12`, `Type_C1.A12/B1`, `Type_C1.MTB`, `Type_C2.A1/B12`, `Type_C2.A12/B1`, `Type_C2.MTB`, `R23.1`, `R24.1`, `R27.1`, `R28.1`, `C31.2`, `C32.2`, `PWR1.2`, `PWR2.2`, `AMS-1.1`, `PWR3.2`, `PWR4.2`, `TVS1.2`, `LED1.K`, `U7.0`, `U7.2`, `C35.2`, `C36.2`, `C37.2`, `C38.2`, `M3.1`, `M3.15`, `M3.38`, `M3.39`, `C33.2`, `C34.2`, `S1.1`, `S2.1`, `R49.2`, `U8.3`, `U9.3`, `C42.2`, `C43.2`, `C44.2`, `C40.2`, `C41.2`, `D3.A`, `D8.A`, `H7.3`, `H8.3`, `D4.A`, `R56.2`, `Q4.S`, `J1.0`, `J3.0`, `R57.2`, `Q5.S`, `J2.0`, `J4.0`, `P1.5`, `P2.5`, `P1.10`, `P2.10`, `P1.19`, `P2.19`, `P1.26`, `P2.26`, `P1.29`, `P2.29`, `P1.33`, `P2.33`, `P1.39`, `P2.39`, `P1.40`, `P2.40`, `TB1.3`, `TB1.4`, `TB1.9`, `TB1.10`, `TB1.18`, `TB2.3`, `TB2.4`, `TB2.9`, `TB2.10`, `TB2.18`, `C47.2`, `C49.2`, `C51.2`, `H5.0`, `H5.2`, `H3.0`, `H3.2`, `C45.2`, `C48.2`, `C50.2`, `H6.0`, `H4.0`

### `AGND` - Buck regulator analog ground; drawn separately from GND

`R20.2`, `U5.10`, `C29.2`, `R26.2`

### `3V3` (aliases: VDD3V3, 3V3_OP, 3V3OUT) - 3.3 V logic rail; all four labels are shown as one connected node

`U2.1`, `U2.3`, `C3.1`, `C4.1`, `U4.14`, `R7.1`, `R8.1`, `C12.1`, `P3.1`, `P4.1`, `U6.5`, `C30.1`, `U3.1`, `U3.3`, `U3.6`, `C8.1`, `C9.1`, `C13.1`, `AMS-1.2`, `PWR3.1`, `PWR4.1`, `TVS1.1`, `R11.2`, `U7.1`, `U7.3`, `U7.6`, `C35.1`, `C36.1`, `C38.1`, `R31.1`, `R32.1`, `M3.2`, `R29.1`, `R30.1`, `R46.1`, `R48.1`, `Q3.E`, `U8.5`, `U9.5`, `R45.1`, `C42.1`, `C43.1`, `C44.1`, `C40.1`, `C41.1`, `D3.K`, `D8.K`, `TB1.19`, `TB1.20`, `TB2.19`, `TB2.20`, `C51.1`, `H5.5`, `H3.5`, `C50.1`

### `1V8` - 1.8 V IMU rail

`U2.5`, `C5.1`, `C6.1`, `U1.8`, `U1.13`, `C1.1`, `C2.1`, `R1.1`, `U4.1`, `R5.1`, `R6.1`, `R9.2`, `C14.1`

### `5V` (aliases: VDD5V) - Protected/switched 5 V system rail

`M2.1`, `M2.2`, `M2.3`, `Q2.E`, `C27.1`, `C20.1`, `U3.9`, `C10.1`, `H1.4`, `D1.K`, `D2.K`, `PWR1.1`, `PWR2.1`, `AMS-1.3`, `U7.9`, `C37.1`, `P1.1`, `P1.3`, `P2.1`, `P2.3`

### `5V_VOUT` (aliases: Vout, 5V_Vout) - Raw buck-converter 5 V output before M2

`L2.2`, `C16.2`, `R14.1`, `C21.1`, `C22.1`, `C23.1`, `C24.1`, `C25.1`, `C26.1`, `C28.1`, `U5.5`, `M2.5`, `M2.6`, `M2.7`, `M2.8`, `Q1.E`

### `DC_IN` - 6-12 V protected input rail feeding motors and auxiliary loads

`M1.1`, `M1.2`, `M1.3`, `U6.8`, `R21.1`, `H7.2`, `H8.2`, `D4.K`, `J1.2`, `J3.2`, `J2.2`, `J4.2`, `TB1.13`, `TB1.14`, `TB1.24`, `TB2.13`, `TB2.14`, `TB2.24`, `C47.1`, `C49.1`, `C45.1`, `C48.1`

### `VIN` - Buck input after INA219 shunt R21

`R21.2`, `U6.7`, `C17.1`, `C18.1`, `C19.1`, `R13.1`, `U5.1`

### `VDD_DC_JACK` - Barrel-jack positive before M1

`H2.1`, `M1.5`, `M1.6`, `M1.7`, `M1.8`

### `VDDUSB` - Type_C1 VBUS

`Type_C1.A4/B9`, `Type_C1.A9/B4`, `C31.1`, `D2.A`

### `VDDUSB1` - Type_C2 VBUS

`Type_C2.A4/B9`, `Type_C2.A9/B4`, `C32.1`, `D1.A`

### `IIC_SDA` (aliases: ICM_SDA, IO32)

`U4.11`, `P3.3`, `P4.3`, `M3.8`, `P1.4`, `P2.4`, `U6.3`

### `IIC_SCL` (aliases: ICM_SCL, IO33)

`U4.10`, `P3.4`, `P4.4`, `M3.9`, `P1.6`, `P2.6`, `U6.4`

### `A_C1` (aliases: IO34)

`M3.6`, `R39.2`

### `A_C2` (aliases: IO35)

`M3.7`, `R40.2`

### `B_C1` (aliases: IO27)

`M3.12`, `R36.2`

### `B_C2` (aliases: IO16)

`M3.27`, `R37.2`

### `S0` (aliases: IO25)

`M3.10`, `TB1.23`, `TB2.23`

### `S1` (aliases: IO17)

`M3.28`, `TB1.22`, `TB2.22`

### `S2` (aliases: IO21)

`M3.33`, `TB1.21`, `TB2.21`

### `S3` (aliases: IO22)

`M3.36`, `TB1.17`, `TB2.17`

### `S4` (aliases: IO23)

`M3.37`, `TB1.16`, `TB2.16`

### `S5` (aliases: IO26)

`M3.11`, `TB1.15`, `TB2.15`

### `SPI_CK` (aliases: IO14)

`M3.13`

### `SPI_SO` (aliases: IO12)

`M3.14`

### `SPI_MO` (aliases: IO13)

`M3.16`

### `SD_CS` (aliases: IO15)

`M3.23`

### `U1RXD` (aliases: IO18)

`M3.30`, `R48.2`, `U9.4`

### `U1TXD` (aliases: IO19)

`M3.31`, `R46.2`, `R47.2`, `U8.2`

### `U0RX` (aliases: P_TX)

`R33.1`, `R32.2`, `M3.34`, `P1.7`, `P2.7`

### `U0TX` (aliases: P_RX)

`R34.1`, `R31.2`, `M3.35`, `P1.9`, `P2.9`

### `IMU_BP`

`U2.4`, `C7.1`

### `I2C_SCL_ICM`

`U1.23`, `U4.5`, `R6.2`

### `I2C_SDA_ICM`

`U1.24`, `U4.4`, `R5.2`

### `ICM_INT`

`U1.12`

### `ICM_FSYNC`

`U1.11`, `R2.1`

### `ICM_AD0`

`U1.9`, `R3.1`

### `ICM_REGOUT`

`U1.10`, `C11.1`

### `EXT_ICM_FSYNC`

`U4.13`, `R7.2`

### `EXT_ICM_INT`

`U4.12`, `R8.2`

### `IMU_LEVEL_OE`

`U4.8`, `R9.1`

### `M1_GATE`

`M1.4`, `R15.1`

### `EN`

`R13.2`, `R20.1`, `U5.12`

### `MODE`

`U5.6`, `R25.2`, `R26.1`

### `VCC_1`

`U5.9`, `C29.1`, `R22.2`, `R25.1`

### `PG`

`U5.3`, `R22.1`

### `BST`

`U5.8`, `R10.1`

### `BOOT_RC`

`R10.2`, `C15.1`

### `SW`

`U5.7`, `C15.2`, `L2.1`, `R12.1`

### `RC_COMP`

`R12.2`, `C16.1`, `R16.1`

### `FB`

`R14.2`, `R16.2`, `R17.1`, `U5.11`

### `Q1_BASE`

`Q1.B`, `R18.1`

### `M2_GATE`

`M2.4`, `Q1.C`, `Q2.C`

### `Q2_BASE`

`Q2.B`, `R19.1`

### `CP_RX`

`H1.1`, `R4.1`

### `LIDAR_RXD`

`R4.2`, `U3.5`

### `DTR_1`

`U3.12`

### `D_P`

`U3.7`, `Type_C2.A6`, `Type_C2.B6`

### `D_N`

`U3.8`, `Type_C2.A7`, `Type_C2.B7`

### `IP0`

`Type_C1.A5`, `R27.2`

### `IP1`

`Type_C1.B5`, `R23.2`

### `USBD_P`

`Type_C1.A6`, `Type_C1.B6`, `U7.7`

### `USBD_N`

`Type_C1.A7`, `Type_C1.B7`, `U7.8`

### `CC1`

`Type_C2.A5`, `R28.2`

### `CC2`

`Type_C2.B5`, `R24.2`

### `LED_A`

`LED1.A`, `R11.1`

### `TXD`

`U7.4`, `R33.2`

### `RXD`

`U7.5`, `R34.2`

### `DTR`

`U7.12`, `R35.2`, `VT2.E`

### `RTS`

`U7.13`, `R38.2`, `VT1.E`

### `#EN`

`M3.3`, `R29.2`, `C33.1`, `S2.2`, `VT1.C`

### `SVP`

`M3.4`

### `SVN`

`M3.5`

### `SD2`

`M3.17`

### `SD3`

`M3.18`

### `CMD`

`M3.19`

### `CLK`

`M3.20`

### `SD0`

`M3.21`

### `SD1`

`M3.22`

### `IO2`

`M3.24`

### `IO0`

`M3.25`, `R30.2`, `C34.1`, `S1.2`, `VT2.C`

### `IO4`

`M3.26`, `R54.1`

### `IO5`

`M3.29`, `R55.1`

### `AUTO_VT1_BASE`

`R35.1`, `VT1.B`

### `AUTO_VT2_BASE`

`R38.1`, `VT2.B`

### `Q3_BASE`

`R47.1`, `Q3.B`

### `TXEN`

`Q3.C`, `R49.1`, `U8.1`, `U9.1`

### `DATA`

`U8.4`, `U9.2`, `R45.2`, `H7.1`, `H8.1`

### `IO4_GATE`

`R54.2`, `R56.1`, `Q4.G`

### `IO4_SWITCHED`

`Q4.D`, `J1.1`, `J3.1`

### `IO5_GATE`

`R55.2`, `R57.1`, `Q5.G`

### `IO5_SWITCHED`

`Q5.D`, `J2.1`, `J4.1`

### `HEADER_PASS_2`

`P1.2`, `P2.2`

### `HEADER_PASS_8`

`P1.8`, `P2.8`

### `HEADER_PASS_11`

`P1.11`, `P2.11`

### `HEADER_PASS_12`

`P1.12`, `P2.12`

### `HEADER_PASS_13`

`P1.13`, `P2.13`

### `HEADER_PASS_14`

`P1.14`, `P2.14`

### `HEADER_PASS_15`

`P1.15`, `P2.15`

### `HEADER_PASS_16`

`P1.16`, `P2.16`

### `HEADER_PASS_17`

`P1.17`, `P2.17`

### `HEADER_PASS_18`

`P1.18`, `P2.18`

### `HEADER_PASS_20`

`P1.20`, `P2.20`

### `HEADER_PASS_21`

`P1.21`, `P2.21`

### `HEADER_PASS_22`

`P1.22`, `P2.22`

### `HEADER_PASS_23`

`P1.23`, `P2.23`

### `HEADER_PASS_24`

`P1.24`, `P2.24`

### `HEADER_PASS_25`

`P1.25`, `P2.25`

### `HEADER_PASS_27`

`P1.27`, `P2.27`

### `HEADER_PASS_28`

`P1.28`, `P2.28`

### `HEADER_PASS_30`

`P1.30`, `P2.30`

### `HEADER_PASS_31`

`P1.31`, `P2.31`

### `HEADER_PASS_32`

`P1.32`, `P2.32`

### `HEADER_PASS_34`

`P1.34`, `P2.34`

### `HEADER_PASS_35`

`P1.35`, `P2.35`

### `HEADER_PASS_36`

`P1.36`, `P2.36`

### `HEADER_PASS_37`

`P1.37`, `P2.37`

### `HEADER_PASS_38`

`P1.38`, `P2.38`

### `MA1`

`TB2.1`, `TB2.2`, `H5.6`

### `MA2`

`TB2.5`, `TB2.6`, `H5.1`

### `MB1`

`TB2.7`, `TB2.8`, `H3.6`

### `MB2`

`TB2.11`, `TB2.12`, `H3.1`

### `A_C1_CONN`

`H5.4`, `R39.1`

### `A_C2_CONN`

`H5.3`, `R40.1`

### `B_C1_CONN`

`H3.4`, `R36.1`

### `B_C2_CONN`

`H3.3`, `R37.1`

### `MA1_PRIME`

`TB1.1`, `TB1.2`, `H6.6`

### `MA2_PRIME`

`TB1.5`, `TB1.6`, `H6.1`

### `MB1_PRIME`

`TB1.7`, `TB1.8`, `H4.6`

### `MB2_PRIME`

`TB1.11`, `TB1.12`, `H4.1`

## IC and module pin assignments

### U1 - ICM-20948

| Pin | Net |
|---:|---|
| `1` | `NC` |
| `2` | `NC` |
| `3` | `NC` |
| `4` | `NC` |
| `5` | `NC` |
| `6` | `NC` |
| `7` | `NC` |
| `8` | `1V8` |
| `9` | `ICM_AD0` |
| `10` | `ICM_REGOUT` |
| `11` | `ICM_FSYNC` |
| `12` | `ICM_INT` |
| `13` | `1V8` |
| `14` | `NC` |
| `15` | `NC` |
| `16` | `NC` |
| `17` | `NC` |
| `18` | `GND` |
| `19` | `NC` |
| `20` | `NC` |
| `21` | `NC` |
| `22` | `NC` |
| `23` | `I2C_SCL_ICM` |
| `24` | `I2C_SDA_ICM` |

### U2 - RT9193-1.8GB

| Pin | Net |
|---:|---|
| `1` | `3V3` |
| `2` | `GND` |
| `3` | `3V3` |
| `4` | `IMU_BP` |
| `5` | `1V8` |

### U3 - CH343P

| Pin | Net |
|---:|---|
| `0` | `GND` |
| `1` | `3V3` |
| `2` | `GND` |
| `3` | `3V3` |
| `4` | `NC` |
| `5` | `LIDAR_RXD` |
| `6` | `3V3` |
| `7` | `D_P` |
| `8` | `D_N` |
| `9` | `5V` |
| `10` | `NC` |
| `11` | `NC` |
| `12` | `DTR_1` |
| `13` | `NC` |
| `14` | `NC` |
| `15` | `NC` |
| `16` | `NC` |

### U4 - LSF0204PWR

| Pin | Net |
|---:|---|
| `1` | `1V8` |
| `2` | `NC` |
| `3` | `NC` |
| `4` | `I2C_SDA_ICM` |
| `5` | `I2C_SCL_ICM` |
| `6` | `NC` |
| `7` | `GND` |
| `8` | `IMU_LEVEL_OE` |
| `9` | `NC` |
| `10` | `IIC_SCL` |
| `11` | `IIC_SDA` |
| `12` | `EXT_ICM_INT` |
| `13` | `EXT_ICM_FSYNC` |
| `14` | `3V3` |

### U5 - MP8759GD

| Pin | Net |
|---:|---|
| `1` | `VIN` |
| `2` | `GND` |
| `3` | `PG` |
| `4` | `NC` |
| `5` | `5V_VOUT` |
| `6` | `MODE` |
| `7` | `SW` |
| `8` | `BST` |
| `9` | `VCC_1` |
| `10` | `AGND` |
| `11` | `FB` |
| `12` | `EN` |

### U6 - INA219BIDR (SOP-8), address 0x42

| Pin | Net |
|---:|---|
| `1` | `GND` |
| `2` | `GND` |
| `3` | `IIC_SDA` |
| `4` | `IIC_SCL` |
| `5` | `3V3` |
| `6` | `GND` |
| `7` | `VIN` |
| `8` | `DC_IN` |

### U7 - CH343P

| Pin | Net |
|---:|---|
| `0` | `GND` |
| `1` | `3V3` |
| `2` | `GND` |
| `3` | `3V3` |
| `4` | `TXD` |
| `5` | `RXD` |
| `6` | `3V3` |
| `7` | `USBD_P` |
| `8` | `USBD_N` |
| `9` | `5V` |
| `10` | `NC` |
| `11` | `NC` |
| `12` | `DTR` |
| `13` | `RTS` |
| `14` | `NC` |
| `15` | `NC` |
| `16` | `NC` |

### U8 - SN74LVC1G126DBV

| Pin | Net |
|---:|---|
| `1` | `TXEN` |
| `2` | `U1TXD` |
| `3` | `GND` |
| `4` | `DATA` |
| `5` | `3V3` |

### U9 - SN74LVC1G125DBV

| Pin | Net |
|---:|---|
| `1` | `TXEN` |
| `2` | `DATA` |
| `3` | `GND` |
| `4` | `U1RXD` |
| `5` | `3V3` |

### M3 - ESP32-WROOM-32UE

| Pin | Net |
|---:|---|
| `1` | `GND` |
| `2` | `3V3` |
| `3` | `#EN` |
| `4` | `SVP` |
| `5` | `SVN` |
| `6` | `A_C1` |
| `7` | `A_C2` |
| `8` | `IIC_SDA` |
| `9` | `IIC_SCL` |
| `10` | `S0` |
| `11` | `S5` |
| `12` | `B_C1` |
| `13` | `SPI_CK` |
| `14` | `SPI_SO` |
| `15` | `GND` |
| `16` | `SPI_MO` |
| `17` | `SD2` |
| `18` | `SD3` |
| `19` | `CMD` |
| `20` | `CLK` |
| `21` | `SD0` |
| `22` | `SD1` |
| `23` | `SD_CS` |
| `24` | `IO2` |
| `25` | `IO0` |
| `26` | `IO4` |
| `27` | `B_C2` |
| `28` | `S1` |
| `29` | `IO5` |
| `30` | `U1RXD` |
| `31` | `U1TXD` |
| `32` | `NC` |
| `33` | `S2` |
| `34` | `U0RX` |
| `35` | `U0TX` |
| `36` | `S3` |
| `37` | `S4` |
| `38` | `GND` |
| `39` | `GND` |

### TB1 - TB6612FNG

| Pin | Net |
|---:|---|
| `1` | `MA1_PRIME` |
| `2` | `MA1_PRIME` |
| `3` | `GND` |
| `4` | `GND` |
| `5` | `MA2_PRIME` |
| `6` | `MA2_PRIME` |
| `7` | `MB1_PRIME` |
| `8` | `MB1_PRIME` |
| `9` | `GND` |
| `10` | `GND` |
| `11` | `MB2_PRIME` |
| `12` | `MB2_PRIME` |
| `13` | `DC_IN` |
| `14` | `DC_IN` |
| `15` | `S5` |
| `16` | `S4` |
| `17` | `S3` |
| `18` | `GND` |
| `19` | `3V3` |
| `20` | `3V3` |
| `21` | `S2` |
| `22` | `S1` |
| `23` | `S0` |
| `24` | `DC_IN` |

### TB2 - TB6612FNG

| Pin | Net |
|---:|---|
| `1` | `MA1` |
| `2` | `MA1` |
| `3` | `GND` |
| `4` | `GND` |
| `5` | `MA2` |
| `6` | `MA2` |
| `7` | `MB1` |
| `8` | `MB1` |
| `9` | `GND` |
| `10` | `GND` |
| `11` | `MB2` |
| `12` | `MB2` |
| `13` | `DC_IN` |
| `14` | `DC_IN` |
| `15` | `S5` |
| `16` | `S4` |
| `17` | `S3` |
| `18` | `GND` |
| `19` | `3V3` |
| `20` | `3V3` |
| `21` | `S2` |
| `22` | `S1` |
| `23` | `S0` |
| `24` | `DC_IN` |

## Source annotations and translated notes
- **10DOF / I2C:** 10DOF: pay attention to orientation.
- **PWR-IN / 5V-5A:** Input marked 6-12 V; output section marked 5V-5A / 5 V power for Raspberry Pi or Jetson Nano.
- **PWR-IN / 5V-5A:** INA219 address shown as 0x42.
- **PWR-IN / 5V-5A:** Chinese note: check whether I2C is being strongly pulled up.
- **PWR-IN / 5V-5A:** Chinese note: increase the inductor package/physical size one step.
- **ESP32 / USB-UART:** Chinese note: a phone is required; if firmware must be installed, OTG functionality cannot be used.
- **ESP32 / USB-UART:** Chinese note: EN must reach ground faster than IO0.
- **USB Type-C:** Chinese note: 16-pin SMT female Type-C; do not supply power externally.
- **Motor Drivers:** Chinese note: add 3.3 V zener protection and larger capacitance to motor feedback signals.
- **Motor Drivers:** Chinese note: add 3.6 V zener protection and larger capacitance to the power supply.
- **IO Control:** Current annotation: I:3Amax.
- **Document:** Title: Waveshare ROS Driver for Robots / Raspberry Pi version of ROS Driver for Robots.
- **Document:** The PDF is a one-page schematic drawing. Exact PCB footprints, board revision, wire colors/lengths, and connector mating-face orientation are not specified.

## Known source-level ambiguities
- Q4 and Q5 part numbers are not printed. They are represented as generic N-channel MOSFETs with `G`, `S`, and `D` terminals.
- VT1 and VT2 physical package pin numbering is not printed; the extraction uses terminal names `B`, `C`, and `E`.
- The TB6612FNG symbol text appears to repeat `BO2` on pin 12; the wiring clearly treats pins 11 and 12 as the paired B-output node. The extraction preserves connectivity, not that apparent label typo.
- The source drawing does not identify the connector viewing direction. Pin numbers are schematic pin numbers only.
- `AGND` and `GND` are preserved as different nets because the schematic draws different ground symbols; no explicit tie is visible on the page.
- Q1/Q2/M2 terminal connectivity was transcribed from the drawn ideal-diode/output-switch circuit; the PDF does not provide a named subcircuit or explanatory note.
