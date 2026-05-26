from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = REPO_ROOT


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    hostname: str = os.environ.get("OIAB_HOSTNAME", "overland.daemonadventures.net")
    bind_host: str = os.environ.get("OIAB_BIND_HOST", "0.0.0.0")
    http_port: int = int(os.environ.get("OIAB_PORT_HTTP", "8080"))
    https_port: int = int(os.environ.get("OIAB_PORT_HTTPS", "8443"))
    data_dir: Path = Path(os.environ.get("OIAB_DATA_DIR", "/data/oiab"))
    dev_mode: bool = env_bool("OIAB_DEV_MODE", True)
    map_pack_registry: Path | None = None
    enable_optional_services: bool = env_bool("OIAB_ENABLE_OPTIONAL_SERVICES", False)
    default_map_app: str = os.environ.get("OIAB_DEFAULT_MAP_APP", "maps_v2")
    cert_mode: str = os.environ.get("OIAB_CERT_MODE", "existing")

    def __post_init__(self) -> None:
        registry = os.environ.get("OIAB_MAP_PACK_REGISTRY")
        object.__setattr__(self, "map_pack_registry", Path(registry) if registry else self.data_dir / "maps" / "registry.json")

    @property
    def cert_dir(self) -> Path:
        return self.data_dir / "certs"

    @property
    def frontend_dir(self) -> Path:
        return REPO_ROOT / "frontend"

    @property
    def config_dir(self) -> Path:
        return REPO_ROOT / "config"


DATA_SUBDIRS = [
    "config",
    "maps/packs",
    "maps/styles",
    "maps/sprites",
    "media/music",
    "media/uploads",
    "games",
    "tracks",
    "waypoints",
    "content/zim",
    "services/jellyfin",
    "services/komga",
    "services/minecraft",
    "certs",
    "logs",
    "backups",
]


def ensure_data_layout(settings: Settings) -> None:
    for subdir in DATA_SUBDIRS:
        (settings.data_dir / subdir).mkdir(parents=True, exist_ok=True)


SETTINGS = Settings()
