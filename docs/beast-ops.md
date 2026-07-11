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
- **Lower computer:** ESP32 — motion (PID), stock pan-tilt servo bus, sensor feedback.
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
| `http://192.168.20.184:5000` | **Control UI** (drive, FPV, gimbal) | Use Google Chrome. Open in a normal browser — works fine. |
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

1. **Web app (`:5000`)** — teleop, FPV, and pan-tilt gimbal. Drive it manually. *(done — it drives)*
2. **JupyterLab (`:8888`)** — official lesson notebooks: motion, camera/CV (face/object/line/
   gesture), and gimbal control. This is where you learn to program it.
3. **JSON command API** — `/json` Socket.IO. Script motion and gimbal control; this is also
   the integration point if the Hangar ever gains a (supervised) command view.
4. **ROS2 stack** (optional, separate install, port `:5100`) — SLAM, mapping, nav, even
   LLM-driven natural-language control. Bigger jump.

## Jetson migration and flash runbook — OP-JETSON-FLASH

> **Status: R36.5 FLASHED; PROVISIONING IN PROGRESS — verified 2026-07-11.** The Intel Raptor Lake
> host successfully flashed QSPI and the 2 TB NVMe, and `beast-01` booted Jetson Linux R36.5 from
> `/dev/nvme0n1p1`. Key-based SSH works over the normal L4T USB gadget. JetPack compute, Docker,
> ROS 2, the Waveshare workspace, and Beast bench validation remain incomplete because the staged
> `beast` account needs one recovery-mode sudo credential repair. BEAST-01 still physically runs
> the Raspberry Pi 5 stack until those gates pass and the Jetson is installed.

### Target and non-goals

- Flash **JetPack 6.2.2 / Jetson Linux 36.5** to the Jetson Orin Nano developer kit's NVMe.
  The prepared release must report `R36, REVISION: 5.0` and an Ubuntu 22.04 root filesystem.
- The directly sold NVIDIA developer kit contains the development module **P3767-0005**, not the
  production P3767-0003 module. Use `BOARDID=3767`, `BOARDSKU=0005`, and `FAB=300` if a manual
  identity override is required.
- Use the supported `jetson-orin-nano-devkit-super` configuration so the finished system has the
  Super power profiles available; select a conservative power mode during stationary bench work.
- Flash QSPI/UEFI boot firmware and the NVMe root filesystem together from one clean BSP tree.
- Continue directly through JetPack compute, Docker/NVIDIA Container Runtime, ROS 2 Humble, and
  the official Waveshare workspace. The migration is not minimally viable at "Ubuntu boots."
- Do **not** install JetPack 7. JP7 remains out of scope until the JP6 Beast path is working,
  backed up, and deliberately reopened for experimentation.
- Do **not** burn fuses to enable USB 3 recovery, modify EEPROM contents, enable Secure Boot, or
  add rootfs A/B or encryption during this recovery. Those are separate, irreversible or
  complexity-increasing changes.
- Do **not** use the current Pi/Flask service as proof that the Jetson path works. The cutover is
  complete only after the ROS workspace, zero-motion telemetry, and physical stop behavior pass.

### What the audit established

- Recovery mode is proven: the host has repeatedly enumerated `0955:7523 NVIDIA Corp. APX`.
- The module reports T234 chip SKU `D5` and RAM code `2`, consistent with an 8 GB Orin Nano.
- NVIDIA's automatic detector received a 256-byte EEPROM response but parsed no board ID, FAB,
  SKU, or revision. That proves a parsing/read problem, not yet that every EEPROM byte is blank.
- The downloaded `Jetson_Linux_R36.5.0_aarch64.tbz2` and
  `Tegra_Linux_Sample-Root-Filesystem_R36.5.0_aarch64.tbz2` match NVIDIA's published SHA-1 hashes.
- A generated package from the failed path selected the production-module kernel DTB
  `p3767-0003`; that was wrong for this NVIDIA developer kit. No package from that tree is reusable.
- The formatted override `RAMCODE_ID=00:00:00:02` caused a local Python conversion failure.
  More importantly, overriding RAM code was unnecessary because the chip supplied numeric `2`.
- NVIDIA's R36.5 Quick Start ends the Orin Nano Super NVMe command in `internal`, while the
  general flashing guide shows `external`. The bundled R36.5 tooling explicitly supports both
  with `--external-device` and generates an external-storage PARTUUID in either case. This runbook
  follows the board-specific Quick Start command exactly and verifies the generated UUID artifacts.
- The Podman image contained the correct NVIDIA user-space packages, but still used Nobara's
  kernel USB stack, device namespace, network interfaces, and NFS facilities. Container NFS and
  the raw USB `-110` timeout therefore do not implicate the downloaded JetPack release.
- No prior attempt reached a QSPI or NVMe partition write. The observed failures occurred while
  building images, starting container NFS, sending an RCM blob, or querying target storage.

The original `USBDEVFS_CONTROL ... -110` symptom was ambiguous. The corrected signed-payload
captures now assign it below Docker, QEMU, VFIO, and the guest kernel, but do not yet distinguish the
EVO AMD controller/physical path from the Jetson BootROM endpoint. The Intel control below changes
exactly that boundary rather than assuming the cable or Jetson is at fault.

### Attempt ledger — 2026-07-11 EVO whole-controller run

This is the chronological record of the first run against the native Ubuntu VM. Keep failed
boundaries here as evidence; do not summarize them later as a successful flash.

