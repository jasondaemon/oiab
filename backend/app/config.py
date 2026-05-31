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
    db_path: Path | None = None
    dev_mode: bool = env_bool("OIAB_DEV_MODE", True)
    map_pack_registry: Path | None = None
    enable_optional_services: bool = env_bool("OIAB_ENABLE_OPTIONAL_SERVICES", False)
    default_map_app: str = os.environ.get("OIAB_DEFAULT_MAP_APP", "maps_v2")
    cert_mode: str = os.environ.get("OIAB_CERT_MODE", "existing")
    gpsd_socket: str = os.environ.get("OIAB_GPSD_SOCKET", "")
    gpsd_host: str = os.environ.get("OIAB_GPSD_HOST", "127.0.0.1")
    gpsd_port: int = int(os.environ.get("OIAB_GPSD_PORT", "2947"))
    allow_docker_control: bool = env_bool("OIAB_ALLOW_DOCKER_CONTROL", False)
    settings_pin: str = os.environ.get("OIAB_SETTINGS_PIN", "314159")
    ap_passphrase: str = os.environ.get("OIAB_AP_PASSPHRASE", "")
    auto_install_world_map: bool = env_bool("OIAB_AUTO_INSTALL_WORLD_MAP", True)
    firms_map_key: str = os.environ.get("OIAB_FIRMS_MAP_KEY", "")
    firms_source: str = os.environ.get("OIAB_FIRMS_SOURCE", "VIIRS_SNPP_NRT")
    nws_alerts_url: str = os.environ.get("OIAB_NWS_ALERTS_URL", "https://api.weather.gov/alerts/active?status=actual&message_type=alert")
    mvum_mapserver_url: str = os.environ.get("OIAB_MVUM_MAPSERVER_URL", "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer")
    mvum_roads_url: str = os.environ.get("OIAB_MVUM_ROADS_URL", "")
    mvum_trails_url: str = os.environ.get("OIAB_MVUM_TRAILS_URL", "")
    filebrowser_port: int = int(os.environ.get("FILEBROWSER_PORT", "8091"))
    minecraft_map_port: int = int(os.environ.get("MINECRAFT_MAP_PORT", "8123"))
    minecraft_admin_port: int = int(os.environ.get("MINECRAFT_ADMIN_PORT", "8452"))
    filebrowser_url: str = os.environ.get("FILEBROWSER_URL", "")
    jellyfin_url: str = os.environ.get("JELLYFIN_URL", "")
    komga_url: str = os.environ.get("KOMGA_URL", "")
    komga_proxy_target: str = os.environ.get("KOMGA_PROXY_TARGET", "http://host.docker.internal:25601")
    komga_reader_auth_header: str = os.environ.get("KOMGA_READER_AUTH_HEADER", "")
    komga_reader_auth_file: Path = Path(os.environ.get("KOMGA_READER_AUTH_FILE", "/run/oiab/komga-reader-auth.env"))
    kiwix_url: str = os.environ.get("KIWIX_URL", "")
    minecraft_map_url: str = os.environ.get("MINECRAFT_MAP_URL", "")
    minecraft_admin_url: str = os.environ.get("MINECRAFT_ADMIN_URL", "")
    crafty_db: Path = Path(os.environ.get("OIAB_CRAFTY_DB", "/data/oiab/services/crafty/config/db/crafty.sqlite"))
    crafty_server_name: str = os.environ.get("OIAB_CRAFTY_SERVER_NAME", "Trailer Pi Minecraft")
    minecraft_wiki_dir: Path = Path(os.environ.get("OIAB_MINECRAFT_WIKI_DIR", "/data/oiab/content/wikis/minecraft"))
    pokemon_wiki_dir: Path = Path(os.environ.get("OIAB_POKEMON_WIKI_DIR", "/data/oiab/content/wikis/pokemon"))
    survivor_library_source: Path = Path(os.environ.get("OIAB_SURVIVOR_LIBRARY_SOURCE", ""))
    medical_library_source: Path = Path(os.environ.get("OIAB_MEDICAL_LIBRARY_SOURCE", ""))

    def __post_init__(self) -> None:
        registry = os.environ.get("OIAB_MAP_PACK_REGISTRY")
        object.__setattr__(self, "map_pack_registry", Path(registry) if registry else self.data_dir / "maps" / "registry.json")
        db_path = os.environ.get("OIAB_DB_PATH")
        object.__setattr__(self, "db_path", Path(db_path) if db_path else self.data_dir / "db" / "oiab.sqlite")
        if "OIAB_MINECRAFT_WIKI_DIR" not in os.environ:
            object.__setattr__(self, "minecraft_wiki_dir", self.data_dir / "content" / "wikis" / "minecraft")
        if "OIAB_POKEMON_WIKI_DIR" not in os.environ:
            object.__setattr__(self, "pokemon_wiki_dir", self.data_dir / "content" / "wikis" / "pokemon")

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
    "db",
    "maps/packs",
    "maps/overlays",
    "maps/overlays/mvum/source",
    "maps/overlays/mvum/geojson",
    "maps/overlays/mvum/pmtiles",
    "maps/overlays/wildfire",
    "maps/overlays/weather",
    "maps/overlays/imagery/routes",
    "maps/cache",
    "maps/styles",
    "maps/sprites",
    "media/music-art",
    "media/uploads",
    "trivia/questions",
    "trivia/backups",
    "games",
    "tracks",
    "waypoints",
    "maps/tmp",
    "services/jellyfin",
    "services/komga",
    "services/minecraft",
    "services/emulatorjs",
    "services/filebrowser",
    "services/filebrowser/database",
    "services/filebrowser/config",
    "certs",
    "logs",
    "backups",
]


def ensure_data_layout(settings: Settings) -> None:
    for subdir in DATA_SUBDIRS:
        (settings.data_dir / subdir).mkdir(parents=True, exist_ok=True)


SETTINGS = Settings()
