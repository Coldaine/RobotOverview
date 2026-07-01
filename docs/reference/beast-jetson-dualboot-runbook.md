---
title: BEAST-01 Jetson Dual-Boot and Recovery Runbook
audience: BEAST operators
status: draft runbook
last_updated: 2026-07-01
---

# BEAST-01 Jetson Dual-Boot and Recovery Runbook

This runbook is for a Jetson Orin Nano / Orin Nano Super experiment on BEAST-01.
It assumes the target outcome is a same-2TB-NVMe dual boot:

- JetPack 6.x Beast OS: primary, working, default boot target.
- JetPack 7.x experiment OS: secondary, disposable, not trusted for Beast operation.
- Shared `/data`: operator data only.
- No shared `/home`.

Do not start a JetPack 7 install until the recovery gate below is complete.

## Hard rules

1. JP6 remains the Beast-control baseline.
2. JP7 is allowed to update shared QSPI/UEFI firmware.
3. The accepted rollback is destructive: Force Recovery, reflash JP6, restore Beast
   app/config/data, and revalidate operation.
4. The stock Jetson ISO may erase the selected target storage. If it only offers the
   entire 2TB NVMe as the install target, stop unless the backup has been verified and
   the operator explicitly accepts a wipe/restore.
5. Do not run Docker, Podman, or local containerized services on `icarus-laptop`.
   If the ROS2/Waveshare container path must be tested, use the Jetson itself or remote
   infrastructure.

## Recovery gate

Complete this gate before inserting any JP7 installer USB.

### 1. Capture the current JP6 state

Run these on the Jetson while JP6 is known-good:

```bash
mkdir -p ~/beast-recovery-capture/$(date +%Y%m%d)
cd ~/beast-recovery-capture/$(date +%Y%m%d)

cat /etc/nv_tegra_release | tee nv_tegra_release.txt
dpkg-query -W nvidia-l4t-core nvidia-l4t-bootloader nvidia-jetpack | tee nvidia-packages.txt
sudo nvbootctrl dump-slots-info | tee nvbootctrl-slots.txt
sudo cat /etc/nv_boot_control.conf | tee nv_boot_control.conf
sudo efibootmgr -v | tee efibootmgr-v.txt
lsblk -o NAME,SIZE,FSTYPE,FSVER,LABEL,UUID,PARTUUID,MOUNTPOINTS | tee lsblk.txt
sudo sgdisk -p /dev/nvme0n1 | tee nvme0n1-sgdisk.txt
sudo parted /dev/nvme0n1 unit MiB print | tee nvme0n1-parted.txt
findmnt -R / | tee findmnt-root.txt
systemctl list-unit-files | grep -Ei 'ugv|jupyter|nv|getty' | tee service-candidates.txt
```

Also capture the Beast app and repo state if present:

```bash
for repo in ~/ugv_jetson ~/ugv_ws ~/ugv_base_general; do
  if [ -d "$repo/.git" ]; then
    git -C "$repo" remote -v
    git -C "$repo" rev-parse HEAD
    git -C "$repo" status --short
  fi
done | tee waveshare-repos.txt
```

### 2. Make a restorable backup

Preferred backup: full NVMe image to another machine or external drive with enough space.

```bash
set -o pipefail
backup_stamp="$(date +%Y%m%d)"
backup_image="beast-jp6-nvme0n1-${backup_stamp}.img.zst"
sudo sgdisk --backup=beast-jp6-nvme0n1.gpt /dev/nvme0n1
sudo dd if=/dev/nvme0n1 bs=64M status=progress conv=fsync | zstd -T0 -19 -o "$backup_image"
sha256sum beast-jp6-nvme0n1.gpt "$backup_image" | tee beast-jp6-backup.sha256
```

Minimum backup if a full image is impossible:

