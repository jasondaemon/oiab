# Architecture

OIAB is a small standalone appliance-style web platform.

```text
OIAB
├── backend/app
│   ├── main.py              # HTTP server, static routes, JSON APIs
│   ├── config.py            # env/config and data-dir layout
│   ├── gps/                 # gpsd reader and stabilization logic
│   ├── storage.py           # current JSON/GeoJSON persistence helpers
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

## Compatibility Aliases

Several frontend modules still expect legacy endpoint names. The backend serves aliases such as `/maps-location-current`, `/maps-v2-map-packs`, `/maps-data`, `/maps-quick-save`, `/mobile-games`, and `/game-stats` during migration.

These aliases are temporary compatibility shims, not IIAB dependencies.

