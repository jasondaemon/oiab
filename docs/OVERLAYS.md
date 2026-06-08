# Maps v2 Overlays

OIAB overlays are independent MapLibre sources layered over the active PMTiles basemap. They are not merged into the basemap.

## Storage

```text
/data/oiab/maps/overlays
/data/oiab/maps/overlays/mvum/source
/data/oiab/maps/overlays/mvum/geojson
/data/oiab/maps/overlays/mvum/pmtiles
/data/oiab/maps/overlays/wildfire
/data/oiab/maps/overlays/weather
/data/oiab/geopdf/originals
/data/oiab/geopdf/processed
/data/oiab/maps/cache
```

## Settings

Use Settings → Maps → Overlays.

Overlay cards show category, enabled state, cache state, opacity, layer order, last fetch time, feature count when available, job/install status, and storage path. Maps v2 also has an overlay checklist in the top-right layer panel for quick enable/disable while driving.

Overlay types are intentionally separate:

- Display-only overlays: online raster layers such as USGS Topo.
- Refreshable snapshot overlays: wildfire and weather GeoJSON caches.
- Install/generated overlays: MVUM source data converted into normalized GeoJSON and PMTiles, plus offline USGS contour generation.
- Imported map overlays: georeferenced PDFs rendered into local raster tiles.

## Overlay Expansion Pack

The overlay registry now supports broader categories for trip-planning data:

```text
Land & Boundaries
Water
Weather & Forecasts
Fire & Smoke
Sky & Satellite
Camping & Recreation
Connectivity
User / Imported
```

Every catalog overlay carries metadata for display name, category, data mode, source type, cache policy, min/max zoom, opacity, legend, attribution, refresh/install status, and tap behavior. Heavy datasets remain disabled/unavailable until a source file is generated or a provider URL/key is configured.

New catalog overlays:

| Overlay | Data mode | Status |
| --- | --- | --- |
| PAD-US Protected Lands | offline PMTiles | defaults to the USGS PAD-US 4.1 Vector Analysis PADUS-only ScienceBase package; optionally override with `OIAB_PADUS_SOURCE_URL` |
| NHD Water Features | offline PMTiles | build from `OIAB_NHD_SOURCE_URL` using `scripts/overlays/download-nhd` |
| RIDB Recreation Sites | cached GeoJSON | refresh with `OIAB_RIDB_API_KEY` plus bbox, or convert the official `RIDBFullExport_V1_JSON.zip` from `OIAB_RIDB_SOURCE_URL` |
| Snow Depth | online NOAA raster | online-only |
| Drought Monitor | cached GeoJSON | defaults to official current USDM GeoJSON; optional `OIAB_DROUGHT_GEOJSON_URL` override |
| USGS Stream Gauges | cached GeoJSON | refresh with bbox from USGS NWIS |
| Wind Forecast | placeholder | set `OIAB_WIND_FORECAST_TILE_URL` before enabling |
| Smoke Forecast | placeholder | set `OIAB_SMOKE_FORECAST_TILE_URL` before enabling |
| Dark Sky | offline raster tiles | build from `OIAB_DARKSKY_SOURCE_URL` using `scripts/overlays/build-darksky` |
| NASA GIBS Satellite | placeholder | set `OIAB_GIBS_TILE_URL` before enabling |
| Recent Lightning | cached GeoJSON | set `OIAB_LIGHTNING_GEOJSON_URL` |
| FCC Connectivity | provider PMTiles hook | import/build provider data manually |
| Parcel Import | provider PMTiles hook | import provider-specific PMTiles manually |

Refresh endpoints:

```text
POST /api/maps/overlays/<overlay_id>/refresh
POST /api/maps/overlays
  {"action":"refresh-overlay","id":"<overlay_id>"}
```

Supported lightweight refreshes today:

```text
ridb_recreation_sites
drought_monitor
stream_gauges_usgs
lightning_recent
firms_active_hotspots
nws_active_alerts
blm_sma_cached
blm_wilderness_wsa_cached
usgs_topographic_contours
```

Heavy vector/raster build scripts:

```text
scripts/overlays/download-padus
scripts/overlays/download-nhd
scripts/overlays/download-drought
scripts/overlays/download-ridb
scripts/overlays/build-darksky
scripts/overlays/build-pmtiles
```

Managed output paths:

