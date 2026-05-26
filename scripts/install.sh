#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${OIAB_DATA_DIR:-/data/oiab}"

echo "Installing Overland In A Box base directories"
sudo mkdir -p "$DATA_DIR"/{config,maps/packs,maps/styles,maps/sprites,media/music,media/uploads,games,tracks,waypoints,content/zim,services/jellyfin,services/komga,services/minecraft,certs,logs,backups}
sudo chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" "$DATA_DIR"

if [ ! -f "$ROOT/config/oiab.env" ]; then
  cp "$ROOT/config/oiab.env.example" "$ROOT/config/oiab.env"
fi

echo "Base install prepared. Review config/oiab.env, then run scripts/dev.sh or install systemd/oiab-backend.service."

