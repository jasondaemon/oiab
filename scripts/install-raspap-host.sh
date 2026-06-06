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
apt-get install -y curl ca-certificates iw rfkill dnsmasq hostapd

tmp_installer="$(mktemp)"
trap 'rm -f "$tmp_installer"' EXIT
curl -fsSL "$INSTALLER_URL" -o "$tmp_installer"
bash "$tmp_installer" --yes

install -m 0755 "$REPO_ROOT/scripts/oiab-raspap-mode-manager.sh" /usr/local/sbin/oiab-raspap-mode-manager
install -m 0644 "$REPO_ROOT/systemd/oiab-raspap-mode.service" /etc/systemd/system/oiab-raspap-mode.service

cat >/etc/NetworkManager/dispatcher.d/90-oiab-raspap-mode <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${2:-}" =~ ^(up|down|dhcp4-change|connectivity-change|hostname|pre-up|vpn-up|vpn-down)$ ]]; then
  /usr/local/sbin/oiab-raspap-mode-manager apply >/dev/null 2>&1 || true
fi
EOF
chmod 0755 /etc/NetworkManager/dispatcher.d/90-oiab-raspap-mode

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

if [[ -f /etc/nginx/sites-available/overland-trusted-https.conf ]]; then
  python3 - <<'PY'
from pathlib import Path
import re

path = Path("/etc/nginx/sites-available/overland-trusted-https.conf")
text = path.read_text(encoding="utf-8")
marker = "    location ^~ /apps/filebrowser/ {\n"
block = """    location ^~ /apps/raspap/ {\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto https;\n        proxy_set_header X-Forwarded-Host $http_host;\n        proxy_pass http://127.0.0.1:8097/;\n        proxy_redirect ~^/(.*)$ /apps/raspap/$1;\n        proxy_cookie_path / /apps/raspap/;\n        sub_filter_once off;\n        sub_filter_types text/css application/javascript;\n        sub_filter 'href=\"/' 'href=\"/apps/raspap/';\n        sub_filter 'src=\"/' 'src=\"/apps/raspap/';\n        sub_filter 'action=\"/' 'action=\"/apps/raspap/';\n    }\n\n"""
if block not in text and marker in text:
    text = text.replace(marker, block + marker, 1)
filebrowser_block = """    location ^~ /apps/filebrowser/ {\n        client_max_body_size 10000M;\n        proxy_http_version 1.1;\n        proxy_request_buffering off;\n        proxy_buffering off;\n        proxy_connect_timeout 600;\n        proxy_send_timeout 600;\n        proxy_read_timeout 600;\n        send_timeout 600;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto https;\n        proxy_set_header X-Forwarded-Host $http_host;\n        proxy_set_header X-Auth-User admin;\n        proxy_pass http://127.0.0.1:8091/;\n    }\n"""
text = re.sub(
    r"    location \^~ /apps/filebrowser/ \{\n(?:        .*\n)*?    \}\n",
    filebrowser_block,
    text,
    count=1,
)
if text != path.read_text(encoding="utf-8"):
    path.write_text(text, encoding="utf-8")
PY
  nginx -t
  systemctl reload nginx
fi

if [[ -f /var/www/html/src/RaspAP/Networking/Hotspot/WiFiManager.php ]]; then
  python3 - <<'PY'
from pathlib import Path

path = Path("/var/www/html/src/RaspAP/Networking/Hotspot/WiFiManager.php")
text = path.read_text(encoding="utf-8")
old = "        if ($_SESSION['wifi_client_interface'] === null && !isset($_POST['wifiClientInterface'])) {\n"
new = "        if (($_SESSION['wifi_client_interface'] ?? null) === null && !isset($_POST['wifiClientInterface'])) {\n"
if old in text:
    text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")
PY
fi

if [[ -f /var/www/html/src/RaspAP/Auth/HTTPAuth.php ]]; then
  python3 - <<'PY'
from pathlib import Path

path = Path("/var/www/html/src/RaspAP/Auth/HTTPAuth.php")
text = path.read_text(encoding="utf-8")
old = "                header('Location: /login?action=' . urlencode($redirectUrl));\n"
new = "                $basePath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');\n                header('Location: ' . ($basePath ?: '') . '/login?action=' . urlencode($redirectUrl));\n"
if old in text:
    text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")
PY
fi

if [[ -f /var/www/html/src/RaspAP/Tokens/CSRFTokenizer.php ]]; then
  python3 - <<'PY'
from pathlib import Path

path = Path("/var/www/html/src/RaspAP/Tokens/CSRFTokenizer.php")
text = path.read_text(encoding="utf-8")
old = "            header('Location: /login');\n"
new = "            $basePath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');\n            header('Location: ' . ($basePath ?: '') . '/login');\n"
if old in text:
    text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")
PY
fi

if [[ -f /var/www/html/app/js/app.js ]]; then
  python3 - <<'PY'
from pathlib import Path

path = Path("/var/www/html/app/js/app.js")
text = path.read_text(encoding="utf-8")
old = "    const path = window.location.pathname;\n"
new = "    const path = window.location.pathname.replace(/^\\/apps\\/raspap(?=\\/|$)/, '') || '/';\n"
if old in text:
    text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")
PY
fi

systemctl enable lighttpd >/dev/null 2>&1 || true
systemctl restart lighttpd
systemctl daemon-reload
systemctl enable oiab-raspap-mode.service >/dev/null 2>&1 || true
nmcli radio wifi on >/dev/null 2>&1 || true
/usr/local/sbin/oiab-raspap-mode-manager apply || true

cat <<EOF
RaspAP installed.

Access:
  local direct: ${RASPAP_SCHEME}://<pi-hostname-or-ip>:${RASPAP_PORT}/
  recommended via OIAB nginx: https://<oiab-host>/apps/raspap/

Recommended OIAB topology:
  - AP / client access interface: wlan0
  - Uplink interface (Starlink/home/hotel): wlan1 when present
  - Ethernet remains preferred docked uplink and disables the hotspot
  - Without ethernet, wlan0 becomes the local OIAB hotspot
  - With wlan1 present, NetworkManager/RaspAP can remember and auto-connect uplink Wi-Fi

Use Central Settings -> Network / RaspAP -> Open RaspAP to launch it from OIAB.
EOF
