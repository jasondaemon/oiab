#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y gpsd gpsd-clients udev

install -m 0755 "$REPO_ROOT/scripts/oiab-gps-reacquire" /usr/local/sbin/oiab-gps-reacquire
install -m 0644 "$REPO_ROOT/systemd/oiab-gps-reacquire.service" /etc/systemd/system/oiab-gps-reacquire.service
install -m 0644 "$REPO_ROOT/systemd/oiab-gps-reacquire.timer" /etc/systemd/system/oiab-gps-reacquire.timer
install -m 0644 "$REPO_ROOT/deploy/gps/99-oiab-gps.rules" /etc/udev/rules.d/99-oiab-gps.rules

mkdir -p /etc/systemd/system/gpsd.socket.d
cat >/etc/systemd/system/gpsd.socket.d/oiab.conf <<'EOF'
[Socket]
ListenStream=
ListenStream=/run/gpsd.sock
ListenStream=[::]:2947
ListenStream=0.0.0.0:2947
SocketMode=0660
EOF

systemctl daemon-reload
udevadm control --reload-rules
systemctl enable --now gpsd.socket
systemctl enable --now oiab-gps-reacquire.timer
systemctl restart gpsd.socket
/usr/local/sbin/oiab-gps-reacquire || true

cat <<'EOF'
OIAB GPS host integration installed.

Behavior:
  - prefers stable /dev/serial/by-id GPS paths
  - restarts gpsd after USB GPS add/remove events
  - runs a periodic safety check every 60 seconds
  - exposes gpsd on TCP 2947 for the OIAB Docker container

Verify:
  gpspipe -w -n 5
  curl http://127.0.0.1:18120/api/location/current
EOF
