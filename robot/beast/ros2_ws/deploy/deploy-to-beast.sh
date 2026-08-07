#!/usr/bin/env bash
# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0
#
# deploy-to-beast.sh — the durable path for landing repo changes on BEAST-01.
#
# Run from any checkout of this repo (Windows Git Bash / Linux / macOS):
#
#   robot/beast/ros2_ws/deploy/deploy-to-beast.sh [ref] [--packages "p1 p2"]
#   robot/beast/ros2_ws/deploy/deploy-to-beast.sh --verify-only
#
# What a full run does, over `ssh beast-01-ts` (Tailscale — stable; LAN IPs drift):
#   1. fetch + fast-forward the on-robot checkout to <ref> (default origin/main);
#      refuses to touch a dirty tree.
#   2. colcon build --symlink-install the affected packages
#      (default: beast_power beast_base ugv_bringup ugv_cockpit — the base
#      service set).
#   3. install deploy/storage payloads and systemd units, daemon-reload,
#      restart beast-ros-base and try-restart beast-cockpit (one sudo prompt).
#   4. verify the live graph (see --verify-only below) and print a dated
#      evidence block to paste into docs/beast-ops.md "Quick connect".
#
# --verify-only runs only step 4 (no sudo, read-only). Use it any time to
# detect drift between the repo and the robot — the checks below encode the
# contract the merged code promises:
#   * beast-ros-base active; beast-cockpit active unless intentionally disabled
#   * beast_power running and the SOLE publisher of /ugv/voltage
#   * /ugv/charging_active has a publisher
#   * ugv_safety_monitor is gone (strip 2026-08-07)
#   * INA219 config register is not the 0x399F factory value (soft warn)
#
# Honest limits: build runs on the Jetson (~minutes); the restart is a brief
# stack outage — run parked. sudo on the robot needs the beast password once.

set -euo pipefail

HOST="${BEAST_HOST:-beast-01-ts}"
REPO_DIR="/home/beast/beast/RobotOverview"
WS_DIR="$REPO_DIR/robot/beast/ros2_ws"
PACKAGES="beast_power beast_base ugv_bringup ugv_cockpit"
REF="origin/main"
VERIFY_ONLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --verify-only) VERIFY_ONLY=1 ;;
    --packages) shift; PACKAGES="${1:?--packages needs an argument}" ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) REF="$1" ;;
  esac
  shift
done

say() { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }

ssh_opts=(-o ConnectTimeout=10 -o BatchMode=yes)

