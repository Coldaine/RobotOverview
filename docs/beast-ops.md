# BEAST-01 — Operations

Operating facts for the physical **UGV Beast** (`BEAST-01`) — how to reach it, drive it,
read its telemetry, and program it. The catalog entry for the unit lives in
`src/data/hangar.ts` (`id: 'beast'`). Facts below carry the date they were last verified;
re-verify against the live robot before relying on anything stale.

> The Hangar is growing an in-app supervised portal to the Beast (telemetry, video, teleop —
> North Star AG2, decided 2026-07-02). Until it ships, the robot's own dashboard below is the
> control surface. Human-in-the-loop always; nothing operates the robot unattended.

## Hardware chain

```
Browser / HTTP client  ──HTTP/WebSocket──▶  Raspberry Pi 5 (upper computer)
                                              │  Flask web app `ugv_rpi`, camera, strategy
                                              ▼  JSON over UART @115200
                                            ESP32 (lower computer)  ──▶ motors · servos · IMU · voltage
```

- **Upper computer:** Raspberry Pi 5 — vision, web UI, command relay. No CUDA; learned-policy
  inference lives offboard.
- **Lower computer:** ESP32 — motion (PID), servo bus (RoArm-M2), sensor feedback.
- **Software stack:** Waveshare `ugv_rpi` (standard, not ROS2). Server is Werkzeug / Python 3.11.

## Network

| Fact | Value | Verified |
|---|---|---|
| Hostname | `beast.local` | ⚠️ did not resolve from `icarus-laptop` on 2026-07-01 |
| IP | `192.168.20.184` | ✅ HTTP 200, 8-14 ms ping |
| Cross-VLAN reach | reachable from the dev workstation (different VLAN) | ✅ measured 2026-07-01 |
| DHCP reservation | fixed IP held on the UDM | ⚠️ per setup — confirm on the UDM |
| Source VLAN | CastleMooseGoose → robot VLAN (`192.168.20.x`) | ⚠️ per setup — confirm |

