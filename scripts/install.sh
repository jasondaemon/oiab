#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${OIAB_DATA_DIR:-/data/oiab}"
INSTALL_RASPAP="${OIAB_INSTALL_RASPAP:-true}"

echo "Installing Overland In A Box base directories"
sudo mkdir -p "$DATA_DIR"/{config,maps/packs,maps/styles,maps/sprites,media/music,media/uploads,games,tracks,waypoints,content/zim,services/jellyfin,services/komga,services/minecraft,certs,logs,backups}
sudo chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" "$DATA_DIR"

if [ ! -f "$ROOT/config/oiab.env" ]; then
  cp "$ROOT/config/oiab.env.example" "$ROOT/config/oiab.env"
fi

if [[ "$INSTALL_RASPAP" == "true" ]] && command -v apt-get >/dev/null 2>&1; then
  echo "Installing RaspAP host integration (default OIAB network component)"
  sudo "$ROOT/scripts/install-raspap-host.sh"
else
  echo "Skipping RaspAP host integration (set OIAB_INSTALL_RASPAP=true to enable)."
fi

echo "Base install prepared. Review config/oiab.env, then run scripts/dev.sh or install systemd/oiab-backend.service."