```bash
sudo rsync -aHAX --numeric-ids / /mnt/beast-backup/rootfs/ \
  --exclude=/dev --exclude=/proc --exclude=/sys --exclude=/run \
  --exclude=/tmp --exclude=/mnt --exclude=/media --exclude=/lost+found

sudo rsync -aHAX /boot/ /mnt/beast-backup/boot/
sudo rsync -aHAX /etc/ /mnt/beast-backup/etc/
sudo rsync -aHAX /data/ /mnt/beast-backup/data/ 2>/dev/null || true
sudo rsync -aHAX ~/ugv_jetson/ /mnt/beast-backup/ugv_jetson/ 2>/dev/null || true
sudo rsync -aHAX ~/ugv_ws/ /mnt/beast-backup/ugv_ws/ 2>/dev/null || true
sudo rsync -aHAX ~/ugv_base_general/ /mnt/beast-backup/ugv_base_general/ 2>/dev/null || true
sudo find /data -xdev -maxdepth 4 -type f -printf '%p\t%s\n' 2>/dev/null | tee /mnt/beast-backup/data-manifest.tsv
```

The minimum backup must include `/boot`, `/etc`, Waveshare configs, service files,
repo refs, and a `/data` manifest.

### 3. Verify Force Recovery access

Use an Ubuntu x86_64 host with NVIDIA SDK Manager or Jetson Linux driver-package tools
ready. The host can be a dedicated Ubuntu host, VM with USB passthrough, or remote
bench machine. Do not rely on `icarus-laptop` local containers for this.

From the Jetson, if the OS still boots:

```bash
sudo reboot --force forced-recovery
```

From powered-off hardware:

1. Connect Jetson Orin Nano Developer Kit Button Header pins `9` and `10`.
2. Connect USB-C data to the Ubuntu host.
3. Apply barrel-jack power.
4. Remove the jumper after the host detects recovery mode.

Host verification:

```bash
lsusb | grep -Ei 'nvidia|0955|apx'
```

The gate passes only when the host sees the Jetson in recovery mode and the operator
has either SDK Manager or `Linux_for_Tegra` tools installed and ready.

### 4. Define acceptable restore

The JP7 experiment is approved only if this restore definition is acceptable:

1. Reflash JetPack 6.x firmware and OS.
2. Restore Beast app/config/data from the backup.
3. Confirm `http://<beast-ip>:5000` web UI.
4. Confirm `http://<beast-ip>:8888` JupyterLab.
5. Confirm UART telemetry from the ESP32 lower controller.
6. Confirm camera stream.
7. Send and observe safe stop command: `{"T":1,"L":0,"R":0}`.

## Target disk layout

Use labels and UUIDs in `/etc/fstab`; do not rely on partition numbers after repartitioning.

| Mount | Label | Purpose | Sharing |
|---|---|---|---|
| JP6 root | `BEAST_JP6_ROOT` | Production Beast OS and Waveshare control stack | JP6 only |
| JP7 root | `BEAST_JP7_ROOT` | Experimental JP7 OS | JP7 only |
| Shared data | `BEAST_DATA` | Logs, captures, models, source manifests, operator notes | Mounted by both |
| EFI/boot partitions | NVIDIA-created | Jetson boot artifacts and UEFI boot entries | Managed carefully |

Recommended sizing on a 2TB NVMe:

| Partition intent | Suggested size |
|---|---|
| JP6 root | 250-400 GiB |
| JP7 root | 250-400 GiB |
| `/data` | Remainder after boot/vendor partitions and roots |

## JP7 install procedure

1. Complete the recovery gate.
2. Attach display/keyboard or serial console so the QSPI/capsule prompts are visible.
3. Confirm the Jetson has stable power. Do not run firmware updates from a marginal
   battery state.
4. Boot JP6 one last time and export the capture bundle plus backup hashes off-device.
5. Boot the JetPack 7 ISO USB from UEFI Boot Manager. Press `Esc` at the NVIDIA splash,
   select Boot Manager, then select the USB device.
6. If the installer prompts for QSPI/UEFI capsule update, press `Y` before the 30-second
   timeout and wait through both passes/reboots.
7. At target selection, stop and inspect:
   - If the installer can target only the prepared `BEAST_JP7_ROOT` partition without
     touching JP6 root or `/data`, proceed.
   - If the installer only offers the entire NVMe device, stop unless the operator accepts
     destructive restore. The stock NVIDIA docs warn that the selected target storage is
     erased.
8. Install JP7 to the experiment root only.
9. Boot JP7 once, create a local operator account, and capture:

