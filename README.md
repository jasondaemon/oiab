# Overland In A Box

Overland In A Box (OIAB) is a standalone offline-first overlanding appliance for a Raspberry Pi, vehicle head unit, tablet, and phone. It packages local maps, GPS, media, games, reference libraries, file management, and field networking behind one browser-based interface.

OIAB is its own platform. It does not require any external appliance framework, Ansible role set, or legacy runtime tree. Application code should be rebuildable from this repository; user content and generated data belong on durable storage such as an external SSD.

## What OIAB Provides

- Head-unit dashboard UI with a persistent left dock, map-focused home screen, music card, and vehicle/GPS card.
- Small-screen mobile UI for phones, launched from `mobile.daemonadventures.net` or `/mobile/`.
- Maps v2 using MapLibre, PMTiles basemaps, local saved data, GPS tracking, waypoints, routes, overlays, offline regions, GeoPDF overlays, and diagnostics.
- Map pack acquisition for World Overview, CONUS, states, and manual PMTiles imports.
- Overlay acquisition and caching for MVUM, BLM, wilderness/WSA, PAD-US, RIDB recreation sites, weather, wildfire, radar, temperature forecast, contours, satellite, and user overlays where configured.
- USB GPS via host `gpsd`, stabilized position output, and browser GPS fallback.
- Local music player with album art, full-screen mode, visualizers, and SSD-backed music indexing.
- File Browser-based LAN file manager for drag-and-drop uploads and durable storage access.
- Optional service integrations for Jellyfin, Komga, Kiwix, Web Emulator, Minecraft, Crafty, and RaspAP.
- Local game suite with persistent player identity, active games, scores, dictionaries/question packs, and mobile-first layouts.
- Raspberry Pi performance monitor, including CPU, memory, disks, temperature, network throughput, and optional Geekworm X1206 UPS telemetry.
- Certificate, hostname, service, plugin, storage, network, map, music, and game management through Central Settings.

Source credits, third-party data notices, and icon attributions are tracked in [`docs/ATTRIBUTIONS.md`](docs/ATTRIBUTIONS.md) and surfaced in Central Settings -> Data & Attributions.

## Repository Layout

```text
backend/                  OIAB Python backend and APIs
config/                   Default catalogs, app config, examples
docs/                     Deployment, data, maps, overlays, network, and service docs
frontend/                 Head-unit shell, mobile apps, maps, shared UI
scripts/                  Deployment, storage, overlay, and host helper scripts
services/                 Optional service manifests and compose fragments
docker-compose.yml        Core and optional-service container stack
Dockerfile                oiab-core image
```

## Runtime Model

The base runtime is `oiab-core`, a containerized Python web app serving:

- the dashboard shell and mobile UI
- APIs for maps, overlays, music, games, services, GPS, settings, files, and diagnostics
- static assets and fallback PMTiles/overlay range serving

Optional services run as separate containers or host services. OIAB stores launcher visibility, service metadata, and settings in SQLite, but large content stays in mounted directories.

## Durable Data

Default data root:

```text
/data/oiab
```

Trailer/Raspberry Pi production default:

```text
/srv/trailer/data/oiab
```

Important durable paths:

```text
/data/oiab/db/oiab.sqlite
/data/oiab/games/oiab-games.sqlite3
/data/oiab/maps/packs
/data/oiab/maps/overlays
/data/oiab/maps/tmp
/data/oiab/geopdf/originals
/data/oiab/geopdf/processed
/data/oiab/media/music-art
/data/oiab/trivia/questions
/data/oiab/services
/data/oiab/certs
```

Large SSD content is normally mounted separately and exposed to OIAB:

```text
/srv/trailer/media/music
/srv/trailer/media/books/Ebooks
/srv/trailer/media/books/Comics
/srv/trailer/media/books/PDFs
/srv/trailer/media/movies
/srv/trailer/media/tv
/srv/trailer/roms
/srv/trailer/wikis/zims
/srv/trailer/wikis/static
/srv/trailer/minecraft/server
/srv/trailer/jellyfin
```

