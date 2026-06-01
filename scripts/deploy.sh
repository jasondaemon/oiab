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
  if [ -f config/oiab.env.example ]; then
    cp config/oiab.env.example "$REMOTE_ENV_PATH"
  else
    cat > "$REMOTE_ENV_PATH" <<ENVEOF
OIAB_HTTP_PUBLISHED_PORT=$REMOTE_PORT
ENVEOF
  fi
fi

python3 - "$REMOTE_ENV_PATH" "$REMOTE_PORT" <<'PY'
from pathlib import Path
import secrets
import sys

env_path = Path(sys.argv[1])
remote_port = sys.argv[2]
lines = env_path.read_text().splitlines() if env_path.exists() else []

entries: dict[str, str] = {}
order: list[str] = []
passthrough: list[str] = []
for raw in lines:
    line = raw.rstrip("\n")
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in line:
        passthrough.append(line)
        continue
    key, value = line.split("=", 1)
    key = key.strip()
    if key not in entries:
        order.append(key)
    entries[key] = value

def ensure(key: str, value: str) -> None:
    if key not in entries or not str(entries[key]).strip():
        if key not in entries:
            order.append(key)
        entries[key] = value

if "OIAB_HTTP_PUBLISHED_PORT" not in entries:
    order.append("OIAB_HTTP_PUBLISHED_PORT")
entries["OIAB_HTTP_PUBLISHED_PORT"] = remote_port
ensure("FILEBROWSER_INTERNAL_URL", "http://filebrowser:80")
ensure("FILEBROWSER_ADMIN_USER", "admin")
if entries.get("FILEBROWSER_ADMIN_PASSWORD", "").strip() in {"", "change-me"}:
    if "FILEBROWSER_ADMIN_PASSWORD" not in entries:
        order.append("FILEBROWSER_ADMIN_PASSWORD")
    entries["FILEBROWSER_ADMIN_PASSWORD"] = secrets.token_urlsafe(24)

output: list[str] = []
if passthrough:
    output.extend(passthrough)
for key in order:
    output.append(f"{key}={entries[key]}")
env_path.write_text("\\n".join(output).strip() + "\\n")
PY

docker compose --env-file "$REMOTE_ENV_PATH" build oiab-core
docker compose --env-file "$REMOTE_ENV_PATH" up -d --force-recreate oiab-core filebrowser

healthy=0
for i in \$(seq 1 45); do
  if docker exec oiab-core python - <<'PY'
import urllib.request, sys
urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=3).read()
sys.exit(0)
PY
  then
    healthy=1
    break
  fi
  sleep 2
done

if [ "\$healthy" -ne 1 ]; then
  echo "OIAB core did not become healthy in time." >&2
  docker ps --filter name=oiab-core
  docker logs --tail=200 oiab-core || true
  exit 1
fi

if ! docker exec oiab-core python - <<'PY'
import json
import urllib.request

payload = json.loads(urllib.request.urlopen('http://127.0.0.1:8080/api/filebrowser/session', timeout=5).read().decode())
if not payload.get('ok') or not payload.get('token'):
    raise SystemExit(1)
PY
then
  echo "File Browser bootstrap failed after deploy." >&2
  docker ps --filter name=oiab-filebrowser-1
  docker logs --tail=200 oiab-filebrowser-1 || true
  exit 1
fi

echo "OIAB core and File Browser bootstrap are healthy."
EOF
