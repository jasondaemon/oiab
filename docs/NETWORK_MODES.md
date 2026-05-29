# Raspberry Pi Network Modes

OIAB includes a host-level network mode manager for trailer/off-grid Raspberry Pi deployments.

It is intentionally outside the Docker container because Wi-Fi AP mode, DHCP, DNS, and NAT are host networking responsibilities.

## Modes

### Docked / Router Mode

When `OIAB_ETH_IFACE` has carrier, default `eth0`, OIAB:

- stops the Pi-hosted Wi-Fi AP
- stops OIAB field-mode DHCP/DNS
- removes OIAB NAT rules
- lets the Pi behave as a normal Ethernet client on the router network

OIAB services remain reachable through the router-assigned IP and configured hostname.

### Field / Offline AP Mode

When `eth0` has no carrier, OIAB:

- starts a Wi-Fi AP on `OIAB_AP_IFACE`, default `wlan0`
- broadcasts `OIAB_AP_SSID`, default `Daemon Adventures`
- assigns the Pi AP IP, default `192.168.8.2`
- serves DHCP/DNS for `192.168.8.0/24`
- resolves local OIAB names and common connectivity-check domains to the Pi
- keeps OIAB local content reachable without internet

Default field-mode DNS names:

- `oiab.local`
- `maps.local`
- `daemon.local`
- `daemon-adventures.local`
- `mobile.daemonadventures.net`

Connectivity probe paths handled by the OIAB backend:

- `/generate_204`
- `/gen_204`
- `/hotspot-detect.html`
- `/connecttest.txt`
- `/ncsi.txt`

### Optional Starlink WAN Mode

If `OIAB_WAN_WIFI_IFACE`, default `wlan1`, is connected upstream, the manager NATs AP clients through that interface.

Configure Starlink Wi-Fi with NetworkManager or your normal host networking tools. The OIAB manager does not own Starlink credentials; it only detects the WAN interface and enables NAT when available.

If Starlink drops, the AP stays up and local OIAB continues to work.

## Configuration

Central Settings → HotSpot Config writes:

```text
/data/oiab/config/network.env
```

Configurable values:

```bash
OIAB_ETH_IFACE=eth0
OIAB_AP_IFACE=wlan0
OIAB_WAN_WIFI_IFACE=wlan1
OIAB_AP_SSID='Daemon Adventures'
OIAB_AP_COUNTRY=US
OIAB_AP_CHANNEL=6
OIAB_AP_SUBNET=192.168.8.0/24
OIAB_AP_IP=192.168.8.2
OIAB_DHCP_RANGE=192.168.8.3,192.168.8.20,12h
```

The manager defaults to `/data/oiab/config/network.env`. If your production data is mounted elsewhere on the host, install with:

```bash
sudo OIAB_NETWORK_CONFIG=/srv/trailer/data/oiab/config/network.env scripts/install-network-mode-manager.sh
```

## Install

On Raspberry Pi OS:

```bash
cd /srv/trailer/oiab
sudo OIAB_NETWORK_CONFIG=/srv/trailer/data/oiab/config/network.env scripts/install-network-mode-manager.sh
```

The installer:

- installs `hostapd`, `dnsmasq`, `nftables`, and `iw`
- installs `oiab-network-manager`
- installs `oiab-network-status`
- installs dedicated systemd units:
  - `oiab-network-manager.service`
  - `oiab-hostapd.service`
  - `oiab-dnsmasq.service`
- enables and starts `oiab-network-manager.service`

The AP and DHCP units are not enabled directly. The manager starts/stops them based on Ethernet carrier state.

## Diagnostics

```bash
oiab-network-status
systemctl status oiab-network-manager
journalctl -u oiab-network-manager -f
```

`oiab-network-status` reports:

- current mode
- Ethernet carrier state
- AP interface status
- WAN Wi-Fi interface status
- DHCP/DNS status
- AP service status
- NAT status
- Pi AP IP
- detected Wi-Fi clients

## Manual Checks

Docked:

```bash
cat /sys/class/net/eth0/carrier
systemctl is-active oiab-hostapd
systemctl is-active oiab-dnsmasq
sudo nft list table ip oiab_nat
```

Field:

```bash
ip addr show wlan0
systemctl status oiab-hostapd
systemctl status oiab-dnsmasq
dig @192.168.8.2 oiab.local
curl http://192.168.8.2/generate_204 -i
```

## Rollback

```bash
cd /srv/trailer/oiab
sudo scripts/uninstall-network-mode-manager.sh
```

Rollback stops and disables the OIAB network services, removes OIAB NAT rules, and removes installed systemd units/scripts. It preserves `/data/oiab/config/network.env`.

## Notes

The request text included an acceptance-test subnet of `10.44.0.0/24`, but the requested defaults are `192.168.8.0/24` and `192.168.8.2`. OIAB uses the requested defaults and can be changed to `10.44.0.0/24` through HotSpot Config if needed.
