#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export OIAB_DATA_DIR="${OIAB_DATA_DIR:-$ROOT/data}"
export OIAB_DEV_MODE="${OIAB_DEV_MODE:-true}"
export PYTHONPATH="$ROOT:${PYTHONPATH:-}"

mkdir -p "$OIAB_DATA_DIR"
python3 -m backend.app.main --host "${OIAB_BIND_HOST:-127.0.0.1}" --port "${OIAB_PORT_HTTP:-8080}"

