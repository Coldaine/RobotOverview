---
title: BEAST-01 Jetson Dual-Boot Evidence Dossier
audience: BEAST operators and AI agents planning Jetson OS experiments
status: reference
last_updated: 2026-07-01
---

# BEAST-01 Jetson Dual-Boot Evidence Dossier

This dossier records why a JetPack 7 experiment on BEAST-01 is acceptable only with a
tested destructive recovery path back to a known-good JetPack 6 Beast-control state.

Decision for this research branch: optimize for a same-2TB-NVMe dual boot, with
JetPack 6 as the primary Beast OS and JetPack 7 as the secondary experiment OS.
Treat the risk as acceptable only because firmware and storage recovery are planned
before the experiment.

## Evidence snapshot

| Area | Evidence | Operator implication |
|---|---|---|
| Current JetPack 7 | NVIDIA lists JetPack 7.2 with Jetson Linux 39.2, CUDA 13.2.1, TensorRT 10.16.2, and Ubuntu 24.04 as the current JetPack 7 release reviewed on 2026-07-01. | JP7 is a different OS generation from JP6 and should be treated as an experiment for the Waveshare stack. |
| Jetson ISO | NVIDIA's Orin Nano Quick Start says JetPack 7.2 uses a Jetson ISO USB installer and installs Jetson Linux onto attached target storage such as microSD or NVMe. | The ISO path is convenient, but it is an installer, not a live USB test drive. |
| Target erasure | The same Quick Start cautions that installing erases the selected target storage. | Do not select the production 2TB NVMe unless the JP6 backup and recovery gate are complete and the installer target is unambiguous. |
| Shared firmware | NVIDIA states the Orin Nano developer kit uses UEFI firmware stored in QSPI-NOR and that firmware must be compatible with the JetPack release being booted. | JP6 and JP7 roots on the same NVMe still share QSPI/UEFI firmware and boot variables. This is not a fully isolated dual boot. |
| JP7 firmware gate | NVIDIA says JetPack 7.2 requires JetPack 6.x-generation UEFI/QSPI before booting the JP7 ISO, and the installer may prompt for a QSPI capsule update. | A JP7 install can alter firmware state before the root filesystem install is complete. Capture JP6 firmware and boot state first. |
| Capsule update behavior | NVIDIA documents a 30-second `Y` prompt for outdated QSPI firmware and two capsule-update passes that may reboot. | Missing the prompt or losing power can create confusing failure modes. Use display or serial and stable power. |
| Recovery mode | NVIDIA's Orin Nano guide documents Force Recovery by software or by shorting Button Header pins 9 and 10, and SDK Manager flashing from an Ubuntu host. | Recovery access must be verified before the JP7 experiment begins. |
| Initrd flash | NVIDIA calls initrd flash the official method for Orin NX/Nano with NVMe external storage. | If SDK Manager cannot restore JP6, initrd flash is the supported fallback path. |

## Shared QSPI/UEFI risk

The dual-boot plan separates root filesystems, not firmware. On Orin Nano, the UEFI
firmware in QSPI-NOR, UEFI variables, bootloader slots, boot entries, and boot-order
state are shared across JP6 and JP7. JP7 may update QSPI from a JP6-era 36.x firmware
to a 39.x firmware during the ISO flow.

That does not make the experiment impossible, but it changes the recovery target.
The recovery goal is not byte-for-byte rollback of QSPI. The recovery goal is a
reproducible return to a working JP6 Beast-control state: JP6 firmware/OS flashed,
Waveshare services restored, Beast web UI and Jupyter reachable, UART telemetry
working, camera working, and a safe stop command confirmed.

## Actual failure modes found

| Failure mode | Source signal | Why it matters |
|---|---|---|
| QSPI capsule retry/loop | NVIDIA forum reports show capsule updates staged repeatedly when the firmware version did not bump, with the process aborting to prevent a boot loop. Another JP7.2 report says the capsule appeared to retry across several reboots before settling. | The operator may see repeated reboots and misread the state. Serial/display logs and stable power are required. |
| `nvidia-l4t-bootloader` post-install failure | JP7.2 Orin Nano reports show ISO installs failing at "Step 9/13 Updating boot firmware" while reinstalling `nvidia-l4t-bootloader`. | JP7 can leave a root filesystem partially installed and apt in a broken/half-configured state. |
| Stale or wrong `nv_boot_control.conf` compatibility | JP7.2 reports show `COMPATIBLE_SPEC` values such as `jetson-orin-nx-devkit-16gb` on an Orin Nano Super, causing board matching failure. Other forum logs show similar package failures when `COMPATIBLE_SPEC` does not match known boards. | Capture `/etc/nv_boot_control.conf` before the experiment and expect a reflash, not a small package fix, if board identity becomes inconsistent. |
| Downgrade/reflash friction | NVIDIA forum responses for downgrade/reflash trouble point users back to SDK Manager or manual driver-package/rootfs/initrd flash. | The recovery path must be prepared on an Ubuntu host before the experiment, not discovered after the robot is down. |

