# Overland In A Box

Overland In A Box (OIAB) is a standalone offline-first overlanding web platform. It is extracted from the earlier IIAB Overland work, but this repository is not an Internet-in-a-Box module and does not require IIAB, IIAB Ansible roles, `/opt/iiab`, `/library`, or `/etc/iiab`.

The base install is intentionally lean:

- responsive Overland shell UI
- Maps v2 with MapLibre, PMTiles, and local map-pack registry
- USB GPS/gpsd location endpoint with stabilized location output
- waypoints, folders, current track display stubs, and quick waypoint save
- persistent music player and local music scanner
- file/static upload workflow for music, trivia packs, PMTiles, books, comics, ZIM files, ROMs, visualizer images, and general uploads
- local games launcher with SQLite-backed active games, scores, player identity merges, and license plate tracking
- optional service manager framework
- certificate and hostname configuration docs/scripts

Optional plugins such as Jellyfin, Komga, Kiwix/Wikipedia, Web Emulator Runtime, and Minecraft are represented as managed manifests. They are not installed or shown in the launcher by default.

For a trailer-style install that reuses the existing SSD content layout, prepare the expected directories with:

```bash
sudo scripts/prepare-trailer-ssd-layout.sh
```

## Quick Start

### Local Python Runtime

```bash
cd /path/to/oiab_src
cp config/oiab.env.example config/oiab.env
scripts/dev.sh
```

Then open:

```text
http://localhost:8080/
```

### Docker Runtime

Docker is the preferred deployment path for Raspberry Pi installs:

```bash
cd /opt/oiab
cp config/oiab.env.example config/oiab.env
docker compose --env-file config/oiab.env up -d --build oiab-core
```

Open:

```text
http://overland.daemonadventures.net/
```

or the Pi LAN address while DNS is being configured.

The default production hostname is configurable and defaults to:

```text
overland.daemonadventures.net
```

## Data Directory

By default, runtime data lives under:

```text
/data/oiab
```

For local development, override it:

```bash
export OIAB_DATA_DIR="$PWD/data"
scripts/dev.sh
```

In Docker, the host path from `OIAB_DATA_DIR` is bind-mounted to `/data/oiab` inside the container. The trailer defaults keep OIAB app state under `/srv/trailer/data/oiab` while large existing SSD libraries stay in their original locations:

- Music: `/srv/trailer/media/music`
- Jellyfin media: `/srv/trailer/media`
- Books: `/srv/trailer/media/books/Ebooks`
- Comics: `/srv/trailer/media/books/Comics`
- Emulator ROMs: `/srv/trailer/roms`
- Kiwix/ZIM content: `/srv/trailer/iiab/zims`
- Jellyfin config/cache: `/srv/trailer/jellyfin`
- Minecraft server: `/srv/trailer/minecraft/server`

Game platform state is stored in:

```text
/data/oiab/games/oiab-games.sqlite3
```

Map/user/settings state is stored in:

```text
/data/oiab/db/oiab.sqlite
```

On first startup, compatible legacy GeoJSON/JSON map data is backed up and imported into SQLite without deleting the source files.

Trail Trivia reads category packs from:

```text
/data/oiab/trivia/questions
```

The File Uploads app can upload and list local content without rebuilding the frontend. Current upload targets are:

- Music: `/data/oiab/media/music`
- Trivia questions: `/data/oiab/trivia/questions`
- Map packs: `/data/oiab/maps/packs`
- Books: `/data/oiab/media/books`
- Comics: `/data/oiab/media/comics`
- Kiwix ZIM files: `/data/oiab/content/zim`
- Emulator ROMs: `/data/oiab/games/roms`
- Music visualizer images: `/data/oiab/media/music/visualizers`
- General uploads: `/data/oiab/media/uploads`

## Map Packs

Maps are core to OIAB, but map data is not committed to git.

PMTiles packs live under:

```text
/data/oiab/maps/packs
```

The installable catalog is `config/map-pack-catalog.json`. The installed registry is stored in SQLite and can import from:

```text
/data/oiab/maps/registry.json
```

On first run, OIAB checks for an active PMTiles pack. If none exists, it registers `/data/oiab/maps/packs/world-overview.pmtiles` when present. If that file is missing and `OIAB_AUTO_INSTALL_WORLD_MAP=true` (the default), OIAB starts a background World Overview install using `pmtiles extract`.

