/**
 * 40-pin header map (net names extracted programmatically from the vector
 * layer of the ROS Driver for Robots schematic), the driver board's official
 * callout legend, Jetson mount-stack layers, bring-up checklist, and
 * provenance for the BEAST Console.
 */

export type PinRole = 'pwr5' | 'pwr3' | 'gnd' | 'uart' | 'i2c' | 'nc';

export interface PinDef {
  pin: number;
  name: string;
  role: PinRole;
  used?: string;
}

export const PINS40: PinDef[] = [
  { pin: 1, name: '3V3', role: 'pwr3' }, { pin: 2, name: '5V', role: 'pwr5' },
  { pin: 3, name: 'IIC_SDA', role: 'i2c' }, { pin: 4, name: '5V', role: 'pwr5' },
  { pin: 5, name: 'IIC_SCL', role: 'i2c' }, { pin: 6, name: 'GND', role: 'gnd', used: 'Jetson GND (pin 6 → pin 6)' },
  { pin: 7, name: '—', role: 'nc' }, { pin: 8, name: 'P_TX (ESP32 U0TX)', role: 'uart', used: '→ Jetson pin 10 RXD' },
  { pin: 9, name: 'GND', role: 'gnd' }, { pin: 10, name: 'P_RX (ESP32 U0RX)', role: 'uart', used: '← Jetson pin 8 TXD' },
  { pin: 11, name: '—', role: 'nc' }, { pin: 12, name: '—', role: 'nc' },
  { pin: 13, name: '—', role: 'nc' }, { pin: 14, name: 'GND', role: 'gnd' },
  { pin: 15, name: '—', role: 'nc' }, { pin: 16, name: '—', role: 'nc' },
  { pin: 17, name: '3V3', role: 'pwr3' }, { pin: 18, name: '—', role: 'nc' },
  { pin: 19, name: '—', role: 'nc' }, { pin: 20, name: 'GND', role: 'gnd' },
  { pin: 21, name: '—', role: 'nc' }, { pin: 22, name: '—', role: 'nc' },
  { pin: 23, name: '—', role: 'nc' }, { pin: 24, name: '—', role: 'nc' },
  { pin: 25, name: 'GND', role: 'gnd' }, { pin: 26, name: '—', role: 'nc' },
  { pin: 27, name: '—', role: 'nc' }, { pin: 28, name: '—', role: 'nc' },
  { pin: 29, name: '—', role: 'nc' }, { pin: 30, name: 'GND', role: 'gnd' },
  { pin: 31, name: '—', role: 'nc' }, { pin: 32, name: '—', role: 'nc' },
  { pin: 33, name: '—', role: 'nc' }, { pin: 34, name: 'GND', role: 'gnd' },
  { pin: 35, name: '—', role: 'nc' }, { pin: 36, name: '—', role: 'nc' },
  { pin: 37, name: '—', role: 'nc' }, { pin: 38, name: '—', role: 'nc' },
  { pin: 39, name: 'GND', role: 'gnd' }, { pin: 40, name: '—', role: 'nc' },
];

/** Waveshare's own labeled diagram of the ROS Driver board, served by the app. */
export const DRIVER_CALLOUT_IMAGE = '/datacore/beast-driver-board-callouts.png';

export interface CalloutDef {
  n: number;
  /** verbatim from the diagram's legend — do not paraphrase */
  label: string;
  face: 'front' | 'back';
  /** bench-data port id, when the callout is a connector the Live Plug view tracks */
  port?: string;
  /** what you look for on the board in your hands */
  tell?: string;
}

/**
 * The diagram's numbered legend, 1–19 (front view carries 1–10, back 11–19).
 * This is the physical-identification reference: when a `detail` field in
 * bench-data cites "callout N", this is the N. Labels are verbatim; `tell` is
 * ours, from the silkscreen visible in the photo.
 */
