#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${OIAB_DATA_DIR:-/data/oiab}"
INSTALL_RASPAP="${OIAB_INSTALL_RASPAP:-true}"
INSTALL_I2C_TOOLS="${OIAB_INSTALL_I2C_TOOLS:-true}"

echo "Installing Overland In A Box base directories"
sudo mkdir -p "$DATA_DIR"/{config,maps/packs,maps/styles,maps/sprites,media/music,media/uploads,games,tracks,waypoints,content/zim,services/jellyfin,services/komga,services/minecraft,certs,logs,backups}
sudo chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" "$DATA_DIR"

if [ ! -f "$ROOT/config/oiab.env" ]; then
  cp "$ROOT/config/oiab.env.example" "$ROOT/config/oiab.env"
fi

if [ -S /var/run/docker.sock ] && command -v stat >/dev/null 2>&1; then
  DOCKER_GID="$(stat -c '%g' /var/run/docker.sock 2>/dev/null || true)"
  if [ -n "$DOCKER_GID" ]; then
    python3 - "$ROOT/config/oiab.env" "$DOCKER_GID" <<'PY'
from pathlib import Path
import sys

env_path = Path(sys.argv[1])
gid = sys.argv[2]
lines = env_path.read_text().splitlines() if env_path.exists() else []
entries = {}
order = []
other = []
for raw in lines:
    line = raw.rstrip("\n")
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in line:
        other.append(line)
        continue
    key, value = line.split("=", 1)
    key = key.strip()
    if key not in entries:
        order.append(key)
    entries[key] = value
if "OIAB_DOCKER_GID" not in entries:
    order.append("OIAB_DOCKER_GID")
entries["OIAB_DOCKER_GID"] = gid
output = []
if other:
    output.extend(other)
for key in order:
    output.append(f"{key}={entries[key]}")
env_path.write_text("\n".join(output).strip() + "\n")
PY
  fi
fi

if [[ "$INSTALL_I2C_TOOLS" == "true" ]] && command -v apt-get >/dev/null 2>&1; then
  echo "Installing Raspberry Pi I2C diagnostics/packages for optional UPS telemetry"
  sudo apt-get update
  sudo apt-get install -y i2c-tools python3-smbus python3-smbus2
fi

if [ -e /dev/i2c-1 ]; then
  python3 - "$ROOT/config/oiab.env" <<'PY'
from pathlib import Path
import sys

env_path = Path(sys.argv[1])
lines = env_path.read_text().splitlines() if env_path.exists() else []
entries = {}
order = []
other = []
for raw in lines:
    line = raw.rstrip("\n")
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in line:
        other.append(line)
        continue
    key, value = line.split("=", 1)
    key = key.strip()
    if key not in entries:
        order.append(key)
    entries[key] = value
def set_default(key: str, value: str) -> None:
    if key not in entries or not str(entries[key]).strip():
        if key not in entries:
            order.append(key)
        entries[key] = value
set_default("OIAB_I2C_DEVICE_HOST", "/dev/i2c-1")
set_default("OIAB_I2C_DEVICE", "/dev/i2c-1")
set_default("OIAB_I2C_BUS", "1")
set_default("OIAB_I2C_ADDRESS", "0x36")
output = []
if other:
    output.extend(other)
for key in order:
    output.append(f"{key}={entries[key]}")
env_path.write_text("\n".join(output).strip() + "\n")
PY
else
  echo "I2C device /dev/i2c-1 is not available. Enable I2C with raspi-config to use X1206 battery telemetry."
fi

if [[ "$INSTALL_RASPAP" == "true" ]] && command -v apt-get >/dev/null 2>&1; then
  echo "Installing RaspAP host integration (default OIAB network component)"
  sudo "$ROOT/scripts/install-raspap-host.sh"
else
  echo "Skipping RaspAP host integration (set OIAB_INSTALL_RASPAP=true to enable)."
fi

echo "Base install prepared. Review config/oiab.env, then run scripts/dev.sh or install systemd/oiab-backend.service."
