#!/usr/bin/env bash
set -euo pipefail

apply=false
if [[ "${1:-}" == "--apply" ]]; then apply=true; shift; fi
if [[ $# -ne 0 ]]; then echo "usage: $0 [--apply]" >&2; exit 2; fi
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
mode=DRY-RUN
if $apply; then mode=APPLY; fi
echo "$mode: no recorder unit will be enabled."

show_file() { diff -u "$2" "$1" 2>/dev/null || true; }
install_file() {
  local source=$1 target=$2 mode=$3
  echo "$mode: $source -> $target"
  [[ -e "$target" ]] && show_file "$source" "$target"
  $apply || return 0
  install -D -m "$mode" "$source" "$target"
}
echo "$mode: create /data/beast, /var/lib/beast/storage, /etc/beast/recording, /usr/local/lib/beast-storage"
if $apply; then
  install -d -o root -g root -m 0711 /data
  install -d -o beast -g beast -m 0750 /data/beast /data/beast/recordings /data/beast/recordings/blackbox /data/beast/recordings/missions /data/beast/datasets /data/beast/maps /data/beast/models /data/beast/recovery-staging
  install -d -o root -g beast -m 0750 /var/lib/beast/storage
  install -d -o root -g root -m 0755 /etc/beast/recording /usr/local/lib/beast-storage
fi
install_file "$root/storage/beast_storage.py" /usr/local/lib/beast-storage/beast_storage.py 0755
install_file "$root/storage/beast_record" /usr/local/lib/beast-storage/beast_record 0755
install_file "$root/storage/storage.env" /etc/beast/storage.env 0644
install_file "$root/storage/blackbox.topics" /etc/beast/recording/blackbox.topics 0644
install_file "$root/storage/mission.topics" /etc/beast/recording/mission.topics 0644
install_file "$root/systemd/beast-storage-prepare.service" /etc/systemd/system/beast-storage-prepare.service 0644
install_file "$root/systemd/beast-storage-maintenance.service" /etc/systemd/system/beast-storage-maintenance.service 0644
install_file "$root/systemd/beast-storage-maintenance.timer" /etc/systemd/system/beast-storage-maintenance.timer 0644
install_file "$root/systemd/beast-blackbox-record.service" /etc/systemd/system/beast-blackbox-record.service 0644
install_file "$root/systemd/beast-mission-record@.service" /etc/systemd/system/beast-mission-record@.service 0644
if $apply; then
  ln -sf /usr/local/lib/beast-storage/beast_storage.py /usr/local/bin/beast-storage
  systemctl daemon-reload
  systemctl disable beast-blackbox-record.service beast-mission-record@.service
fi