```text
/data/oiab/maps/overlays/padus/pmtiles/padus-protected-lands.pmtiles
/data/oiab/maps/overlays/water/pmtiles/nhd-water-features.pmtiles
/data/oiab/maps/overlays/water/usgs-stream-gauges-latest.geojson
/data/oiab/maps/overlays/ridb/ridb-recreation-sites-latest.geojson
/data/oiab/maps/overlays/drought/usdm-latest.geojson
/data/oiab/maps/overlays/darksky/tiles/{z}/{x}/{y}.png
```

Source/cache directories under `padus/source`, `water/source`, `public-lands/source`, `darksky/source`, `contours/regions`, and `weather/forecast-cache` are excluded from local overlay auto-registration so generated working files do not show up as duplicate user overlays.

## Provider setup guidance

Settings → Maps → Overlays shows a collapsed **Details & Source** section for every provider-backed overlay. That section explains where to get the required key/package and what to paste into OIAB.

Recommended configuration by source:

| Overlay | User input | Source |
| --- | --- | --- |
| Wildfire Hotspots | Paste a free NASA FIRMS `MAP_KEY` | <https://firms.modaps.eosdis.nasa.gov/api/map_key/> |
| RIDB Recreation Sites | Paste a RIDB API key for bbox refreshes, or paste `https://ridb.recreation.gov/downloads/RIDBFullExport_V1_JSON.zip` as the source URL for a national offline cache | <https://ridb.recreation.gov/docs> |
| Drought Monitor | No input required; built-in current GeoJSON is used | <https://droughtmonitor.unl.edu/DmData/GISData.aspx> |
| PAD-US Protected Lands | Optional direct USGS PAD-US package URL. Leave blank to use the built-in PAD-US 4.1 Vector Analysis PADUS-only package. | <https://www.usgs.gov/programs/gap-analysis-project/science/pad-us-data-download> |
| NHD Water Features | Optional direct USGS NHD package URL | <https://apps.nationalmap.gov/downloader/> |
| Wind / Smoke / GIBS / Lightning / FCC / Dark Sky | Advanced provider URL only | See each overlay's Details & Source section |

Do not paste web landing pages into source URL fields. Use direct downloadable data packages, direct GeoJSON snapshots, or tile templates as described by each overlay. Key-based overlays should use the API key field, not a source URL.

## USGS Topo

USGS Topo is currently an online raster overlay using The National Map `USGSTopo` ArcGIS tile endpoint:

```text
https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}
```

Full offline raster topo is intentionally deferred because a broad raster cache can consume a large amount of SSD space. OIAB instead supports offline vector contours generated from USGS 3DEP / The National Map for a user-selected bbox or trip region.

## USGS Topographic Contours

OIAB can generate an offline vector contour overlay named `USGS Topographic Contours`.

Data flow:

1. Query USGS The National Map / 3DEP for `National Elevation Dataset (NED) 1/3 arc-second` DEM tiles covering a bbox.
2. Download and cache raw DEM GeoTIFF tiles under `/data/oiab/maps/overlays/contours/source`.
3. Merge the DEM tiles with `gdalbuildvrt`.
4. Clip the merged DEM to the requested bbox with `gdalwarp`.
5. Run `gdal_contour` to generate vector contour lines.
6. Normalize the contour attributes and package them into PMTiles at `/data/oiab/maps/overlays/contours/contours.pmtiles`.

Related configuration:

```text
OIAB_CONTOURS_ENABLED=true
OIAB_CONTOURS_BBOX=minLon,minLat,maxLon,maxLat
OIAB_CONTOURS_INTERVAL_FT=40
OIAB_CONTOURS_INDEX_INTERVAL_FT=200
OIAB_CONTOURS_MINZOOM=9
OIAB_CONTOURS_MAXZOOM=16
OIAB_CONTOURS_OUTPUT=/data/oiab/maps/overlays/contours/contours.pmtiles
```

Generated metadata is written next to the PMTiles archive and includes:

- source
- bbox
- contour interval
- index interval
- created_at
- DEM resolution
- commands/settings used

Contour display behavior:

- index contours visible from z9+
- normal contours visible from z11+
- contour labels visible from z12+
- contours remain an optional overlay and do not modify the basemap

## GeoPDF Maps

OIAB can import georeferenced PDF maps and render them as individual raster tile overlays.

