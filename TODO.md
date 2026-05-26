# TODO

- Clean remaining legacy text and localStorage keys in copied frontend assets.
- Replace temporary compatibility endpoint aliases with clean `/api/*` calls.
- Port full server-authoritative multiplayer game logic instead of first-pass lobby/score stubs.
- Add GPX/GeoJSON export endpoints backed by the new SQLite map/user store.
- Add explicit UI controls for map layer visibility and app/theme settings stored in SQLite.
- Expand the file upload UI beyond trivia packs into music, GPX, books, and content packs.
- Complete optional service install/start/stop/remove actions.
- Improve map sprites and POI symbol loading.
- Gradually replace any transitional legacy map visuals with original OIAB assets.
- Modernize sprite generation and custom OIAB map style evolution.
- Add overland-specific topo/trail styling enhancements.
- Validate PMTiles range-serving behavior on Raspberry Pi deployment.
- Add a TLS reverse-proxy container once the standalone certificate flow is finalized.
- Add optional in-container gpsd/device-passthrough override for users who do not want host gpsd.
- Add map-pack download/import workflow.
- Deepen Kiwix/Wikipedia integration.
- Add production HTTPS reverse proxy/unit integration.
- Add sync/backup strategy for family game data and waypoints.
