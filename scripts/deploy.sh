#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-pi@overland.daemonadventures.net:/opt/oiab}"

rsync -av --delete \
  --exclude '.git/' \
  --exclude 'data/' \
  --exclude '*.pmtiles' \
  --exclude 'config/oiab.env' \
  "$ROOT/" "$TARGET/"

