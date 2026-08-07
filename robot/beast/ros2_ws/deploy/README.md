# Deploying to BEAST-01

Merging to `main` does **not** put code on the robot — the robot runs its own
checkout at `/home/beast/beast/RobotOverview` under systemd. This directory is
the durable pipeline that closes that gap.

## The one command

From any clone of this repo (Windows Git Bash, Linux, macOS):

```bash
robot/beast/ros2_ws/deploy/deploy-to-beast.sh            # deploy origin/main
robot/beast/ros2_ws/deploy/deploy-to-beast.sh --verify-only   # drift check, read-only
```

`deploy-to-beast.sh` drives `beast-01-ts` (Tailscale — stable; never hardcode
LAN IPs) through four steps: fast-forward the on-robot checkout (refuses a
dirty tree), `colcon build --symlink-install` the base service packages
(`beast_power beast_base ugv_bringup ugv_cockpit`, override with `--packages`), install
`deploy/storage/` payloads and `deploy/systemd/` service/timer units + `daemon-reload`,
restart `beast-ros-base`, and `try-restart beast-cockpit` without activating an intentionally
disabled cockpit, then verify the live graph and exit non-zero on any broken contract.

The verification contract is what "landed" means:

- `beast-ros-base` active; `beast-cockpit` active unless intentionally disabled
- `beast_power` running and the **sole** publisher of `/ugv/voltage`
- `/ugv/charging_active` has a publisher
- `ugv_safety_monitor` absent (stripped 2026-08-07)
- INA219 config register no longer the `0x399F` factory value
- **drive path live**: a non-zero twist on `/cmd_vel_ui` while disarmed reaches
  `beast_base`'s callback (rejection logged) — node presence is not proof of
  this. 2026-08-07: a deploy restart wedged Fast DDS SHM between `twist_mux`
  and `beast_base` while every node check passed; the robot could not be
  driven until the next clean restart. The probe is motion-free (disarm →
  rejected burst → restores the prior gate state). If it FAILs on a freshly
  restarted stack, restart `beast-ros-base` once more and re-verify.

All ros2 CLI calls in the verify run under a UDP-only Fast DDS profile
(written to `/tmp/beast_verify_fastdds_udp.xml` on the robot) — the default
SHM transport proved unreliable for late-joining CLI participants on this
host and produced false FAILs.

Run `--verify-only` freely — no sudo, read-only, and it prints PASS/FAIL per
check. Run it *before* assuming any doc claim about the robot is current.

## House rules

- **Every robot-facing merge gets deployed the same day.** Open the PR, merge,
  then run the script. A merge without a deploy run is drift in progress —
  2026-08-07 proved this (the INA219 cutover sat undeployed while docs
  implied it was live).
- After a deploy, paste the script's dated verification output into the
  `docs/beast-ops.md` **Quick connect** block.
- The restart is a brief stack outage — deploy parked, never mid-mission.
- First-time Jetson setup follows the [Jetson UART gate and Beast software runbook](../../../../docs/beast-jetson-flash-runbook.md#jetson-uart-gate-and-beast-software). Use its `rosdep` procedure; this deploy script assumes the
  workspace already builds.

Future option (not built): a GitHub Actions runner on the tailnet running
`--verify-only` nightly and opening an issue on drift. The script's exit code
is already shaped for that.

## Other units here

`deploy/systemd/` also carries the cockpit, storage, and blackbox/mission
record units — installed by the same script step. `deploy/diagnostics/` holds
`power_log.py` (INA219 + `/ugv/voltage` CSV logger; **manual process, not a
service** — restart it after every reboot if a charge readout is wanted).
