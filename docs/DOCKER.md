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
