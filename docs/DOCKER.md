# Docker

OIAB is Docker-first. Base state lives under one bind mount:

```text
/data/oiab
```

## Base Runtime

```bash
docker compose up -d --build oiab-core
```

The core container serves the app and includes Python fallback range serving for:

```text
/maps/packs/*.pmtiles
```

The core image also installs GDAL tools used by overlay generation and GeoPDF imports:

```text
gdalinfo
gdalwarp
gdal2tiles.py
```

GeoPDF originals and processed tiles live on the `/data/oiab` bind mount, so tile caches survive container rebuilds:

```text
/data/oiab/geopdf/originals
/data/oiab/geopdf/processed
```

## Production PMTiles Serving

For large PMTiles files, serve map packs with a static web server and proxy the rest of OIAB to `oiab-core`.

Caddy example:

```bash
docker compose --profile static-server up -d --build oiab-core oiab-web
```

By default the Caddy profile listens on:

```text
OIAB_WEB_HTTP_PUBLISHED_PORT=18080
```

Use `deploy/caddy/Caddyfile` as the reference. It serves:

```text
/maps/packs/ -> /data/oiab/maps/packs
```

Required PMTiles response behavior:

- byte range support with `206 Partial Content`
- `Accept-Ranges: bytes`
- long-lived immutable cache headers only for registry-generated versioned URLs such as `/maps/packs/us-pa.pmtiles?v=<file_size>-<mtime_ns>`
- `no-cache` or `no-store` for unversioned PMTiles URLs
- `ETag` or `Last-Modified`

An nginx equivalent lives at:

```text
deploy/nginx/oiab.conf
```

## Diagnostics

Open:

```text
/map-diagnostics
```

or call:

```text
GET /api/maps/packs/diagnostics
```

The diagnostics report active pack path, versioned public URL, size, mtime, file readability, HEAD response, byte-range response, `Cache-Control`, and whether the active PMTiles URL returns `206 Partial Content`.

If a PMTiles file is replaced manually on the host or external SSD, rescan packs from Settings → Map Packs before loading Maps v2. Rescan updates the file size/mtime version in the public URL so browsers and PMTiles range caches do not reuse stale byte ranges.

## Host Wi-Fi/AP Network Manager

The OIAB network mode manager is installed on the Raspberry Pi host, not inside `oiab-core`.

Docker continues to serve the web app while the host manager switches the Pi between:

- Ethernet docked/router mode
- offline Wi-Fi AP mode
- optional AP plus Starlink WAN NAT mode

Install on the Pi:

```bash
cd /srv/trailer/oiab
sudo OIAB_NETWORK_CONFIG=/srv/trailer/data/oiab/config/network.env scripts/install-network-mode-manager.sh
oiab-network-status
```

Central Settings → HotSpot Config writes the `network.env` consumed by the host service.

See `docs/NETWORK_MODES.md` for rollback, diagnostics, and Starlink notes.

## Raspberry Pi UPS Battery Telemetry

The Performance Monitor can read a Geekworm X1206 UPS HAT over I2C. On Raspberry Pi deployments, install host packages and enable I2C:

```bash
sudo apt-get install -y i2c-tools python3-smbus python3-smbus2
i2cdetect -y 1
```

The X1206 should appear at address `0x36`. `scripts/deploy.sh` automatically maps `/dev/i2c-1` into `oiab-core` when it exists. Manual Compose deployments can set:

```bash
OIAB_I2C_DEVICE_HOST=/dev/i2c-1 docker compose up -d --build oiab-core
```

See `docs/PERFORMANCE_MONITOR.md` for full verification and troubleshooting.

## Trusted Local HTTPS Hostnames

The production headunit hostname is:

```text
overland.daemonadventures.net
```

The small-screen/mobile launcher hostname is:

```text
mobile.daemonadventures.net
```

Field-mode DNS should resolve both names to the Pi AP IP. The trusted HTTPS certificate should include SANs for:

```text
overland.daemonadventures.net
*.overland.daemonadventures.net
mobile.daemonadventures.net
```

The mobile hostname is intentionally a sibling of `overland.daemonadventures.net`, not `mobile.overland.daemonadventures.net`, so phone URLs stay short while the headunit remains the default production UI.
