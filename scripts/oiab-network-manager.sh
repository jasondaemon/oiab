#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${OIAB_NETWORK_CONFIG:-/data/oiab/config/network.env}"
RUN_DIR="${OIAB_NETWORK_RUN_DIR:-/run/oiab-network}"
MODE_FILE="$RUN_DIR/mode"
LOG_TAG="oiab-network-manager"

OIAB_ETH_IFACE="${OIAB_ETH_IFACE:-eth0}"
OIAB_AP_IFACE="${OIAB_AP_IFACE:-wlan0}"
OIAB_WAN_WIFI_IFACE="${OIAB_WAN_WIFI_IFACE:-wlan1}"
OIAB_AP_SSID="${OIAB_AP_SSID:-Daemon Adventures}"
OIAB_AP_PASSPHRASE="${OIAB_AP_PASSPHRASE:-}"
OIAB_AP_COUNTRY="${OIAB_AP_COUNTRY:-US}"
OIAB_AP_CHANNEL="${OIAB_AP_CHANNEL:-6}"
OIAB_AP_SUBNET="${OIAB_AP_SUBNET:-192.168.8.0/24}"
OIAB_AP_IP="${OIAB_AP_IP:-192.168.8.2}"
OIAB_DHCP_RANGE="${OIAB_DHCP_RANGE:-192.168.8.3,192.168.8.20,12h}"
OIAB_NETWORK_POLL_SECONDS="${OIAB_NETWORK_POLL_SECONDS:-5}"

log() {
  logger -t "$LOG_TAG" -- "$*"
  printf '%s\n' "$*"
}