1. Refetched and read the live `coldaine-k8cluster` configuration, then connected to
   `pve-evo-x2` and gathered host facts before allocation. The host reported Proxmox VE 9.2.2,
   kernel `7.0.2-6-pve`, 32 CPU threads, 30 GiB host-visible RAM, and active guests 112, 113,
   and 1202. The reduced host-visible RAM is the EVO iGPU carve-out, not missing DIMMs.
2. Confirmed exactly one recovery device: `0955:7523 NVIDIA Corp. APX`. Sysfs mapped it to PCI
   function `c8:00.4`, an AMD Strix Halo xHCI controller isolated by itself in IOMMU group 31.
   An earlier in-session statement called this group 32; the sysfs recheck corrected it to 31.
   The controller carried no Proxmox management NIC, storage, or other USB device.
3. Left the EVO control plane (VM 113) and observability guest (CT 1202) running. Gracefully
   stopped the EVO Talos worker (VM 112) to free physical memory for the attended flash window.
4. Downloaded the current Ubuntu 22.04 release cloud image from Ubuntu and created temporary VM
   900, `evo-jetson-flasher-r365`: q35/OVMF, host CPU, 8 vCPU, 12 GiB fixed RAM, 140 GiB disk on
   `vmdata`, VLAN 30 VirtIO networking, and `hostpci0=0000:c8:00.4,pcie=1`. The Proxmox host then
   showed `c8:00.4` bound to `vfio-pci`; Ubuntu 22.04.5 with kernel `5.15.0-185-generic` showed
   the same controller at guest PCI `01:00.0` using `xhci_hcd` and APX on guest USB bus 9.
5. Installed the BSP prerequisites, complete kernel modules, QEMU guest agent, RNDIS/CDC modules,
   rpcbind, and the NFS server. Disabled the guest firewall for the attended session, enabled
   IPv6, set USBFS memory to 2048 MiB, and disabled global USB autosuspend.
6. Copied only the two R36.5 archives into the clean VM. Their SHA-1 values matched NVIDIA:
   `96e691a6d2d618e22dd6cb0630ee17faaa4733e9` for the BSP and
   `7844cfc00ef92eeb85d699d17bcb787a1560d486` for the sample root filesystem. Extracted a new
   `Linux_for_Tegra`, ran `l4t_flash_prerequisites.sh` and `apply_binaries.sh`, and verified the
   staged target reports `R36, REVISION: 5.0`.
7. Pre-created headless user `beast`, hostname `beast-01`, and an SSH authorized key in the staged
   rootfs. NVIDIA's helper printed its generated temporary password to the terminal; that password
   was immediately replaced with a new discarded random credential. Key-based SSH is the intended
   first-boot path and the printed credential is invalid.
8. Generated `bootloader/readinfocmd.txt` using the known NVIDIA developer-kit package identity
   `BOARDID=3767`, `BOARDSKU=0005`, and `FAB=300`. The first read-only probe read ECID
   `0x80012344705E021D2C00000003008240`, then timed out while sending `bct_br`. It created no fresh
   `cvm.bin`; therefore no three-dump stability claim can be made. No QSPI or NVMe write occurred.
9. Applied the complete community mitigation rather than only its global half: fully stopped and
   restarted VM 900 to reset the passed controller, restored USBFS 2048 MiB and global autosuspend
   `-1`, set every USB device and root hub `power/control` to `on`, and set every
   `autosuspend_delay_ms` to `-1`. APX re-enumerated normally. The second read-only probe read the
   same ECID and failed at the same `Sending bct_br` boundary. It again created no `cvm.bin` and
   wrote nothing to QSPI or NVMe.
10. Started offline package generation with the bounded known identity plus the independently
    established chip values `CHIP_SKU=00:00:00:D5` and numeric `RAMCODE_ID=2`. The first offline
    invocation omitted those chip values and correctly stopped at chip-info parsing; its output
    was discarded. The corrected invocation selected kernel/UEFI DTB
    `tegra234-p3768-0000+p3767-0005-nv-super.dtb`, the expected P3767-0003 BPMP DTB, QSPI layout
    `flash_t234_qspi.xml`, NVMe layout `flash_l4t_t234_nvme.xml`, and external APP UUID generation.
    It exited successfully with `Finish generating flash package`. Inspection confirmed a 2.4 GiB
    external package, 11 MiB internal QSPI package, 2,282,183,740-byte sparse `system.img`, and
    matching image SHA-1 `15cda47639be08efa6e214c7d59fb6129dc343c3`. `abootimg` showed the
    external boot command line uses `root=PARTUUID=a08cd0ca-4707-4e72-bc04-8691205bb435`, exactly
    matching `bootloader/l4t-rootfs-uuid.txt_ext`; the saved parameters target `nvme0n1p1` and end
    in `jetson-orin-nano-devkit-super internal`. A scan of the saved command and generated package
    found no fuse-burn command. Exactly one APX device remained attached. The package is ready for
    `--flash-only` after the physical transport variable and recovery state are changed.
11. Upgraded VM 900 from Ubuntu's 5.15 GA kernel to the 6.8 HWE kernel and repeated the read-only
    probe. It read the same ECID and failed at the same first `bct_br` transfer, so the result is not
    specific to the older guest kernel.
12. Captured the failed VM transaction with `usbmon`. Descriptor reads completed, then
    `tegrarcm_v2` submitted one 8,192-byte bulk OUT transfer beginning
    `42435442 f76f0ad8 ee33a8f2`. After about ten seconds it completed as `-2` with actual length
    zero: userspace cancelled an URB for which the host stack had reported no transferred bytes.
