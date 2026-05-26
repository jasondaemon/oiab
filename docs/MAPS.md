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

If no data-dir registry exists, OIAB uses `config/map-packs.json`.

## Offline Behavior

Maps v2 does not require internet after a PMTiles file is installed. It does not require API keys.

## Current Gaps

- Full offline search is not yet ported.
- Future overlay registry entries are planned for USGS topo, MVUM, public lands, weather, radar, and wildfire data.