Prepare the standard SSD layout:

```bash
sudo scripts/prepare-trailer-ssd-layout.sh
```

Each user-data directory may contain a short `README.md` explaining what belongs there. Regenerate those with:

```bash
python3 scripts/write_storage_readmes.py
```

## Quick Start: Local Development

```bash
cd /path/to/oiab_src
cp config/oiab.env.example config/oiab.env
scripts/dev.sh
```

Open:

```text
http://localhost:8080/
```

Use a local data directory when developing:

```bash
export OIAB_DATA_DIR="$PWD/data"
scripts/dev.sh
```

## Quick Start: Docker

```bash
cd /opt/oiab
cp config/oiab.env.example config/oiab.env
docker compose --env-file config/oiab.env up -d --build oiab-core filebrowser
```

Open:

```text
http://localhost:18120/
```

or the configured hostname:

```text
https://overland.daemonadventures.net/
```

Phone/mobile entrypoint:

```text
https://mobile.daemonadventures.net/
```

## Raspberry Pi Production Install

1. Install Raspberry Pi OS 64-bit.
2. Mount the SSD at the desired durable data root.
3. Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
newgrp docker
```

4. Clone OIAB:

```bash
sudo mkdir -p /opt
sudo chown "$USER:$USER" /opt
git clone https://github.com/jasondaemon/oiab.git /opt/oiab
cd /opt/oiab
cp config/oiab.env.example config/oiab.env
```

5. Edit `config/oiab.env` for hostname, ports, storage locations, GPS, optional service paths, and API keys.

6. Start the core stack:

```bash
docker compose --env-file config/oiab.env up -d --build oiab-core filebrowser
docker compose --env-file config/oiab.env ps
```

7. Optional services can be started by profile:

```bash
docker compose --env-file config/oiab.env --profile jellyfin up -d
docker compose --env-file config/oiab.env --profile komga up -d
docker compose --env-file config/oiab.env --profile kiwix up -d
docker compose --env-file config/oiab.env --profile minecraft up -d
docker compose --env-file config/oiab.env --profile raspap up -d
```

## Deployment From This Workstation

The project includes a deployment script that rsyncs source to the Pi, preserves data/config, rebuilds `oiab-core`, and recreates core services:

```bash
OIAB_DEPLOY_SSH_KEY="$HOME/.ssh/codex_ed25519" ./scripts/deploy.sh
```

The deploy script intentionally excludes local `data/`, git metadata, build caches, and generated Android artifacts.

## Maps

PMTiles basemaps live under:

```text
/data/oiab/maps/packs
```

Maps v2 supports:

- default World Overview bootstrap so first run is not blank
- CONUS and state PMTiles extraction from Protomaps
- manual PMTiles placement and rescan
- one active detailed basemap at a time
- low-zoom World Overview fallback
- versioned PMTiles URLs to avoid stale range-cache holes
- diagnostics for PMTiles headers, range serving, metadata, tile checks, cache headers, and load errors

Map pack management:

```text
Central Settings → Maps
```

Map diagnostics:

```text
/map-diagnostics
```

Production PMTiles serving should use the included static-server guidance/config for Caddy or nginx where available. Python range serving remains a fallback.

## Overlays

Overlay sources are independent from the basemap. They can be enabled, ordered, cached, refreshed, and styled without merging data into the PMTiles basemap.

Supported overlay categories include:

- topographic: USGS Topo raster, USGS contour PMTiles
- public lands: BLM SMA, BLM wilderness/WSA, PAD-US
- access/trails: MVUM roads and trails
- recreation: RIDB recreation sites
- water: NHD features, USGS stream gauges
- weather: radar, temperature forecast, NWS alerts, snow, wind, drought, lightning
- wildfire: FIRMS hotspots
- imagery: online satellite and future offline regions
- user: local GeoJSON/PMTiles and GeoPDF tile overlays

Overlay data lives under:

```text
/data/oiab/maps/overlays
```

GeoPDF imports:

```text
/data/oiab/geopdf/originals
/data/oiab/geopdf/processed
```

See [docs/OVERLAYS.md](docs/OVERLAYS.md) and [docs/MAPS.md](docs/MAPS.md).

## GPS

Docker mode expects host `gpsd` by default:

```text
OIAB_GPSD_HOST=host.docker.internal
OIAB_GPSD_PORT=2947
```

Install the Raspberry Pi host GPS helper during setup:

```bash
sudo ./scripts/install-gps-host.sh
```

It keeps GPS reconnects resilient by using stable `/dev/serial/by-id` paths and restarting `gpsd` on USB add/remove events.

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

## Raspberry Pi Networking

OIAB integrates with RaspAP for field networking:

- single wireless interface: client AP for OIAB access
- second wireless interface: upstream Wi-Fi such as Starlink, home, hotel, or campground Wi-Fi
- Ethernet remains a docked/failsafe option
- DNS/captive-check handling keeps `overland.daemonadventures.net`, `mobile.daemonadventures.net`, and local names reachable in field mode

RaspAP is a core component in production but can be disabled from Central Settings.

Docs:

- [docs/RASPAP.md](docs/RASPAP.md)
- [docs/NETWORK_MODES.md](docs/NETWORK_MODES.md)

## File Manager

OIAB uses [File Browser](https://filebrowser.org/) as the full file manager. It is mounted at the configured storage root and is intended for LAN drag-and-drop uploads, media management, map imports, PDFs, ROMs, and administrative file moves.

The built-in lightweight upload page is not the primary file management path.

## Optional Services

Optional service manifests live in:

```text
services/manifests
```

Compose fragments live in:

```text
services/compose
```

Central Settings exposes plugin status, enable/disable controls, install/start/stop actions when Docker control is allowed, and launch links.

Docker control requires:

```text
OIAB_ALLOW_DOCKER_CONTROL=true
```

## Certificates and Hostnames

TLS/certificate data belongs under:

```text
/data/oiab/certs
```

Central Settings includes certificate helpers and hostname settings for the production names:

```text
overland.daemonadventures.net
mobile.daemonadventures.net
```

RaspAP DNS and local network config should resolve those hostnames to the Pi in field mode.

## Operational Checks

Core health:

```bash
curl http://127.0.0.1:18120/api/health
docker ps
docker logs --tail=100 oiab-core
```

Disk usage:

```bash
df -h
du -sh /srv/trailer/data/oiab /srv/trailer/media /srv/trailer/wikis /srv/trailer/roms
```

Overlay jobs:

```bash
curl http://127.0.0.1:18120/api/maps/overlays/jobs
```

PMTiles/overlay directory:

```bash
find /srv/trailer/data/oiab/maps -maxdepth 4 -type f -ls
```

Network:

```bash
oiab-network-status
```

## Documentation

- [docs/DATA_LAYOUT.md](docs/DATA_LAYOUT.md)
- [docs/DOCKER.md](docs/DOCKER.md)
- [docs/DOCKER_DEPLOYMENT.md](docs/DOCKER_DEPLOYMENT.md)
- [docs/MAPS.md](docs/MAPS.md)
- [docs/OVERLAYS.md](docs/OVERLAYS.md)
- [docs/GPS.md](docs/GPS.md)
- [docs/RASPAP.md](docs/RASPAP.md)
- [docs/NETWORK_MODES.md](docs/NETWORK_MODES.md)
- [docs/PERFORMANCE_MONITOR.md](docs/PERFORMANCE_MONITOR.md)
- [docs/CERTIFICATES.md](docs/CERTIFICATES.md)
- [docs/OPTIONAL_SERVICES.md](docs/OPTIONAL_SERVICES.md)

## Development Principles

- Keep code and containers rebuildable.
- Keep user data on durable storage.
- Prefer offline-capable data where storage is reasonable.
- Keep online overlays graceful when offline.
- Do not make large raster downloads the default path when vector or bounded-region workflows are more practical.
- Avoid adding appliance-specific assumptions that make fresh installs harder.
