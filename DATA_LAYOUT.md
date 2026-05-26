# Data Layout

Default root:

```text
OIAB_DATA_DIR=/data/oiab
```

Subdirectories:

```text
/data/oiab/config
/data/oiab/maps/packs
/data/oiab/maps/styles
/data/oiab/maps/sprites
/data/oiab/media/music
/data/oiab/media/uploads
/data/oiab/games
/data/oiab/tracks
/data/oiab/waypoints
/data/oiab/content/zim
/data/oiab/services/jellyfin
/data/oiab/services/komga
/data/oiab/services/minecraft
/data/oiab/certs
/data/oiab/logs
/data/oiab/backups
```

Current first-pass persistence is JSON/GeoJSON:

- waypoints: `/data/oiab/waypoints/trailer-places.geojson`
- current track: `/data/oiab/tracks/current.geojson`
- game lobby state: `/data/oiab/games/mobile-games.json`
- score data: `/data/oiab/games/scoreboard.json`
- music cache: `/data/oiab/media/music-library.json`

Future hardening target: migrate durable data to SQLite behind the storage modules.