13. Removed VM and VFIO from the transaction. Stopped VM 900, rebound `c8:00.4` to the Proxmox
    7.0 host's `xhci_hcd`, and ran the complete generated NVIDIA read-info environment directly on
    `pve-evo-x2`. The host generated and submitted the same signed 8,192-byte payload, including the
    same leading bytes, and again completed zero bytes before cancellation. This is a valid native
    control; an earlier standalone `tegrarcm_v2` test that sent a zero-filled BCT was incomplete and
    is not evidence. No storage write occurred in either native test.

The Intel control below closed this diagnosis: the same signed BCT completed immediately on Intel,
so the Jetson, cable, recovery sequence, and payload were not the cause of the EVO timeout. Do not
reuse the EVO Strix Halo controller for Jetson recovery flashing unless a later firmware or kernel
change passes the read-only BCT control first.

### Successful local Intel flash — 2026-07-11

1. Moved the same cable and recovery-mode Jetson to the Nobara workstation. APX enumerated on the
   Intel Alder Lake PCH xHCI controller `8086:51ed` at PCI `00:14.0`, USB path `3-2`, using Nobara
   kernel `7.1.3-200.nobara.fc44.x86_64`.
2. Ran the exact signed read-only environment. The first 8,192-byte BCT beginning
   `42435442 f76f0ad8 ee33a8f2` completed `8192/8192`, followed by MB1, PSC, MB2, fuse, and EEPROM
   operations. This assigns the EVO failures to its AMD Strix Halo USB path rather than the Jetson.
3. Streamed the prepared Ubuntu-generated R36.5 tree locally, preserving the rootfs and generated
   QSPI/NVMe images while excluding only obsolete large intermediate images. Reverified external
   `system.img` SHA-1 `15cda47639be08efa6e214c7d59fb6129dc343c3`, the R36.5 release line, and
   the `jetson-orin-nano-devkit-super` `nvme0n1p1` parameters.
4. Adapted Nobara's service name at runtime from NVIDIA's expected `nfs-kernel-server` to Fedora's
   `nfs-server`; NFS, rpcbind, IPv6, and host firewall restoration passed preflight. The firewall
   was stopped only for the attended flash and restored afterward; NVIDIA's temporary exports were
   removed.
5. The first two write attempts stopped before storage access. `usbmon` proved the copied
   `bootloader/br_bct_BR.bct` had been reset to a zero template by later `--read-info` probes even
   though the immutable internal QSPI BCT remained valid. The Jetson accepted the 8 KiB transfer,
   reset, and cancelled MB1 with `-108`. This was a generated-tree lifecycle error, not USB loss.
6. Regenerated only the RCM-boot artifacts with `BOARDID=3767`, `BOARDSKU=0005`, `FAB=300`,
   `CHIP_SKU=00:00:00:D5`, and `RAMCODE_ID=2`. Nobara OpenSSH no longer supports NVIDIA's legacy
   DSA host-key generation, so the local recovery-ramdisk script skipped only that obsolete key and
   retained RSA, ECDSA, and Ed25519. The regenerated boot BCT SHA-1
   `063ef50bfb883fd1bb8daece5ac01e9302f778a0` then matched `images/internal/flash.idx` exactly.
7. Ran `l4t_initrd_flash.sh --flash-only --showlogs --network usb0`. RCM boot reported
   `last_boot_error: 0`, sent the 104.6 MB blob, exposed `0955:7035`, brought SSH up at
   `fc00:1:1:0::2`, and identified the target as a 2 TB Micron 2400 NVMe.
8. NVIDIA reported `Successfully flashed the external device`, `Successfully flashed the QSPI`,
   `Flashing success`, and `Flash is successful` after 4 minutes 15 seconds. Every programmed QSPI
   payload reported a matching SHA-1. The host firewall returned active and the NFS export list
   returned empty after cleanup.
9. Normal boot enumerated `0955:7020 NVIDIA L4T`, and key-based SSH reached `beast@192.168.55.1`.
   Verified hostname `beast-01`, Jetson Linux `R36, REVISION: 5.0`, root filesystem
   `/dev/nvme0n1p1` as ext4, APP PARTUUID `a08cd0ca-4707-4e72-bc04-8691205bb435`, and APP expanded
   to 1.9 TiB.

Remaining blocker: the earlier discarded random password hash left `beast` in the `sudo` group but
without a usable sudo credential, and root-key SSH is disabled. Re-enter recovery once, RCM-boot the
validated initrd without invoking any flash command, mount the NVMe rootfs, install a narrowly
owned passwordless-sudo rule for the SSH-key-only `beast` account, unmount, and reboot normally.
Then continue immediately with JetPack compute, Docker, ROS 2 Humble, `ugv_ws`, and bench safety
validation. Do not reflash storage for this credential repair.

### First-boot configuration and persistence inventory

Audited after the successful flash on 2026-07-11:

- `beast` accepts the local `laptop-extra@coldaine-fleet` Ed25519 key with fingerprint
  `SHA256:6DUbgRuhTmZ/uTVXpLN/VPf2gPoiFIy2WPBXfaBRp4k`. This is **not** the
  `SSH_PUBKEY_PATRICK_DESKTOP` key currently stored in Doppler. The working private key remains on
  the local workstation; neither it nor a Jetson-specific replacement key was written to Doppler.
- Doppler `secrets_managment/dev` has no `BEAST_*` or `JETSON_*` administrator credential. The
  existing `PVE_EVO_X2_ROOT_PASSWORD` enabled the Proxmox work, and the existing
  `UDM_WIFI_MOOSEGOOSEIOT` / `UDM_WIFI_CASTLEMOOSEGOOSE` PSKs are available for later network
  configuration, but no secret value belongs in this runbook.
