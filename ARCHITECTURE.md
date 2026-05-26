# Architecture

OIAB is a small standalone appliance-style web platform.

```text
OIAB
├── backend/app
│   ├── main.py              # HTTP server, static routes, JSON APIs
│   ├── config.py            # env/config and data-dir layout
│   ├── gps/                 # gpsd reader and stabilization logic
│   ├── app_db.py            # SQLite map/user/settings storage
│   ├── storage.py           # compatibility helpers over SQLite storage
│   └── services.py          # optional service manifest/status reader
├── frontend
│   ├── shell/               # responsive parent shell
│   ├── maps/                # Maps v2 MapLibre/PMTiles app
│   ├── mobile/              # mobile/game app surfaces from prior work
│   └── shared/overland/     # shared icons, music, places, and app assets
├── config
│   ├── apps.json
│   ├── services.json
│   ├── map-packs.json
│   └── oiab.env.example
├── services
│   ├── manifests/           # optional service metadata
│   └── compose/             # optional service compose fragments
└── scripts
```

## Runtime Model

The root route `/` serves the Overland shell. Apps open inside the shell viewport or as direct routes.

Important routes:

- `/` - OIAB shell
- `/maps-v2/` - standalone Maps v2 app
- `/mobile/` - mobile launcher and game apps
- `/music` - music controller page
- `/gps-status` - GPS status app
- `/settings` - settings/admin app surface
- `/api/location/current` - stabilized GPS/location JSON
- `/api/maps-v2/map-packs` - installed map-pack registry
- `/api/services` - optional service status

## Data Storage

OIAB uses SQLite for durable appliance state that multiple local clients read and update:

- `/data/oiab/db/oiab.sqlite` for map/user/settings data
- `/data/oiab/games/oiab-games.sqlite3` for the game platform

The map/user database stores waypoints, folders, saved tracks, track points, map packs, map settings, app settings, and sync placeholders. Legacy GeoJSON/JSON files are imported on startup when present and backed up before import.

SQLite is appropriate here because OIAB is a single-node local appliance. WAL mode keeps concurrent browser reads responsive while short writes are serialized safely.

## Compatibility Aliases

Several frontend modules still expect legacy endpoint names. The backend serves aliases such as `/maps-location-current`, `/maps-v2-map-packs`, `/maps-data`, `/maps-quick-save`, `/mobile-games`, and `/game-stats` during migration.

These aliases are temporary compatibility shims, not IIAB dependencies.
