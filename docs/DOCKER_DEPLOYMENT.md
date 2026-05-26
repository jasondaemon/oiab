# Docker Deployment

Docker is the preferred production deployment model for OIAB.

## Base Install

```bash
cd /opt/oiab
cp config/oiab.env.example config/oiab.env
docker compose --env-file config/oiab.env up -d --build oiab-core
```

The base install includes the shell, Maps v2 runtime, GPS/location endpoints, waypoints/tracks storage, music endpoints, games data foundation, and optional service manifests.

It does not install Jellyfin, Komga, Kiwix, Minecraft, map packs, media, or ROMs.

## Persistent Data

The host path in `OIAB_DATA_DIR` is bind-mounted into the container as `/data/oiab`.

Default:

```text
/data/oiab
```

Important subdirectories:

```text
/data/oiab/certs
/data/oiab/maps/packs
/data/oiab/media/music
/data/oiab/media/uploads
/data/oiab/games
/data/oiab/tracks
/data/oiab/waypoints
/data/oiab/services
```

## Environment

Use `config/oiab.env` for deployment configuration.

Common values:

```text
OIAB_HOSTNAME=overland.daemonadventures.net
OIAB_DATA_DIR=/data/oiab
OIAB_DB_PATH=/data/oiab/db/oiab.sqlite
OIAB_HTTP_PUBLISHED_PORT=80
OIAB_GPSD_HOST=host.docker.internal
OIAB_GPSD_PORT=2947
OIAB_ALLOW_DOCKER_CONTROL=false
```

## Map Packs

PMTiles files are data, not git content.

Default expected path:

```text
/data/oiab/maps/packs/protomaps-conus.pmtiles
```

The container serves map packs through the OIAB backend with HTTP range support.

## Certificates

Certificates live in:

```text
/data/oiab/certs
```

The current base container serves HTTP. TLS termination can be added in front of `oiab-core` with Caddy, Nginx, or a future OIAB web gateway container while keeping certificate storage under `/data/oiab/certs`.

## GPS

The base Docker mode uses host `gpsd`.

Host checks:

```bash
systemctl status gpsd
gpspipe -w -n 5
```

Container check:

```bash
docker compose --env-file config/oiab.env exec oiab-core python - <<'PY'
from backend.app.gps.gpsd import read_gpsd
print(read_gpsd())
PY
```

If host `gpsd` only listens on localhost, Docker bridge clients will not be able to reach it. Configure `gpsd` for host-gateway access or use a future host-network/device-passthrough override.

## Optional Services

Start optional services with profiles:

```bash
docker compose --env-file config/oiab.env --profile jellyfin up -d
docker compose --env-file config/oiab.env --profile komga up -d
docker compose --env-file config/oiab.env --profile kiwix up -d
docker compose --env-file config/oiab.env --profile minecraft up -d
```

Fragments also live under:

```text
services/compose/
```

These fragments mirror the profile services in the root compose file and are kept for service-manager and future install workflow integration.

The in-app service manager can run compose actions only when explicitly enabled:

```text
OIAB_ALLOW_DOCKER_CONTROL=true
```

Keep this disabled unless the OIAB UI is on a trusted local network and you are comfortable allowing it to start/stop optional containers.

## Raspberry Pi + External SSD Checklist

```bash
lsblk
sudo mkdir -p /data
sudo blkid
sudo mount -a
sudo mkdir -p /data/oiab
sudo chown -R "$USER:$USER" /data/oiab
```

Use `/etc/fstab` with the SSD UUID so `/data` mounts before Docker starts.

## Validation

```bash
docker compose --env-file config/oiab.env config
docker compose --env-file config/oiab.env up -d --build oiab-core
curl http://127.0.0.1/api/health
docker compose --env-file config/oiab.env logs --tail=100 oiab-core
```
