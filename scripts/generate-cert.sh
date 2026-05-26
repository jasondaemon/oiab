#!/usr/bin/env bash
set -euo pipefail

HOSTNAME="${OIAB_HOSTNAME:-overland.daemonadventures.net}"
DATA_DIR="${OIAB_DATA_DIR:-/data/oiab}"
CERT_DIR="$DATA_DIR/certs"

mkdir -p "$CERT_DIR"

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required" >&2
  exit 1
fi

openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
  -keyout "$CERT_DIR/oiab.key" \
  -out "$CERT_DIR/oiab.crt" \
  -subj "/CN=$HOSTNAME" \
  -addext "subjectAltName=DNS:$HOSTNAME,DNS:*.$HOSTNAME"

echo "Generated development certificate:"
echo "  $CERT_DIR/oiab.crt"
echo "  $CERT_DIR/oiab.key"
echo "For production, prefer a DNS-01 certificate for $HOSTNAME."