run_verify() {
  say "verify live graph on $HOST"
  ssh "${ssh_opts[@]}" "$HOST" 'bash -s' <<'REMOTE'
# ROS setup scripts reference unbound vars; enable -u only after sourcing.
source /opt/ros/humble/setup.bash
source /home/beast/beast/RobotOverview/robot/beast/ros2_ws/install/setup.bash 2>/dev/null || true
set -u
fail=0
ok()   { printf 'PASS  %s\n' "$*"; }
bad()  { printf 'FAIL  %s\n' "$*"; fail=1; }
warn() { printf 'WARN  %s\n' "$*"; }

for svc in beast-ros-base beast-cockpit; do
  svc_state="$(systemctl is-active "$svc" 2>/dev/null || true)"
  if [ "$svc" = beast-cockpit ] \
      && [ "$svc_state" = inactive ] \
      && [ "$(systemctl is-enabled "$svc" 2>/dev/null || true)" = disabled ]; then
    warn "$svc inactive (operator-disabled)"
  elif [ "$svc_state" = active ]; then
    ok "$svc active"
  else
    bad "$svc ${svc_state:-not active}"
  fi
done

nodes="$(ros2 node list 2>/dev/null || true)"
echo "$nodes" | grep -qx '/beast_power' \
  && ok "beast_power running" || bad "beast_power not in node graph"
echo "$nodes" | grep -qx '/ugv_safety_monitor' \
  && bad "ugv_safety_monitor still running (strip not deployed)" \
  || ok "ugv_safety_monitor absent"

vpubs="$(ros2 topic info /ugv/voltage 2>/dev/null | awk '/Publisher count/ {print $3}')"
[ "$vpubs" = "1" ] && ok "/ugv/voltage has exactly 1 publisher" \
  || bad "/ugv/voltage publisher count = ${vpubs:-unknown}"
vowner="$(ros2 topic info /ugv/voltage -v 2>/dev/null | awk '/Node name/ {print $3; exit}')"
[ "$vowner" = "beast_power" ] && ok "/ugv/voltage published by beast_power" \
  || bad "/ugv/voltage published by ${vowner:-unknown}"

cpubs="$(ros2 topic info /ugv/charging_active 2>/dev/null | awk '/Publisher count/ {print $3}')"
[ "${cpubs:-0}" -ge 1 ] 2>/dev/null && ok "/ugv/charging_active has a publisher" \
  || bad "/ugv/charging_active has no publisher"

cfg="$(i2cget -y 7 0x41 0x00 w 2>/dev/null || true)"
if [ -z "$cfg" ]; then
  warn "INA219 unreadable on i2c-7 (sensor or wiring issue)"
elif [ "$cfg" = "0x9f39" ]; then
  warn "INA219 config still factory 0x399F — beast_power has not configured the chip"
else
  ok "INA219 configured ($cfg)"
fi

sample="$(timeout 6 ros2 topic echo --once /ugv/voltage 2>/dev/null || true)"
sample_present="$(printf '%s\n' "$sample" | awk -F': ' '/^[[:space:]]*present:/ {print $2; exit}')"
sample_voltage="$(printf '%s\n' "$sample" | awk -F': ' '/^[[:space:]]*voltage:/ {print $2; exit}')"
case "$sample_present" in
  true)
    [ -n "$sample_voltage" ] \
      && ok "/ugv/voltage live: ${sample_voltage} V" \
      || bad "/ugv/voltage present=true but voltage is missing"
    ;;
  false)
    bad "/ugv/voltage reports INA219 absent"
    ;;
  *)
    warn "no usable /ugv/voltage sample within 6 s"
    ;;
esac

exit "$fail"
REMOTE
}

if [ "$VERIFY_ONLY" = 1 ]; then
  run_verify
  exit $?
fi

say "1/4 sync robot checkout to $REF"
ssh "${ssh_opts[@]}" "$HOST" bash -s -- "$REPO_DIR" "$REF" <<'REMOTE'
set -euo pipefail
repo_dir="$1"
ref="$2"

git -C "$repo_dir" fetch origin --prune
if [ -n "$(git -C "$repo_dir" status --porcelain --untracked-files=all)" ]; then
  echo "on-robot tree is dirty; refusing to deploy" >&2
  exit 1
fi

target_sha="$(git -C "$repo_dir" rev-parse --verify "$ref^{commit}")"
git -C "$repo_dir" merge --ff-only "$ref"
actual_sha="$(git -C "$repo_dir" rev-parse HEAD)"
if [ "$actual_sha" != "$target_sha" ]; then
  echo "checkout is at $actual_sha, not requested ref $target_sha; refusing to build" >&2
  exit 1
fi
git -C "$repo_dir" log --oneline -1
REMOTE

say "2/4 colcon build: $PACKAGES"
ssh "${ssh_opts[@]}" "$HOST" "bash -lc 'cd \"$WS_DIR\" \
  && source /opt/ros/humble/setup.bash \
  && colcon build --packages-select $PACKAGES --symlink-install'"

say "3/4 install storage/systemd units + restart (sudo password prompt)"
# One ssh session so a single sudo timestamp covers install, reload, restart.
ssh -t "$HOST" "sudo -v \
  && sudo install -m 0644 '$WS_DIR'/deploy/systemd/*.service /etc/systemd/system/ \
  && sudo install -m 0644 '$WS_DIR'/deploy/systemd/*.timer /etc/systemd/system/ \
  && sudo '$WS_DIR'/deploy/storage/install.sh --apply \
  && sudo systemctl daemon-reload \
  && sudo systemctl restart beast-ros-base \
  && sudo systemctl try-restart beast-cockpit \
  && sleep 20"

say "4/4 post-deploy verification"
if run_verify; then
  say "deploy of $REF verified on $HOST"
  date -u '+Paste into docs/beast-ops.md Quick connect: deploy verified %Y-%m-%dT%H:%MZ'
else
  say "DEPLOYED BUT VERIFICATION FAILED — inspect before relying on the robot"
  exit 1
fi