load_config() {
  if [[ -f "$CONFIG_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
  fi
  mkdir -p "$RUN_DIR"
}

prefix_len() {
  printf '%s\n' "${OIAB_AP_SUBNET#*/}"
}

eth_has_carrier() {
  local carrier_file="/sys/class/net/$OIAB_ETH_IFACE/carrier"
  [[ -e "/sys/class/net/$OIAB_ETH_IFACE" ]] || return 1
  if [[ -r "$carrier_file" ]]; then
    [[ "$(cat "$carrier_file" 2>/dev/null || printf 0)" == "1" ]]
    return
  fi
  ip link show "$OIAB_ETH_IFACE" 2>/dev/null | grep -q "LOWER_UP"
}

iface_exists() {
  [[ -e "/sys/class/net/$1" ]]
}

iface_has_ipv4() {
  ip -4 addr show dev "$1" 2>/dev/null | grep -q "inet "
}

network_manager_active() {
  command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet NetworkManager.service
}

set_nm_managed() {
  local iface="$1"
  local state="$2"
  if network_manager_active && command -v nmcli >/dev/null 2>&1; then
    nmcli dev set "$iface" managed "$state" >/dev/null 2>&1 || true
  fi
}

render_hostapd_config() {
  cat >"$RUN_DIR/hostapd.conf" <<EOF
interface=$OIAB_AP_IFACE
driver=nl80211
ssid=$OIAB_AP_SSID
country_code=$OIAB_AP_COUNTRY
hw_mode=g
channel=$OIAB_AP_CHANNEL
ieee80211n=1
wmm_enabled=1
auth_algs=1
ignore_broadcast_ssid=0
logger_syslog=-1
logger_syslog_level=2
logger_stdout=-1
logger_stdout_level=2
EOF
  if [[ -n "${OIAB_AP_PASSPHRASE}" ]]; then
    cat >>"$RUN_DIR/hostapd.conf" <<EOF
wpa=2
wpa_passphrase=$OIAB_AP_PASSPHRASE
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
EOF
  fi
}

render_dnsmasq_config() {
  local range_start range_end lease
  IFS=',' read -r range_start range_end lease <<<"$OIAB_DHCP_RANGE"
  cat >"$RUN_DIR/dnsmasq.conf" <<EOF
interface=$OIAB_AP_IFACE
bind-interfaces
listen-address=$OIAB_AP_IP
dhcp-authoritative
dhcp-range=$range_start,$range_end,$lease
dhcp-option=option:router,$OIAB_AP_IP
dhcp-option=option:dns-server,$OIAB_AP_IP
domain-needed
bogus-priv
local=/local/
address=/oiab.local/$OIAB_AP_IP
address=/maps.local/$OIAB_AP_IP
address=/daemon.local/$OIAB_AP_IP
address=/daemon-adventures.local/$OIAB_AP_IP
address=/overland.daemonadventures.net/$OIAB_AP_IP
address=/mobile.daemonadventures.net/$OIAB_AP_IP
address=/captive.apple.com/$OIAB_AP_IP
address=/www.apple.com/$OIAB_AP_IP
address=/connectivitycheck.gstatic.com/$OIAB_AP_IP
address=/connectivitycheck.android.com/$OIAB_AP_IP
address=/clients3.google.com/$OIAB_AP_IP
address=/www.gstatic.com/$OIAB_AP_IP
address=/www.msftconnecttest.com/$OIAB_AP_IP
address=/dns.msftncsi.com/$OIAB_AP_IP
address=/ipv6.msftconnecttest.com/$OIAB_AP_IP
EOF
}

clear_nat() {
  if command -v nft >/dev/null 2>&1; then
    nft delete table ip oiab_nat >/dev/null 2>&1 || true
  elif command -v iptables >/dev/null 2>&1; then
    iptables -t nat -D POSTROUTING -s "$OIAB_AP_SUBNET" -o "$OIAB_WAN_WIFI_IFACE" -j MASQUERADE >/dev/null 2>&1 || true
  fi
}

nat_enabled() {
  if command -v nft >/dev/null 2>&1 && nft list table ip oiab_nat >/dev/null 2>&1; then
    return 0
  fi
  if command -v iptables >/dev/null 2>&1 && iptables -t nat -S POSTROUTING 2>/dev/null | grep -q "$OIAB_AP_SUBNET"; then
    return 0
  fi
  return 1
}

wan_available() {
  iface_exists "$OIAB_WAN_WIFI_IFACE" && ip link show "$OIAB_WAN_WIFI_IFACE" 2>/dev/null | grep -q "UP" && iface_has_ipv4 "$OIAB_WAN_WIFI_IFACE"
}

setup_nat_if_available() {
  local quiet="${1:-0}"
  if ! wan_available; then
    nat_enabled && clear_nat
    [[ "$quiet" == "1" ]] || log "FIELD mode: WAN interface $OIAB_WAN_WIFI_IFACE unavailable; keeping AP local-only."
    return 0
  fi
  nat_enabled && return 0
  sysctl -w net.ipv4.ip_forward=1 >/dev/null || true
  if command -v nft >/dev/null 2>&1; then
    nft add table ip oiab_nat >/dev/null 2>&1 || true
    nft "add chain ip oiab_nat postrouting { type nat hook postrouting priority srcnat; policy accept; }" >/dev/null 2>&1 || true
    nft add rule ip oiab_nat postrouting oifname "$OIAB_WAN_WIFI_IFACE" ip saddr "$OIAB_AP_SUBNET" masquerade >/dev/null
  elif command -v iptables >/dev/null 2>&1; then
    iptables -t nat -A POSTROUTING -s "$OIAB_AP_SUBNET" -o "$OIAB_WAN_WIFI_IFACE" -j MASQUERADE
  else
    log "FIELD mode: no nft or iptables found; NAT unavailable."
  fi
}

stop_field_services() {
  systemctl stop oiab-hostapd.service >/dev/null 2>&1 || true
  systemctl stop oiab-dnsmasq.service >/dev/null 2>&1 || true
}

enter_docked() {
  stop_field_services
  clear_nat
  if iface_exists "$OIAB_AP_IFACE"; then
    ip addr flush dev "$OIAB_AP_IFACE" >/dev/null 2>&1 || true
    ip link set "$OIAB_AP_IFACE" down >/dev/null 2>&1 || true
    set_nm_managed "$OIAB_AP_IFACE" yes
  fi
  printf 'DOCKED\n' >"$MODE_FILE"
  log "Switched to DOCKED mode: Ethernet carrier detected on $OIAB_ETH_IFACE."
}

enter_field() {
  if ! iface_exists "$OIAB_AP_IFACE"; then
    printf 'FIELD_FAILED\n' >"$MODE_FILE"
    log "Cannot enter FIELD mode: AP interface $OIAB_AP_IFACE does not exist."
    return 1
  fi

  render_hostapd_config
  render_dnsmasq_config
  stop_field_services
  set_nm_managed "$OIAB_AP_IFACE" no
  command -v rfkill >/dev/null 2>&1 && rfkill unblock wifi >/dev/null 2>&1 || true
  ip link set "$OIAB_AP_IFACE" down >/dev/null 2>&1 || true
  ip addr flush dev "$OIAB_AP_IFACE" >/dev/null 2>&1 || true
  ip addr add "$OIAB_AP_IP/$(prefix_len)" dev "$OIAB_AP_IFACE"
  ip link set "$OIAB_AP_IFACE" up
  setup_nat_if_available 0
  systemctl start oiab-dnsmasq.service
  systemctl start oiab-hostapd.service
  printf 'FIELD\n' >"$MODE_FILE"
  log "Switched to FIELD mode: SSID '$OIAB_AP_SSID' on $OIAB_AP_IFACE at $OIAB_AP_IP."
}

desired_mode() {
  if eth_has_carrier; then
    printf 'DOCKED\n'
  else
    printf 'FIELD\n'
  fi
}

current_mode() {
  if [[ -r "$MODE_FILE" ]]; then
    cat "$MODE_FILE"
  else
    printf 'UNKNOWN\n'
  fi
}

apply_mode_once() {
  load_config
  local desired current
  desired="$(desired_mode)"
  current="$(current_mode)"
  if [[ "$desired" == "$current" ]]; then
    if [[ "$desired" == "FIELD" ]]; then
      setup_nat_if_available 1
    fi
    return 0
  fi
  if [[ "$desired" == "DOCKED" ]]; then
    enter_docked
  else
    enter_field
  fi
}

run_loop() {
  load_config
  log "Starting OIAB network mode manager with config $CONFIG_FILE."
  while true; do
    apply_mode_once || true
    sleep "$OIAB_NETWORK_POLL_SECONDS"
  done
}

case "${1:-run}" in
  run)
    run_loop
    ;;
  once)
    apply_mode_once
    ;;
  field)
    load_config
    enter_field
    ;;
  docked)
    load_config
    enter_docked
    ;;
  *)
    printf 'Usage: %s [run|once|field|docked]\n' "$0" >&2
    exit 2
    ;;
esac