export const DRIVER_CALLOUTS: CalloutDef[] = [
  { n: 1, label: 'ESP32 module', face: 'front', tell: 'ESP32-WROOM-32UE can, top of the front face' },
  { n: 2, label: 'ESP32 module antenna connector', face: 'front', port: 'drv-ipex', tell: 'IPEX1 stub right beside the can — keep it seated' },
  { n: 3, label: 'Motor control interfaces', face: 'front', port: 'drv-m1', tell: '2×2 block; one row has the encoder pins, the other prints NC on its four middles' },
  { n: 4, label: 'INA219 — Battery voltage detection IC', face: 'front', tell: 'pack telemetry on I2C 0x42, next to the electrolytic' },
  { n: 5, label: 'Power supply', face: 'front', port: 'drv-dcin', tell: 'XH2.54 in the bottom-left corner, silkscreen DC 9-12.6V, − / + marked' },
  { n: 6, label: 'USB communication / downloading', face: 'front', port: 'drv-esp32-usb', tell: 'LEFT USB-C, silkscreen USB, the one beside the DC jack — this is the host link' },
  { n: 7, label: 'Lidar USB connector', face: 'front', port: 'drv-lidar-usb', tell: 'RIGHT USB-C, silkscreen LIDAR — unused on BEAST' },
  { n: 8, label: 'ESP32-IO0 button', face: 'front', tell: 'silkscreen BOOT, inboard of the USB pair' },
  { n: 9, label: 'ESP32-EN button', face: 'front', tell: 'silkscreen EN — reset; sits just above BOOT' },
  { n: 10, label: 'I2C device interface', face: 'front', port: 'drv-i2c', tell: 'PH2.0 marked IIC · SCL · SDA · GND · 3V3 — the OLED bus' },
  { n: 11, label: 'Lidar UART interface', face: 'back', port: 'drv-lidar-sensor', tell: 'ZH1.5T marked LiDAR · 5V · GND · NC · RX (the PWM pin is NC)' },
  { n: 12, label: 'Bus servo control interfaces', face: 'back', port: 'drv-servo', tell: 'two 3-pin sockets marked D · V · G' },
  { n: 13, label: 'TB6612FNG — Motor driver IC', face: 'back', tell: 'the two drivers under the silkscreened board name' },
  { n: 14, label: 'Host controller 40PIN extended header', face: 'back', tell: 'the OUTER 2×20 socket — the one owner inspection could not use; see open items' },
  { n: 15, label: 'Host controller connection header', face: 'back', port: 'drv-40pin', tell: 'the INNER 2×20 socket — what actually mates the Audio HAT below' },
  { n: 16, label: 'I2C device interface', face: 'back', port: 'drv-i2c', tell: 'second header, same bus as callout 10' },
  { n: 17, label: 'ICM20948 — 9-axis IMU attitude sensor', face: 'back', tell: 'X / Y / Z axis arrows are silkscreened beside it' },
  { n: 18, label: '12V switch controlled by ESP32-IO4', face: 'back', port: 'drv-io45', tell: 'two parallel 2-pin sockets both marked IO4' },
  { n: 19, label: '12V switch controlled by ESP32-IO5', face: 'back', port: 'drv-io45', tell: 'two parallel 2-pin sockets both marked IO5' },
];

export interface MountLayerDef {
  id: string;
  name: string;
  kind: 'plate' | 'board' | 'ghost' | 'future';
  detail: string;
  hardwareHint: string;
}

