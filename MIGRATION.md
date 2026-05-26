# Migration Notes

This repository is a product extraction from prior IIAB Overland work.

## What Was Ported

- universal Overland shell frontend
- Maps v2 MapLibre/PMTiles proof of concept
- local MapLibre, PMTiles, icon, and font assets
- GPS status frontend
- gpsd current-location backend and stabilization layer
- SQLite-backed waypoint/folder/track/map-pack storage with legacy GeoJSON import
- music shell/player frontend and local music library scanner
- mobile launcher and game frontends
- optional service manifests for Jellyfin, Komga, Kiwix, and Minecraft
- standalone data layout rooted at `OIAB_DATA_DIR`

## What Was Intentionally Not Ported As A Requirement

- IIAB installation
- IIAB Ansible roles
- IIAB Admin Console
- `/opt/iiab`, `/library`, or `/etc/iiab` paths
- preinstalled Jellyfin, Komga, Kiwix, Minecraft, or map packs

## Migration Helper Scope

The script `scripts/migrate-from-iiab-overland.py` is a scaffold for importing:

- waypoints and folders
- tracks
- settings
- music metadata
- game scores
- map-pack registry references

It does not yet perform every conversion.

## Test Checklist

1. Run `scripts/dev.sh`.
2. Open `http://localhost:8080/`.
3. Open `/maps-v2/`.
4. Confirm missing map-pack state appears when no PMTiles exists.
5. Put a small PMTiles file in `OIAB_DATA_DIR/maps/packs` and update registry if needed.
6. Confirm `/api/maps-v2/map-packs` reports the file.
7. Confirm `/api/location/current` returns JSON even without gpsd.
8. Confirm `/api/services` lists optional services as not installed.
9. Add a quick waypoint and confirm it appears through `/api/map-data` and in `OIAB_DATA_DIR/db/oiab.sqlite`.
10. Put MP3 files in `OIAB_DATA_DIR/media/music`, open Music, and run Scan Library.

## Legacy Data Import

On startup, OIAB imports compatible legacy files into `/data/oiab/db/oiab.sqlite`:

- `/data/oiab/waypoints/trailer-places.geojson`
- `/data/oiab/tracks/current.geojson`
- `/data/oiab/maps/registry.json`

The source files are backed up under `/data/oiab/backups/migrations` and are not deleted. If an import fails, the failure is logged and the source files remain untouched.