- The normal L4T USB gadget is reachable at `192.168.55.1`; onboard Ethernet `enP8p1s0` and Wi-Fi
  `wlP1p1s0` are down. The current network-map identity `beast` / `192.168.20.184` still belongs to
  the Pi-hosted BEAST-01 and must not silently move to the Jetson before physical cutover and a live
  UniFi/DHCP check.
- Timezone is `Etc/UTC` and NTP is not synchronized while the Jetson has no upstream network.
- `nvpmodel` reports the 25 W mode. Select and record a conservative stationary bench mode only
  after sudo repair; do not guess a mode number from another Jetson release.
- Base `nvidia-l4t-*` R36.5 packages are installed, but the `nvidia-jetpack` meta-package, Docker,
  ROS 2 Humble, and `ugv_ws` are not yet installed. This is why the state is “provisioning in
  progress,” not Beast-ready.
- The validated local flash tree and logs are under `/home/coldaine/jetson-r365-flash` (about
  11 GiB). The successful host log is `local-flash3.log`; the external image still hashes to
  `15cda47639be08efa6e214c7d59fb6129dc343c3`. These files are persistent on the workstation but
  are not a backup.
- A second generated tree remains on stopped Proxmox VM 900 at
  `/home/ubuntu/jetson-flash/Linux_for_Tegra` (about 24 GiB), with the same external image hash and
  internal BCT index. VM 900 is stopped, EVO's `c8:00.4` controller is returned to `xhci_hcd`, and
  Talos worker VM 112 is running. A VM disk on the same fleet is a second copy, not an independent
  backup.
- The local Nobara-only DSA compatibility edit lives inside the local BSP tree, and the temporary
  service-name wrapper lives under `/tmp/jetson-flash-bin`; neither is a reusable repository tool.
  Their required behavior is recorded in the successful-flash ledger above.
- Durable source documentation and Hangar content are pushed on PR #117. They are not on `main`
  until that PR is reviewed and merged.

### Flash-host architecture — Proxmox with the whole xHCI controller

Use a disposable native Ubuntu 22.04 x86_64 VM on Proxmox. Pass an entire physical USB xHCI
controller to the VM as a PCI device with VFIO. Do **not** configure `usb0: host=0955:7523`, USB
vendor/product filters, SPICE USB redirection, an LXC, Docker, or Podman.

This distinction matters: the VM's Ubuntu kernel must own the controller and every transition
from APX to the L4T initrd composite device and USB network interface. Individual USB forwarding
asks QEMU or Proxmox to reacquire each new USB identity; whole-controller PCI passthrough does not.

This architecture is valid in general, but the 2026-07-11 native-host control proves that rebuilding
VM 900 cannot resolve the current EVO failure: the same transfer fails below the VM boundary on the
same AMD controller. Resume this architecture only on a controller that first passes the read-only
`bct_br` control.

On the Proxmox host, verify IOMMU and inventory the controllers:

```bash
dmesg | grep -Ei 'DMAR|IOMMU|AMD-Vi|interrupt remapping'
find /sys/kernel/iommu_groups -type l
lspci -nnk | sed -n '/USB controller/,+3p'
lsusb -t
```

Map the physical port to its PCI controller and inspect the complete IOMMU group. The selected
controller must not carry the Proxmox boot disk, management NIC, keyboard, UPS, or other required
USB devices. If no onboard controller is isolated, install a dedicated PCIe USB controller; do
not use ACS override to manufacture unsafe isolation.

Create the temporary VM with these minimums:

```text
Ubuntu 22.04 x86_64
q35 machine
4-8 vCPUs
8 GiB RAM or more
120 GiB or larger ext4 guest filesystem
VirtIO network with internet access
the complete xHCI PCI function as hostpci
```

Attach the verified controller, substituting the real VM ID and PCI address:

```bash
qm set <vmid> --machine q35
qm set <vmid> --hostpci0 0000:<bus:device.function>,pcie=1
```

With the VM running, the Proxmox host must show that PCI function bound to `vfio-pci`, while the
Ubuntu guest must show the same controller using `xhci_hcd`:

```bash
lspci -nnk -s <bus:device.function>
lsusb -t
```

### Prepare the Ubuntu guest

Do not install or run Docker in the flashing VM. Install the complete Ubuntu kernel modules and
the BSP's own prerequisite list, then verify the services that initrd flashing actually uses:

```bash
sudo apt update
sudo apt install -y linux-modules-extra-"$(uname -r)" rpcbind nfs-kernel-server
sudo modprobe rndis_host
sudo modprobe cdc_ether
sudo modprobe cdc_ncm
sudo modprobe cdc_subset

sudo systemctl enable --now rpcbind nfs-kernel-server
test "$(sysctl -n net.ipv6.conf.all.disable_ipv6)" = 0
systemctl is-active rpcbind nfs-kernel-server
rpcinfo -p localhost
```

Temporarily disable the guest firewall and any guest VPN during the flash, or explicitly allow
the initrd IPv6, SSH, and NFS traffic. Apply the proven USB timeout mitigations **inside the
Ubuntu guest**, because that guest now owns the USB kernel stack:

```bash
sudo ufw disable
echo 2048 | sudo tee /sys/module/usbcore/parameters/usbfs_memory_mb
echo -1 | sudo tee /sys/module/usbcore/parameters/autosuspend
for control in /sys/bus/usb/devices/*/power/control; do
  echo on | sudo tee "$control"
done
```

The 2048 MB USBFS value is a successful community workaround for the same large-blob timeout,
not an NVIDIA release requirement. Keep it because the failed host logged `-110` during RCM.
This VM is a dedicated flash appliance: keep it only for retries within the same attended flash
session, then destroy it when the session succeeds or is abandoned. Do not reuse it for general
workloads or save it as a template with its firewall disabled and USB power policy altered.