## Waveshare compatibility evidence

BEAST-01's current working control model is Waveshare host code talking JSON over UART
to an ESP32 lower controller. The relevant Waveshare evidence points at the JP6/Jammy
generation, not JP7/Noble:

- `waveshareteam/ugv_jetson` says it is the Jetson Orin Nano/Orin NX upper-computer app
  for Waveshare UGV robots including UGV Beast. Its README says it can be installed on
  pure Ubuntu 22.04 on Jetson, and its setup uses a Python virtual environment,
  `python3-venv`, `python3-pip`, Flask, JupyterLab, OpenCV, MediaPipe, serial, and
  WebRTC dependencies.
- NVIDIA's JetPack 6.x releases use Ubuntu 22.04-based root filesystems. Ubuntu 22.04's
  default Python generation is the Python 3.10 generation that Waveshare's JP6-era
  scripts implicitly target.
- `waveshareteam/ugv_ws` uses the `ros2-humble-develop` branch, references ROS2 Humble
  package names, and starts a `ugv_jetson_ros_humble` container for the ROS path.
  ROS2 Humble's binary Debian target is Ubuntu Jammy 22.04.
- JP7.2 uses Ubuntu 24.04 and a newer Jetson Linux base. That is useful for experiments,
  but it is not the compatibility baseline for Waveshare's current Beast-control path.

## Dual-boot conclusion

Same-NVMe dual boot is an acceptable research target only with these boundaries:

1. JP6 is primary. JP7 is secondary and disposable.
2. `/home` is not shared between JP6 and JP7.
3. `/data` may be shared only for operator data, logs, models, captures, and manifests.
4. Any JP7 installer step that would erase the entire 2TB NVMe is stopped unless the
   JP6 image backup has been verified and the operator accepts a destructive restore.
5. QSPI/UEFI changes are expected. The rollback is "reflash and restore JP6 Beast OS,"
   not "undo every firmware byte."

## Sources

- [NVIDIA JetPack SDK Downloads and Notes](https://developer.nvidia.com/embedded/jetpack/downloads)
- [NVIDIA Orin Nano Quick Start Guide](https://docs.nvidia.com/jetson/orin-nano-devkit/user-guide/latest/quick_start.html)
- [NVIDIA Orin Nano JetPack 6.x Update Path](https://docs.nvidia.com/jetson/orin-nano-devkit/user-guide/latest/update_firmware.html)
- [NVIDIA Orin Nano BSP Setup](https://docs.nvidia.com/jetson/orin-nano-devkit/user-guide/latest/setup_bsp.html)
- [NVIDIA Orin Nano How-to Guides](https://docs.nvidia.com/jetson/orin-nano-devkit/user-guide/latest/howto.html)
- [NVIDIA Jetson Linux Flashing Support, r36.5](https://docs.nvidia.com/jetson/archives/r36.5/DeveloperGuide/SD/FlashingSupport.html)
- [NVIDIA Jetson Linux UEFI Adaptation, r36.2](https://docs.nvidia.com/jetson/archives/r36.2/DeveloperGuide/SD/Bootloader/UEFI.html)
- [NVIDIA forum: JP7.2 Orin Nano bootloader failure thread](https://forums.developer.nvidia.com/t/jetpack-7-2-jetson-linux-r39-2-on-jetson-orin-nano-developer-kit-getting-started-and-feedback-thread/372151?page=3)
- [NVIDIA forum: JP7.2 installation crash](https://forums.developer.nvidia.com/t/jetpack-7-2-installation-crash/372102)
- [NVIDIA forum: QSPI capsule staging failure](https://forums.developer.nvidia.com/t/jetson-agx-orin-qspi-update-failing/373801)
- [NVIDIA forum: UEFI A/B capsule update boot loop after power loss](https://forums.developer.nvidia.com/t/36-4-0-uefi-a-b-capsule-update-bootloop-after-power-loss/357686)
- [NVIDIA forum: downgrade/reflash from JetPack 6](https://forums.developer.nvidia.com/t/how-to-downgrade-reflash-from-6-0-to-5-1-3-in-jetson-orin-nano/301037)
- [Waveshare `ugv_jetson`](https://github.com/waveshareteam/ugv_jetson)
- [Waveshare `ugv_ws` ROS2 Humble README](https://github.com/waveshareteam/ugv_ws/blob/ros2-humble-develop/README.md)
- [ROS2 Humble Ubuntu install docs](https://docs.ros.org/en/humble/Installation/Ubuntu-Install-Debs.html)
