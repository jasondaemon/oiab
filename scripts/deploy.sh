#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_HOST="${OIAB_DEPLOY_HOST:-jasondaemon@192.168.62.30}"
DEPLOY_PATH="${OIAB_DEPLOY_PATH:-/srv/trailer/oiab}"
DEPLOY_TARGET="${DEPLOY_HOST}:${DEPLOY_PATH}"
REMOTE_ENV_PATH="${OIAB_DEPLOY_ENV_PATH:-$DEPLOY_PATH/.env}"
REMOTE_PORT="${OIAB_HTTP_PUBLISHED_PORT:-18120}"
SSH_KEY="${OIAB_DEPLOY_SSH_KEY:-}"
SSH_OPTS=(-o StrictHostKeyChecking=no)
if [ -n "$SSH_KEY" ]; then
  SSH_OPTS=(-i "$SSH_KEY" "${SSH_OPTS[@]}")
fi

echo "Deploying OIAB source to ${DEPLOY_TARGET}"

rsync -av --delete \
  -e "ssh ${SSH_OPTS[*]}" \
  --exclude '.git/' \
  --exclude '.DS_Store' \
  --exclude 'data/' \
  --exclude 'config/oiab.env' \
  --exclude '.tmp-docker-data/' \
  --exclude 'android-wrapper/.gradle/' \
  --exclude 'android-wrapper/**/build/' \
  --exclude 'android-wrapper/local.properties' \
  "$ROOT/" "$DEPLOY_TARGET/"

ssh "${SSH_OPTS[@]}" "$DEPLOY_HOST" "bash -s" <<EOF
set -euo pipefail
cd "$DEPLOY_PATH"

rm -f .DS_Store app_db.py main.py maps-v2.js maps-v2.css index.html universal-shell.css

if [ ! -f "$REMOTE_ENV_PATH" ]; then
  cat > "$REMOTE_ENV_PATH" <<ENVEOF
OIAB_HTTP_PUBLISHED_PORT=$REMOTE_PORT
ENVEOF
fi

docker compose build oiab-core
docker compose up -d --no-deps --force-recreate oiab-core

for i in \$(seq 1 45); do
  if docker exec oiab-core python - <<'PY'
import urllib.request, sys
urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=3).read()
sys.exit(0)
PY
  then
    echo "OIAB core is healthy."
    exit 0
  fi
  sleep 2
done

echo "OIAB core did not become healthy in time." >&2
docker ps --filter name=oiab-core
docker logs --tail=200 oiab-core || true
exit 1
EOF
