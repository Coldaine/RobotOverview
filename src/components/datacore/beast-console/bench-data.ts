/**
 * The bench scene: every board, peripheral, and connector in the BEAST-01
 * electronics loom, positioned on one SVG canvas so recorded connections
 * render as live cables. Two builds are modeled: 'pi5' (the original kit,
 * as-shipped) and 'orin' (the Jetson target). Verified 2026-07-24 against the
 * owner's physical inspection, the Waveshare CAD archive
 * (data/hardware-cad-assets: UGV Beast PT + Jetson Orin STEP), the ROS Driver
 * schematic, and the UGV Beast wikis; driver-board connectors re-checked
 * 2026-07-27 against Waveshare's labeled callout diagram (callout numbers in
 * the `detail` fields refer to it — see DRIVER_CALLOUTS in reference-data.ts).
 * Positions are diagrammatic, not physical silkscreen coordinates.
 *
 * Ground truth (owner-confirmed): the electronics stack is, bottom → top,
 * Raspberry Pi 5 (inverted) → RPI Audio HAT for Robots → ROS Driver board.
 * The HAT passes 5 V + UART through between them, and its FAN-2507 is
 * integral — screwed into a cutout in the HAT. The Orin build removes only
 * the Pi from the bottom; the HAT + driver pair stays mated.
 */

import { WIRING_LINKS } from '@/data/wiring';
import type { Build, PortCategory } from '@/data/types';

// Build and PortCategory are facts about the robot and live in the data spine.
// Re-exported here so existing console imports keep working unchanged.
export type { Build, PortCategory };

export const CAT: Record<PortCategory, { label: string; color: string }> = {
  power: { label: 'Power', color: 'var(--color-signal-crit)' },
  uart: { label: 'UART', color: 'var(--color-amber)' },
  usb: { label: 'USB', color: 'var(--color-cyan)' },
  i2c: { label: 'I2C', color: '#a78bfa' },
  motor: { label: 'Motor', color: 'var(--color-signal-ok)' },
  servo: { label: 'Servo bus', color: 'var(--color-amber-soft)' },
  sensor: { label: 'Sensor', color: '#c084fc' },
  video: { label: 'Video', color: 'var(--color-cyan-soft)' },
  net: { label: 'Network', color: 'var(--color-cyan)' },
  rf: { label: 'RF', color: 'var(--color-signal-idle)' },
  storage: { label: 'Storage', color: 'var(--color-signal-idle)' },
  audio: { label: 'Audio', color: '#f472b6' },
};

export type PortSide = 'top' | 'bottom' | 'left' | 'right';