export const MOUNT_LAYERS: MountLayerDef[] = [
  {
    id: 'chassis', name: 'Chassis deck plate', kind: 'plate',
    detail: 'UGV Beast tracked chassis — deck plate 231.54 × 159.96 mm (Waveshare 2D drawing), with 1020 T-slot rails along the sides (currently unused). The driver board and the Jetson host bay sit side-by-side on this deck.',
    hardwareHint: 'M3 holes + T-slot rails',
  },
  {
    id: 'ups', name: '3S 18650 UPS (undercarriage)', kind: 'board',
    detail: 'The battery rides in the undercarriage bay UNDER the deck, not in the electronics stack. One-time gotcha: it plays dead until a 12.6 V 2 A charger is plugged in once to arm the protection circuit.',
    hardwareHint: 'undercarriage bay · 3× Molicel P30B (3 Ah, 30 A)',
  },
  {
    id: 'pi5', name: 'Raspberry Pi 5 (comes off)', kind: 'ghost',
    detail: 'The original host — BOTTOM of the electronics stack, mounted inverted, its 40-pin docking up into the Audio HAT. It received 5 V (from the driver-board buck) and the ESP32 UART entirely through that one connector. The Orin build removes it; everything above it stays mated. Do NOT dock the Jetson in its place: the dev kit (103 × 90.5 × 34.8 mm + heatsink) doesn\'t fit, and its 40-pin 5 V pins are outputs — the buck would back-drive them.',
    hardwareHint: 'REMOVE for Orin build',
  },
  {
    id: 'audiohat', name: 'RPI Audio HAT for Robots', kind: 'board',
    detail: 'Mid-stack: the inverted Pi 5 docked into its underside; the ROS Driver board sits on top. SSS1629A5 USB codec + amp, dual mics, speakers, 3.5 mm AUX, FE1.1S USB hub + CH340 LiDAR bridge — and the FAN-2507 is INTEGRAL, seated in a cutout and screwed into the HAT itself. Stays exactly where it is in the Orin build; only its USB-C moves, from the Pi to Jetson USB-A #4.',
    hardwareHint: 'stays mid-stack · integral fan',
  },
  {
    id: 'driverboard', name: 'ROS Driver board', kind: 'board',
    detail: 'TOP of the electronics stack, mated onto the Audio HAT below it — no spare 40-pin is exposed on it (owner-verified). 65 × 65 mm, mounting holes 49 × 58 mm, Ø3 mm (M3) — figures from the General Driver page; verify with calipers. Its buck feeds 5 V down the stack; the Orin\'s UART jumpers tap the HAT\'s vacated Pi dock below, not this board.',
    hardwareHint: 'top of stack · buck feeds 5 V down',
  },
  {
    id: 'jetson', name: 'Jetson Orin Nano Dev Kit', kind: 'board',
    detail: 'Mounts BESIDE the electronics stack on its own standoffs — it never docks into the stack (no fit, and its 40-pin 5 V pins are outputs, not a power input). Wired by exactly three things: 3 UART jumpers, the HAT\'s USB-C, and the UPS barrel pigtail. Carrier PCB 100 × 79 mm; dev kit 103 × 90.5 × 34.8 mm. Official standoffs: M2.5 hex, 4.5 × 6.57 mm, with M2.5 × 3.7 mm pad-head screws. Exact hole XY coordinates are only in NVIDIA\'s login-gated P3768 design files — measure, drill the plate, and record what you use here.',
    hardwareHint: 'M2.5 hex standoffs 4.5 × 6.57 mm',
  },
  {
    id: 'mast', name: 'Sensor mast · Picatinny rail', kind: 'board',
    detail: 'The mast rises from the deck rear and carries the 21 mm Picatinny rail (OAK-D rides it today) plus the pan-tilt. It is also the future real estate: the Mid-360S wants the highest point with a clear 360° horizon, and the OAK-D Pro replaces the Lite on the same rail claws.',
    hardwareHint: 'chassis mast + rail claw mounts',
  },
  {
    id: 'oakdpro', name: 'OAK-D Pro (future)', kind: 'future',
    detail: 'Swaps onto the Lite\'s rail position: 1/4-20 tripod thread underneath or VESA 75 (M4) on the back. 111 × 40 × 31 mm, 184 g — noticeably heavier than the Lite, so check the rail claw torque. Leave the IR dot projector and flood LED unobstructed; route the Y-adapter power lead down the mast.',
    hardwareHint: '1/4-20 or VESA75 M4 on the rail',
  },
  {
    id: 'mid360s', name: 'Livox Mid-360S (future)', kind: 'future',
    detail: 'Top-of-mast slot. 65 × 65 mm base × 60 mm tall, 265 g — needs a flat plate at the mast tip with nothing intruding into the 360° × 59° field. Route the M12 pigtail (Ethernet + 9–27 V power) down the mast to the Jetson RJ45 and the pack tap. Mind cold-start self-heating draw (to ~14 W).',
    hardwareHint: '65 × 65 plate at mast tip, FOV clear',
  },
];