### Build one clean R36.5 BSP

Transfer only the two verified NVIDIA archives into `~/jetson-r36.5-clean` in the VM. Do not copy
the old extracted tree, `system.img`, `tools/kernel_flash/images`, SDK Manager containers, or
generated flash packages.

Verify the official SHA-1 values inside the VM:

```bash
mkdir -p ~/jetson-r36.5-clean
cd ~/jetson-r36.5-clean
sha1sum -c <<'SHA1SUMS'
96e691a6d2d618e22dd6cb0630ee17faaa4733e9  Jetson_Linux_R36.5.0_aarch64.tbz2
7844cfc00ef92eeb85d699d17bcb787a1560d486  Tegra_Linux_Sample-Root-Filesystem_R36.5.0_aarch64.tbz2
SHA1SUMS
```

Extract and stage the BSP:

```bash
tar -xpf Jetson_Linux_R36.5.0_aarch64.tbz2
sudo tar -xpf Tegra_Linux_Sample-Root-Filesystem_R36.5.0_aarch64.tbz2 \
  -C Linux_for_Tegra/rootfs
cd Linux_for_Tegra
sudo ./tools/l4t_flash_prerequisites.sh
sudo ./apply_binaries.sh
head -1 rootfs/etc/nv_tegra_release
```

The release line must contain `R36` and `REVISION: 5.0`. Pre-create the headless account without
putting a password in the runbook or shell history:

```bash
read -rsp 'Temporary BEAST-01 password: ' BEAST_TEMP_PASSWORD; echo
sudo ./tools/l4t_create_default_user.sh \
  -u beast -p "$BEAST_TEMP_PASSWORD" -n beast-01 --accept-license
unset BEAST_TEMP_PASSWORD
```

This bypasses interactive OEM setup. First boot must still verify that the APP partition expanded
to the NVMe's usable capacity. NVIDIA's script has no stdin or file-based password option: while
it runs, another local user or process in the flash VM can read the temporary password from its
command line. Use a unique one-time password in this dedicated VM, change it immediately after
first login with `passwd`, and destroy the VM after the attended flash session.

Before connecting the recovery session, record:

```text
Developer-kit product/order number:
Module/carrier markings visible without disassembly:
NVMe manufacturer and model:
Proxmox node, xHCI PCI address, and physical USB port:
VM ID and Ubuntu kernel version:
USB cable or hub used:
```

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

### Read identity before generating images

Use the official read-info path; do not infer "blank EEPROM" from SDK Manager's summary. Generate
the read-only command using the known developer-kit package identity. The terminal `internal`
argument below belongs only to `flash.sh` command generation and does not configure NVMe boot:

```bash
sudo env BOARDID=3767 BOARDSKU=0005 FAB=300 \
  ./flash.sh --read-info --no-flash jetson-orin-nano-devkit-super internal
```

Run the generated probe three times, preserving each raw CVM dump. Wait for APX to return between
runs instead of sleeping for an assumed duration:

```bash
cd bootloader
set -euo pipefail
sudo rm -f cvm.bin
rm -f ../cvm-{1,2,3}.bin ../read-info-{1,2,3}.log ../chkbdinfo-*.log

for attempt in 1 2 3; do
  sudo rm -f cvm.bin
  sudo bash readinfocmd.txt 2>&1 | tee "../read-info-${attempt}.log"
  sudo test -s cvm.bin || { echo 'read-info did not create a fresh cvm.bin'; exit 1; }
  sudo cp cvm.bin "../cvm-${attempt}.bin"
  sudo test -s "../cvm-${attempt}.bin"
  timeout 30 bash -c 'until lsusb -d 0955:7523 >/dev/null; do sleep 1; done' || {
    echo 'APX did not return after read-info'; exit 1;
  }
done
sha256sum ../cvm-*.bin
cmp -s ../cvm-1.bin ../cvm-2.bin && cmp -s ../cvm-1.bin ../cvm-3.bin || {
  echo 'EEPROM dumps are not stable'; exit 1;
}

parse_failed=0
for dump in ../cvm-{1,2,3}.bin; do
  for mode in i f k r; do
    if ! sudo ./chkbdinfo "-${mode}" "$dump" 2>&1 | \
      tee "../chkbdinfo-$(basename "$dump" .bin)-${mode}.log"; then
      parse_failed=1
    fi
  done
done
echo "chkbdinfo parse_failed=${parse_failed}"
cd ..
```

Interpret the result narrowly:

- Different dumps or read timeouts mean the USB path is not yet trustworthy; do not override it.
- Stable dumps that parse as `3767 / 300 / 0005` need no manual EEPROM override.
- Stable dumps with missing identity fields support a bounded software override using the known
  NVIDIA developer-kit identity. Preserve the dumps for NVIDIA support; do not write the EEPROM.
- Chip SKU D5 and RAM code 2 are read independently from the chip. Do not force either value in
  the primary command while those reads continue to succeed.

### Generate the exact QSPI plus NVMe package

If the CVM parser remains malformed, generate with only the necessary identity override:

```bash
sudo env \
  SKIP_EEPROM_CHECK=1 \
  BOARDID=3767 \
  BOARDSKU=0005 \
  FAB=300 \
  ./tools/kernel_flash/l4t_initrd_flash.sh \
    --no-flash \
    --external-device nvme0n1p1 \
    -p "-c ./bootloader/generic/cfg/flash_t234_qspi.xml" \
    -c ./tools/kernel_flash/flash_l4t_t234_nvme.xml \
    --showlogs \
    --network usb0 \
    --erase-all \
    jetson-orin-nano-devkit-super \
    internal
```

