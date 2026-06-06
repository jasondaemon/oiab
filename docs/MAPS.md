# Maps

OIAB Maps v2 is a standalone MapLibre/PMTiles map app located at:

```text
/maps-v2/
```

## Map Packs

PMTiles files live under:

```text
/data/oiab/maps/packs
```

OIAB has two map-pack concepts:

- Catalog: `config/map-pack-catalog.json`, the installable/known pack list.
- Installed registry: SQLite plus `/data/oiab/maps/registry.json` compatibility import.

The Settings page is:

```text
/mobile/map-packs.html
/map-packs
```

## Acquisition

Supported paths:

- Direct PMTiles URL: catalog entries with `source_type=direct_pmtiles` download into `/data/oiab/maps/tmp/*.part`, then atomically move into `/data/oiab/maps/packs`.
- Protomaps extraction: catalog entries with `source_type=extract_from_parent` call `pmtiles extract` against the configured parent source and bounding box.
- Manual seed/import: copy `.pmtiles` files into `/data/oiab/maps/packs`, then click Rescan.

The Docker image includes the `pmtiles` CLI so world/CONUS/state extracts can run when internet is available. The parent Protomaps source is intentionally a catalog entry, not bundled in git.

## Map Pack API

```text
GET  /api/maps/packs/catalog
GET  /api/maps/packs/installed
GET  /api/maps/packs/status
GET  /api/maps/packs/diagnostics
POST /api/maps/packs/install
POST /api/maps/packs/set-active
POST /api/maps/packs/remove
POST /api/maps/packs/rescan
POST /api/maps/packs/import-path
```

Compatibility aliases remain:

```text
GET/POST /api/maps-v2/map-packs
GET/POST /maps-v2-map-packs
```

Example manual import:

```json
{"path":"/mnt/ssd/maps/protomaps-conus.pmtiles"}
```

The Python backend can serve PMTiles files from `/data/oiab/maps/packs` through `/maps/packs/<file>.pmtiles` and supports HTTP range requests. This is the fallback path.

Installed pack URLs returned by the registry are versioned from file metadata:

```text
/maps/packs/<file>.pmtiles?v=<file_size>-<mtime_ns>
```

If you manually replace a `.pmtiles` file, click **Rescan** in Map Packs so the stored file size/mtime and public URL version update. This prevents clients from reusing stale cached byte ranges from the old file.

For production and large packs, put Caddy or nginx in front of `oiab-core` and serve `/maps/packs/` directly from `/data/oiab/maps/packs`. OIAB includes example configs:

```text
deploy/caddy/Caddyfile
deploy/nginx/oiab.conf
```

The static server should return:

- `206 Partial Content` for byte-range requests
- `Accept-Ranges: bytes`
- `Cache-Control: public, max-age=31536000, immutable` only for versioned `?v=` PMTiles URLs
- `Cache-Control: no-cache` or `no-store` for unversioned PMTiles URLs
- `ETag` or `Last-Modified`

In `OIAB_DEV_MODE=true`, the Python fallback returns `Cache-Control: no-store` for static files so local pack replacement cannot be hidden by browser cache. In production, the Python fallback only uses immutable caching for versioned PMTiles URLs.

Diagnostics page:

```text
/map-diagnostics
```

Diagnostics API:

```text
/api/maps/packs/diagnostics
```

Tile-level checks:

```text
GET  /api/maps/packs/tile-check?pack=us_pa&z=10&x=293&y=391
GET  /api/maps/packs/range-check?pack=us_pa&range=bytes=0-16383
POST /api/maps/packs/validate
```

Maps v2 stores recent MapLibre tile errors in browser local storage and links them to `/map-diagnostics`. Use this flow for repeatable gray rectangles or missing tiles:

1. Open Maps v2 and reproduce the gray tile.
2. Open the Tile Diagnostics panel in the map or the browser console.
3. Copy the failing `z/x/y`, source id, and active pack id.
4. Open `/map-diagnostics` and run Tile Check.
5. If Tile Check reports `tile_exists=false`, regenerate or reinstall that map pack.
6. If Tile Check reports the tile exists but browser range checks fail, fix static serving/range support.
7. If Tile Check succeeds and range checks pass, clear browser site data for the OIAB hostname and retry.

To clear stale browser data, remove site data/cache for the OIAB hostname in the browser settings. On Chromium-based browsers this is usually under Site Settings → View permissions and data stored across sites. On mobile Safari, use Settings → Safari → Advanced → Website Data for the hostname.