export const MOUNT_CHECKS: { id: string; label: string }[] = [
  { id: 'c-ups-activate', label: 'UPS activated once with the 12.6 V 2 A charger (it plays dead until then)' },
  { id: 'c-remove-hat', label: 'Pi 5 undocked from the bottom of the stack; HAT + driver stay mated; HAT USB-C → Jetson USB-A #4' },
  { id: 'c-standoffs', label: 'Jetson in its bay on its own standoffs, fan unobstructed' },
  { id: 'c-uart', label: 'UART link up: 3 M-F jumpers from the HAT\'s vacated Pi dock (8→Jetson 10, 10←Jetson 8, 6→6) — or ESP32 USB-C → Jetson USB' },
  { id: 'c-no5v', label: "Nothing feeding the Orin from the driver board's 5 V rail (Pi-only)" },
  { id: 'c-barrel', label: 'Pigtail: UPS free XH2.54 socket → Jetson barrel — meter the socket first (~11–12.6 V, note +), then the barrel (center +) BEFORE first plug-in' },
  { id: 'c-lidar', label: 'LiDAR: sensor → driver LiDAR IN · LiDAR USB-C → Jetson USB-A (or stock: via the Audio HAT hub)' },
  { id: 'c-cams', label: 'Cameras: pan-tilt USB cam + OAK-D Lite → Jetson USB-A' },
  { id: 'c-common-gnd', label: 'Common ground verified (driver GND ↔ Jetson GND)' },
  { id: 'c-volt', label: 'Battery voltage measured at both rails before first boot' },
  { id: 'c-uart-dev', label: 'Jetson: /dev/ttyTHS1 up at 115200, ugv_jetson talks to the ESP32' },
];

export const PROVENANCE: { label: string; note: string }[] = [
  { label: 'Waveshare wiki/store — driver boards + Audio Driver Board', note: 'board ID: UGV Rover/Beast/RaspRover ship the ROS Driver (ugv_base_ros README); connector list, MP8759GD 5V/5A buck; Audio HAT = SSS1629A5 USB codec + FE1.1S/CH340 hub + fan header, multi-system' },
  { label: 'Waveshare wiki — UGV Beast Jetson Orin AI/ROS2 kits', note: 'kit wiring, UPS activation gotcha, USB cameras (pan-tilt 5MP + OAK-D Lite), assembly split' },
  { label: 'NVIDIA Orin Nano carrier spec SP-11324-001 v1.3 (local PDF)', note: 'barrel 5.5×2.5 mm 9–20 V 45 W, PCB 100×79 mm, M2.5 hex standoffs 4.5×6.57 mm; hole XY only in gated P3768 design files' },
  { label: 'ROS Driver for Robots schematic (vector PDF)', note: '40-pin net names (P_TX/P_RX/IIC), bridge chips, bucks — extracted programmatically via PyMuPDF' },
  { label: 'Waveshare labeled callout diagram — ROS Driver for Robots (local PNG)', note: "official front/back product diagram, callouts 1–19: settles which USB-C is which (6 = ESP32/host, silkscreen USB; 7 = LiDAR bridge, silkscreen LIDAR), names both host headers (14/15), and gives the board silkscreen for every connector" },
  { label: 'Owner inspection + Waveshare CAD (UGV Beast PT & Jetson Orin STEP, data/hardware-cad-assets)', note: 'stack bottom→top = Pi 5 inverted → Audio HAT → ROS Driver; FAN-2507 integral to the HAT (cutout + screws); HAT+driver pair unchanged in the Jetson variant; deck 231.54 × 159.96 mm' },
  { label: 'repo docs/beast-ops.md + src/data/hangar.ts', note: 'BEAST-01 decisions: NVMe boot, UART jumpers, "the Orin cannot use this (5V) rail", chassis hotspots' },
  { label: 'ugv_jetson firmware source', note: '115200 baud JSON host link, /dev/ttyTHS* on Orin' },
  { label: 'Luxonis docs + Livox Mid-360S specs + livox_ros_driver2', note: 'OAK-D Pro power/Y-adapter/mounts; Mid-360S Ethernet/M12, 9–27 V, FOV, ROS2 driver' },
  { label: 'Power research (Waveshare UPS 3S wiki, Molicel/Samsung datasheets, JetsonHacks)', note: '3S1P ceiling, cell options, ideal-diode ORing, V-mount + 15 V PD trigger split-rail pattern' },
];