If all EEPROM fields parse correctly, run the same command without the four `env` assignments.
Require a clean generation and verify all of the following before any write:

- Board ID `3767`, FAB `300`, SKU `0005`, chip SKU D5, and RAM code 2.
- Kernel/UEFI DTB `tegra234-p3768-0000+p3767-0005-nv-super.dtb`.
- QSPI layout `bootloader/generic/cfg/flash_t234_qspi.xml`.
- External layout `tools/kernel_flash/flash_l4t_t234_nvme.xml` and `nvme0n1p1`.
- The external image uses the UUID in `bootloader/l4t-rootfs-uuid.txt_ext` and a
  `root=PARTUUID=...` command line that resolves to the NVMe APP partition.

The P3767-0005 configuration intentionally reuses a P3767-0003 **BPMP** DTB. That one BPMP name
is expected; a P3767-0003 kernel/UEFI DTB is not.

Return the board to APX if necessary, verify only one recovery device is attached, and flash the
already generated package:

```bash
lsusb -d 0955:7523
sudo ./tools/kernel_flash/l4t_initrd_flash.sh \
  --flash-only --showlogs --network usb0
```

In separate guest terminals, monitor `dmesg -wH`, `udevadm monitor --kernel --udev`, `lsusb`, and
`ip -6 -br addr`. The expected transition is APX `0955:7523`, then L4T initrd `0955:7035`, then a
USB network interface and SSH/NFS over IPv6, followed by QSPI and NVMe writes. Keep barrel power
and USB connected until completion. The recovery jumper must already be absent.

### Stop conditions and fault isolation

Use the transition point to choose the next investigation; do not stack unrelated workarounds:

| Last proven boundary | Investigate next |
|---|---|
| APX never appears in Ubuntu | recovery sequence, physical port, cable, VFIO assignment |
| EEPROM dumps differ | controller/cable/USB transport; do not conclude EEPROM corruption |
| Blob timeout; UART shows BPMP/DRAM fatal | generated identity/config or target hardware |
| APX disappears; `0955:7035` never appears | initrd boot or USB gadget failure |
| `0955:7035` appears; no network interface | Ubuntu RNDIS/CDC modules |
| USB network exists; SSH fails | guest IPv6/interface configuration |
| SSH works; NFS fails | guest NFS service, firewall, VPN, or exports created by the tool |
| Initrd runs; `nvme0n1` is absent | NVMe seating, slot, model compatibility, or target PCIe |

Stop immediately if generation names P3767-0003 as the kernel DTB, the external image does not
use the external PARTUUID, a write target is not QSPI plus `nvme0n1p1`, or any fuse command
appears. If the corrected package still times out before initrd, capture the Jetson debug UART at
115200 8N1 on the next attempt;
that distinguishes a host USB timeout from target-side BPMP/DRAM failure.

### First-boot acceptance

After a successful flash and normal power cycle without the recovery jumper:

```bash
set -euo pipefail
passwd
mkdir -p ~/beast-acceptance
head -1 /etc/nv_tegra_release | tee ~/beast-acceptance/nv-tegra-release.txt
findmnt -no SOURCE,TARGET / | tee ~/beast-acceptance/root-mount.txt
findmnt -no SOURCE / | grep -q nvme
lsblk -o NAME,MODEL,SIZE,FSTYPE,MOUNTPOINTS | tee ~/beast-acceptance/lsblk.txt
grep '^TNSPEC ' /etc/nv_boot_control.conf | tee ~/beast-acceptance/tnspec.txt
grep -q '3767-300-0005' ~/beast-acceptance/tnspec.txt
sudo nvbootctrl dump-slots-info | tee ~/beast-acceptance/nvbootctrl.txt
dpkg --audit
sudo apt update
sudo apt-get check
sudo apt install nvidia-jetpack
dpkg --audit
sudo apt-get check

dpkg-query -W nvidia-jetpack 'cuda-*' 'libnvinfer*' 'libcudnn*' 'libnvvpi*' \
  | tee ~/beast-acceptance/jetpack-packages.txt
nvcc --version | tee ~/beast-acceptance/cuda.txt
python3 -c 'import tensorrt as trt; print(trt.__version__)' \
  | tee ~/beast-acceptance/tensorrt.txt
sudo nvpmodel -q --verbose | tee ~/beast-acceptance/nvpmodel.txt
set +e
sudo timeout --signal=INT 5 tegrastats --interval 1000 \
  | tee ~/beast-acceptance/tegrastats.txt
tegrastats_status=${PIPESTATUS[0]}
set -e
test "$tegrastats_status" -eq 0 || test "$tegrastats_status" -eq 124
test -s ~/beast-acceptance/tegrastats.txt
```

Acceptance requires:

- Jetson Linux reports `R36, REVISION: 5.0`.
- `/` is mounted from the NVMe and the APP filesystem has expanded to the expected capacity.
- `TNSPEC` contains `3767-300-0005`, with no empty identity fields or P3767-0003.
- QSPI/UEFI boots repeatedly without APX or a manual boot override.
- `apt-get check`, `dpkg --audit`, and `nvidia-jetpack` complete successfully before any blanket
  `apt upgrade` or `apt full-upgrade`.
- The package capture contains installed CUDA, TensorRT (`libnvinfer`), cuDNN, and VPI packages;
  `nvcc` and the TensorRT Python import print versions without errors.
- `nvpmodel` prints the selected profile, and at least three `tegrastats` samples show live CPU,
  memory, temperature, and GPU fields.
- The later zero-motion ESP32 probe captures voltage, IMU, and raw odometry before any motion test.

