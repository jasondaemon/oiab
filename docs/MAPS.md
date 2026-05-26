# Maps

OIAB Maps v2 is a standalone MapLibre/PMTiles map app located at:

```text
/maps-v2/
```

## Map Packs

Expected default PMTiles path:

```text
/data/oiab/maps/packs/protomaps-conus.pmtiles
```

Map packs are declared in the registry:

```text
/data/oiab/maps/registry.json
```

If no data-dir registry exists, OIAB seeds from `config/map-packs.json` and then stores map-pack metadata in:

```text
/data/oiab/db/oiab.sqlite
```

## Map Pack API

```text
GET  /api/maps-v2/map-packs
POST /api/maps-v2/map-packs
```

Supported POST actions:

```json
{"action":"rescan"}
{"action":"set-active","id":"protomaps-conus"}
{"action":"import-path","path":"/mnt/ssd/maps/protomaps-conus.pmtiles"}
```

The backend serves PMTiles files from `/data/oiab/maps/packs` through `/maps/packs/<file>.pmtiles` and supports HTTP range requests.

The mobile/admin Map Packs page is available at:

```text
/mobile/map-packs.html
/map-packs
```

## Offline Behavior

Maps v2 does not require internet after a PMTiles file is installed. It does not require API keys.

## Current Gaps

- Full offline search is not yet ported.
- Future overlay registry entries are planned for USGS topo, MVUM, public lands, weather, radar, and wildfire data.
- Legacy map visual assets are tracked as transitional assets. OIAB-specific icons live separately so they can replace inherited visuals gradually.

## Legacy Visual Assets

Maps v2 currently includes original OIAB SVG waypoint/category icons and vendored MapLibre/PMTiles runtime files. Any IIAB/maps.black-derived CSS, sprites, or icons must remain separated under legacy asset folders and be documented in `THIRD_PARTY_NOTICES.md` before release packaging.
