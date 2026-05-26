# Data Layout

Default root:

```text
OIAB_DATA_DIR=/data/oiab
```

Subdirectories:

```text
/data/oiab/config
/data/oiab/db
/data/oiab/maps/packs
/data/oiab/maps/styles
/data/oiab/maps/sprites
/data/oiab/media/music
/data/oiab/media/music/visualizers
/data/oiab/media/books
/data/oiab/media/comics
/data/oiab/media/uploads
/data/oiab/trivia/questions
/data/oiab/trivia/backups
/data/oiab/games
/data/oiab/games/roms
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

Primary durable state is SQLite:

- OIAB map/user/settings database: `/data/oiab/db/oiab.sqlite`
- active games, score history, player identity merges, and license plates: `/data/oiab/games/oiab-games.sqlite3`
- trivia question packs: `/data/oiab/trivia/questions/*.json`
- music cache: `/data/oiab/media/music-library.json`
- uploaded local content:
  - music: `/data/oiab/media/music`
  - books: `/data/oiab/media/books`
  - comics: `/data/oiab/media/comics`
  - emulator ROMs: `/data/oiab/games/roms`
  - Kiwix ZIM files: `/data/oiab/content/zim`
  - PMTiles map packs: `/data/oiab/maps/packs`

The OIAB database stores:

- waypoint folders/categories and visibility
- waypoints
- saved/current tracks
- track points
- map-pack registry metadata
- map settings and layer visibility
- app settings
- sync metadata placeholders

Legacy JSON/GeoJSON files are imported on first startup when present:

- `/data/oiab/waypoints/trailer-places.geojson`
- `/data/oiab/tracks/current.geojson`
- `/data/oiab/maps/registry.json`

Before import, source files are copied to:

```text
/data/oiab/backups/migrations
```

The import is transactional at the database layer and does not delete legacy files.

SQLite runs in WAL mode so multiple local clients can read while short writes are committed safely. The deployment is still a single-node appliance; do not place the database on a network filesystem.
