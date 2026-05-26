# Optional Services

Optional services are not installed by default.

Current manifests:

- Jellyfin
- Komga
- Kiwix / Offline Wikipedia
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

Grouped profile aliases:

- `media`
- `reading`
- `wiki`
- `games`
- `optional`

The service manager UI is available at:

```text
/mobile/services.html
/service-manager
```

The backend lists manifests and checks Docker Compose state. Install/start/stop/restart/remove actions are disabled by default because they require host-level Docker control.

To enable those actions on a trusted local appliance:

```text
OIAB_ALLOW_DOCKER_CONTROL=true
```

Current implementation runs `docker compose` from the OIAB repo directory. This is safer than blindly exposing Docker control in the UI by default, but it is still a privileged host operation. Leave it disabled for public or untrusted networks.

## Content Paths

```text
/data/oiab/content/zim
/data/oiab/media
/data/oiab/media/books
/data/oiab/media/comics
/data/oiab/services/jellyfin
/data/oiab/services/komga
/data/oiab/services/minecraft
```

Kiwix expects ZIM content under `/data/oiab/content/zim`. The first compose profile uses `kiwix-serve --library /data/library.xml`; a future ZIM manager should generate or update that library file.