/** Recovered board documents served by the app (public/datacore). */
export const DOCUMENTS: { label: string; file: string; note: string }[] = [
  { label: 'ROS Driver for Robots — labeled callout diagram', file: DRIVER_CALLOUT_IMAGE, note: 'official Waveshare front/back product diagram, callouts 1–19 — the physical-ID reference (437 KB)' },
  { label: 'ROS Driver for Robots — schematic', file: '/datacore/pdfs/ROS_Driver_for_Robots.pdf', note: 'the ESP32 board on BEAST — ICM-20948, CH343P ×2, ESP32-WROOM-32UE (1 MB)' },
  { label: 'General Driver for Robots — schematic', file: '/datacore/pdfs/General_Driver_for_Robots.pdf', note: 'the older WAVE ROVER-era sibling — near-identical layout, CP2102 bridges (985 KB)' },
  { label: 'Servo Driver with ESP32 — schematic', file: '/datacore/pdfs/Servo_Driver_with_ESP32_Schematic.pdf', note: 'bus-servo expansion board (478 KB)' },
  { label: 'Bus servo control circuit', file: '/datacore/pdfs/Bus_servo_control_circuit.pdf', note: 'excerpt for custom designs (139 KB)' },
  { label: 'RPi Motor Driver Board — schematic', file: '/datacore/pdfs/RPi-Motor-Driver-Board-Schematic.pdf', note: 'older MC33886 HAT (101 KB)' },
  { label: 'Jetson Orin Nano carrier board spec', file: '/datacore/pdfs/jetson_orin_nano_carrier_board_spec.pdf', note: 'SP-11324-001 v1.3 incl. mechanical chapter (957 KB)' },
];

export interface CameraCandidate {
  name: string;
  kind: 'zoom' | 'thermal';
  pick: 'top' | 'alt';
  spec: string;
  linux: string;
  price: string;
  verdict: string;
}

/** Shortlist to replace the pan-tilt 5MP camera (researched 2026-07-23). */
export const CAMERA_CANDIDATES: CameraCandidate[] = [
  {
    name: 'ELP 10× zoom USB (IMX415)', kind: 'zoom', pick: 'top',
    spec: '4K · 5–50 mm motorized 10× optical · rides the existing pan-tilt bracket',
    linux: 'true UVC — zoom via v4l2-ctl zoom_absolute, ROS2 v4l2_camera just works',
    price: '~$100–150',
    verdict: 'Top zoom pick: no vendor SDK, no CSI port used, cheap.',
  },
  {
    name: 'Arducam PTZ (IMX477)', kind: 'zoom', pick: 'alt',
    spec: '12 MP CSI · real optical zoom + own pan-tilt servos (full bracket replacement)',
    linux: 'CSI + I2C control via vendor Python scripts — no ROS2-native path',
    price: '~$70–90',
    verdict: 'Alt: most integrated, but costs the CSI port + custom glue code.',
  },
  {
    name: 'FLIR Lepton 3.5 + PureThermal 3', kind: 'thermal', pick: 'top',
    spec: '160×120 radiometric · 8.7 Hz (export cap) · ~10 g — trivial for the bracket',
    linux: 'native UVC out of the box; Lepton controls via UVC extension unit',
    price: '~$250',
    verdict: 'Top thermal pick — and the overall pick if buying one: heat vision is the capability nothing else on BEAST has; OAK-D Pro already covers "look closer".',
  },
  {
    name: 'Topdon TC001', kind: 'thermal', pick: 'alt',
    spec: '256×192 radiometric · 25 Hz · 30 g',
    linux: 'not UVC — PyThermalCamera decode + v4l2loopback glue (Linux/Pi pedigree)',
    price: '~$200–250',
    verdict: 'Alt: better res + frame rate, at the cost of custom driver glue.',
  },
];