export interface BoardChip {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardDef {
  id: 'driver' | 'jetson' | 'ups' | 'audiohat' | 'pi5';
  name: string;
  subtitle: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  chips: BoardChip[];
  /** absent = present in both builds */
  build?: Build;
  /** board-title font size override (default 16.5) — for long names on narrow boards */
  titleSize?: number;
}

export interface PortDef {
  id: string;
  board: BoardDef['id'];
  label: string;
  conn: string;
  cat: PortCategory;
  x: number;
  y: number;
  side: PortSide;
  detail: string;
  expect: string;
  link?: string;
  danger?: boolean;
}

export interface PeripheralDef {
  id: string;
  name: string;
  sub: string;
  cat: PortCategory;
  x: number;
  y: number;
  w: number;
  h: number;
  detail: string;
  /** 'future' = planned hardware not yet on the robot (OAK-D Pro, 360S…) */
  era?: 'future';
  /** absent = present in both builds */
  build?: Build;
}

export interface CableDef {
  from: string;
  to: string;
  cat: PortCategory;
  label: string;
  era?: 'future';
  /** absent = present in both builds */
  build?: Build;
}

export const BOARDS: BoardDef[] = [
  {
    id: 'driver',
    name: 'ROS Driver for Robots',
    subtitle: 'ESP32-WROOM-32UE · TOP of the electronics stack',
    x: 120, y: 300, w: 430, h: 330,
    fill: '#0d1522',
    chips: [
      { label: 'ESP32-WROOM-32UE', x: 300, y: 470, w: 124, h: 66 },
      { label: 'CH343P · ESP32 USB', x: 240, y: 408, w: 128, h: 26 },
      { label: 'CH343P · LiDAR→USB', x: 430, y: 408, w: 128, h: 26 },
      { label: 'TB6612FNG ×2', x: 210, y: 560, w: 96, h: 24 },
      { label: 'INA219 0x42', x: 480, y: 470, w: 84, h: 24 },
      { label: 'ICM-20948 9-axis IMU', x: 400, y: 560, w: 156, h: 24 },
    ],
  },
  {
    id: 'audiohat',
    name: 'RPI Audio HAT for Robots',
    subtitle: 'mid-stack · audio · fan',
    x: 640, y: 330, w: 240, h: 230,
    fill: '#181320',
    titleSize: 13.5,
    chips: [
      { label: 'SSS1629A5 USB codec', x: 760, y: 440, w: 168, h: 24 },
      { label: 'FE1.1S hub + CH340', x: 760, y: 475, w: 168, h: 24 },
      { label: 'amp · mics ×2 · AUX', x: 760, y: 510, w: 168, h: 24 },
    ],
  },
  {
    id: 'jetson',
    name: 'Jetson Orin Nano Dev Kit',
    subtitle: 'own standoffs beside the stack · NEVER docks into it',
    x: 930, y: 300, w: 420, h: 330,
    fill: '#101a2b',
    build: 'orin',
    chips: [
      { label: 'Orin Nano 8GB module', x: 1140, y: 420, w: 160, h: 48 },
      { label: 'M.2 M-key 2280 · 2TB NVMe (boot)', x: 1140, y: 500, w: 200, h: 24 },
      { label: 'M.2 E-key · Wi-Fi/BT', x: 1140, y: 540, w: 140, h: 24 },
      { label: 'J14: pins 9-10 = FORCE_RECOVERY', x: 1140, y: 580, w: 200, h: 24 },
    ],
  },
  {
    id: 'pi5',
    name: 'Raspberry Pi 5',
    subtitle: 'original host · BOTTOM of the stack, mounted inverted',
    x: 930, y: 300, w: 420, h: 330,
    fill: '#111827',
    build: 'pi5',
    chips: [
      { label: 'BCM2712 · 4×A76', x: 1140, y: 430, w: 140, h: 48 },
      { label: 'powered via 40-pin 5 V (driver-board buck)', x: 1140, y: 510, w: 250, h: 24 },
      { label: 'onboard Wi-Fi/BT (no ext. antenna)', x: 1140, y: 550, w: 220, h: 24 },
    ],
  },
  {
    id: 'ups',
    name: '3S 18650 UPS',
    subtitle: 'undercarriage bay · 9–12.6 V pack rail · 4× XH2.54 (3 used, 1 free)',
    x: 640, y: 70, w: 250, h: 170,
    fill: '#131a14',
    chips: [
      { label: 'Molicel P30B ×3 · 3 Ah · 30 A', x: 765, y: 160, w: 168, h: 24 },
      { label: 'protection + balance FETs', x: 765, y: 196, w: 168, h: 24 },
    ],
  },
];

export const PORTS: PortDef[] = [
  // Driver board — top edge
  {
    id: 'drv-dcin', board: 'driver', label: 'DC-IN 7–13V', conn: 'XH2.54-2P', cat: 'power',
    x: 168, y: 300, side: 'top',
    detail: 'Main battery input via the power switch. Feeds the whole board — and passes pack voltage straight through to the motor drivers and servo bus. The 5 V buck here also powers the whole stack below (HAT, and the Pi 5 in the original build). Callout 5 ("Power supply") on the labeled diagram: bottom-left corner of the front face, polarity silkscreened − / +. Note the board itself prints DC 9-12.6V — the 3S window — where the wiki rates the input 7–13 V; treat 9–12.6 V as the number to design to.',
    expect: '3S UPS output (~9–12.6 V)', link: 'ups-out1',
  },
  {
    id: 'drv-lidar-sensor', board: 'driver', label: 'LiDAR IN', conn: 'ZH1.5T-4P · Tx/PWM/GND/5V', cat: 'sensor',
    x: 262, y: 300, side: 'top',
    detail: 'Callout 11 ("Lidar UART interface") — back face, silkscreened LiDAR · 5V · GND · NC · RX. D500 (STL-19P) option A: plug in here, one-way UART at 230400 baud; the onboard CH343P turns it into USB on the LiDAR USB-C. Option B (stock kit route) is what BEAST actually runs — the pigtail is in the HAT\'s LiDAR socket, so this header sits empty today. Note the pin the D500 cable uses for its PWM speed line is marked NC here: the board reads the scan, it never drives the motor.',
    expect: '(only on the driver-board route) D500 LiDAR kit cable', link: 'lidar',
  },
  {
    id: 'drv-esp32-usb', board: 'driver', label: 'USB-C · ESP32', conn: 'USB-C · silkscreen "USB"', cat: 'usb',
    x: 356, y: 300, side: 'top',
    detail: 'Callout 6 ("USB communication / downloading") — the ESP32\'s own USB-C through its CH343P (Type_C1, nets USBD_P/USBD_N in the schematic). On BEAST this is the LIVE HOST LINK: the Jetson\'s USB-A cable is in this port, so the 115200-baud JSON protocol runs over USB as /dev/ttyUSB0 instead of the 40-pin UART jumpers. Same port flashes and debugs the ESP32 (auto-download circuit — no button dance). Telling the pair apart on the board: this is the LEFT USB-C, silkscreened USB, the one next to the DC jack; the ESP32\'s EN (callout 9) and BOOT/IO0 (callout 8) buttons are on the same face just inboard of the pair.',
    expect: 'Jetson USB-A — live host control link',
  },
  {
    id: 'drv-lidar-usb', board: 'driver', label: 'USB-C · LiDAR', conn: 'USB-C · silkscreen "LIDAR"', cat: 'usb',
    x: 440, y: 300, side: 'top',
    detail: "Callout 7 (\"Lidar USB connector\") — the RIGHT USB-C, silkscreened LIDAR. USB side of the driver board's own LiDAR bridge, and one-way: nothing on the board drives its TX, so it can only ever stream out whatever arrives on the LiDAR UART header (callout 11). On BEAST the D500 rides the HAT instead, which makes this port a dead end — leave it empty, and don't mistake it for the host link.",
    expect: '(only if the D500 moves here) USB-C → Jetson USB-A', link: 'jet-usb1',
  },
  // Driver board — left edge
  {
    id: 'drv-5v', board: 'driver', label: '5V rail', conn: 'MP8759GD buck → 40-pin 5V', cat: 'power',
    x: 120, y: 380, side: 'left', danger: true,
    detail: "5 V / 5 A buck feeding the 40-pin 5 V pins — this is what powers the HAT (and powered the Pi 5 through the stack). The Orin can't run on 5 V and must never be fed here: its 40-pin 5 V pins are OUTPUTS. In the Orin build the headroom freed by the Pi makes this the natural aux-5V feed for the OAK-D Pro's Y-adapter.",
    expect: '(future) OAK-D Pro Y-adapter 5 V',
  },
  {
    id: 'drv-i2c', board: 'driver', label: 'I2C/OLED', conn: 'PH2.0-4P ×2 (P3/P4)', cat: 'i2c',
    x: 120, y: 452, side: 'left',
    detail: "I2C expansion bus (two headers, same bus) — callouts 10 (front face, beside the ESP32) and 16 (back face), both silkscreened IIC · SCL · SDA · GND · 3V3. The kit's SSD1306 OLED status screen lives here — driven by the ESP32, works on any host.",
    expect: 'OLED 0.91″ screen', link: 'oled',
  },
  {
    id: 'drv-io45', board: 'driver', label: 'IO4/IO5', conn: '2-pin ×4 · MOSFET-switched', cat: 'power',
    x: 120, y: 524, side: 'left',
    detail: 'Two transistor-switched pack-voltage outputs the ESP32 can toggle — on BEAST they drive the pan-tilt LED spotlight. Callouts 18 (IO4) and 19 (IO5), which the diagram calls "12 V switch controlled by ESP32-IO4/IO5"; each channel is brought out on TWO parallel 2-pin sockets on the back face (four in all), polarity silkscreened + / − and the channel name printed beside each.',
    expect: 'LED spotlight', link: 'spotlight',
  },
  // Driver board — bottom edge
  {
    id: 'drv-m1', board: 'driver', label: 'Motor A', conn: 'PH2.0-6P + encoder', cat: 'motor',
    x: 200, y: 630, side: 'bottom',
    detail: 'Track gearmotor with hall encoder — TB6612FNG channel A (silkscreen MA1/MA2, encoder on AC1/AC2). Callout 3 ("Motor control interfaces") covers the whole 2×2 connector block: one row is silkscreened with the encoder pins (AC1/AC2, BC1/BC2, 3V3, GND), the other is the same 6-pin housing with its four middle pins printed NC — encoder-less spares, unused on BEAST.',
    expect: 'Left track motor', link: 'motor-l',
  },
  {
    id: 'drv-m2', board: 'driver', label: 'Motor B', conn: 'PH2.0-6P + encoder', cat: 'motor',
    x: 310, y: 630, side: 'bottom',
    detail: 'Track gearmotor with hall encoder — TB6612FNG channel B (silkscreen MB1/MB2, encoder on BC1/BC2). Second connector of the callout-3 block; the two TB6612FNG drivers themselves are callout 13, on the back face.',
    expect: 'Right track motor', link: 'motor-r',
  },
  {
    id: 'drv-servo', board: 'driver', label: 'Servo bus', conn: '5264-3P ×2 · daisy chain', cat: 'servo',
    x: 445, y: 630, side: 'bottom',
    detail: 'ST3215 bus servos for the pan-tilt — daisy-chained, ID-addressed, driven from ESP32 GPIO18/19 at 1 Mbps, powered at pack voltage. Callout 12 ("Bus servo control interfaces"): two identical 3-pin sockets on the back face, silkscreened D · V · G — either one starts the chain.',
    expect: 'Pan-tilt ST3215 ×2', link: 'pantilt',
  },
  // Driver board — right edge (faces the stack + host)
  {
    id: 'drv-40pin', board: 'driver', label: 'stack 40p', conn: '2×20 · mates the Audio HAT', cat: 'uart',
    x: 550, y: 350, side: 'right',
    detail: 'The stack connector: the driver board sits on TOP of the Audio HAT and mates it here, board-to-board. 5 V from the buck and the ESP32 UART (P_TX/P_RX) flow down through the HAT — in the original build they continued down to the inverted Pi 5 at the bottom. This is callout 15, "Host controller connection header". The labeled diagram shows a SECOND 2×20 socket beside it — callout 14, "Host controller 40PIN extended header" — which owner inspection did not find usable on the assembled robot; look before you plan to tap it (see open items).',
    expect: 'Audio HAT (board-to-board)', link: 'hat-40pin-top',
  },
  {
    id: 'drv-sd', board: 'driver', label: 'TF card', conn: 'microSD (SPI)', cat: 'storage',
    x: 550, y: 490, side: 'right',
    detail: 'ESP32-side storage: standalone logging and Wi-Fi config — independent of the host.',
    expect: '(optional) microSD',
  },
  {
    id: 'drv-ipex', board: 'driver', label: 'IPEX ant.', conn: 'IPEX1', cat: 'rf',
    x: 550, y: 560, side: 'right',
    detail: 'ESP32 external Wi-Fi/BT antenna (the -32UE module has no onboard antenna — keep this seated). Callout 2 on the labeled diagram, immediately beside the module can (callout 1).',
    expect: 'Stub antenna', link: 'antenna',
  },
  // Audio HAT — top edge (faces the driver board above it in the stack)
  {
    id: 'hat-40pin-top', board: 'audiohat', label: '40p · DRV', conn: '2×20 · driver board docks on top', cat: 'uart',
    x: 700, y: 330, side: 'top',
    detail: 'Upper stack connector — the ROS Driver board sits on top of the HAT and mates here. Carries 5 V down from the driver-board buck and passes the ESP32 UART through.',
    expect: 'ROS Driver board (stacked above)', link: 'drv-40pin',
  },
  {
    id: 'hat-lidar', board: 'audiohat', label: 'LiDAR-alt', conn: 'UART in → CH340 → hub', cat: 'sensor',
    x: 775, y: 330, side: 'top',
    detail: 'The HAT\'s own LiDAR socket (stock kit route): D500 UART in, CH340 bridge, out through the FE1.1S hub — so audio AND the scan stream share the single USB cable to the host. This is where BEAST\'s pigtail actually is, which is why the driver board\'s own LiDAR pair (callouts 11 and 7) sits idle.',
    expect: 'D500 LiDAR (stock route — confirmed)',
  },
  {
    id: 'hat-usbc', board: 'audiohat', label: 'USB-C', conn: 'USB-C · audio + hub uplink', cat: 'usb',
    x: 845, y: 330, side: 'top',
    detail: 'The HAT\'s single upstream cable: SSS1629A5 USB audio (driver-free — ugv_jetson\'s "USB PnP Audio Device") plus anything on the FE1.1S hub (LiDAR via CH340 if stock-routed). Original build: → Pi 5 USB-A. Orin build: → Jetson USB-A #4.',
    expect: 'host USB-A (Pi 5 / Jetson)', link: 'jet-usb4',
  },
  // Audio HAT — bottom edge (faces the Pi below it in the stack)
  {
    id: 'hat-fan', board: 'audiohat', label: 'FAN', conn: '2-pin · 5 V fan header', cat: 'power',
    x: 685, y: 560, side: 'bottom',
    detail: 'Feeds the HAT\'s integral FAN-2507 — the fan is screwed into a cutout in the HAT itself and cools the stack. Powered from the HAT\'s 5 V (which comes down the 40-pin from the driver-board buck), so it keeps spinning after the Pi is removed — verify on first Orin power-up.',
    expect: 'FAN-2507 (integral)', link: 'fan2507',
  },
  {
    id: 'hat-40pin-bot', board: 'audiohat', label: '40p · PI5', conn: '2×20 female · Pi docks from below', cat: 'uart',
    x: 760, y: 560, side: 'bottom',
    detail: 'Lower stack connector — in the original build the inverted Pi 5 docked here from below, receiving 5 V and the ESP32 UART through the HAT. In the Orin build this vacated socket is the UART tap: 3× male-to-female DuPont jumpers into holes 8, 10, 6 → Jetson pins 10, 8, 6. Finding the holes on the downward-facing socket: meter the outer row from the pin-1 end — the two holes reading 5 V are pins 2 and 4, then 6/8/10 are the next three along the same row; mark, power OFF, insert. Stay out of the 5 V holes, and the Jetson must never dock here bodily (no fit; its 5 V pins are outputs).',
    expect: 'Pi 5 (original) · UART jumpers (Orin)', link: 'pi-40pin',
  },
  {
    id: 'hat-spk', board: 'audiohat', label: 'SPK ×2', conn: '2× 2-pin · APA2068 amp out', cat: 'audio',
    x: 835, y: 560, side: 'bottom',
    detail: 'Amplified stereo speaker outputs (8 Ω 2 W each). The 3.5 mm AUX jack and the dual MEMS mics are onboard the HAT itself.',
    expect: 'Speakers ×2', link: 'speaker',
  },
  // UPS module
  {
    id: 'ups-chg', board: 'ups', label: 'CHG 12.6V', conn: 'DC 5.5×2.1 mm · 2 A', cat: 'power',
    x: 700, y: 70, side: 'top',
    detail: 'Charge input. Doubles as the arming plug: a fresh pack plays dead until a 12.6 V 2 A charger is connected once to wake the protection FETs. Charges in place — no need to pull cells.',
    expect: '12.6 V 2 A charger', link: 'charger',
  },
  {
    id: 'ups-out1', board: 'ups', label: 'OUT · driver', conn: 'XH2.54-2P lead', cat: 'power',
    x: 700, y: 240, side: 'bottom',
    detail: 'Pack-voltage lead to the driver board DC-IN, routed through the chassis power switch. Everything downstream — motors, servos, spotlight, the 5 V buck feeding the stack — draws through this one lead.',
    expect: 'XH2.54 → driver DC-IN', link: 'drv-dcin',
  },
  {
    id: 'ups-out2', board: 'ups', label: 'OUT · pigtail', conn: '→ 5.5×2.5 mm barrel', cat: 'power',
    x: 820, y: 240, side: 'bottom',
    detail: "Orin build: pack voltage to the Jetson's barrel jack, from the UPS's FREE 4th XH2.54 socket (owner-observed: 4 headers, 3 populated). Verify the free socket with the meter FIRST: pack armed → expect ~11–12.6 V and note which hole is +; if it reads 0 V it's the charge-extension node — pick again. Terminate the pigtail with an XH2.54 lead matching that polarity. CAVEAT: this socket is likely upstream of the chassis switch, so the Jetson stays live whenever the pack is armed — shut it down in software, unplug the barrel for storage, or add an inline XH switch lead later. Do NOT use IO4/IO5 for this (ESP32-switched). Final check at the barrel: center pin positive, ~pack voltage. 9–12.6 V sits inside the Orin's 9–20 V window.",
    expect: 'Pigtail → Jetson barrel', link: 'jet-barrel',
  },
  {
    id: 'ups-aux', board: 'ups', label: 'AUX tap', conn: 'not stock — splice/XT30 to add', cat: 'power',
    x: 890, y: 155, side: 'right',
    detail: 'Does not exist on the stock UPS. A future spliced pack-voltage tap (XT30 recommended) for new loads — the Livox Mid-360S wants 9–27 V, which this rail covers. Record it here when you add it.',
    expect: '(future) Mid-360S power tap',
  },
  // Jetson — top edge
  {
    id: 'jet-barrel', board: 'jetson', label: 'DC barrel 9–20V', conn: '5.5×2.5 mm center+ · 45 W max', cat: 'power',
    x: 990, y: 300, side: 'top',
    detail: "The Orin's power input in this build: your pigtail from the UPS rail (~9–12.6 V, in range). This replaces the 40-pin 5 V feed the Pi used — the Orin cannot be powered through its 40-pin.",
    expect: 'UPS pigtail → barrel plug', link: 'ups-out2',
  },
  {
    id: 'jet-40pin', board: 'jetson', label: '40-pin header', conn: '2×20 · Pi-compatible pinout', cat: 'uart',
    x: 1096, y: 300, side: 'top',
    detail: 'Takes the 3 UART jumpers from the HAT\'s vacated Pi dock: HAT hole 8 → Jetson pin 10, hole 10 → Jetson pin 8 (crossed), 6 → 6 GND. Shows up as /dev/ttyTHS1 at 115200 baud (JSON protocol). Jumper wires only — the dev kit never docks into the stack. USB alternative: ESP32 USB-C → Jetson USB-A (/dev/ttyUSB0).',
    expect: '3× jumpers → HAT Pi dock', link: 'hat-40pin-bot',
  },
  {
    id: 'jet-usbc', board: 'jetson', label: 'USB-C', conn: 'USB-C · no display, no PD', cat: 'usb',
    x: 1200, y: 300, side: 'top',
    detail: 'Flashing/recovery (RCM) and the 192.168.55.1 USB-gadget console. Not part of the runtime data path.',
    expect: '(bench only) flashing host',
  },
  // Jetson — left edge
  {
    id: 'jet-usb1', board: 'jetson', label: 'USB-A #1', conn: 'USB 3.2 Gen2', cat: 'usb',
    x: 930, y: 372, side: 'left',
    detail: "LiDAR data lands here when the D500 is routed through the driver board's own bridge (LiDAR USB-C). If you keep the stock HAT route instead, this port stays free.",
    expect: 'LiDAR USB (from driver board)', link: 'drv-lidar-usb',
  },
  {
    id: 'jet-usb2', board: 'jetson', label: 'USB-A #2', conn: 'USB 3.2 Gen2', cat: 'usb',
    x: 930, y: 424, side: 'left',
    detail: 'Pan-tilt camera feed (the kit camera is USB, not CSI).',
    expect: 'Pan-tilt 5MP 160° USB camera', link: 'camera',
  },
  {
    id: 'jet-usb3', board: 'jetson', label: 'USB-A #3', conn: 'USB 3.2 Gen2', cat: 'usb',
    x: 930, y: 476, side: 'left',
    detail: 'OAK-D Lite depth camera — one USB-C cable carries its power and data.',
    expect: 'OAK-D Lite (USB3)', link: 'oakd',
  },
  {
    id: 'jet-usb4', board: 'jetson', label: 'USB-A #4', conn: 'USB 3.2 Gen2', cat: 'usb',
    x: 930, y: 528, side: 'left',
    detail: "The Audio HAT's USB-C lands here — audio (SSS1629A5, driver-free) plus whatever rides the HAT's hub (LiDAR via CH340 on the stock route).",
    expect: 'Audio HAT USB-C', link: 'hat-usbc',
  },
  {
    id: 'jet-rj45', board: 'jetson', label: 'GbE', conn: 'RJ45', cat: 'net',
    x: 930, y: 588, side: 'left',
    detail: 'Bench Ethernet for provisioning (enP8p1s0); the robot roams on the M.2 Wi-Fi card (wlP1p1s0). Future: this port becomes the Livox Mid-360S link (100BASE-TX via its M12 pigtail) — the lidar is Ethernet, not USB.',
    expect: '(bench) Ethernet · (future) Mid-360S', link: 'mid360s',
  },
  // Jetson — right edge
  {
    id: 'jet-wifi', board: 'jetson', label: 'Wi-Fi ant.', conn: 'IPEX MHF4 ×2 (M.2 card)', cat: 'rf',
    x: 1350, y: 420, side: 'right',
    detail: 'Two MHF4 antenna leads off the M.2 E-key Wi-Fi card. On BEAST they route out of the bay to the chassis antennas — the robot roams on this link (wlP1p1s0), so seat both.',
    expect: 'Chassis Wi-Fi antennas ×2', link: 'antenna-jet',
  },
  // Jetson — bottom edge
  {
    id: 'jet-csi0', board: 'jetson', label: 'CSI 0', conn: '22-pin FFC · 2-lane', cat: 'video',
    x: 1030, y: 630, side: 'bottom',
    detail: 'MIPI camera option — unused on BEAST (both cameras are USB).',
    expect: '(unused)',
  },
  {
    id: 'jet-csi1', board: 'jetson', label: 'CSI 1', conn: '22-pin FFC · 2/4-lane', cat: 'video',
    x: 1110, y: 630, side: 'bottom',
    detail: 'Second MIPI lane set — unused on BEAST.',
    expect: '(unused)',
  },
  {
    id: 'jet-dp', board: 'jetson', label: 'DisplayPort', conn: 'DP 1.2 (only display out)', cat: 'video',
    x: 1200, y: 630, side: 'bottom',
    detail: 'Bench monitor during provisioning. DP→HDMI needs an adapter; the USB-C port has no display output.',
    expect: '(bench) monitor',
  },
  // Raspberry Pi 5 (original build)
  {
    id: 'pi-40pin', board: 'pi5', label: '40-pin GPIO', conn: '2×20 male · docks up into the HAT', cat: 'uart',
    x: 1030, y: 300, side: 'top',
    detail: 'The Pi rides the BOTTOM of the stack, inverted, its 40-pin mating up into the Audio HAT. Everything arrives through this one connector: 5 V from the driver-board buck (pins 2/4) and the ESP32 UART on pins 8/10. No separate power cable, no jumper wires.',
    expect: 'Audio HAT (board-to-board)', link: 'hat-40pin-bot',
  },
  {
    id: 'pi-usb3a', board: 'pi5', label: 'USB-A 3.0 #1', conn: 'USB 3.0', cat: 'usb',
    x: 930, y: 390, side: 'left',
    detail: 'OAK-D Lite depth camera in the original build.',
    expect: 'OAK-D Lite (USB3)', link: 'oakd',
  },
  {
    id: 'pi-usb3b', board: 'pi5', label: 'USB-A 3.0 #2', conn: 'USB 3.0', cat: 'usb',
    x: 930, y: 445, side: 'left',
    detail: 'Pan-tilt USB camera in the original build.',
    expect: 'Pan-tilt 5MP USB camera', link: 'camera',
  },
  {
    id: 'pi-usb2', board: 'pi5', label: 'USB-A 2.0 ×2', conn: 'USB 2.0', cat: 'usb',
    x: 930, y: 500, side: 'left',
    detail: "The Audio HAT's USB-C lands here — audio plus the D500 LiDAR stream riding the HAT's hub (stock route).",
    expect: 'Audio HAT USB-C', link: 'hat-usbc',
  },
];

export const PERIPHERALS: PeripheralDef[] = [
  {
    id: 'charger', name: '12.6 V 2 A charger', sub: 'arms + charges the UPS', cat: 'power',
    x: 420, y: 84, w: 170, h: 56,
    detail: 'Bench charger for the 3S pack. Required once to arm a fresh pack, then used for routine in-place charging through the same jack.',
  },
  {
    id: 'lidar', name: 'D500 LiDAR', sub: 'STL-19P · 230400 baud · 360°', cat: 'sensor',
    x: 180, y: 110, w: 150, h: 64,
    detail: "DTOF, 0.03–12 m, 10 Hz scan. Two valid sockets: the driver board's LiDAR IN (callout 11, own CH343P bridge → the USB-C at callout 7) or the Audio HAT's LiDAR socket (CH340 → shared USB cable). BEAST runs the second — the stock kit route — so the scan arrives on the host over the HAT's single cable. Moving it to the driver board is an option, not a fix.",
  },
  {
    id: 'oled', name: 'OLED 0.91″', sub: 'SSD1306 · I2C', cat: 'i2c',
    x: 40, y: 720, w: 130, h: 56,
    detail: 'Status readout (IPs, ports, RSSI) driven by the ESP32 — host-independent.',
  },
  {
    id: 'motor-l', name: 'Left track motor', sub: 'DC + hall encoder', cat: 'motor',
    x: 200, y: 800, w: 145, h: 56,
    detail: 'Track drive, left side.',
  },
  {
    id: 'motor-r', name: 'Right track motor', sub: 'DC + hall encoder', cat: 'motor',
    x: 375, y: 800, w: 145, h: 56,
    detail: 'Track drive, right side.',
  },
  {
    id: 'pantilt', name: 'Pan-tilt', sub: 'ST3215 bus servos ×2', cat: 'servo',
    x: 550, y: 800, w: 150, h: 56,
    detail: '2-DOF camera/spotlight gimbal on the serial servo bus.',
  },
  {
    id: 'spotlight', name: 'LED spotlight', sub: 'on pan-tilt · IO4/IO5', cat: 'power',
    x: 40, y: 640, w: 130, h: 50,
    detail: "High-brightness LED next to the pan-tilt camera, switched by the driver board's IO4/IO5 outputs.",
  },
  {
    id: 'antenna', name: 'ESP32 antenna', sub: 'IPEX1 stub', cat: 'rf',
    x: 420, y: 690, w: 130, h: 50,
    detail: 'ESP32 external antenna (the -32UE module needs it).',
  },
  {
    id: 'fan2507', name: 'FAN-2507', sub: 'integral — screwed into the HAT', cat: 'power',
    x: 600, y: 640, w: 150, h: 50,
    detail: 'The stack fan. It is an integral part of the Audio HAT — seated in a cutout and screwed into the HAT itself — and runs off the HAT\'s fan header. Because the HAT\'s 5 V comes down the 40-pin from the driver-board buck, the fan is independent of which host is installed.',
  },
  {
    id: 'speaker', name: 'Speakers ×2', sub: '8 Ω 2 W · stereo', cat: 'audio',
    x: 770, y: 640, w: 150, h: 50,
    detail: 'Stereo speakers driven by the HAT\'s APA2068 amplifier. Mics and the 3.5 mm AUX jack are on the HAT itself.',
  },
  {
    id: 'camera', name: 'Pan-tilt camera', sub: 'USB · 5MP · 160°', cat: 'video',
    x: 950, y: 730, w: 140, h: 56,
    detail: 'Rides the pan-tilt; plugs straight into the host over USB (both builds).',
  },
  {
    id: 'oakd', name: 'OAK-D Lite', sub: 'USB3 · depth · rail mount', cat: 'video',
    x: 1120, y: 730, w: 140, h: 56,
    detail: "Luxonis depth camera on the sensor mast's 21 mm Picatinny rail. One USB-C cable: power + data (both builds).",
  },
  {
    id: 'antenna-jet', name: 'Wi-Fi antennas ×2', sub: 'MHF4 leads → chassis', cat: 'rf',
    x: 1280, y: 668, w: 160, h: 50, build: 'orin',
    detail: "The Jetson's antennas, routed out of the host bay. The robot's runtime link — keep them clear of the tracks and the spotlight wiring. (The Pi 5 used its onboard antenna.)",
  },
  // ——— future loadout (Orin build) ———
  {
    id: 'oakdpro', name: 'OAK-D Pro', sub: 'USB3 · IR dot + flood · 184 g', cat: 'video',
    x: 935, y: 830, w: 170, h: 56, era: 'future', build: 'orin',
    detail: 'Planned OAK-D Lite replacement. Active IR: laser dot projector + flood illuminator — up to ~15 W with everything on, so Luxonis says use the Y-adapter with an external 5 V ≥3 A feed rather than one USB port. Mounts: 1/4-20 + VESA 75 (M4). Keep the USB3 cable ≤2 m shielded; Orin Nanos sometimes negotiate USB2 — check with lsusb -t.',
  },
  {
    id: 'mid360s', name: 'Livox Mid-360S', sub: '3D 360°×59° · Ethernet · 9–27 V', cat: 'sensor',
    x: 1150, y: 830, w: 185, h: 56, era: 'future', build: 'orin',
    detail: 'Planned 3D lidar (65×65×60 mm, 265 g, ~200k pts/s, 40 m). Ethernet via M12 pigtail — it CANNOT reuse the D500\'s UART bridges (CH343P or CH340). Needs the Jetson RJ45 + a 9–27 V tap off the pack (≈6.5 W, up to 14 W self-heating). ROS2: livox_ros_driver2.',
  },
  {
    id: 'camup', name: 'Zoom/thermal cam', sub: 'UVC · rides the pan-tilt', cat: 'video',
    x: 700, y: 830, w: 180, h: 56, era: 'future', build: 'orin',
    detail: 'Planned 5MP-camera replacement on the existing pan-tilt bracket. Shortlist: ELP 10× optical-zoom USB (IMX415, true UVC, v4l2 zoom control, ~$100–150) or FLIR Lepton 3.5 + PureThermal 3 (radiometric thermal, true UVC, 8.7 Hz, ~$250). Both are plain UVC → ROS2 v4l2_camera just works.',
  },
];

export type BenchNode =
  | ({ kind: 'port' } & PortDef)
  | ({ kind: 'peripheral'; cx: number; cy: number } & PeripheralDef);

export const NODE_INDEX: Record<string, BenchNode> = Object.fromEntries([
  ...PORTS.map((p) => [p.id, { kind: 'port' as const, ...p }]),
  ...PERIPHERALS.map((p) => [
    p.id,
    { kind: 'peripheral' as const, ...p, cx: p.x + p.w / 2, cy: p.y + p.h / 2 },
  ]),
]);

/** Canonical loom, one entry per physical cable. No `build` = both builds. */
/**
 * The loom, projected for the bench view. `parentNet` and `documents` are spine
 * bookkeeping and are deliberately dropped here — the view draws cables, it does
 * not carry provenance. Edit {@link WIRING_LINKS}, never this.
 */
export const EXPECTED_CABLES: CableDef[] = WIRING_LINKS.map((link) => {
  const cable: CableDef = { from: link.from, to: link.to, cat: link.cat, label: link.label };
  if (link.build) cable.build = link.build;
  if (link.era) cable.era = link.era;
  return cable;
});

export type StepKind = 'unplug' | 'new' | 'move' | 'check';

export interface ConversionStep {
  n: number;
  kind: StepKind;
  title: string;
  how: string;
  /** port or peripheral id to pin the numbered badge on (omit = list-only step) */
  anchor?: string;
  /** cable this step concerns, as `${from}->${to}` — kept bright while others dim */
  cable?: string;
}

export const STEP_KIND_META: Record<StepKind, { label: string; color: string }> = {
  unplug: { label: 'UNPLUG', color: 'var(--color-signal-crit)' },
  new: { label: 'NEW', color: 'var(--color-signal-ok)' },
  move: { label: 'MOVE', color: 'var(--color-amber)' },
  check: { label: 'CHECK', color: 'var(--color-cyan)' },
};

/** The Pi→Orin conversion, in order. Rendered as numbered badges on the Orin bench. */
export const CONVERSION_STEPS: ConversionStep[] = [
  {
    n: 1, kind: 'unplug', anchor: 'hat-40pin-bot',
    title: 'Undock the Pi 5 from the bottom of the stack',
    how: 'Everything off first (chassis switch, charger out). Pull the Pi straight down off the HAT\'s lower 40-pin while supporting the HAT. The HAT + driver board above stay mated — do not separate them. Keep the Pi\'s screws.',
  },
  {
    n: 2, kind: 'new',
    title: 'Mount the Jetson beside the stack',
    how: 'No published hole XY: press the dev kit onto paper, mark through its 4 holes, drill the plate, M2.5 hex standoffs (4.5 × 6.57 mm). Fan side unobstructed. It must NEVER dock into the stack — its 40-pin 5 V pins are outputs.',
  },
  {
    n: 3, kind: 'new', anchor: 'jet-40pin', cable: 'hat-40pin-bot->jet-40pin',
    title: 'Run the 3 UART jumpers (or one USB cable)',
    how: 'The Pi\'s old dock on the HAT\'s underside is now a free female socket carrying the same nets — no exposed spare pins exist on the driver board. 3× male-to-female DuPont: HAT hole 8 → Jetson pin 10, hole 10 → Jetson pin 8, hole 6 → pin 6. The downward-facing socket is mirrored, so find the holes by meter: the two reading 5 V are pins 2/4, then 6, 8, 10 follow along that row — mark them, power off, insert. Stay out of the 5 V holes. Zero-pin-counting alternative — and what BEAST is running today: one USB cable from the driver board\'s ESP32 USB-C to a Jetson USB-A (port becomes /dev/ttyUSB0). Take the LEFT USB-C, silkscreened USB, next to the DC jack (callout 6); the other one is the LiDAR bridge and will never answer.',
  },
  {
    n: 4, kind: 'move', anchor: 'hat-usbc', cable: 'hat-usbc->jet-usb4',
    title: "Move the Audio HAT's USB-C to the Jetson",
    how: 'The same cable that fed the Pi — re-plug into Jetson USB-A #4. Audio (and the LiDAR, if stock-routed) rides this one cable.',
  },
  {
    n: 5, kind: 'new', anchor: 'jet-barrel', cable: 'ups-out2->jet-barrel',
    title: 'Power the Jetson (do this last — wall adapter until then)',
    how: 'PLAN A — split-rail upgrade, solderless (recommended): 99 Wh V-mount battery with USB-C PD output, mounted on the rear T-slot rails → USB-C PD trigger cable FIXED AT 15 V → 5.5×2.5 barrel. Pick 15 V for headroom, not 20 V: NVIDIA\'s carrier spec (SP-11324-001, pp. 7/31/32) rates the DC jack 9–20 V, so a 20 V trigger is technically in spec but leaves zero margin for PD overshoot. Meter the barrel first plug-in (center +, 15 V). Cells: verified Molicel P30B (30 A) — no swap needed; the drive pack is already right.PLAN B — interim pack tap: XH2.54 lead on the pigtail into the UPS\'s free 4th socket (meter it first: ~11–12.6 V, note the + hole; it likely bypasses the chassis switch, so the Jetson stays live while the pack is armed).',
  },
  {
    n: 6, kind: 'move', anchor: 'jet-usb2', cable: 'camera->jet-usb2',
    title: 'Re-plug the pan-tilt camera',
    how: 'Its USB cable → Jetson USB-A #2.',
  },
  {
    n: 7, kind: 'move', anchor: 'jet-usb3', cable: 'oakd->jet-usb3',
    title: 'Re-plug the OAK-D Lite',
    how: 'Its USB-C→A cable → Jetson USB-A #3.',
  },
  {
    n: 8, kind: 'new', anchor: 'jet-wifi', cable: 'antenna-jet->jet-wifi',
    title: 'Seat both Wi-Fi antenna leads',
    how: 'Two MHF4 snap-on leads on the M.2 card — the robot roams on this link. Seat both, route clear of the tracks.',
  },
  {
    n: 9, kind: 'check', anchor: 'hat-lidar',
    title: 'D500 route — already settled, just confirm it survived',
    how: 'The pigtail is in the HAT\'s LiDAR socket (stock route), so the scan rides the HAT\'s USB cable and nothing needs moving. The driver-board alternative (LiDAR IN callout 11 → USB-C callout 7 → Jetson USB-A #1) stays available if you ever want the lidar off the shared cable. Confirm the pigtail is still seated after the Pi comes out, and record the plug here.',
  },
  {
    n: 10, kind: 'check', anchor: 'hat-fan',
    title: 'Fan check on first power-up',
    how: "The HAT's integral FAN-2507 should keep spinning without the Pi (its 5 V comes down the stack from the driver-board buck). If it stops: power off and re-check the fan header feed before continuing.",
  },
  {
    n: 11, kind: 'check',
    title: 'First boot',
    how: 'Chassis switch on → Jetson boots from NVMe → `ls /dev/ttyTHS1` (or /dev/ttyUSB0 on the USB route) → run ugv_jetson; wheels respond = conversion done. Record each plug in this diagram as you make it.',
  },
];

/** Port endpoints on a cable (one or both ends may be ports). */
export function cablePortEnds(cable: CableDef): string[] {
  const ends: string[] = [];
  const from = NODE_INDEX[cable.from];
  const to = NODE_INDEX[cable.to];
  if (from?.kind === 'port') ends.push(cable.from);
  if (to?.kind === 'port') ends.push(cable.to);
  return ends;
}

/**
 * Preferred port to open when jumping from a peripheral (stable: `from` if it
 * is a port, otherwise `to`). Loom *status* uses {@link cableStatus} so either
 * port end can record the plug.
 */
export function cableOwner(cable: CableDef): string | null {
  return cablePortEnds(cable)[0] ?? null;
}

/** Aggregate loom state: plugged > planned > empty across either port end. */
export function cableStatus(
  cable: CableDef,
  ports: Record<string, { status?: string }>,
): 'empty' | 'planned' | 'plugged' {
  const ends = cablePortEnds(cable);
  if (ends.length === 0) return 'empty';
  if (ends.some((id) => ports[id]?.status === 'plugged')) return 'plugged';
  if (ends.some((id) => ports[id]?.status === 'planned')) return 'planned';
  return 'empty';
}
