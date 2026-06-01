# RaspAP Integration

OIAB is moving toward a RaspAP-first network management model for Raspberry Pi deployments.

## Intent

Use RaspAP as the feature-complete network UI for:

- local Wi-Fi access point configuration
- dual-radio uplink configuration
- remembered upstream Wi-Fi networks
- Ethernet fallback behavior

Recommended topology:

- `wlan0`: local OIAB client access point
- `wlan1`: upstream client radio for Starlink, home Wi-Fi, hotel Wi-Fi, etc.
- `eth0`: fallback wired uplink when available

If only one Wi-Fi interface is present:

- use that radio for local client access
- OIAB remains usable offline

If two Wi-Fi interfaces are present:

- one remains dedicated to the OIAB access point
- the second can be used as an upstream client

## Access from OIAB

Central Settings now includes a `Network / RaspAP` card with:

- `Open RaspAP`
- advanced fallback AP settings for the older host network manager

The launcher defaults to:

- proxied same-origin path: `https://<current-host>/apps/raspap/`
- local/dev fallback: `http://<current-host>:8097/`

unless explicitly overridden by:

- `OIAB_RASPAP_URL`

## Install on the host

Use:

```bash
cd /srv/trailer/oiab
sudo ./scripts/install-raspap-host.sh
```

This wrapper:

- fetches the official RaspAP quick installer
- runs it unattended
- moves the RaspAP lighttpd UI to port `8097`
- patches a PHP 8 session-key warning in `WiFiManager.php`
- patches nginx, when present, to expose RaspAP at `/apps/raspap/`

Related environment variables:

- `OIAB_RASPAP_PORT`
- `OIAB_RASPAP_SCHEME`
- `OIAB_RASPAP_URL`
- `RASPAP_INSTALLER_URL`

## Current model

For now, OIAB keeps the previous host AP manager settings as a bootstrap/fallback path.

That means:

- RaspAP is the preferred user-facing network UI
- the legacy OIAB AP manager remains available until full cutover is complete

## Notes

- RaspAP is host-level infrastructure, not a Docker-contained app.
- It should be treated as a core Raspberry Pi appliance component.
- Production should expose RaspAP through the main nginx host on:
  - `https://<current-host>/apps/raspap/`
- Plain `http://<host>:8097/` remains useful for local host debugging.
