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
/data/oiab/trivia/questions
/data/oiab/trivia/backups
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

Current first-pass persistence is SQLite for game platform data and JSON/GeoJSON for map/user content:

- waypoints: `/data/oiab/waypoints/trailer-places.geojson`
- current track: `/data/oiab/tracks/current.geojson`
- active games, score history, player identity merges, and license plates: `/data/oiab/games/oiab-games.sqlite3`
- trivia question packs: `/data/oiab/trivia/questions/*.json`
- music cache: `/data/oiab/media/music-library.json`

The game database runs in SQLite WAL mode so multiple local clients can read while short writes are committed safely. Future hardening target: migrate waypoints, folders, tracks, settings, and sync metadata behind the same style of storage modules.
