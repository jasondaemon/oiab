#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  printf 'Run with sudo: sudo %s\n' "$0" >&2
  exit 1
fi

systemctl disable --now oiab-network-manager.service >/dev/null 2>&1 || true
systemctl stop oiab-hostapd.service oiab-dnsmasq.service >/dev/null 2>&1 || true

if command -v nft >/dev/null 2>&1; then
  nft delete table ip oiab_nat >/dev/null 2>&1 || true
fi

rm -f /etc/systemd/system/oiab-network-manager.service
rm -f /etc/systemd/system/oiab-hostapd.service
rm -f /etc/systemd/system/oiab-dnsmasq.service
rm -rf /etc/systemd/system/oiab-network-manager.service.d
rm -f /usr/local/sbin/oiab-network-manager
rm -f /usr/local/bin/oiab-network-status
rm -rf /run/oiab-network

systemctl daemon-reload

printf 'OIAB network mode manager removed. Configuration files under /data/oiab or your custom OIAB_NETWORK_CONFIG path were preserved.\n'