If you manually replace a `.pmtiles` file, always click **Rescan** in Settings → Map Packs before testing. Rescan updates the versioned public URL so stale byte ranges are not reused.

## Offline Behavior

Maps v2 does not require internet after a PMTiles file is installed. It does not require API keys.

## Overlay Sources

Overlays are managed independently from the active basemap. They are not merged into PMTiles map packs and they do not duplicate the full basemap style.

Overlay catalog:

```text
config/map-overlays.json
```

Local overlay storage:

```text
/data/oiab/maps/overlays
/data/oiab/maps/cache
```

Overlay API:

```text
GET  /api/maps/overlays/catalog
GET  /api/maps/overlays
GET  /api/maps/overlays/status
POST /api/maps/overlays/rescan
POST /api/maps/overlays/set-enabled
POST /api/maps/overlays/set-opacity
POST /api/maps/overlays/set-order
POST /api/maps/overlays/wildfire/refresh
POST /api/maps/overlays/weather/alerts/refresh
POST /api/maps/overlays/mvum/roads/install
POST /api/maps/overlays/mvum/trails/install
GET  /api/maps/overlays/jobs
GET  /api/maps/overlays/jobs/<job_id>
GET  /api/geopdf
POST /api/geopdf/import
POST /api/geopdf/<id>/rebuild
DELETE /api/geopdf/<id>
```

Supported overlay source types:

- `raster_xyz` / `arcgis_raster`: tiled raster overlay such as USGS topo. USGS Topo is online-only for now.
- `geopdf_tiles`: locally rendered raster tiles from an imported georeferenced PDF.
- `geojson` / `cached_geojson`: local or cached GeoJSON rendered with default or overlay-specific styling.
- `pmtiles_vector` / `generated_pmtiles`: independent vector PMTiles overlay. PMTiles overlays need a known `source_layer`.

Settings → Map Packs includes an **Overlay Sources** section for layer toggles, opacity, ordering, rescan, availability, cache mode, and attribution. Enabled overlays are persisted in SQLite and loaded by Maps v2 on startup. Overlay layers are inserted below symbol/label layers by default so labels remain readable.

Current overlay direction:

- USGS Topo starts as an online National Map raster overlay. Full-CONUS offline raster topo is intentionally deferred because it can consume large amounts of storage.
- MVUM is the first full-US offline overlay target. OIAB can fetch roads/trails from the USFS EDW `EDW_MVUM_01` ArcGIS MapServer, normalize them to GeoJSON, and generate PMTiles when `tippecanoe` is available. Manual converted files under `/data/oiab/maps/overlays/mvum` are still detected by rescan.
- Wildfire hotspots use a cached NASA FIRMS GeoJSON snapshot. Live refresh requires `OIAB_FIRMS_MAP_KEY` when the selected FIRMS endpoint requires a key.
- NWS weather alerts use a cached GeoJSON snapshot from `api.weather.gov`, rendered offline until stale.
- NOAA Radar is available as an online-only nowCOAST raster overlay using the live base reflectivity mosaic.
- It is not cached for offline use yet; later work will add bbox-based area caching.
- GeoPDF maps are imported through File Uploads → GeoPDF Maps. GDAL detects geospatial metadata, rejects non-georeferenced PDFs, and renders local tiles under `/data/oiab/geopdf/processed`.

## Current Gaps

- Full offline search is not yet ported.
- Overlay caching is implemented for latest-snapshot GeoJSON overlays. Raster tile mirroring is not implemented yet.
- MVUM install jobs now have a default ArcGIS REST path. Explicit shapefile/file source overrides still require `ogr2ogr`; PMTiles output requires `tippecanoe`.
- Legacy map visual assets are tracked as transitional assets. OIAB-specific icons live separately so they can replace inherited visuals gradually.
- The Protomaps build URL in the catalog should be refreshed periodically or replaced by a curated OIAB pack repository.
- Explicit multi-pack basemap rendering is intentionally disabled. Maps v2 renders one active PMTiles basemap at a time to avoid duplicate full-style tile requests. Additional data should use purpose-built overlay sources/layers.

## Legacy Visual Assets

Maps v2 currently uses the license-compatible maps.black Protomaps light style and sprite set as a transitional visual baseline because OIAB's PMTiles packs use the Protomaps schema. Original OIAB SVG waypoint/category icons remain separate under `frontend/maps/icons`, and inherited map visuals live under `frontend/maps/sprites/legacy` and `frontend/maps/styles/legacy`.