export const OPEN_ITEMS: string[] = [
  'Power record set straight (2026-07-24): the pack runs Molicel P30B ×3 (3.0 Ah, 30 A) and NO power problems were ever observed on the Pi build — the earlier "brownout" framing was a misreading of a planning request. The Power Planner is forward-looking (Jetson + future loads). Worth doing anyway: baseline INA219 pack telemetry before the conversion.',
  'UART pin numbers (8/10/6) follow the standard Pi/Jetson header convention — high-confidence, but the wiki never states the pins explicitly.',
  'Jetson carrier mounting-hole XY coordinates are unpublished — NVIDIA gates them inside the P3768 Altium/KiCad design files (login required). Official standoff spec is known (M2.5 hex 4.5×6.57 mm); measure the pattern and record it in the Mount tab.',
  'UPS arming: sources describe both "plug the 12.6 V charger once" and "press the onboard BOOT button" as the wake step for a fresh pack — do whichever brings it alive.',
  "D500 socket answered (2026-07-27): the pigtail is in the Audio HAT's LiDAR port — the stock kit route, CH340 → FE1.1S hub → the one HAT USB cable. The driver board's own LiDAR pair (UART IN at callout 11, USB-C at callout 7) is therefore idle; moving the lidar onto it is still a valid option if you want the scan off the shared cable, not a repair.",
  'The labeled callout diagram names TWO host headers on the driver board — 15 "Host controller connection header" and 14 "Host controller 40PIN extended header", both drawn as 2×20 sockets — while the console models one and owner inspection found no usable spare 40-pin on the assembled robot. Look at the board in hand before planning to tap 14; the Orin UART jumpers go into the HAT\'s vacated Pi dock either way.',
  'The HAT\'s integral FAN-2507 runs off the HAT fan header, fed from the 40-pin 5 V — that rail stays live without the Pi, but verify the fan spins on first Orin power-up before buttoning up.',
  'No public schematic exists for the RPI Audio HAT for Robots — Waveshare documents it component-level only (SSS1629A5, FE1.1S, CH340, APA2068). Its full PCB geometry is in the kit STEP (data/hardware-cad-assets) if a drawing is ever needed.',
  'The 65×65 mm / 49×58 mm mounting figures come from the General Driver page — the ROS Driver appears identical, but verify with calipers before drilling.',
  'Board port positions in the Live Plug view are diagrammatic, not physical silkscreen coordinates.',
  '"360S lidar" is interpreted as the Livox Mid-360S — the only literal name match found. If you actually meant a UART 360° upgrade (e.g. Waveshare STL27L), that one IS a drop-in for the D500\'s ZH1.5T-4P/CH343P path.',
];

export const INTEGRITY_NOTE =
  'Data-integrity flag resolved (2026-07-23): the backup branch data/hardware-cad-assets had deduplicated both ' +
  '"connection" PDFs onto one LFS object, losing the ROS Driver original. Fresh copies of all board PDFs were ' +
  're-downloaded from Waveshare/NVIDIA and now ship with the app under Documents below.';