Workflow:

1. Open File Manager / File Uploads.
2. Choose `GeoPDF Maps`.
3. Upload a PDF that contains geospatial metadata.
4. OIAB stores the original under `/data/oiab/geopdf/originals`.
5. GDAL reads the georeferencing metadata and renders tiles under `/data/oiab/geopdf/processed/<map_id>/tiles`.
6. The PDF appears as its own overlay in Maps v2 and can be enabled, disabled, faded, zoomed to, rebuilt, or cleared.

GeoPDF API:

```text
GET    /api/geopdf
POST   /api/geopdf/import
GET    /api/geopdf/<id>
POST   /api/geopdf/<id>/rebuild
POST   /api/geopdf/<id>/update
POST   /api/geopdf/<id>/delete
PATCH  /api/geopdf/<id>
DELETE /api/geopdf/<id>
GET    /tiles/geopdf/<id>/<z>/<x>/<y>.png
```

Processing requires GDAL tools inside the OIAB runtime:

```text
gdalinfo
gdalwarp
gdal2tiles.py
```

The Docker image installs `gdal-bin`. If a host or custom image is missing GDAL, imports fail with a clear `GDAL is not installed` message.

Supported PDFs are those GDAL can read as georeferenced PDFs, including common Adobe GeoPDF/LGIDict and ISO geospatial PDF metadata. Non-georeferenced PDFs are rejected and are not added to the overlay list.

Useful configuration:

```text
OIAB_GEOPDF_MIN_ZOOM=8
OIAB_GEOPDF_MAX_ZOOM=16
OIAB_GEOPDF_RENDER_DPI=300
OIAB_GEOPDF_TILE_SIZE=256
OIAB_GEOPDF_OUTPUT_FORMAT=png
```

`OIAB_GEOPDF_RENDER_DPI` controls how GDAL rasterizes vector/PDF content before tiling. The default is `300`; low values such as `72` produce visibly pixelated overlays when zoomed in. Scanned PDFs with low-resolution embedded imagery cannot be sharpened beyond their source image quality.

Troubleshooting:

- `PDF is not georeferenced`: the PDF has no usable geospatial metadata.
- `Could not determine GeoPDF bounds`: GDAL read the file but did not expose WGS84 bounds.
- `GDAL is not installed`: rebuild or update the runtime with GDAL tools.
- `Tile generation failed`: inspect `/api/maps/overlays/jobs` for the exact GDAL command stderr.
- Rebuild tiles with `POST /api/geopdf/<id>/rebuild`.
- Clear a tile cache from Settings → Maps → Overlays or `DELETE /api/geopdf/<id>`.

## MVUM

MVUM is the first planned national offline overlay because USFS vector data is smaller and directly useful for overlanding.

Supported install flow:

1. In Settings → Map Packs → Overlay Sources, click **Download/Generate MVUM Roads** or **Download/Generate MVUM Trails**.
2. OIAB uses the USFS EDW `EDW_MVUM_01` ArcGIS MapServer by default:

```text
https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer
```

3. The backend discovers the roads/trails layer, pages ArcGIS REST `query` responses as GeoJSON, stores raw source data, normalizes fields, then registers the output overlay.
4. If `tippecanoe` is available, OIAB builds PMTiles. If it is missing, OIAB keeps a GeoJSON overlay so install still completes, but PMTiles is preferred for large national overlays.

Manual fallback:

1. Download USFS Enterprise MVUM roads/trails source data.
2. Convert source data to GeoJSON or PMTiles.
3. Place outputs under:

```text
/data/oiab/maps/overlays/mvum/geojson
/data/oiab/maps/overlays/mvum/pmtiles
```

4. Click Rescan Overlays.
5. Enable the MVUM overlay.

Manual conversion shape:

```bash
ogr2ogr -f GeoJSONSeq /data/oiab/maps/overlays/mvum/geojson/mvum-roads-us.geojsonseq SOURCE_DATA
tippecanoe -o /data/oiab/maps/overlays/mvum/pmtiles/mvum-roads-us.pmtiles \
  -l mvum_roads --force --drop-densest-as-needed \
  /data/oiab/maps/overlays/mvum/geojson/mvum-roads-us.geojsonseq
```

Current in-app install flow:

