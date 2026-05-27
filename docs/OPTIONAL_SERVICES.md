# Optional Plugins / Services

Optional plugins are not installed or shown in the launcher by default. Install and enable a plugin to expose its app icon.

Current manifests:

- Jellyfin
- Komga
- Kiwix / Offline Wikipedia
- Web Emulator Runtime
- Minecraft

Manifests live under:

```text
services/manifests
```

Compose fragments live under:

```text
services/compose
```

The root `docker-compose.yml` also includes profile-backed services:

```bash
docker compose --env-file config/oiab.env --profile jellyfin up -d
docker compose --env-file config/oiab.env --profile komga up -d
docker compose --env-file config/oiab.env --profile kiwix up -d
docker compose --env-file config/oiab.env --profile minecraft up -d
```

The Web Emulator Runtime is an asset plugin. Installing it downloads the offline EmulatorJS runtime into:

```text
/data/oiab/services/emulatorjs/data
```

The launcher uses ROM files from:

```text
/data/oiab/games/roms
```

Grouped profile aliases:

- `media`
- `reading`
- `wiki`
- `games`
- `optional`

The plugin manager UI is available at:

```text
/mobile/services.html
/service-manager
```

The backend lists manifests and checks Docker Compose or asset state. Enable/disable controls affect launcher visibility. Docker install/start/stop/restart/remove actions are disabled by default because they require host-level Docker control.

To enable those actions on a trusted local appliance:

```text
OIAB_ALLOW_DOCKER_CONTROL=true
```

Current implementation runs `docker compose` from the OIAB repo directory when Docker control is enabled and available. If Docker control is disabled, the Plugins page shows the host command to run and lets you enable launcher visibility after the service is installed.

## Content Paths

```text
/srv/trailer/iiab/zims -> /data/oiab/content/zim
/srv/trailer/media -> /data/oiab/media
/srv/trailer/media/books/Ebooks -> /data/oiab/media/books
/srv/trailer/media/books/Comics -> /data/oiab/media/comics
/srv/trailer/jellyfin/config -> Jellyfin /config
/srv/trailer/jellyfin/cache -> Jellyfin /cache
/srv/trailer/minecraft/server -> Minecraft /data
/srv/trailer/roms -> /data/oiab/games/roms
/srv/trailer/data/oiab/services/emulatorjs/data -> /maps/emulatorjs/data/
```

Kiwix expects ZIM content under `/data/oiab/content/zim`. The first compose profile uses `kiwix-serve --library /data/library.xml`; a future ZIM manager should generate or update that library file.