Install Docker Engine and NVIDIA Container Toolkit only **after** the native JetPack package state
is healthy. Use Docker's Ubuntu repository rather than Ubuntu's older `docker.io` package, then
install NVIDIA Container Toolkit from NVIDIA's repository. After those repositories are
configured according to their linked vendor instructions, install and prove the runtime:

```bash
sudo apt install docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
docker info --format '{{json .Runtimes}}'
sudo docker run --rm --runtime=nvidia ubuntu:22.04 \
  bash -lc 'cat /etc/nv_tegra_release && ls /dev/nvhost* >/dev/null'
```

Do not use `nvidia-smi` as the acceptance test: Jetson's integrated GPU is not managed like a
desktop PCIe card. Add a matching L4T CUDA container and run `deviceQuery` before GPU workloads.

### Jetson UART gate and Beast software

The current Waveshare architecture already puts wheel control, encoders, IMU, battery telemetry,
servo handling, and the motor stop on the ESP32 lower computer. Do not port Raspberry Pi GPIO,
I2C, PWM, or motor-control code that the Beast does not use. The Jetson replaces the Pi as the ROS
upper computer and talks to the same ESP32 at 115200 baud.

On the NVIDIA carrier board's **40-pin expansion header**, pin 8 is UART TX, pin 10 is UART RX,
and pin 6 is ground. These are unrelated to J14 recovery pins 9-10. The Linux device is
`/dev/ttyTHS1`, not the Pi workspace's `/dev/ttyAMA0`. Before connecting the Beast:

```bash
sudo systemctl disable --now nvgetty.service
sudo usermod -aG dialout "$USER"
# Log out and back in before the following checks.
ls -l /dev/ttyTHS1
```

With the Jetson powered off, loop pin 8 to pin 10, boot, and run a 115200-baud transmit/receive
loopback. Remove the loop only after powering off. R36.5 has a reported Orin Nano/NX DMA regression
on `serial@3100000`: if bytes do not loop back, first test the community-confirmed PIO workaround
that removes `dmas` and `dma-names` from that node. The narrower NVIDIA-proposed fix adds the
missing GPCDMA IOMMU property. Preserve the stock DTB and record which fix is necessary before
deploying either one. Do not lower the ESP32 protocol baud or invent a USB-UART replacement until
this test determines whether the onboard UART is actually affected.

Install ROS 2 Humble from the official Jammy ARM64 apt repository, including
`ros-humble-ros-base`, `python3-rosdep`, and `python3-colcon-common-extensions`. Initialize `rosdep`
once, then use the prepared Jetson adaptation branch instead of Waveshare's unmodified Pi defaults:

```bash
set -euo pipefail
sudo apt update
sudo apt install -y git ros-humble-ros-base python3-rosdep \
  python3-colcon-common-extensions

mkdir -p ~/beast
cd ~/beast
UGV_WS_COMMIT=a1a1d9cb882974de46905e17a2496cf4ab70089b
git clone --no-checkout https://github.com/Coldaine/ugv_ws.git
cd ugv_ws
git fetch origin "$UGV_WS_COMMIT"
git checkout --detach "$UGV_WS_COMMIT"
test "$(git rev-parse HEAD)" = "$UGV_WS_COMMIT"

source /opt/ros/humble/setup.bash
if [[ ! -f /etc/ros/rosdep/sources.list.d/20-default.list ]]; then
  sudo rosdep init
fi
rosdep update
rosdep install --from-paths src --ignore-src --rosdistro humble -r -y
colcon build --symlink-install
```

That branch is based on Waveshare `ros2-humble-develop-251125` at `037dfca`, makes the ESP32 and
LiDAR ports launch arguments, permits LiDAR-free base bring-up, and corrects `rclcpy` to `rclpy`.
It deliberately preserves Pi defaults for upstream compatibility. Do not blindly run
`build_first.sh` on the Jetson: it installs wildcard desktop, simulation, vision, and debug-symbol
packages and hard-codes its build path. Add those lanes only when the corresponding hardware test
reaches them.

Set `UGV_MODEL=ugv_beast`. Do not set `LDLIDAR_MODEL` until the fitted LiDAR label identifies
`ld06`, `ld19`, or `stl27l`. Use a stable `/dev/serial/by-id/...` path for USB LiDAR once observed.
Keep the vendor `ugv_jetson` Flask service disabled while ROS is running because both attempt to
own `/dev/ttyTHS1` and camera devices.

For the first hardware session, lift and secure the tracks, leave LiDAR and autonomous nodes off,
and start only base bring-up:

```bash
export UGV_MODEL=ugv_beast
source /opt/ros/humble/setup.bash
source ~/beast/ugv_ws/install/setup.bash
ros2 launch ugv_bringup bringup_lidar.launch.py \
  serial_port:=/dev/ttyTHS1 use_lidar:=false use_rviz:=false
```

With no `/cmd_vel` publisher running, capture one message from each zero-motion telemetry lane:

```bash
set -euo pipefail
mkdir -p ~/beast-acceptance/ros
rm -f ~/beast-acceptance/ros/*.txt
ros2 topic info /cmd_vel --verbose | tee ~/beast-acceptance/ros/cmd-vel-info.txt
grep -q '^Publisher count: 0$' ~/beast-acceptance/ros/cmd-vel-info.txt
timeout 15 ros2 topic echo /ugv/voltage --once \
  | tee ~/beast-acceptance/ros/voltage.txt
timeout 15 ros2 topic echo /imu/raw --once \
  | tee ~/beast-acceptance/ros/imu-raw.txt
timeout 15 ros2 topic echo /odom/odom_raw --once \
  | tee ~/beast-acceptance/ros/odom-raw.txt
test -s ~/beast-acceptance/ros/voltage.txt
test -s ~/beast-acceptance/ros/imu-raw.txt
test -s ~/beast-acceptance/ros/odom-raw.txt
```