```text
POST /api/maps/overlays/mvum/roads/install
POST /api/maps/overlays/mvum/trails/install
GET  /api/maps/overlays/jobs
GET  /api/maps/overlays/jobs/<job_id>
```

Optional source overrides:

```text
OIAB_MVUM_MAPSERVER_URL=https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer
OIAB_MVUM_ROADS_URL=...
OIAB_MVUM_TRAILS_URL=...
```

`OIAB_MVUM_ROADS_URL` and `OIAB_MVUM_TRAILS_URL` are for explicit file/shapefile source downloads. If they are not set, the ArcGIS REST MapServer path is used.

Install jobs write source data into:

```text
/data/oiab/maps/overlays/mvum/source
```

They normalize properties into GeoJSON under:

```text
/data/oiab/maps/overlays/mvum/geojson
```

When `tippecanoe` is available, they build PMTiles under:

```text
/data/oiab/maps/overlays/mvum/pmtiles
```

Tool behavior:

```text
ArcGIS REST install: no required local conversion tools
Explicit shapefile/file source: ogr2ogr required
PMTiles generation: tippecanoe preferred, pmtiles useful for diagnostics
```

If a required source/tool is missing, Settings shows the exact reason and does not fake a successful install. On Debian/Raspberry Pi hosts, the starting point is:

```bash
sudo apt-get install -y gdal-bin tippecanoe
```

Docker deployments need those tools inside the container image used for conversion. The base OIAB Docker image installs `gdal-bin`, `tippecanoe`, and the `pmtiles` CLI.

Normalization should preserve raw properties and map known fields to:

```text
route_id, route_name, route_type, vehicle_classes, season, allowed,
allowed_raw, high_clearance, style_bucket, source, forest_name, district,
raw_properties
```

## Wildfire

Wildfire hotspots are cached GeoJSON snapshots.

Endpoint:

```text
POST /api/maps/overlays/wildfire/refresh
```

Cache:

```text
/data/oiab/maps/overlays/wildfire/firms-latest.geojson
```

Live refresh uses NASA FIRMS. Paste the free MAP_KEY in
Settings -> Map Packs -> Wildfire Hotspots, or configure it with an
environment variable:

```text
OIAB_FIRMS_MAP_KEY=...
OIAB_FIRMS_SOURCE=VIIRS_SNPP_NRT
```

NASA FIRMS MAP_KEY request page:
https://firms.modaps.eosdis.nasa.gov/api/map_key/

Active fire data is informational and may be delayed, incomplete, or wrong.

## NWS Weather Alerts

NWS alerts are cached GeoJSON snapshots.

Endpoint:

```text
POST /api/maps/overlays/weather/alerts/refresh
```

Cache:

```text
/data/oiab/maps/overlays/weather/nws-alerts-latest.geojson
```

Default source:

```text
https://api.weather.gov/alerts/active?status=actual&message_type=alert
```

Cached alerts continue rendering offline and are marked stale after the configured refresh interval.

## Temperature Forecast

Temperature Forecast is an online NOAA/NWS raster overlay backed by the NDFD temperature MapServer:

```text
https://mapservices.weather.noaa.gov/raster/rest/services/NDFD/NDFD_temp/MapServer
```

The map overlay supports near-term temperature, max temperature, min temperature, and apparent / feels-like temperature when available from the NDFD service. Forecast period selection is exposed in the Maps v2 overlay panel.

Point forecast cards use the NWS API:

```text
https://api.weather.gov/points/{lat},{lon}
```

OIAB caches the point-to-grid lookup and recent hourly/daily forecast payloads under:

```text
/data/oiab/maps/overlays/weather/forecast-cache
```

Live temperature map tiles require internet. Cached point forecast details can still display offline with a stale-data warning. Map tiles are optional raster overlays and are layered below routes, waypoints, and vehicle markers.

## Future Satellite / Corridor Imagery

Full offline imagery is not implemented yet. The planned storage path for route-specific imagery caches is:

```text
/data/oiab/maps/overlays/imagery/routes
```

The intended product shape is route-corridor caching rather than broad full-CONUS imagery mirroring. This avoids consuming large SSD space for imagery outside the actual trip corridor.

## Manual User Overlays

Drop files into `/data/oiab/maps/overlays` and click Rescan Overlays:

- `.geojson`
- `.json`
- `.pmtiles`

PMTiles vector overlays need a known `source_layer` before they can render usefully.