If no active PMTiles pack is ready yet, `/maps-v2/` shows setup progress and recovery actions instead of stopping at a dead end.

Manage installed packs from:

```text
/mobile/map-packs.html
```

Check PMTiles range/header behavior from:

```text
/map-diagnostics
```

Supported install paths:

- Catalog direct PMTiles URL download.
- Catalog extraction from a Protomaps parent source using `pmtiles extract`.
- Manual copy into `/data/oiab/maps/packs` followed by Rescan.

Set `OIAB_AUTO_INSTALL_WORLD_MAP=false` only when you explicitly want to skip first-run World Overview installation.

For production or large packs, serve `/maps/packs/` with the included Caddy/nginx static-server config instead of relying on Python fallback range serving. See `docs/DOCKER.md`.

## Raspberry Pi + External SSD Docker Install

1. Install Raspberry Pi OS 64-bit and connect the external SSD.
2. Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
newgrp docker
```

3. Mount the SSD at `/data`. Use your actual device/UUID from `lsblk` and `blkid`; do not format a disk that already contains data you need.

```bash
lsblk
sudo mkdir -p /data
sudo blkid
```

Example `/etc/fstab` entry:

```text
UUID=YOUR-SSD-UUID /data ext4 defaults,noatime 0 2
```

Then:

```bash
sudo mount -a
sudo mkdir -p /data/oiab
sudo chown -R "$USER:$USER" /data/oiab
```

4. Clone and configure OIAB:

```bash
sudo mkdir -p /opt
sudo chown "$USER:$USER" /opt
git clone https://github.com/jasondaemon/oiab.git /opt/oiab
cd /opt/oiab
cp config/oiab.env.example config/oiab.env
```

Edit `config/oiab.env` for hostname, published ports, GPS, and optional service settings.

5. Put map packs and certs under the SSD-backed data directory:

```text
/data/oiab/maps/packs/protomaps-conus.pmtiles
/data/oiab/certs/
```

6. Start the base platform:

```bash
docker compose --env-file config/oiab.env up -d --build oiab-core
docker compose --env-file config/oiab.env ps
```

7. Start optional plugins/services only when wanted:

```bash
docker compose --env-file config/oiab.env --profile jellyfin up -d
docker compose --env-file config/oiab.env --profile komga up -d
docker compose --env-file config/oiab.env --profile kiwix up -d
docker compose --env-file config/oiab.env --profile minecraft up -d
```

The in-app Plugins page can enable/disable launcher visibility after install. Docker start/stop actions require Docker Compose access from the backend; otherwise the page shows the exact host command to run.

Install the offline EmulatorJS runtime with the Plugins page, or from the host:

```bash
docker compose --env-file config/oiab.env exec oiab-core scripts/install-emulatorjs.sh
```

## GPS With Docker

The Docker-first path expects `gpsd` to run on the Pi host. OIAB reads it from inside the container using:

```text
OIAB_GPSD_HOST=host.docker.internal
OIAB_GPSD_PORT=2947
```

The compose file maps `host.docker.internal` to Docker's host gateway. On the Pi, configure `gpsd` to accept host-gateway connections, then verify:

```bash
gpspipe -w -n 5
docker compose --env-file config/oiab.env exec oiab-core python - <<'PY'
from backend.app.gps.gpsd import read_gpsd
print(read_gpsd())
PY
```

If you later want in-container `gpsd`, pass the USB GPS device through with a compose override and point `OIAB_GPSD_HOST` at that gpsd container. The base install does not require that mode.

## Docker Compose Profiles

The base install starts only `oiab-core`.

Optional profiles:

- `jellyfin`
- `komga`
- `kiwix`
- `minecraft`
- grouped aliases: `media`, `reading`, `wiki`, `games`, `optional`

Example:

```bash
docker compose --env-file config/oiab.env --profile media up -d
```

## Current Status

This is the first standalone extraction pass. It is runnable, but intentionally preserves several compatibility aliases while we migrate individual apps away from legacy naming and API shapes.

See:

- [Architecture](ARCHITECTURE.md)
- [Migration Notes](MIGRATION.md)
- [Data Layout](DATA_LAYOUT.md)
- [Docker Deployment](docs/DOCKER_DEPLOYMENT.md)
- [TODO](TODO.md)
- [Third Party Notices](THIRD_PARTY_NOTICES.md)
