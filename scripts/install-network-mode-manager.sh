#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  printf 'Run with sudo: sudo %s\n' "$0" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="${OIAB_NETWORK_CONFIG:-/data/oiab/config/network.env}"

if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y hostapd dnsmasq nftables iw rfkill
fi

install -m 0755 "$REPO_ROOT/scripts/oiab-network-manager.sh" /usr/local/sbin/oiab-network-manager
install -m 0755 "$REPO_ROOT/scripts/oiab-network-status" /usr/local/bin/oiab-network-status
install -m 0644 "$REPO_ROOT/systemd/oiab-network-manager.service" /etc/systemd/system/oiab-network-manager.service
install -m 0644 "$REPO_ROOT/systemd/oiab-hostapd.service" /etc/systemd/system/oiab-hostapd.service
install -m 0644 "$REPO_ROOT/systemd/oiab-dnsmasq.service" /etc/systemd/system/oiab-dnsmasq.service

mkdir -p "$(dirname "$CONFIG_FILE")"
if [[ ! -f "$CONFIG_FILE" ]]; then
  cat >"$CONFIG_FILE" <<'EOF'
# OIAB hotspot/network mode manager configuration.
OIAB_ETH_IFACE=eth0
OIAB_AP_IFACE=wlan0
OIAB_WAN_WIFI_IFACE=wlan1
OIAB_AP_SSID='Daemon Adventures'
OIAB_AP_COUNTRY=US
OIAB_AP_CHANNEL=6
OIAB_AP_SUBNET=192.168.8.0/24
OIAB_AP_IP=192.168.8.2
OIAB_DHCP_RANGE=192.168.8.3,192.168.8.20,12h
EOF
fi

if [[ "$CONFIG_FILE" != "/data/oiab/config/network.env" ]]; then
  mkdir -p /etc/systemd/system/oiab-network-manager.service.d
  cat >/etc/systemd/system/oiab-network-manager.service.d/override.conf <<EOF
[Service]
Environment=OIAB_NETWORK_CONFIG=$CONFIG_FILE
EOF
fi

systemctl daemon-reload
systemctl enable oiab-network-manager.service
systemctl restart oiab-network-manager.service

printf 'OIAB network mode manager installed.\n'
printf 'Config: %s\n' "$CONFIG_FILE"
printf 'Status: oiab-network-status\n'