The voltage must be finite and plausible for the connected Beast battery; IMU and odometry arrays
must be populated and update when the chassis is moved by hand. Stop if any lane times out or the
`/cmd_vel` topic already has an unexpected publisher.

Once the fitted LiDAR is identified, relaunch with `use_lidar:=true` and its stable `lidar_port`.
For the heartbeat test, keep the tracks lifted and clear, start exactly one publisher in a second
terminal, and begin at 0.02 m/s. Increase only enough to overcome motor deadband, never above
0.05 m/s during this test:

```bash
ros2 topic pub --rate 5 /cmd_vel geometry_msgs/msg/Twist \
  '{linear: {x: 0.02, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.0}}'
```

While the lifted tracks are turning steadily, press Ctrl+C in that publisher terminal and start a
timer. With no other publisher and without sending zero first, the ESP32 must stop the tracks
within its configured three-second heartbeat interval. After observing and recording that stop,
send an explicit zero with a subscriber wait:

```bash
ros2 topic pub /cmd_vel geometry_msgs/msg/Twist \
  '{linear: {x: 0.0, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.0}}' \
  --once -w 1
```

The lower-level failsafe exists in current `ugv_base_general`; it still requires this physical
validation. Camera, LiDAR, SLAM/Nav2, and web control follow only after the chassis gate.

### Remaining post-flash completion record

The flash facts above are verified. Before declaring the Jetson migration complete, add:

- The completed sudo repair and post-repair `apt-get check` / `dpkg --audit` result.
- Installed JetPack, CUDA, TensorRT, cuDNN, VPI, Docker, and NVIDIA runtime package versions.
- ROS 2 Humble / `ugv_ws` build, launch, and physical safety-validation results.

Until those gates pass, R36.5-on-NVMe is an operating fact but the Beast compute cutover is not.

### Research references

- NVIDIA JetPack 6.2.2 — https://developer.nvidia.com/embedded/jetpack-sdk-622
- NVIDIA Jetson Linux 36.5 release — https://developer.nvidia.com/embedded/jetson-linux-r365
- NVIDIA Jetson Linux 36.5 flashing support — https://docs.nvidia.com/jetson/archives/r36.5/DeveloperGuide/SD/FlashingSupport.html
- NVIDIA R36.5 Quick Start (Orin Nano Super NVMe command) — https://docs.nvidia.com/jetson/archives/r36.5/DeveloperGuide/IN/QuickStart.html
- NVIDIA R36.5 supported modules — https://docs.nvidia.com/jetson/archives/r36.5/DeveloperGuide/index.html
- NVIDIA EEPROM layout — https://docs.nvidia.com/jetson/archives/r35.6.2/DeveloperGuide/HR/JetsonEepromLayout.html
- Proxmox PCI passthrough administration — https://pve.proxmox.com/pve-docs/pve-admin-guide.pdf
- Successful Orin Nano Proxmox whole-controller flash — https://git.ericxliu.me/eric/ericxliu-me/src/commit/3b723ecfad7d7f64f02d2e496c97fb79b29c8b61/content/posts/flashing-jetson-orin-nano-in-virtualized-environments.md
- NVIDIA forum: containerized external-storage flash limitations — https://forums.developer.nvidia.com/t/flashing-orin-from-inside-docker-container/352106
- NVIDIA forum: EEPROM override recovery — https://forums.developer.nvidia.com/t/cannot-flash-jetson-nano-orin-devkit-eeprom-error/278033
- NVIDIA forum: USBFS timeout workaround — https://forums.developer.nvidia.com/t/fix-for-error-might-be-timeout-in-usb-write-increase-usbfs-memory-mb-to-2048/360581
- NVIDIA forum: matching AMD-controller timeout resolved on Intel — https://forums.developer.nvidia.com/t/jetson-agx-orin-64gb-usb-timeout-on-flash-gui-broken-after-flash-sh-sdk-manager-no-sdks-on-windows/363988
- Linux usbmon documentation — https://docs.kernel.org/usb/usbmon.html
- NVIDIA forum: R36.5 Orin Nano/NX UART DMA fixes — https://forums.developer.nvidia.com/t/solved-uart-serial-port-not-working-after-upgradint-to-jetpack-6-2-2-orin-nano-nx/363837
- NVIDIA Container Toolkit install guide — https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html
- Docker Engine on Ubuntu — https://docs.docker.com/engine/install/ubuntu/
- ROS 2 Humble Ubuntu packages — https://docs.ros.org/en/humble/Installation/Ubuntu-Install-Debs.html
- Waveshare UGV Beast Jetson Orin ROS 2 — https://www.waveshare.com/wiki/UGV_Beast_Jetson_Orin_ROS2
- Prepared Jetson `ugv_ws` branch — https://github.com/Coldaine/ugv_ws/tree/beast/jetson-orin-nano-adaptation
- Reddit: recovery-mode jumper and cable lessons — https://www.reddit.com/r/JetsonNano/comments/1lqzjhu
- Reddit: NVMe model compatibility report — https://www.reddit.com/r/JetsonNano/comments/1hth1vo/booting_jetson_orin_nano_super_from_ssd/

## References

- Waveshare UGV Beast — https://www.waveshare.com/ugv-beast.htm
- `ugv_rpi` (Pi upper-computer code) — https://github.com/waveshareteam/ugv_rpi
- `ugv_base_general` / `ugv_base_ros` (ESP32 lower-computer code) — https://github.com/waveshareteam