```bash
cat /etc/nv_tegra_release
dpkg-query -W nvidia-l4t-core nvidia-l4t-bootloader nvidia-jetpack
sudo nvbootctrl dump-slots-info
sudo cat /etc/nv_boot_control.conf
sudo efibootmgr -v
lsblk -f
```

1. Mount `/data` by UUID or label. Do not mount JP6 `/home` into JP7.
2. Reboot to JP6 from UEFI Boot Manager.
3. Set JP6 as the default boot target with UEFI Boot Maintenance Manager or
   `efibootmgr`, then reboot and confirm JP6 starts without manual selection.

## JP6 default boot check

On JP6:

```bash
sudo efibootmgr -v
findmnt /data
cat /etc/nv_tegra_release
npm run beast:probe
```

`npm run beast:probe` is expected to send only a safe stop and decode telemetry from
the current Pi/Beast path when run from this repo against the live Beast endpoint.
For the Jetson-hosted Beast path, use the equivalent Waveshare stop/telemetry probe.

## Destructive recovery procedure

Use this if JP7 breaks boot, leaves apt half-configured, updates QSPI into a bad state,
or erases the wrong storage.

### Option A: SDK Manager restore

1. Put the Jetson in Force Recovery.
2. Start SDK Manager on the Ubuntu host.
3. Select the exact developer-kit target, for example `Jetson Orin Nano [8GB developer kit version]`.
   Do not select a bare module profile for the developer kit carrier.
4. Select the JP6.x Jetson Linux/JetPack release chosen for Beast control.
5. Clear Host Machine if only target flashing is needed.
6. Select NVMe or SD target according to the restore plan.
7. Flash.
8. Complete first boot and restore backups.

### Option B: Initrd flash restore

Use the Jetson Linux driver package and sample rootfs for the JP6.x release on the
Ubuntu host. From `Linux_for_Tegra`, with the Jetson in Force Recovery:

```bash
sudo ./tools/kernel_flash/l4t_initrd_flash.sh \
  --external-device nvme0n1p1 \
  -p "-c ./bootloader/generic/cfg/flash_t234_qspi.xml" \
  -c ./tools/kernel_flash/flash_l4t_t234_nvme.xml \
  --showlogs \
  --network usb0 \
  jetson-orin-nano-devkit external
```

Adjust the board config only after confirming the exact module/carrier with NVIDIA's
support matrix and the hardware label. If a Super-specific config is required by the
chosen BSP, record it in the recovery log before flashing.

### Restore Beast state

After JP6 boots:

```bash
sudo rsync -aHAX --numeric-ids /mnt/beast-backup/rootfs/ /
sudo rsync -aHAX /mnt/beast-backup/boot/ /boot/
sudo rsync -aHAX /mnt/beast-backup/etc/ /etc/
sudo systemctl daemon-reload
sudo reboot
```

If restoring from a full image, restore the image from the backup host, then boot JP6
and run the validation checklist below.

## Validation checklist

JP6 is considered restored only when all items pass:

| Check | Pass condition |
|---|---|
| Boot | JP6 boots by default without manual UEFI selection. |
| Firmware state | `nvbootctrl dump-slots-info` and `/etc/nv_boot_control.conf` are captured after restore. |
| Web UI | Beast control UI responds. |
| Jupyter | JupyterLab responds. |
| Telemetry | ESP32 UART telemetry is decoded. |
| Camera | Video stream or camera capture works. |
| Safe stop | `{"T":1,"L":0,"R":0}` is sent and observed. |
| Data | `/data` mounts and the pre-experiment manifest is readable. |

## Sources

- [BEAST-01 Jetson Dual-Boot Evidence Dossier](./beast-jetson-dualboot-evidence.md)
- [NVIDIA Orin Nano Quick Start Guide](https://docs.nvidia.com/jetson/orin-nano-devkit/user-guide/latest/quick_start.html)
- [NVIDIA Orin Nano BSP Setup](https://docs.nvidia.com/jetson/orin-nano-devkit/user-guide/latest/setup_bsp.html)
- [NVIDIA Orin Nano How-to Guides](https://docs.nvidia.com/jetson/orin-nano-devkit/user-guide/latest/howto.html)
- [NVIDIA Jetson Linux Flashing Support, r36.5](https://docs.nvidia.com/jetson/archives/r36.5/DeveloperGuide/SD/FlashingSupport.html)