Use the raw IP as the operator path until mDNS/DNS is fixed. After a Beast reboot or a DHCP
renew, re-confirm it returns to `192.168.20.184` (that's what the reservation is for).

## Services & dashboards

| URL | What | Notes |
|---|---|---|
| `http://192.168.20.184:5000` | **Control UI** (drive, FPV, arm, gimbal) | Use Google Chrome. Open in a normal browser — works fine. |
| `http://192.168.20.184:8888` | **JupyterLab** | Interactive lesson notebooks (302 → `/lab?`). The programming on-ramp. |
| `http://192.168.20.184:5000/video_feed` | Raw MJPEG camera stream | Long-lived stream; inspect headers/frames with a client that can abort cleanly. |

### Video recovery note — OP-VIDEO-RELOCK

On 2026-06-30 the control UI and telemetry were healthy, but `/video_feed` hung before
sending HTTP headers. Root cause: the USB camera had re-enumerated after reboot/disconnect,
while Waveshare `cv_ctrl.py` hardcoded `cv2.VideoCapture(0)`. The camera was readable at
`/dev/video1` and also exposed a stable by-id path.

Live Beast patch: `/home/ws/ugv_rpi/cv_ctrl.py` now selects the first readable USB camera
from `/dev/v4l/by-id/*video-index0*`, then `/dev/video0..9`. Original backup:
`/home/ws/ugv_rpi/cv_ctrl.py.bak-20260630-OP-VIDEO-RELOCK`.

If video fails again:

```bash
curl -D - --max-time 3 -o /tmp/beast-video.bin http://192.168.20.184:5000/video_feed
ls -l /dev/video* /dev/v4l/by-id 2>/dev/null
v4l2-ctl --list-devices
tail -80 ~/ugv.log
```

Healthy verification from the dev workstation: `/video_feed` returns `HTTP 200` with
`multipart/x-mixed-replace; boundary=frame`, JPEG bytes begin after `--frame`, and `/ctrl`
telemetry reports `video_fps` around 32 fps.

Driving from the dashboard: keyboard (WASD), the on-screen joystick, or a USB/Bluetooth
**gamepad** read through the browser's Gamepad API on whatever machine has the page open.
(The bundled wireless gamepad can also pair straight to the Pi.)

## Control protocol (reverse-engineered from `control.js`)

Commands are JSON sent to the ESP32 via the Pi. The current build exposes Socket.IO as the
working control transport; the older HTTP helper route is no longer available.

- **Socket.IO:** namespace `/json`, event `json`, e.g. `socketJson.emit('json', {"T":1,"L":0,"R":0})`
- **Legacy HTTP route:** `GET /js?json=...` returned HTTP 404 on 2026-07-01; do not use it
  unless a future Pi build restores it.

Key payloads:

| Intent | JSON | Notes |
|---|---|---|
| Drive (differential) | `{"T":1,"L":<left>,"R":<right>}` | `L`/`R` = track speeds. **Magnitude scaling not yet characterized** — start small (≤0.2) and increase once measured. Capped server-side by `max_speed`/`slow_speed` in the Pi's `config.yaml`. |
| Stop | `{"T":1,"L":0,"R":0}` | App fires this on load. |
| Arm (RoArm-M2) | `{"T":<cmd_arm_ctrl_ui>,"E":..,"Z":..,"R":..}` | T-code from `config.yaml`. |
| Gimbal | `{"T":<cmd_gimbal_ctrl>,"X":..,"Y":..,"SPD":0,"ACC":128}` | T-code from `config.yaml`. |

**Safety:** a stale-command watchdog on the Beast auto-stops the tracks if no command
arrives within its timeout, so a single nudge then silence is self-safing. Still: lift the
tracks or ensure clear runway before any motion command, and send an explicit stop after.

Repeatable safe probe from this repo:

```powershell
npm run beast:probe
```

The default probe loads the robot's bundled Socket.IO client, connects to `/json` and `/ctrl`,
sends only `{"T":1,"L":0,"R":0}`, then prints decoded telemetry. It proves command-channel
control without moving the tracks.

Optional supervised nudge, only when physically with the robot and the runway is clear:

```powershell
npm run beast:probe -- --nudge --i-am-with-the-robot --clear-runway-confirmed
```

## Telemetry

Live feedback streams over Socket.IO namespace `/ctrl`: connect, emit `request_data`,
then read `update` events. (`/jsfb` is **not** exposed on this build — use `/ctrl`.) The
feed comes *from* the ESP32, so receiving it proves the lower controller and the Pi↔ESP32
serial link are both alive. Fields arrive as numeric keys; decoded values observed
2026-07-01 from `/config` and `npm run beast:probe`:

| Key | Reading | Value seen | Healthy? |
|---|---|---|---|
| `112` | Battery voltage | raw `1203` → **12.03 V** | ✅ 3S Li-ion |
| `111` | Wi-Fi RSSI | **-60 dBm** | ✅ usable |
| `107` | CPU temp | 54.3 °C | ✅ normal for Pi 5 |
| `106` | CPU load | 0.1 | ✅ low |
| `108` | RAM usage | 11.4 | ✅ normal |
| `113` | Video FPS | 30.5 | ✅ camera pipeline alive |
| `104` / `105` | Track speed L / R | 0.0 / 0.0 | stationary |
| `114` | feedback-OK flag | `true` | ✅ |

## Operating progression (Waveshare's recommended on-ramp)

1. **Web app (`:5000`)** — teleop, FPV, arm/gimbal. Drive it manually. *(done — it drives)*
2. **JupyterLab (`:8888`)** — official lesson notebooks: motion, camera/CV (face/object/line/
   gesture), arm kinematics. This is where you learn to program it.
3. **JSON command API** — `/json` Socket.IO. Script motion/arm; this is also
   the integration point if the Hangar ever gains a (supervised) command view.
4. **ROS2 stack** (optional, separate install, port `:5100`) — SLAM, mapping, nav, even
   LLM-driven natural-language control. Bigger jump.

## Jetson migration and flash runbook — OP-JETSON-FLASH

> **Status: UNVALIDATED — last updated 2026-07-11.** This is the next-attempt runbook, not a
> record of a successful flash. BEAST-01 still runs the Raspberry Pi 5 stack described above.
> Update this section with the exact successful command, hardware identifiers, timings, and
> first-boot evidence immediately after the Jetson passes bench validation.

### Target and non-goals

- Flash **JetPack 6.2.2 / Jetson Linux 36.5** to the Jetson Orin Nano developer kit's NVMe.
  The prepared release must report `R36, REVISION: 5.0` and an Ubuntu 22.04 root filesystem.
- Flash both QSPI/UEFI boot firmware and the NVMe root filesystem from one clean BSP tree.
- After first boot, install the JetPack compute stack, ROS 2 Humble, and the official
  Waveshare `ugv_ws`; that software setup is a separate post-flash operation.
- Do **not** install JetPack 7. JP7 remains out of scope until the JP6 Beast path is working,
  backed up, and deliberately reopened for experimentation.
- Do **not** use the current Pi/Flask service as proof that the Jetson path works. The cutover
  is complete only after the ROS workspace and physical stop behavior pass bench validation.

### Current evidence and unresolved gate

- Recovery mode is proven: the host has repeatedly enumerated `0955:7523 NVIDIA Corp. APX`.
- The module reports T234 chip SKU `D5` and RAM code `2`, consistent with an 8 GB Orin Nano.
- NVIDIA's automatic board detector read a 256-byte module EEPROM but found no usable board
  ID, FAB, SKU, or revision. That is abnormal for a developer kit. A manual EEPROM override is
  a valid recovery technique, but it is not a repair for the EEPROM.
- `BOARDID=3767`, `FAB=000`, and numeric `RAMCODE_ID=2` are supported by the observed hardware.
  `BOARDSKU` and the normal-versus-Super target profile remain gated on the developer kit's
  product/order number. Do not infer them from the empty EEPROM.
- No prior attempt reached a QSPI or NVMe partition write. The observed failures occurred while
  building images, starting container NFS, sending an RCM blob, or querying target storage.

Before creating the clean BSP, record:

```text
Developer-kit product/order number:
Module/carrier markings visible without disassembly:
NVMe manufacturer and model:
Host machine and physical USB port:
USB cable or hub used:
```

### Host gate — use native Ubuntu

Use a native x86_64 Ubuntu host supported by the JetPack 6.2.2 toolchain. Prefer a full Ubuntu
22.04 installation on a dedicated partition or external SSD. Do not use a VM, Distrobox,
Podman, or a hand-entered shell inside the SDK Manager image for the NVMe flash.

Why this gate exists:

- NVIDIA documents `l4t_initrd_flash.sh` as the NVMe path. It relies on host USB networking,
  NFS, SSH, and services that were not available inside the attempted Podman container.
- NVIDIA forum staff describe external-storage flashing from SDK Manager Docker as unstable.
- The attempted Nobara/Podman path repeatedly blocked in `tegrarcm_v2` before storage details
  returned. Reusing that path would preserve an unproven variable.

On the Ubuntu host, install prerequisites from the freshly extracted BSP instead of maintaining
a parallel package list:

```bash
cd Linux_for_Tegra
sudo ./tools/l4t_flash_prerequisites.sh
sudo systemctl enable --now rpcbind nfs-kernel-server
```

Apply the USB mitigations before connecting the recovery session. A 2026 NVIDIA forum report
found that the default 16 MB USBFS allocation could time out on the 22+ MB RCM blob even after
smaller transfers worked:

```bash
echo 2048 | sudo tee /sys/module/usbcore/parameters/usbfs_memory_mb
echo -1 | sudo tee /sys/module/usbcore/parameters/autosuspend
for control in /sys/bus/usb/devices/*/power/control; do
  echo on | sudo tee "$control"
done
```

Prefer a direct host USB port. If `Sending blob` still times out, retry once through a known-good
USB 2.0 hub or a different data-rated cable before changing images or board parameters.

### Build a clean JetPack 6.2.2 BSP

Do not reuse `jetson-flash/images`, `jetson-flash/workspaces`, generated `system.img` files, or
committed SDK Manager containers from the 2026-07-10/11 attempts. Retain them only as evidence
until the clean flash succeeds.

Download fresh official copies of:

- `Jetson_Linux_R36.5.0_aarch64.tbz2`
- `Tegra_Linux_Sample-Root-Filesystem_R36.5.0_aarch64.tbz2`

Extract and stage them in a new directory:

```bash
tar -xpf Jetson_Linux_R36.5.0_aarch64.tbz2
sudo tar -xpf Tegra_Linux_Sample-Root-Filesystem_R36.5.0_aarch64.tbz2 \
  -C Linux_for_Tegra/rootfs
cd Linux_for_Tegra
sudo ./apply_binaries.sh
head -1 rootfs/etc/nv_tegra_release
```

The release check must contain `R36` and `REVISION: 5.0`. Stop if it does not.

### Enter Force Recovery

J14 is the small 2x6 button header, not the 40-pin GPIO header. Pin 9 is ground; pin 10 is
`FORCE_RECOVERY`.

1. Connect a known-good USB-C data cable between the Jetson recovery port and host.
2. Disconnect barrel power and wait 10 seconds.
3. Short J14 pins 9 and 10.
4. Reconnect barrel power while the pins remain shorted.
5. Wait 2-3 seconds, then remove the jumper.
6. Expect the power LED but no normal display or fan behavior; the host USB result is the proof.
7. Verify on the host:

```bash
lsusb -d 0955:7523
```

Expected: `NVIDIA Corp. APX`. If APX is absent, do not run a flash command. If the kit is already
powered, hold 9-10, momentarily short J14 reset pins 7-8, release 7-8, wait 2-3 seconds, then
release 9-10.

### Resolve board identity before generating images

Use the product/order number and the R36.5 board-spec files to select the exact `BOARDSKU` and
target configuration. Record the evidence beside the selected values. The following is a
template, not permission to guess:

```bash
export SKIP_EEPROM_CHECK=1
export BOARDID=3767
export BOARDSKU=<verified-four-digit-sku>
export FAB=000
export CHIP_SKU=00:00:00:D5
export RAMCODE_ID=2
export RAMCODE=2
export JETSON_TARGET=<verified-jetson-orin-nano-devkit-target>
```

`RAMCODE_ID` must be the numeric value `2`, not the formatted string `00:00:00:02`; the latter
causes TegraFlash to fail locally before communicating with the board.

Stop and seek a hardware determination instead of flashing when the product number cannot
distinguish the candidate SKU/profile. If native Ubuntu reproduces the EEPROM and RCM failures,
preserve the logs for NVIDIA support or RMA rather than escalating manual EEPROM edits.

### Generate once, then flash natively

Run image generation first and require a clean exit:

```bash
sudo -E ./tools/kernel_flash/l4t_initrd_flash.sh \
  --no-flash \
  --external-device nvme0n1p1 \
  -c tools/kernel_flash/flash_l4t_t234_nvme.xml \
  -p "--no-systemimg -c bootloader/generic/cfg/flash_t234_qspi.xml" \
  --showlogs --network usb0 \
  "$JETSON_TARGET" internal
```

Before the physical write, confirm the generated logs name R36.5, the verified SKU/target,
RAM code `2`, QSPI, and `nvme0n1p1`. Then run the same command without `--no-flash`:

```bash
sudo -E ./tools/kernel_flash/l4t_initrd_flash.sh \
  --external-device nvme0n1p1 \
  -c tools/kernel_flash/flash_l4t_t234_nvme.xml \
  -p "--no-systemimg -c bootloader/generic/cfg/flash_t234_qspi.xml" \
  --showlogs --network usb0 \
  "$JETSON_TARGET" internal
```

Do not run concurrent generators against one BSP tree. Keep barrel power and USB connected until
the flasher reports completion. The recovery jumper must be absent before the final reboot.

### Stop conditions and fault isolation

Stop the attempt before changing another variable when any of these occurs:

- APX disappears before the flash starts.
- Board ID/SKU in the generated output differs from the verified product.
- `Sending blob` times out or the host logs USB error `-110`.
- `platformdetails storage storage_info.bin` does not return.
- NFS, RPC, USB networking, or SSH setup fails.
- The command begins targeting any storage other than QSPI plus `nvme0n1p1`.

Change one layer at a time:

1. For a blob timeout, capture host `dmesg`, confirm the 2048 MB USBFS limit and power settings,
   then change only the cable/port/USB 2.0 hub.
2. If the blob succeeds but storage enumeration fails, power off, reseat the NVMe, record its
   model, and test a known-compatible NVMe or microSD path before changing BSP parameters.
3. If the failure repeats on native Ubuntu with a clean BSP and alternate USB path, treat the
   blank EEPROM or module/carrier hardware as the leading fault and open an NVIDIA support/RMA
   case with the logs.

### First-boot acceptance

After a successful flash and normal power cycle without the recovery jumper:

```bash
head -1 /etc/nv_tegra_release
findmnt -no SOURCE,TARGET /
lsblk -o NAME,MODEL,SIZE,FSTYPE,MOUNTPOINTS
sudo apt update
sudo apt install nvidia-jetpack
```

Acceptance requires:

- Jetson Linux reports R36.5.
- `/` is mounted from the NVMe.
- QSPI/UEFI boots repeatedly without APX or a manual boot override.
- `nvidia-jetpack` installs successfully.
- A zero-motion ESP32 serial/telemetry probe succeeds before any ROS motion test.

### Required post-success update

Immediately after success, replace the `UNVALIDATED` banner with a verification date and record:

- Ubuntu host version and whether it was internal, external-SSD, or live media.
- Developer-kit product number, selected `BOARDSKU`, target configuration, and NVMe model.
- Exact successful command and any environment overrides.
- USB cable/port/hub and USBFS/power settings.
- Flash duration and the final success lines from the log.
- R36 release line, root mount source, and first-boot package state.
- Any step that was unnecessary, misleading, or missing.
- The ROS 2 Humble / `ugv_ws` provisioning and physical safety-validation result.

Until that amendment lands, this section remains a proposed recovery sequence, not an operating
claim.

### Research references

- NVIDIA JetPack 6.2.2 — https://developer.nvidia.com/embedded/jetpack-sdk-622
- NVIDIA Jetson Linux 36.5 flashing support — https://docs.nvidia.com/jetson/archives/r36.5/DeveloperGuide/SD/FlashingSupport.html
- NVIDIA forum: containerized external-storage flash limitations — https://forums.developer.nvidia.com/t/flashing-orin-from-inside-docker-container/352106
- NVIDIA forum: EEPROM override recovery — https://forums.developer.nvidia.com/t/cannot-flash-jetson-nano-orin-devkit-eeprom-error/278033
- NVIDIA forum: USBFS timeout workaround — https://forums.developer.nvidia.com/t/fix-for-error-might-be-timeout-in-usb-write-increase-usbfs-memory-mb-to-2048/360581
- Reddit: recovery-mode jumper and cable lessons — https://www.reddit.com/r/JetsonNano/comments/1lqzjhu
- Reddit: NVMe model compatibility report — https://www.reddit.com/r/JetsonNano/comments/1hth1vo/booting_jetson_orin_nano_super_from_ssd/

## References

- Waveshare UGV Beast — https://www.waveshare.com/ugv-beast.htm
- `ugv_rpi` (Pi upper-computer code) — https://github.com/waveshareteam/ugv_rpi
- `ugv_base_general` / `ugv_base_ros` (ESP32 lower-computer code) — https://github.com/waveshareteam
