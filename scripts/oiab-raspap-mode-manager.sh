#!/usr/bin/env bash
set -euo pipefail

LOG_TAG="oiab-raspap-mode"
STATE_DIR="/run/oiab-raspap"
MODE_FILE="$STATE_DIR/mode"
AP_IFACE="${OIAB_AP_IFACE:-wlan0}"
WAN_IFACE="${OIAB_WAN_WIFI_IFACE:-wlan1}"
ETH_IFACE="${OIAB_ETH_IFACE:-eth0}"
AP_IP="${OIAB_AP_IP:-192.168.8.2}"
AP_SUBNET="${OIAB_AP_SUBNET:-192.168.8.0/24}"
AP_PREFIX="${AP_SUBNET#*/}"
HOSTAPD_CONF="/etc/hostapd/hostapd.conf"
RASPAP_DNSMASQ="/etc/dnsmasq.d/090_wlan0.conf"
OIAB_DNSMASQ="/etc/dnsmasq.d/091_oiab.conf"

log() {
  logger -t "$LOG_TAG" -- "$*"
  printf '%s\n' "$*"
}

ensure_state_dir() {
  mkdir -p "$STATE_DIR"
}

iface_exists() {
  [[ -e "/sys/class/net/$1" ]]
}

eth_has_carrier() {
  local carrier_file="/sys/class/net/$ETH_IFACE/carrier"
  [[ -e "/sys/class/net/$ETH_IFACE" ]] || return 1
  if [[ -r "$carrier_file" ]]; then
    [[ "$(cat "$carrier_file" 2>/dev/null || printf 0)" == "1" ]]
    return
  fi
  ip link show "$ETH_IFACE" 2>/dev/null | grep -q "LOWER_UP"
}

network_manager_active() {
  command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet NetworkManager.service
}

nm_set_managed() {
  local iface="$1"
  local state="$2"
  if network_manager_active && command -v nmcli >/dev/null 2>&1 && iface_exists "$iface"; then
    nmcli dev set "$iface" managed "$state" >/dev/null 2>&1 || true
  fi
}

wifi_radio_on() {
  if network_manager_active && command -v nmcli >/dev/null 2>&1; then
    nmcli radio wifi on >/dev/null 2>&1 || true
  fi
  command -v rfkill >/dev/null 2>&1 && rfkill unblock wifi >/dev/null 2>&1 || true
}

wan_available() {
  iface_exists "$WAN_IFACE" && ip link show "$WAN_IFACE" 2>/dev/null | grep -q "UP" && ip -4 addr show dev "$WAN_IFACE" 2>/dev/null | grep -q "inet "
}

current_mode() {
  [[ -r "$MODE_FILE" ]] && cat "$MODE_FILE" || printf 'unknown\n'
}

write_mode() {
  printf '%s\n' "$1" >"$MODE_FILE"
}

seed_oiab_dnsmasq() {
  cat >"$OIAB_DNSMASQ" <<EOF
# OIAB AP-mode DNS and captive responses
address=/overland.daemonadventures.net/$AP_IP
address=/mobile.daemonadventures.net/$AP_IP
address=/oiab.local/$AP_IP
address=/maps.local/$AP_IP
address=/daemon.local/$AP_IP
address=/daemon-adventures.local/$AP_IP
address=/captive.apple.com/$AP_IP
address=/www.apple.com/$AP_IP
address=/connectivitycheck.gstatic.com/$AP_IP
address=/connectivitycheck.android.com/$AP_IP
address=/clients3.google.com/$AP_IP
address=/www.gstatic.com/$AP_IP
address=/www.msftconnecttest.com/$AP_IP
address=/dns.msftncsi.com/$AP_IP
address=/ipv6.msftconnecttest.com/$AP_IP
EOF
}

ensure_raspap_defaults() {
  if [[ -f "$HOSTAPD_CONF" ]]; then
    sed -i \
      -e "s/^ssid=.*/ssid=${OIAB_AP_SSID:-Daemon Adventures}/" \
      -e "s/^channel=.*/channel=${OIAB_AP_CHANNEL:-6}/" \
      -e "s/^country_code=.*/country_code=${OIAB_AP_COUNTRY:-US}/" \
      -e "s/^interface=.*/interface=${AP_IFACE}/" \
      "$HOSTAPD_CONF" || true
    if [[ -n "${OIAB_AP_PASSPHRASE:-}" ]]; then
      if grep -q '^wpa_passphrase=' "$HOSTAPD_CONF"; then
        sed -i -e "s/^wpa_passphrase=.*/wpa_passphrase=${OIAB_AP_PASSPHRASE}/" "$HOSTAPD_CONF" || true
      else
        cat >>"$HOSTAPD_CONF" <<EOF
wpa=2
wpa_passphrase=${OIAB_AP_PASSPHRASE}
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
EOF
      fi
    fi
  fi
  if [[ -f "$RASPAP_DNSMASQ" ]]; then
    python3 - "$RASPAP_DNSMASQ" "${OIAB_DHCP_RANGE:-192.168.8.3,192.168.8.20,12h}" "$AP_IFACE" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
dhcp_range = sys.argv[2]
iface = sys.argv[3]
text = path.read_text(encoding="utf-8")
lines = []
have_iface = False
have_domain = False
have_range = False
for line in text.splitlines():
    if line.startswith("interface="):
        lines.append(f"interface={iface}")
        have_iface = True
    elif line.startswith("domain-needed"):
        lines.append("domain-needed")
        have_domain = True
    elif line.startswith("dhcp-range="):
        lines.append(f"dhcp-range={dhcp_range}")
        have_range = True
    else:
        lines.append(line)
if not have_iface:
    lines.append(f"interface={iface}")
if not have_domain:
    lines.append("domain-needed")
if not have_range:
    lines.append(f"dhcp-range={dhcp_range}")
path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY
  fi
  seed_oiab_dnsmasq
}

