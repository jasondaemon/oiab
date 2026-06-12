# OpenCaching Overlay

OIAB supports OpenCaching geocache data as a cached GeoJSON overlay.

## Source

Default source:

`https://www.opencaching.us/okapi/`

OpenCaching live refresh uses OKAPI and requires a consumer key from the OpenCaching site. Do not commit API keys to the repo.

Attribution:

`OpenCaching.us / OKAPI geocache data.`

## Cache Paths

Cached output:

`/data/oiab/maps/overlays/opencaching/opencaching-latest.geojson`

Offline GPX import directory:

`/data/oiab/maps/overlays/opencaching/import/`

Place `.gpx` files in the import directory and refresh the overlay to cache them.

## Configuration

Settings/environment:

- `OIAB_OPENCACHING_CONSUMER_KEY` - OKAPI consumer key for live bbox refresh.
- `OIAB_OPENCACHING_BASE_URL` - OKAPI base URL, defaults to OpenCaching.us.
- `OIAB_OPENCACHING_BBOX` - live refresh bbox as `minLon,minLat,maxLon,maxLat`.
- `OIAB_OPENCACHING_SHOW_UNAVAILABLE=true` - include unavailable/archived caches where supported.

## Offline Behavior

Cached OKAPI data and imported GPX files render offline. Without a key, live refresh is disabled, but GPX imports still work.
