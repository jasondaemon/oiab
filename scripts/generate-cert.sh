#!/usr/bin/env bash
set -euo pipefail

HOSTNAME="${OIAB_HOSTNAME:-overland.daemonadventures.net}"
DEFAULT_MOBILE_HOST="mobile.${HOSTNAME#*.}"
if [[ "$HOSTNAME" != *.* ]]; then
  DEFAULT_MOBILE_HOST="mobile.$HOSTNAME"
fi
CERT_DOMAINS="${OIAB_CERT_DOMAINS:-$HOSTNAME,*.$HOSTNAME,$DEFAULT_MOBILE_HOST}"
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
  -addext "subjectAltName=$(printf '%s' "$CERT_DOMAINS" | tr ',' '\n' | awk 'NF {gsub(/^[ \t]+|[ \t]+$/, ""); printf "%sDNS:%s", sep, $0; sep=","}')"

echo "Generated development certificate:"
echo "  $CERT_DIR/oiab.crt"
echo "  $CERT_DIR/oiab.key"
echo "Certificate domains: $CERT_DOMAINS"
echo "For production, prefer a DNS-01 certificate for $CERT_DOMAINS."
