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

The first standalone backend can list manifests and basic systemd state. Install/start/stop/remove actions are intentionally stubbed until the service manager workflow is hardened.

