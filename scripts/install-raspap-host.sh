#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RASPAP_PORT="${OIAB_RASPAP_PORT:-8097}"
RASPAP_SCHEME="${OIAB_RASPAP_SCHEME:-http}"
INSTALLER_URL="${RASPAP_INSTALLER_URL:-https://install.raspap.com}"

if [[ "${EUID}" -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y curl ca-certificates

tmp_installer="$(mktemp)"
trap 'rm -f "$tmp_installer"' EXIT
curl -fsSL "$INSTALLER_URL" -o "$tmp_installer"
bash "$tmp_installer" --yes

if [[ -f /etc/lighttpd/lighttpd.conf ]]; then
  python3 - "$RASPAP_PORT" <<'PY'
from pathlib import Path
import re
import sys

port = sys.argv[1]
path = Path("/etc/lighttpd/lighttpd.conf")
text = path.read_text(encoding="utf-8")
if re.search(r"^\s*server\.port\s*=", text, flags=re.M):
    text = re.sub(r"^\s*server\.port\s*=.*$", f"server.port = {port}", text, flags=re.M)
else:
    text += f"\nserver.port = {port}\n"
path.write_text(text, encoding="utf-8")
PY
fi

systemctl enable lighttpd >/dev/null 2>&1 || true
systemctl restart lighttpd

cat <<EOF
RaspAP installed.

Access:
  ${RASPAP_SCHEME}://<pi-hostname-or-ip>:${RASPAP_PORT}/

Recommended OIAB topology:
  - AP / client access interface: wlan0
  - Uplink interface (Starlink/home/hotel): wlan1
  - Ethernet remains available as fallback uplink

Use Central Settings -> Network / RaspAP -> Open RaspAP to launch it from OIAB.
EOF
