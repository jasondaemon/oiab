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

The first standalone backend can list manifests and basic systemd state. Install/start/stop/remove actions are intentionally stubbed until the service manager workflow is hardened.
