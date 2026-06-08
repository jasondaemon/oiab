# OIAB Data Layout

OIAB keeps user data and generated/cached content under `OIAB_DATA_DIR`, defaulting to:

```text
/data/oiab
```

Application code and containers should be rebuildable. User data, map packs, generated overlays, media, and app databases belong in durable storage.

## Map Overlays

```text
/data/oiab/maps/overlays
/data/oiab/maps/overlays/mvum/source
/data/oiab/maps/overlays/mvum/geojson
/data/oiab/maps/overlays/mvum/pmtiles
/data/oiab/maps/overlays/padus/source
/data/oiab/maps/overlays/padus/geojson
/data/oiab/maps/overlays/padus/pmtiles
/data/oiab/maps/overlays/water/source
/data/oiab/maps/overlays/water/geojson
/data/oiab/maps/overlays/water/pmtiles
/data/oiab/maps/overlays/public-lands/source
/data/oiab/maps/overlays/ridb
/data/oiab/maps/overlays/drought
/data/oiab/maps/overlays/darksky/source
/data/oiab/maps/overlays/darksky/tiles
/data/oiab/maps/overlays/connectivity
/data/oiab/maps/overlays/parcels
/data/oiab/maps/overlays/wildfire
/data/oiab/maps/overlays/weather
/data/oiab/maps/overlays/contours
```

Managed overlay outputs should be registered through the overlay catalog and rescan flow. Source/intermediate folders are intentionally ignored by local overlay auto-registration to prevent duplicate map layers.

## Map Packs

```text
/data/oiab/maps/packs
/data/oiab/maps/tmp
/data/oiab/maps/cache
```

PMTiles basemaps live in `maps/packs`. Temporary downloads and regional raster caches live outside the application image.

## GeoPDF

```text
/data/oiab/geopdf/originals
/data/oiab/geopdf/processed
/data/oiab/geopdf/tmp
```

Original PDFs and rendered tile caches are durable user data.