clear_nat() {
  if command -v nft >/dev/null 2>&1; then
    nft delete table ip oiab_raspap_nat >/dev/null 2>&1 || true
  elif command -v iptables >/dev/null 2>&1; then
    iptables -t nat -D POSTROUTING -s "$AP_SUBNET" -o "$WAN_IFACE" -j MASQUERADE >/dev/null 2>&1 || true
    iptables -D FORWARD -i "$AP_IFACE" -o "$WAN_IFACE" -j ACCEPT >/dev/null 2>&1 || true
    iptables -D FORWARD -i "$WAN_IFACE" -o "$AP_IFACE" -m state --state RELATED,ESTABLISHED -j ACCEPT >/dev/null 2>&1 || true
  fi
}

setup_nat() {
  if ! wan_available; then
    clear_nat
    return 0
  fi
  sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1 || true
  if command -v nft >/dev/null 2>&1; then
    nft add table ip oiab_raspap_nat >/dev/null 2>&1 || true
    nft 'add chain ip oiab_raspap_nat forward { type filter hook forward priority filter; policy accept; }' >/dev/null 2>&1 || true
    nft 'add chain ip oiab_raspap_nat postrouting { type nat hook postrouting priority srcnat; policy accept; }' >/dev/null 2>&1 || true
    nft add rule ip oiab_raspap_nat forward iifname "$AP_IFACE" oifname "$WAN_IFACE" accept >/dev/null 2>&1 || true
    nft add rule ip oiab_raspap_nat forward iifname "$WAN_IFACE" oifname "$AP_IFACE" ct state related,established accept >/dev/null 2>&1 || true
    nft add rule ip oiab_raspap_nat postrouting oifname "$WAN_IFACE" ip saddr "$AP_SUBNET" masquerade >/dev/null 2>&1 || true
  elif command -v iptables >/dev/null 2>&1; then
    iptables -C FORWARD -i "$AP_IFACE" -o "$WAN_IFACE" -j ACCEPT >/dev/null 2>&1 || \
      iptables -A FORWARD -i "$AP_IFACE" -o "$WAN_IFACE" -j ACCEPT
    iptables -C FORWARD -i "$WAN_IFACE" -o "$AP_IFACE" -m state --state RELATED,ESTABLISHED -j ACCEPT >/dev/null 2>&1 || \
      iptables -A FORWARD -i "$WAN_IFACE" -o "$AP_IFACE" -m state --state RELATED,ESTABLISHED -j ACCEPT
    iptables -t nat -C POSTROUTING -s "$AP_SUBNET" -o "$WAN_IFACE" -j MASQUERADE >/dev/null 2>&1 || \
      iptables -t nat -A POSTROUTING -s "$AP_SUBNET" -o "$WAN_IFACE" -j MASQUERADE
  fi
}

enter_docked() {
  systemctl stop hostapd >/dev/null 2>&1 || true
  systemctl stop dnsmasq >/dev/null 2>&1 || true
  clear_nat
  if iface_exists "$AP_IFACE"; then
    nm_set_managed "$AP_IFACE" yes
    ip addr flush dev "$AP_IFACE" >/dev/null 2>&1 || true
    ip link set "$AP_IFACE" down >/dev/null 2>&1 || true
  fi
  write_mode docked
  log "DOCKED: ethernet carrier present on $ETH_IFACE; hotspot disabled."
}

enter_field() {
  if ! iface_exists "$AP_IFACE"; then
    write_mode field_failed
    log "FIELD: AP interface $AP_IFACE missing."
    return 1
  fi
  ensure_raspap_defaults
  wifi_radio_on
  nm_set_managed "$AP_IFACE" no
  ip link set "$AP_IFACE" down >/dev/null 2>&1 || true
  ip addr flush dev "$AP_IFACE" >/dev/null 2>&1 || true
  ip addr add "$AP_IP/$AP_PREFIX" dev "$AP_IFACE"
  ip link set "$AP_IFACE" up
  setup_nat
  systemctl restart dnsmasq
  systemctl restart hostapd
  write_mode field
  if wan_available; then
    log "FIELD: hotspot active on $AP_IFACE with uplink on $WAN_IFACE."
  else
    log "FIELD: hotspot active on $AP_IFACE with local-only access."
  fi
}

desired_mode() {
  if eth_has_carrier; then
    printf 'docked\n'
  else
    printf 'field\n'
  fi
}

apply_mode() {
  ensure_state_dir
  local desired current
  desired="$(desired_mode)"
  current="$(current_mode)"
  if [[ "$desired" == "docked" ]]; then
    enter_docked
  else
    enter_field
  fi
  [[ "$desired" != "$current" ]] || true
}

case "${1:-apply}" in
  apply|once)
    apply_mode
    ;;
  field)
    ensure_state_dir
    enter_field
    ;;
  docked)
    ensure_state_dir
    enter_docked
    ;;
  *)
    printf 'Usage: %s [apply|once|field|docked]\n' "$0" >&2
    exit 2
    ;;
esac
