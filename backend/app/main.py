from __future__ import annotations

import argparse
import hashlib
import io
import json
import mimetypes
import os
import re
import shutil
import subprocess
import threading
import time
from datetime import datetime
from email.utils import formatdate
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse
from urllib.request import Request, urlopen

from .app_db import AppDB
from .config import REPO_ROOT, SETTINGS, Settings, ensure_data_layout
from .games_db import GamesDB
from .gps.gpsd import read_gpsd
from .services import list_services, service_action
from .storage import folders_from_places, read_json, read_places, save_waypoint

try:
    from PIL import Image
except Exception:  # Pillow is optional at runtime, but enables thumbnailing large embedded covers.
    Image = None


mimetypes.add_type("application/octet-stream", ".pmtiles")
mimetypes.add_type("application/x-protobuf", ".pbf")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/manifest+json", ".webmanifest")


MAP_PACK_JOBS: dict[str, dict[str, object]] = {}
MAP_PACK_JOBS_LOCK = threading.Lock()
MUSIC_SCHEMA_VERSION = 3
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".aac", ".ogg", ".oga", ".wav", ".flac"}
COVER_NAMES = ("cover.jpg", "cover.jpeg", "cover.png", "folder.jpg", "folder.png", "album.jpg", "album.png")
TEXT_FRAMES = {"TIT2": "title", "TPE1": "artist", "TALB": "album", "TRCK": "track"}
COVER_FALLBACK_MAX_BYTES = 1024 * 1024
COVER_MAX_PIXELS = 512
COVER_JPEG_QUALITY = 82
ROM_SYSTEMS = {
    "arcade": ("Arcade", "mame2003"),
    "atari2600": ("Atari 2600", "stella2014"),
    "fbneo": ("FinalBurn Neo", "fbneo"),
    "gba": ("Game Boy Advance", "mgba"),
    "gb": ("Game Boy", "gambatte"),
    "gbc": ("Game Boy Color", "gambatte"),
    "gamegear": ("Game Gear", "genesis_plus_gx"),
    "genesis": ("Genesis", "genesis_plus_gx"),
    "mame2003": ("MAME 2003", "mame2003"),
    "mastersystem": ("Master System", "genesis_plus_gx"),
    "megadrive": ("Mega Drive", "genesis_plus_gx"),
    "n64": ("Nintendo 64", "mupen64plus_next"),
    "nds": ("Nintendo DS", "desmume"),
    "neogeo": ("Neo Geo", "fbneo"),
    "nes": ("NES", "fceumm"),
    "psx": ("PlayStation", "pcsx_rearmed"),
    "snes": ("SNES", "snes9x"),
    "virtualboy": ("Virtual Boy", "beetle_vb"),
    "wonderswan": ("WonderSwan", "mednafen_wswan"),
    "wonderswancolor": ("WonderSwan Color", "mednafen_wswan"),
}
ROM_EXTENSIONS = {
    ".7z", ".a26", ".bin", ".cue", ".fig", ".gb", ".gba", ".gbc", ".gen",
    ".gg", ".iso", ".m3u", ".md", ".n64", ".nds", ".nes", ".sfc", ".smc",
    ".sms", ".v64", ".vb", ".ws", ".wsc", ".z64", ".zip",
}


def timestamp() -> str:
    return datetime.now().isoformat(timespec="seconds")


def map_pack_job_snapshot(pack_id: str | None = None) -> dict[str, object]:
    with MAP_PACK_JOBS_LOCK:
        if pack_id:
            return dict(MAP_PACK_JOBS.get(pack_id, {}))
        return {key: dict(value) for key, value in MAP_PACK_JOBS.items()}


def update_map_pack_job(pack_id: str, **updates: object) -> dict[str, object]:
    with MAP_PACK_JOBS_LOCK:
        job = dict(MAP_PACK_JOBS.get(pack_id, {}))
        job.update(updates)
        job["id"] = pack_id
        job["updated_at"] = timestamp()
        MAP_PACK_JOBS[pack_id] = job
        return dict(job)


def display_title(path: Path) -> str:
    return path.stem.replace("_", " ").replace("-", " ").strip() or path.name


def synchsafe(value: bytes) -> int:
    result = 0
    for byte in value:
        result = (result << 7) | (byte & 0x7F)
    return result


def decode_id3_text(value: bytes) -> str:
    if not value:
        return ""
    encoding = value[0]
    payload = value[1:]
    if encoding == 0:
        text = payload.decode("latin-1", errors="replace")
    elif encoding == 1:
        text = payload.decode("utf-16", errors="replace")
    elif encoding == 2:
        text = payload.decode("utf-16-be", errors="replace")
    else:
        text = payload.decode("utf-8", errors="replace")
    return text.strip("\x00").strip()


def encoded_null_index(value: bytes, encoding: int) -> int:
    marker = b"\x00\x00" if encoding in (1, 2) else b"\x00"
    index = value.find(marker)
    return len(value) if index < 0 else index + len(marker)


def parse_apic(frame_data: bytes, want_cover: bool = False) -> dict | bool | None:
    if not frame_data:
        return None
    encoding = frame_data[0]
    rest = frame_data[1:]
    mime_end = rest.find(b"\x00")
    if mime_end < 0:
        return None
    mime = rest[:mime_end].decode("latin-1", errors="replace") or "image/jpeg"
    after_mime = rest[mime_end + 1 :]
    if not after_mime:
        return None
    after_type = after_mime[1:]
    desc_end = encoded_null_index(after_type, encoding)
    image_data = after_type[desc_end:]
    if not image_data:
        return None
    return {"mime": mime, "data": image_data} if want_cover else True


def id3_metadata(path: Path, want_cover: bool = False) -> dict:
    if path.suffix.lower() != ".mp3":
        return {}
    metadata = {}
    try:
        with path.open("rb") as handle:
            header = handle.read(10)
            if len(header) != 10 or header[:3] != b"ID3":
                return metadata
            major = header[3]
            tag_size = synchsafe(header[6:10])
            tag = handle.read(tag_size)
    except OSError:
        return metadata

    offset = 0
    while offset + 10 <= len(tag):
        frame_id = tag[offset : offset + 4].decode("latin-1", errors="ignore")
        if not frame_id.strip("\x00"):
            break
        raw_size = tag[offset + 4 : offset + 8]
        frame_size = synchsafe(raw_size) if major == 4 else int.from_bytes(raw_size, "big")
        frame_start = offset + 10
        frame_end = frame_start + frame_size
        if frame_size <= 0 or frame_end > len(tag):
            break
        frame_data = tag[frame_start:frame_end]
        if frame_id in TEXT_FRAMES:
            value = decode_id3_text(frame_data)
            if value:
                metadata[TEXT_FRAMES[frame_id]] = value
        elif frame_id == "APIC":
            parsed = parse_apic(frame_data, want_cover=want_cover)
            if parsed:
                if want_cover:
                    metadata["cover"] = parsed
                else:
                    metadata["hasCover"] = True
        offset = frame_end
    return metadata


def cover_extension(mime: str) -> str:
    lowered = (mime or "").lower()
    if "png" in lowered:
        return ".png"
    if "webp" in lowered:
        return ".webp"
    return ".jpg"


def thumbnail_cover_bytes(image_data: bytes) -> bytes | None:
    if Image is None:
        return None
    try:
        with Image.open(io.BytesIO(image_data)) as image:
            image.thumbnail((COVER_MAX_PIXELS, COVER_MAX_PIXELS))
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            output = io.BytesIO()
            image.save(output, format="JPEG", quality=COVER_JPEG_QUALITY, optimize=True)
            return output.getvalue()
    except Exception:
        return None


def start_map_pack_install(settings: Settings, pack_id: str, reason: str = "manual") -> dict[str, object]:
    pack_id = str(pack_id or "").strip()
    if not pack_id:
        raise ValueError("Map pack id is required.")
    current = map_pack_job_snapshot(pack_id)
    if current.get("status") in {"pending", "running"}:
        return current

    job = update_map_pack_job(
        pack_id,
        status="pending",
        reason=reason,
        error="",
        progress=0,
        started_at=timestamp(),
    )

    def worker() -> None:
        update_map_pack_job(pack_id, status="running", progress=5)
        try:
            handler = object.__new__(OIABHandler)
            handler.settings = settings
            result = handler.install_map_pack_sync(pack_id)
            update_map_pack_job(pack_id, status="succeeded", progress=100, error="", result=result)
        except Exception as exc:  # noqa: BLE001 - background job boundary
            update_map_pack_job(pack_id, status="failed", progress=100, error=str(exc))

    thread = threading.Thread(target=worker, name=f"oiab-map-pack-{pack_id}", daemon=True)
    thread.start()
    return job


def ensure_default_world_map(settings: Settings) -> dict[str, object]:
    db = AppDB(settings)
    registry = db.map_pack_registry()
    active_id = registry.get("active")
    if active_id:
        active = next((pack for pack in registry.get("basemaps", []) if pack.get("id") == active_id and pack.get("installed")), None)
        if active:
            return {"ok": True, "status": "active_exists", "active": active_id}

    world_file = settings.data_dir / "maps" / "packs" / "world-overview.pmtiles"
    if world_file.exists() and world_file.is_file() and world_file.stat().st_size > 0:
        db.upsert_map_pack(
            {
                "id": "world_overview",
                "name": "World Overview",
                "type": "pmtiles",
                "path": str(world_file),
                "url": "/maps/packs/world-overview.pmtiles",
                "style": "/maps-v2/map-style.json",
                "attribution": "© OpenStreetMap contributors; Protomaps",
            },
            active=True,
        )
        return {"ok": True, "status": "registered_existing_world_overview", "active": "world_overview"}

    if settings.auto_install_world_map:
        job = start_map_pack_install(settings, "world_overview", reason="bootstrap")
        return {"ok": True, "status": "install_started", "job": job}
    return {"ok": True, "status": "auto_install_disabled"}


class OIABHandler(BaseHTTPRequestHandler):
    server_version = "OIAB/0.1"
    settings: Settings = SETTINGS

    def log_message(self, fmt: str, *args: object) -> None:
        if self.settings.dev_mode:
            super().log_message(fmt, *args)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        if path in {"/api/health", "/health"}:
            return self.send_json({"ok": True, "name": "Overland In A Box", "time": datetime.now().isoformat()})
        if path in {"/api/config", "/oiab-config"}:
            return self.send_json(self.config_payload())
        if path in {"/api/location/current", "/maps-location-current"}:
            return self.send_json(read_gpsd())
        if path in {"/api/maps-v2/map-packs", "/maps-v2-map-packs"}:
            return self.send_json(self.map_packs())
        if path in {"/api/maps/packs/catalog", "/maps-packs-catalog"}:
            return self.send_json(self.map_pack_catalog())
        if path in {"/api/maps/packs/installed", "/api/maps/packs/status", "/api/maps/packs"}:
            return self.send_json(self.map_packs())
        if path in {"/api/maps/overlays/catalog", "/maps-overlays-catalog"}:
            return self.send_json(self.app_db().map_overlay_catalog())
        if path in {"/api/maps/overlays", "/api/maps/overlays/installed", "/api/maps/overlays/status", "/maps-overlays"}:
            return self.send_json(self.map_overlays())
        if path in {"/api/maps/packs/diagnostics", "/api/maps/pmtiles/diagnostics"}:
            return self.send_json(self.pmtiles_diagnostics())
        if path in {"/api/maps/packs/tile-check", "/api/maps/pmtiles/tile-check"}:
            return self.send_json(self.pmtiles_tile_check(parsed))
        if path in {"/api/maps/packs/range-check", "/api/maps/pmtiles/range-check"}:
            return self.send_json(self.pmtiles_range_check(parsed))
        if path in {"/api/map-data", "/maps-data"}:
            places = read_places(self.settings)
            folders = self.app_db().folders() or folders_from_places(places)
            return self.send_json({"ok": True, "places": places, "folders": folders})
        if path in {"/api/tracks/current", "/maps-tracks-current"}:
            return self.send_json(self.current_track())
        if path in {"/api/services", "/services-status"}:
            return self.send_json({"ok": True, "services": list_services(self.settings), "allow_docker_control": self.settings.allow_docker_control})
        if path in {"/api/system/status", "/system-status"}:
            return self.send_json(self.system_status())
        if path in {"/music-api/library", "/api/music/library"}:
            refresh = "refresh=1" in parsed.query
            return self.send_json(self.music_library(refresh=refresh))
        if path in {"/music-api/visualizer-images", "/api/music/visualizer-images"}:
            return self.send_json(self.visualizer_images())
        if path in {"/roms-api/library", "/api/roms"}:
            return self.send_json(self.rom_library())
        if path in {"/mobile-games", "/api/mobile-games"}:
            return self.send_json({"ok": True, "games": self.open_games()})
        if path in {"/game-stats", "/api/game-stats"}:
            return self.send_json({"ok": True, "scoreboard": self.scoreboard()})
        if path in {"/license-plates", "/api/license-plates"}:
            return self.send_json(self.license_plates())
        if path in {"/api/uploads/trivia-questions", "/api/trivia/questions"}:
            return self.send_json(self.trivia_question_files())
        if path in {"/api/uploads/targets", "/api/uploads/categories"}:
            return self.send_json({"ok": True, "targets": self.upload_targets()})
        if path in {"/api/uploads/list", "/api/uploads/files"}:
            target = parse_qs(parsed.query).get("target", ["uploads"])[-1]
            return self.send_json(self.upload_files(target))
        if path in {"/maps/overland/trivia/questions/manifest.json", "/trivia/questions/manifest.json"}:
            return self.send_json(self.trivia_manifest())
        if path in {"/api/apps", "/overland/apps.json", "/maps/overland/apps.json"}:
            return self.send_json(self.apps_payload())
        if path == "/app-layout":
            return self.send_json({"ok": True, "layout": self.app_layout()})
        if path.startswith("/apps/jellyfin"):
            return self.redirect_to_port(os.environ.get("JELLYFIN_PORT", "8096"))
        if path.startswith("/apps/komga"):
            return self.redirect_to_port(os.environ.get("KOMGA_PORT", "25600"))
        if path.startswith("/apps/wiki"):
            return self.redirect_to_port(os.environ.get("KIWIX_PORT", "8081"))
        if path.startswith("/apps/minecraft"):
            return self.send_json(
                {
                    "ok": True,
                    "service": "minecraft",
                    "message": "Minecraft is a game server. Connect from Minecraft to this host on Java port 25565 or Bedrock port 19132.",
                    "java_port": int(os.environ.get("MINECRAFT_JAVA_PORT", "25565")),
                    "bedrock_port": int(os.environ.get("MINECRAFT_BEDROCK_PORT", "19132")),
                }
            )

        static = self.resolve_static(path)
        if static:
            return self.serve_file(static)
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_HEAD(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        static = self.resolve_static(path)
        if static and static.exists() and static.is_file():
            file_size = static.stat().st_size
            content_type = mimetypes.guess_type(str(static))[0] or "application/octet-stream"
            range_header = self.headers.get("Range")
            start, end = 0, file_size - 1
            status = HTTPStatus.OK
            if range_header and range_header.startswith("bytes="):
                try:
                    range_value = range_header.split("=", 1)[1]
                    start_s, end_s = range_value.split("-", 1)
                    start = int(start_s) if start_s else 0
                    end = int(end_s) if end_s else file_size - 1
                    end = min(end, file_size - 1)
                    if start > end:
                        raise ValueError
                    status = HTTPStatus.PARTIAL_CONTENT
                except ValueError:
                    self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    return
            self.send_response(status)
            self.send_static_headers(static, content_type, end - start + 1)
            if status == HTTPStatus.PARTIAL_CONTENT:
                self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            self.end_headers()
            return
        if path in {"/api/health", "/health"}:
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def redirect_to_port(self, port: str) -> None:
        host = self.headers.get("Host", self.settings.hostname).split(":", 1)[0]
        target = f"http://{host}:{port}/"
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", target)
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path in {"/api/quick-save", "/maps-quick-save", "/api/waypoints"}:
            try:
                payload = self.read_body()
                feature = save_waypoint(self.settings, payload)
                return self.send_json({"ok": True, "feature": feature})
            except Exception as exc:  # noqa: BLE001 - HTTP boundary
                return self.send_json({"ok": False, "error": str(exc)}, status=400)
        if path.startswith("/api/services/"):
            parts = [part for part in path.split("/") if part]
            service_id = parts[2] if len(parts) > 2 else ""
            action = parts[3] if len(parts) > 3 else str(self.read_body().get("action") or "")
            result = service_action(self.settings, service_id, action)
            status = 200 if result.get("ok") else 400
            return self.send_json({**result, "services": list_services(self.settings)}, status=status)
        if path in {"/mobile-games", "/api/mobile-games"}:
            return self.handle_mobile_games()
        if path in {"/game-stats", "/api/game-stats"}:
            return self.handle_game_stats()
        if path in {"/license-plates", "/api/license-plates"}:
            return self.handle_license_plates()
        if path in {"/api/uploads/trivia-question", "/api/trivia/questions/upload"}:
            return self.handle_trivia_question_upload()
        if path in {"/api/uploads/file", "/api/uploads/upload"}:
            target = parse_qs(parsed.query).get("target", ["uploads"])[-1]
            return self.handle_file_upload(target)
        if path in {"/api/maps-v2/map-packs", "/maps-v2-map-packs"}:
            return self.handle_map_packs()
        if path in {"/api/maps/overlays", "/maps-overlays"}:
            return self.handle_map_overlays()
        if path in {"/api/maps/packs/validate", "/api/maps/pmtiles/validate"}:
            return self.send_json(self.pmtiles_validate(self.read_body()))
        if path.startswith("/api/maps/overlays/"):
            action = path.rstrip("/").rsplit("/", 1)[-1]
            return self.handle_map_overlays(action_override=action)
        if path.startswith("/api/maps/packs/"):
            action = path.rstrip("/").rsplit("/", 1)[-1]
            return self.handle_map_packs(action_override=action)
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        content_type = self.headers.get("Content-Type", "")
        if "application/json" in content_type:
            return json.loads(raw.decode("utf-8") or "{}")
        data = parse_qs(raw.decode("utf-8"))
        return {key: values[-1] for key, values in data.items()}

    def send_json(self, data: object, status: int = 200) -> None:
        body = json.dumps(data, indent=2, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def serve_file(self, path: Path) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return
        file_size = path.stat().st_size
        range_header = self.headers.get("Range")
        content_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        start, end = 0, file_size - 1
        status = HTTPStatus.OK
        if range_header and range_header.startswith("bytes="):
            try:
                range_value = range_header.split("=", 1)[1]
                start_s, end_s = range_value.split("-", 1)
                start = int(start_s) if start_s else 0
                end = int(end_s) if end_s else file_size - 1
                end = min(end, file_size - 1)
                if start > end:
                    raise ValueError
                status = HTTPStatus.PARTIAL_CONTENT
            except ValueError:
                self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                return
        length = end - start + 1
        self.send_response(status)
        self.send_static_headers(path, content_type, length)
        if status == HTTPStatus.PARTIAL_CONTENT:
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.end_headers()
        with path.open("rb") as fh:
            fh.seek(start)
            remaining = length
            while remaining > 0:
                chunk = fh.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def send_static_headers(self, path: Path, content_type: str, content_length: int) -> None:
        stat = path.stat()
        parsed = urlparse(self.path)
        has_pack_version = bool(parse_qs(parsed.query).get("v"))
        self.send_header("Content-Type", content_type)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(content_length))
        self.send_header("Last-Modified", formatdate(stat.st_mtime, usegmt=True))
        self.send_header("ETag", f'"{stat.st_mtime_ns:x}-{stat.st_size:x}"')
        if self.settings.dev_mode:
            self.send_header("Cache-Control", "no-store")
        elif path.suffix.lower() == ".pmtiles" and has_pack_version:
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        elif path.suffix.lower() == ".pmtiles":
            self.send_header("Cache-Control", "no-cache")
        elif path.suffix.lower() in {".html", ".js", ".css", ".json"}:
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "public, max-age=3600")

    def resolve_static(self, path: str) -> Path | None:
        if path in {"/", "/overland/", "/overland/index.html"}:
            return REPO_ROOT / "frontend" / "shell" / "index.html"
        if path.startswith("/config/"):
            return self.safe_join(REPO_ROOT / "config", path.removeprefix("/config/"))
        if path in {"/universal-shell.css", "/universal-shell.js", "/overland-shell.css", "/overland-shell.js"}:
            return REPO_ROOT / "frontend" / "shell" / path.removeprefix("/")
        if path == "/overland/legacy.html":
            return REPO_ROOT / "frontend" / "shell" / "legacy.html"
        if path.startswith("/overland/"):
            return self.safe_join(REPO_ROOT / "frontend" / "shell", path.removeprefix("/overland/"))
        if path.startswith("/docs/"):
            return self.safe_join(REPO_ROOT / "docs", path.removeprefix("/docs/"))
        if path in {"/maps-v2", "/maps-v2/"}:
            return REPO_ROOT / "frontend" / "maps" / "index.html"
        if path.startswith("/maps-v2/fonts/") and path.endswith(".pbf"):
            rel = path.removeprefix("/maps-v2/fonts/")
            target = self.safe_join(REPO_ROOT / "frontend" / "maps" / "fonts", rel)
            if target and target.exists():
                return target
            parts = rel.split("/")
            if len(parts) >= 2:
                fallback = self.safe_join(REPO_ROOT / "frontend" / "maps" / "fonts", "/".join([*parts[:-1], "0-255.pbf"]))
                if fallback and fallback.exists():
                    return fallback
            fallback = REPO_ROOT / "frontend" / "maps" / "fonts" / "Noto Sans Regular" / "0-255.pbf"
            if fallback.exists():
                return fallback
        if path.startswith("/maps-v2/"):
            return self.safe_join(REPO_ROOT / "frontend" / "maps", path.removeprefix("/maps-v2/"))
        if path.startswith("/maps-v2-packs/") or path.startswith("/maps/packs/"):
            rel = path.split("/packs/", 1)[-1] if "/packs/" in path else path.removeprefix("/maps-v2-packs/")
            return self.safe_join(self.settings.data_dir / "maps" / "packs", rel)
        if path.startswith("/maps/overlays/"):
            return self.safe_join(self.settings.data_dir / "maps" / "overlays", path.removeprefix("/maps/overlays/"))
        if path.startswith("/maps/emulatorjs/data/"):
            rel = path.removeprefix("/maps/emulatorjs/data/")
            runtime = self.safe_join(self.settings.data_dir / "services" / "emulatorjs" / "data", rel)
            if runtime and runtime.exists():
                return runtime
            return self.safe_join(REPO_ROOT / "frontend" / "shared" / "emulatorjs" / "data", rel)
        if path in {"/mobile", "/mobile/"}:
            return REPO_ROOT / "frontend" / "mobile" / "index.html"
        if path.startswith("/mobile/"):
            return self.safe_join(REPO_ROOT / "frontend" / "mobile", path.removeprefix("/mobile/"))
        if path in {"/music", "/music/"}:
            return REPO_ROOT / "frontend" / "mobile" / "music.html"
        if path in {"/games", "/games/"}:
            return REPO_ROOT / "frontend" / "mobile" / "index.html"
        if path in {"/settings", "/settings/"}:
            return REPO_ROOT / "frontend" / "mobile" / "admin.html"
        if path in {"/files", "/files/", "/upload", "/upload/", "/file-uploads", "/file-uploads/"}:
            return REPO_ROOT / "frontend" / "mobile" / "file-uploads.html"
        if path in {"/map-packs", "/map-packs/", "/maps-settings", "/maps-settings/"}:
            return REPO_ROOT / "frontend" / "mobile" / "map-packs.html"
        if path in {"/map-diagnostics", "/map-diagnostics/", "/pmtiles-diagnostics", "/pmtiles-diagnostics/"}:
            return REPO_ROOT / "frontend" / "mobile" / "map-diagnostics.html"
        if path in {"/services", "/services/", "/service-manager", "/service-manager/"}:
            return REPO_ROOT / "frontend" / "mobile" / "services.html"
        if path in {"/gps-status", "/gps-status/"}:
            return REPO_ROOT / "frontend" / "mobile" / "gps-status.html"
        if path in {"/system-monitor", "/system-monitor/"}:
            return REPO_ROOT / "frontend" / "mobile" / "system-monitor.html"
        if path in {"/https-settings", "/https-settings/"}:
            return REPO_ROOT / "frontend" / "mobile" / "https-settings.html"
        if path.startswith("/maps/overland/trivia/questions/") or path.startswith("/trivia/questions/"):
            rel = path.removeprefix("/maps/overland/trivia/questions/").removeprefix("/trivia/questions/")
            return self.safe_join(self.settings.data_dir / "trivia" / "questions", rel)
        if path.startswith("/maps/overland/"):
            return self.safe_join(REPO_ROOT / "frontend" / "shared" / "overland", path.removeprefix("/maps/overland/"))
        if path.startswith("/media/music-art/"):
            return self.safe_join(self.settings.data_dir / "media" / "music-art", path.removeprefix("/media/music-art/"))
        if path.startswith("/media/music/"):
            return self.safe_join(self.settings.data_dir / "media" / "music", path.removeprefix("/media/music/"))
        if path.startswith("/media/books/"):
            return self.safe_join(self.settings.data_dir / "media" / "books", path.removeprefix("/media/books/"))
        if path.startswith("/media/comics/"):
            return self.safe_join(self.settings.data_dir / "media" / "comics", path.removeprefix("/media/comics/"))
        if path.startswith("/content/zim/"):
            return self.safe_join(self.settings.data_dir / "content" / "zim", path.removeprefix("/content/zim/"))
        if path.startswith("/games/roms/"):
            return self.safe_join(self.settings.data_dir / "games" / "roms", path.removeprefix("/games/roms/"))
        if path.startswith("/uploads/"):
            return self.safe_join(self.settings.data_dir / "media" / "uploads", path.removeprefix("/uploads/"))
        return None

    @staticmethod
    def safe_join(root: Path, rel: str) -> Path | None:
        target = (root / rel).resolve()
        try:
            target.relative_to(root.resolve())
        except ValueError:
            return None
        return target

    def config_payload(self) -> dict:
        return {
            "ok": True,
            "name": "Overland In A Box",
            "short_name": "OIAB",
            "hostname": self.settings.hostname,
            "data_dir": str(self.settings.data_dir),
            "default_map_app": self.settings.default_map_app,
            "optional_services_enabled": self.settings.enable_optional_services,
            "cert_mode": self.settings.cert_mode,
            "https_port": self.settings.https_port,
            "db_path": str(self.settings.db_path),
        }

    def app_db(self) -> AppDB:
        return AppDB(self.settings)

    def apps_payload(self) -> dict:
        payload = read_json(REPO_ROOT / "config" / "apps.json", {"schema": 1, "apps": []})
        services = {str(item.get("id")): item for item in list_services(self.settings)}
        filtered = []
        for app in payload.get("apps", []) or []:
            service_id = app.get("optionalService")
            if service_id:
                service = services.get(str(service_id), {})
                if not (service.get("installed") and service.get("enabled")):
                    continue
            filtered.append(app)
        return {**payload, "apps": filtered}

    def map_packs(self) -> dict:
        registry = self.app_db().map_pack_registry()
        return {**registry, "jobs": map_pack_job_snapshot()}

    def map_overlays(self) -> dict:
        return self.app_db().map_overlay_registry()

    def pmtiles_diagnostics(self) -> dict:
        try:
            active, path, stat, registry = self.resolve_pmtiles_pack("")
        except ValueError:
            registry = self.map_packs()
            return {"ok": False, "error": "No active PMTiles pack is registered.", "registry": registry}

        public_url = str(active.get("public_url") or active.get("url") or f"/maps/packs/{path.name}")
        result: dict[str, object] = {
            "ok": True,
            "active_id": active.get("id"),
            "active_name": active.get("name"),
            "public_url": public_url,
            "versioned_url": public_url,
            "base_url": active.get("base_url") or active.get("unversioned_url") or public_url.split("?", 1)[0],
            "version": active.get("version") or (f"{stat.st_size}-{stat.st_mtime_ns}" if stat else ""),
            "mtime": active.get("mtime") or (stat.st_mtime if stat else 0),
            "mtime_ns": active.get("mtime_ns") or (stat.st_mtime_ns if stat else 0),
            "mtime_iso": datetime.fromtimestamp(stat.st_mtime).isoformat() if stat else "",
            "path": str(path),
            "exists": path.exists(),
            "readable": os.access(path, os.R_OK) if path.exists() else False,
            "size_bytes": stat.st_size if stat else 0,
            "storage_root": str(self.settings.data_dir / "maps" / "packs"),
            "python_fallback_url": public_url,
            "serving_path": "python_fallback",
            "serving_note": "If Caddy/nginx is in front of OIAB, browser-origin checks show the external static server behavior; internal checks use the Python fallback.",
            "pack_zoom": {
                "catalog_minzoom": active.get("catalog_minzoom") or active.get("catalog_min_zoom"),
                "catalog_maxzoom": active.get("catalog_maxzoom") or active.get("catalog_max_zoom"),
                "actual_minzoom": active.get("actual_minzoom") or active.get("actual_min_zoom"),
                "actual_maxzoom": active.get("actual_maxzoom") or active.get("actual_max_zoom"),
                "source_minzoom": active.get("minzoom") or active.get("min_zoom"),
                "source_maxzoom": active.get("maxzoom") or active.get("max_zoom"),
                "metadata_source": active.get("metadata_source"),
            },
            "tests": {},
        }
        if not path.exists() or not path.is_file():
            result["ok"] = False
            result["error"] = "Active PMTiles file is missing on disk."
            return result

        origin = f"http://127.0.0.1:{self.settings.http_port}"
        url = f"{origin}{public_url}"
        result["tested_url"] = url
        result["tests"] = {
            "direct_file_read": self.pmtiles_direct_read_test(path),
            "head": self.http_probe(url, "HEAD"),
            "range": self.http_probe(url, "GET", range_header="bytes=0-16383"),
        }
        range_test = result["tests"]["range"]  # type: ignore[index]
        result["range_ok"] = bool(isinstance(range_test, dict) and range_test.get("status") == 206)
        result["metadata"] = self.pmtiles_metadata_summary(path)
        return result

    def resolve_pmtiles_pack(self, pack_id: str = "") -> tuple[dict, Path, os.stat_result | None, dict]:
        registry = self.map_packs()
        packs = registry.get("basemaps", [])
        target_id = str(pack_id or registry.get("active") or registry.get("active_basemap") or "")
        pack = next((item for item in packs if target_id and str(item.get("id")) == target_id), None)
        pack = pack or next((item for item in packs if item.get("active")), None)
        if not pack:
            raise ValueError("No PMTiles pack is registered.")
        path = self.app_db().resolve_pack_path(str(pack.get("path") or pack.get("public_url") or pack.get("url") or ""))
        stat = path.stat() if path.exists() and path.is_file() else None
        return pack, path, stat, registry

    @staticmethod
    def parse_json_text(value: str) -> object | None:
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None

    def run_pmtiles_text(self, args: list[str], timeout: int = 20) -> dict[str, object]:
        pmtiles = shutil.which("pmtiles")
        command = [pmtiles or "pmtiles", *args]
        if not pmtiles:
            return {"ok": False, "available": False, "command": command, "error": "pmtiles CLI is not installed."}
        try:
            result = subprocess.run(command, text=True, capture_output=True, timeout=timeout, check=False)
            return {
                "ok": result.returncode == 0,
                "available": True,
                "command": command,
                "returncode": result.returncode,
                "stdout": result.stdout[-12000:],
                "stderr": result.stderr[-4000:],
            }
        except subprocess.TimeoutExpired:
            return {"ok": False, "available": True, "command": command, "error": f"pmtiles command timed out after {timeout}s."}

    def pmtiles_metadata_summary(self, path: Path) -> dict[str, object]:
        header = self.run_pmtiles_text(["show", str(path), "--header-json"], timeout=15)
        tilejson = self.run_pmtiles_text(["show", str(path), "--tilejson"], timeout=15)
        metadata = self.run_pmtiles_text(["show", str(path), "--metadata"], timeout=15)
        parsed_header = self.parse_json_text(str(header.get("stdout") or "")) if header.get("ok") else None
        parsed_tilejson = self.parse_json_text(str(tilejson.get("stdout") or "")) if tilejson.get("ok") else None
        parsed_metadata = self.parse_json_text(str(metadata.get("stdout") or "")) if metadata.get("ok") else None
        tilejson_obj = parsed_tilejson if isinstance(parsed_tilejson, dict) else {}
        header_obj = parsed_header if isinstance(parsed_header, dict) else {}
        return {
            "pmtiles_cli_available": bool(header.get("available")),
            "header": parsed_header if parsed_header is not None else header,
            "tilejson": parsed_tilejson if parsed_tilejson is not None else tilejson,
            "metadata": parsed_metadata if parsed_metadata is not None else metadata,
            "bounds": tilejson_obj.get("bounds") or header_obj.get("bounds"),
            "minzoom": tilejson_obj.get("minzoom") or header_obj.get("minzoom"),
            "maxzoom": tilejson_obj.get("maxzoom") or header_obj.get("maxzoom"),
        }

    def pmtiles_tile_check(self, parsed) -> dict[str, object]:
        query = parse_qs(parsed.query)
        pack_id = str(query.get("pack", [""])[-1] or "")
        try:
            z = int(query.get("z", [""])[-1])
            x = int(query.get("x", [""])[-1])
            y = int(query.get("y", [""])[-1])
        except (TypeError, ValueError):
            return {"ok": False, "error": "Provide integer z, x, and y query parameters."}
        try:
            pack, path, stat, _registry = self.resolve_pmtiles_pack(pack_id)
        except ValueError as exc:
            return {"ok": False, "error": str(exc)}
        if not path.exists() or not path.is_file():
            return {"ok": False, "error": "Selected PMTiles file is missing.", "path": str(path), "pack": pack}

        pmtiles = shutil.which("pmtiles")
        command = [pmtiles or "pmtiles", "tile", str(path), str(z), str(x), str(y)]
        result: dict[str, object] = {
            "ok": True,
            "pack_id": pack.get("id"),
            "pack_name": pack.get("name"),
            "pack_url": pack.get("public_url") or pack.get("url"),
            "base_url": pack.get("base_url"),
            "path": str(path),
            "size_bytes": stat.st_size if stat else 0,
            "mtime": stat.st_mtime if stat else 0,
            "mtime_ns": stat.st_mtime_ns if stat else 0,
            "version": pack.get("version") or (f"{stat.st_size}-{stat.st_mtime_ns}" if stat else ""),
            "pack_zoom": {
                "catalog_minzoom": pack.get("catalog_minzoom") or pack.get("catalog_min_zoom"),
                "catalog_maxzoom": pack.get("catalog_maxzoom") or pack.get("catalog_max_zoom"),
                "actual_minzoom": pack.get("actual_minzoom") or pack.get("actual_min_zoom"),
                "actual_maxzoom": pack.get("actual_maxzoom") or pack.get("actual_max_zoom"),
                "source_minzoom": pack.get("minzoom") or pack.get("min_zoom"),
                "source_maxzoom": pack.get("maxzoom") or pack.get("max_zoom"),
                "metadata_source": pack.get("metadata_source"),
            },
            "tile": {"z": z, "x": x, "y": y},
            "pmtiles_cli_available": bool(pmtiles),
            "command": command,
        }
        if not pmtiles:
            result.update({"ok": False, "tile_exists": None, "cli_readable": False, "error": "pmtiles CLI is not installed."})
            return result
        try:
            completed = subprocess.run(command, capture_output=True, timeout=20, check=False)
            output = completed.stdout or b""
            result.update(
                {
                    "returncode": completed.returncode,
                    "stderr": completed.stderr.decode("utf-8", errors="replace")[-4000:],
                    "tile_exists": completed.returncode == 0 and len(output) > 0,
                    "cli_readable": completed.returncode == 0,
                    "tile_bytes": len(output),
                    "tile_magic_hex": output[:16].hex(),
                }
            )
        except subprocess.TimeoutExpired:
            result.update({"ok": False, "tile_exists": None, "cli_readable": False, "error": "pmtiles tile command timed out."})
        return result

    def pmtiles_range_check(self, parsed) -> dict[str, object]:
        query = parse_qs(parsed.query)
        pack_id = str(query.get("pack", [""])[-1] or "")
        range_header = str(query.get("range", ["bytes=0-16383"])[-1] or "bytes=0-16383")
        try:
            pack, _path, _stat, _registry = self.resolve_pmtiles_pack(pack_id)
        except ValueError as exc:
            return {"ok": False, "error": str(exc)}
        public_url = str(pack.get("public_url") or pack.get("url") or "")
        if not public_url:
            return {"ok": False, "error": "Selected pack has no public URL."}
        origin = f"http://127.0.0.1:{self.settings.http_port}"
        url = f"{origin}{public_url}"
        probe = self.http_probe(url, "GET", range_header=range_header)
        return {"ok": bool(probe.get("ok") and probe.get("status") == 206), "pack_id": pack.get("id"), "public_url": public_url, "tested_url": url, "requested_range": range_header, "probe": probe}

    def pmtiles_validate(self, payload: dict) -> dict[str, object]:
        pack_id = str(payload.get("id") or payload.get("pack") or "")
        try:
            pack, path, stat, _registry = self.resolve_pmtiles_pack(pack_id)
        except ValueError as exc:
            return {"ok": False, "error": str(exc)}
        result: dict[str, object] = {
            "ok": True,
            "pack_id": pack.get("id"),
            "pack_name": pack.get("name"),
            "public_url": pack.get("public_url") or pack.get("url"),
            "path": str(path),
            "exists": path.exists(),
            "readable": os.access(path, os.R_OK) if path.exists() else False,
            "size_bytes": stat.st_size if stat else 0,
            "mtime": stat.st_mtime if stat else 0,
            "mtime_ns": stat.st_mtime_ns if stat else 0,
            "version": pack.get("version") or (f"{stat.st_size}-{stat.st_mtime_ns}" if stat else ""),
            "direct_file_read": self.pmtiles_direct_read_test(path) if path.exists() else {"ok": False, "error": "missing"},
        }
        if not path.exists() or not path.is_file():
            result.update({"ok": False, "error": "Selected PMTiles file is missing."})
            return result
        result["metadata"] = self.pmtiles_metadata_summary(path)
        result["verify"] = self.run_pmtiles_text(["verify", str(path)], timeout=45)
        metadata = result.get("metadata") if isinstance(result.get("metadata"), dict) else {}
        bounds = metadata.get("bounds") if isinstance(metadata, dict) else None
        center = payload.get("center") if isinstance(payload.get("center"), dict) else {}
        lon = center.get("lon") or center.get("lng")
        lat = center.get("lat")
        warnings: list[str] = []
        if isinstance(bounds, list) and len(bounds) == 4 and lon is not None and lat is not None:
            try:
                lon_f = float(lon)
                lat_f = float(lat)
                if not (float(bounds[0]) <= lon_f <= float(bounds[2]) and float(bounds[1]) <= lat_f <= float(bounds[3])):
                    warnings.append("Current map center is outside this pack's TileJSON bounds.")
            except (TypeError, ValueError):
                pass
        if not result["direct_file_read"].get("ok"):  # type: ignore[union-attr]
            warnings.append("PMTiles header could not be read from disk.")
        verify = result.get("verify")
        if isinstance(verify, dict) and not verify.get("ok"):
            warnings.append("pmtiles verify did not pass or could not complete.")
        result["warnings"] = warnings
        return result

    @staticmethod
    def pmtiles_direct_read_test(path: Path) -> dict[str, object]:
        try:
            with path.open("rb") as fh:
                head = fh.read(16)
            return {"ok": bool(head), "bytes_read": len(head), "magic_hex": head[:7].hex()}
        except OSError as exc:
            return {"ok": False, "error": str(exc)}

    @staticmethod
    def http_probe(url: str, method: str, range_header: str | None = None) -> dict[str, object]:
        headers = {"User-Agent": "OIAB PMTiles diagnostics/1.0"}
        if range_header:
            headers["Range"] = range_header
        request = Request(url, method=method, headers=headers)
        try:
            with urlopen(request, timeout=6) as response:  # noqa: S310 - local self-test URL
                body = response.read(64) if method != "HEAD" else b""
                return {
                    "ok": True,
                    "status": response.status,
                    "content_length": response.headers.get("Content-Length"),
                    "content_range": response.headers.get("Content-Range"),
                    "accept_ranges": response.headers.get("Accept-Ranges"),
                    "cache_control": response.headers.get("Cache-Control"),
                    "etag": response.headers.get("ETag"),
                    "last_modified": response.headers.get("Last-Modified"),
                    "server": response.headers.get("Server"),
                    "bytes_read": len(body),
                }
        except Exception as exc:  # noqa: BLE001 - diagnostics endpoint
            return {"ok": False, "error": str(exc)}

    def map_pack_catalog(self) -> dict:
        catalog = read_json(REPO_ROOT / "config" / "map-pack-catalog.json", {"version": 1, "packs": []})
        installed = self.map_packs()
        installed_by_id = {item["id"]: item for item in installed.get("basemaps", [])}
        installed_by_filename = {
            Path(str(item.get("path") or item.get("public_url") or item.get("url") or "")).name: item
            for item in installed.get("basemaps", [])
            if item.get("path") or item.get("public_url") or item.get("url")
        }
        packs = []
        for item in catalog.get("packs", []) or []:
            if not isinstance(item, dict):
                continue
            job = map_pack_job_snapshot(str(item.get("id") or ""))
            state = installed_by_id.get(str(item.get("id") or ""), {})
            if not state:
                state = installed_by_filename.get(str(item.get("expected_filename") or ""), {})
            installed_flag = bool(state.get("installed") or state.get("exists"))
            job_status = str(job.get("status") or "")
            install_status = (
                job_status
                or ("installed" if installed_flag else "available" if item.get("install_available", bool(item.get("source_url"))) else "manual")
            )
            packs.append(
                {
                    **item,
                    "installed": installed_flag,
                    "active": bool(state.get("active")),
                    "size_bytes": state.get("size_bytes") or item.get("size_bytes"),
                    "public_url": state.get("public_url") or f"/maps/packs/{item.get('expected_filename')}",
                    "install_available": bool(item.get("install_available", bool(item.get("source_url")))),
                    "install_status": install_status,
                    "install_error": job.get("error") or "",
                    "install_progress": job.get("progress"),
                    "install_job": job,
                }
            )
        return {"ok": True, "version": catalog.get("version", 1), "packs": packs, "jobs": map_pack_job_snapshot()}

    def handle_map_packs(self, action_override: str | None = None) -> None:
        payload = self.read_body()
        action = str(action_override or payload.get("action") or "rescan")
        try:
            if action == "set-active":
                return self.send_json(self.app_db().set_active_map_pack(str(payload.get("id") or "")))
            if action == "disable":
                return self.send_json(self.app_db().disable_map_pack(str(payload.get("id") or "")))
            if action == "install":
                job = start_map_pack_install(self.settings, str(payload.get("id") or ""), reason="manual")
                return self.send_json({"ok": True, "job": job, **self.map_packs()})
            if action == "remove":
                return self.send_json(self.remove_map_pack(str(payload.get("id") or "")))
            if action == "import-path":
                return self.send_json(self.app_db().import_pmtiles_path(str(payload.get("path") or ""), payload.get("name")))
            if action == "rescan":
                self.app_db().rescan_map_packs()
                return self.send_json(self.map_packs())
            return self.send_json({"ok": False, "error": f"Unknown map pack action: {action}"}, status=400)
        except Exception as exc:  # noqa: BLE001 - HTTP boundary
            return self.send_json({"ok": False, "error": str(exc)}, status=400)

    def handle_map_overlays(self, action_override: str | None = None) -> None:
        payload = self.read_body()
        action = str(action_override or payload.get("action") or "rescan")
        db = self.app_db()
        try:
            if action in {"rescan", "scan"}:
                db.rescan_map_overlays()
                return self.send_json(db.map_overlay_registry())
            if action in {"set-enabled", "enable", "disable"}:
                enabled = action == "enable" or bool(payload.get("enabled"))
                if action == "disable":
                    enabled = False
                return self.send_json(db.set_map_overlay_enabled(str(payload.get("id") or ""), enabled))
            if action == "set-opacity":
                return self.send_json(db.set_map_overlay_opacity(str(payload.get("id") or ""), payload.get("opacity")))
            if action == "set-order":
                return self.send_json(db.set_map_overlay_order(str(payload.get("id") or ""), payload.get("sort_order", payload.get("order"))))
            return self.send_json({"ok": False, "error": f"Unknown map overlay action: {action}"}, status=400)
        except Exception as exc:  # noqa: BLE001 - HTTP boundary
            return self.send_json({"ok": False, "error": str(exc)}, status=400)

    def catalog_pack(self, pack_id: str) -> dict:
        for pack in self.map_pack_catalog().get("packs", []):
            if pack.get("id") == pack_id:
                return pack
        raise ValueError("Map pack is not in the catalog.")

    def install_map_pack_sync(self, pack_id: str) -> dict:
        pack = self.catalog_pack(pack_id)
        source_type = str(pack.get("source_type") or "manual")
        if source_type == "direct_pmtiles":
            url = str(pack.get("source_url") or "")
            if not url:
                raise ValueError("This map pack has no download URL yet. Place the .pmtiles file in /data/oiab/maps/packs and rescan.")
            filename = self.safe_upload_name(str(pack.get("expected_filename") or f"{pack_id}.pmtiles"))
            if not filename.endswith(".pmtiles"):
                filename = f"{filename}.pmtiles"
            packs_dir = self.settings.data_dir / "maps" / "packs"
            tmp_dir = self.settings.data_dir / "maps" / "tmp"
            packs_dir.mkdir(parents=True, exist_ok=True)
            tmp_dir.mkdir(parents=True, exist_ok=True)
            part = tmp_dir / f"{filename}.part"
            final = packs_dir / filename
            digest = hashlib.sha256()
            total = 0
            request = Request(url, headers={"User-Agent": "OIAB map-pack-installer/1.0"})
            with urlopen(request, timeout=30) as response, part.open("wb") as fh:  # noqa: S310 - user-configured catalog URLs
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    fh.write(chunk)
                    digest.update(chunk)
                    total += len(chunk)
                    expected_size = pack.get("size_bytes")
                    if expected_size:
                        progress = min(95, max(5, int((total / int(expected_size)) * 95)))
                        update_map_pack_job(pack_id, status="running", progress=progress)
            if total <= 0:
                part.unlink(missing_ok=True)
                raise ValueError("Download completed with zero bytes.")
            expected_size = pack.get("size_bytes")
            if expected_size and int(expected_size) != total:
                part.unlink(missing_ok=True)
                raise ValueError(f"Downloaded size {total} did not match expected size {expected_size}.")
            expected_hash = str(pack.get("checksum") or "").lower().removeprefix("sha256:")
            if expected_hash and digest.hexdigest().lower() != expected_hash:
                part.unlink(missing_ok=True)
                raise ValueError("Downloaded checksum did not match catalog checksum.")
            shutil.move(str(part), str(final))
            self.app_db().upsert_map_pack(
                {
                    "id": pack_id,
                    "name": pack.get("name"),
                    "type": "pmtiles",
                    "path": str(final),
                    "url": f"/maps/packs/{filename}",
                    "style": pack.get("style") or "/maps-v2/map-style.json",
                    "attribution": pack.get("attribution") or "© OpenStreetMap contributors",
                    "catalog": pack,
                },
                active=(pack_id == "world_overview"),
                enabled=True,
            )
            return {"ok": True, "installed": pack_id, "bytes": total, "sha256": digest.hexdigest(), **self.map_packs()}
        if source_type == "extract_from_parent":
            parent = pack.get("parent_source_id")
            filename = self.safe_upload_name(str(pack.get("expected_filename") or f"{pack_id}.pmtiles"))
            if not filename.endswith(".pmtiles"):
                filename = f"{filename}.pmtiles"
            final = self.settings.data_dir / "maps" / "packs" / filename
            part = self.settings.data_dir / "maps" / "tmp" / f"{filename}.part"
            parent_pack = self.catalog_pack(str(parent or ""))
            source = str(parent_pack.get("source_url") or parent_pack.get("install_path") or "")
            if not source:
                raise ValueError("Extraction requires a parent source URL/path.")
            pmtiles = shutil.which("pmtiles")
            command = [pmtiles or "pmtiles", "extract", source, str(part)]
            bbox = pack.get("bbox")
            if bbox and pack_id != "world_overview":
                command.append(f"--bbox={','.join(map(str, bbox))}")
            if pack.get("max_zoom"):
                command.append(f"--maxzoom={pack.get('max_zoom')}")
            if not pmtiles:
                raise ValueError(f"PMTiles CLI is not installed in this environment. Command: {' '.join(command)}")
            part.parent.mkdir(parents=True, exist_ok=True)
            final.parent.mkdir(parents=True, exist_ok=True)
            part.unlink(missing_ok=True)
            update_map_pack_job(pack_id, status="running", progress=10)
            timeout_seconds = int(os.environ.get("OIAB_MAP_EXTRACT_TIMEOUT_SECONDS", "43200"))
            result = subprocess.run(command, text=True, capture_output=True, timeout=timeout_seconds, check=False)
            if result.returncode != 0:
                part.unlink(missing_ok=True)
                raise ValueError((result.stderr or result.stdout or "pmtiles extract failed")[-1000:])
            if not part.exists() or part.stat().st_size <= 0:
                part.unlink(missing_ok=True)
                raise ValueError("Extraction did not create a usable PMTiles file.")
            shutil.move(str(part), str(final))
            self.app_db().upsert_map_pack(
                {
                    "id": pack_id,
                    "name": pack.get("name"),
                    "path": str(final),
                    "url": f"/maps/packs/{filename}",
                    "style": pack.get("style") or "/maps-v2/map-style.json",
                    "attribution": pack.get("attribution") or "© OpenStreetMap contributors",
                    "catalog": pack,
                },
                active=(pack_id == "world_overview"),
                enabled=True,
            )
            return {"ok": True, "installed": pack_id, "stdout": result.stdout[-2000:], **self.map_packs()}
        raise ValueError("This map pack is manual-only. Place the .pmtiles file in /data/oiab/maps/packs and click Rescan.")

    def remove_map_pack(self, pack_id: str) -> dict:
        registry = self.map_packs()
        pack = next((item for item in registry.get("basemaps", []) if item.get("id") == pack_id), None)
        if not pack:
            raise ValueError("Map pack not found.")
        path = self.app_db().resolve_pack_path(str(pack.get("path") or ""))
        if path.exists() and path.is_file():
            path.unlink()
        self.app_db().rescan_map_packs()
        return self.map_packs()

    def system_status(self) -> dict:
        mem = self.read_meminfo()
        network = self.read_network_io()
        disks = []
        for path in [Path("/"), self.settings.data_dir]:
            try:
                usage = shutil.disk_usage(path)
                disks.append({"path": str(path), "total": usage.total, "used": usage.used, "free": usage.free, "percent": round((usage.used / usage.total) * 100, 1)})
            except OSError:
                continue
        temp_c = None
        temp_path = Path("/sys/class/thermal/thermal_zone0/temp")
        if temp_path.exists():
            try:
                temp_c = int(temp_path.read_text(encoding="utf-8").strip()) / 1000
            except (OSError, ValueError):
                temp_c = None
        uptime = 0.0
        try:
            uptime = float(Path("/proc/uptime").read_text(encoding="utf-8").split()[0])
        except (OSError, ValueError, IndexError):
            uptime = time.monotonic()
        return {
            "ok": True,
            "timestamp": datetime.now().isoformat(),
            "load": os.getloadavg() if hasattr(os, "getloadavg") else [0, 0, 0],
            "cpu_count": os.cpu_count(),
            "memory": mem,
            "network": network,
            "temperature_c": temp_c,
            "temperature_f": round((temp_c * 9 / 5) + 32, 1) if temp_c is not None else None,
            "uptime_seconds": uptime,
            "disks": disks,
            "services": list_services(self.settings),
        }

    @staticmethod
    def read_network_io() -> dict:
        interfaces = []
        total_rx = 0
        total_tx = 0
        try:
            lines = Path("/proc/net/dev").read_text(encoding="utf-8").splitlines()[2:]
            for line in lines:
                if ":" not in line:
                    continue
                name, values = line.split(":", 1)
                iface = name.strip()
                if not iface or iface == "lo":
                    continue
                fields = values.split()
                if len(fields) < 16:
                    continue
                rx_bytes = int(fields[0])
                tx_bytes = int(fields[8])
                total_rx += rx_bytes
                total_tx += tx_bytes
                interfaces.append({"name": iface, "rx_bytes": rx_bytes, "tx_bytes": tx_bytes})
        except (OSError, ValueError, IndexError):
            return {"rx_bytes": 0, "tx_bytes": 0, "interfaces": []}
        return {"rx_bytes": total_rx, "tx_bytes": total_tx, "interfaces": interfaces}

    @staticmethod
    def read_meminfo() -> dict:
        data = {}
        try:
            for line in Path("/proc/meminfo").read_text(encoding="utf-8").splitlines():
                key, value = line.split(":", 1)
                data[key] = int(value.strip().split()[0]) * 1024
        except (OSError, ValueError, IndexError):
            return {}
        total = data.get("MemTotal", 0)
        available = data.get("MemAvailable", 0)
        used = max(0, total - available)
        return {"total": total, "available": available, "used": used, "percent": round((used / total) * 100, 1) if total else 0}

    def current_track(self) -> dict:
        return self.app_db().current_track()

    def cache_music_cover(self, cover: dict | None) -> str:
        if not cover:
            return ""
        image_data = cover.get("data") or b""
        if not image_data:
            return ""
        cached_data = thumbnail_cover_bytes(image_data)
        suffix = ".jpg"
        if not cached_data:
            if len(image_data) > COVER_FALLBACK_MAX_BYTES:
                return ""
            cached_data = image_data
            suffix = cover_extension(str(cover.get("mime") or ""))
        digest = hashlib.sha256(
            f"thumb-v1:{COVER_MAX_PIXELS}:{COVER_JPEG_QUALITY}:".encode("utf-8") + image_data
        ).hexdigest()[:24]
        target_dir = self.settings.data_dir / "media" / "music-art"
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / f"{digest}{suffix}"
        if not target.exists():
            tmp = target.with_suffix(target.suffix + ".tmp")
            tmp.write_bytes(cached_data)
            tmp.replace(target)
        return f"/media/music-art/{quote(target.name)}"

    @staticmethod
    def folder_cover(root: Path, path: Path) -> Path | None:
        for current in [path.parent, *path.parent.parents]:
            if current == root.parent or current == root:
                break
            for name in COVER_NAMES:
                candidate = current / name
                if candidate.is_file():
                    return candidate
        return None

    def music_library(self, refresh: bool = False) -> dict:
        cache = self.settings.data_dir / "media" / "music-library.json"
        if cache.exists() and not refresh:
            cached = read_json(cache, {"ok": True, "tracks": []})
            if cached.get("schema") == MUSIC_SCHEMA_VERSION:
                return cached
        root = self.settings.data_dir / "media" / "music"
        tracks = []
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in AUDIO_EXTENSIONS:
                continue
            rel = path.relative_to(root)
            folder = str(rel.parent) if str(rel.parent) != "." else "Music"
            tags = id3_metadata(path, want_cover=True)
            title = tags.get("title") or display_title(path)
            album = tags.get("album") or (rel.parent.name if str(rel.parent) != "." else "Unknown Album")
            artist = tags.get("artist") or "Unknown Artist"
            cover_url = self.cache_music_cover(tags.get("cover"))
            if not cover_url:
                cover_path = self.folder_cover(root, path)
                if cover_path:
                    cover_rel = cover_path.relative_to(root).as_posix()
                    cover_url = f"/media/music/{quote(cover_rel)}"
            tracks.append(
                {
                    "id": str(rel),
                    "title": title,
                    "artist": artist,
                    "album": album,
                    "track": tags.get("track", ""),
                    "folder": folder,
                    "audioUrl": f"/media/music/{quote(rel.as_posix())}",
                    "coverUrl": cover_url or "/maps/overland/tunes.png",
                }
            )
        payload = {"ok": True, "schema": MUSIC_SCHEMA_VERSION, "tracks": tracks, "count": len(tracks)}
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return payload

    def visualizer_images(self) -> dict:
        target = self.settings.data_dir / "media" / "music" / "visualizers"
        target.mkdir(parents=True, exist_ok=True)
        extensions = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
        images = []
        for path in sorted(target.rglob("*")):
            if not path.is_file() or path.name.startswith(".") or path.suffix.lower() not in extensions:
                continue
            rel = path.relative_to(target).as_posix()
            images.append(
                {
                    "id": rel,
                    "name": path.stem.replace("-", " ").replace("_", " ").strip().title() or path.name,
                    "filename": path.name,
                    "url": f"/media/music/visualizers/{rel}",
                    "size": path.stat().st_size,
                }
            )
        return {"ok": True, "images": images}

    def rom_library(self) -> dict:
        root = self.settings.data_dir / "games" / "roms"
        root.mkdir(parents=True, exist_ok=True)
        extension_defaults = {
            ".a26": ("atari2600", *ROM_SYSTEMS["atari2600"]),
            ".gb": ("gb", *ROM_SYSTEMS["gb"]),
            ".gba": ("gba", *ROM_SYSTEMS["gba"]),
            ".gbc": ("gbc", *ROM_SYSTEMS["gbc"]),
            ".gen": ("genesis", *ROM_SYSTEMS["genesis"]),
            ".gg": ("gamegear", *ROM_SYSTEMS["gamegear"]),
            ".md": ("genesis", *ROM_SYSTEMS["genesis"]),
            ".n64": ("n64", *ROM_SYSTEMS["n64"]),
            ".nds": ("nds", *ROM_SYSTEMS["nds"]),
            ".nes": ("nes", *ROM_SYSTEMS["nes"]),
            ".sfc": ("snes", *ROM_SYSTEMS["snes"]),
            ".smc": ("snes", *ROM_SYSTEMS["snes"]),
            ".sms": ("mastersystem", *ROM_SYSTEMS["mastersystem"]),
            ".v64": ("n64", *ROM_SYSTEMS["n64"]),
            ".vb": ("virtualboy", *ROM_SYSTEMS["virtualboy"]),
            ".ws": ("wonderswan", *ROM_SYSTEMS["wonderswan"]),
            ".wsc": ("wonderswancolor", *ROM_SYSTEMS["wonderswancolor"]),
            ".z64": ("n64", *ROM_SYSTEMS["n64"]),
        }
        games = []
        systems: dict[str, dict] = {}
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.name.startswith("."):
                continue
            rel = path.relative_to(root).as_posix()
            first_dir = rel.split("/", 1)[0].lower() if "/" in rel else ""
            if path.suffix.lower() not in ROM_EXTENSIONS:
                continue
            if first_dir in ROM_SYSTEMS:
                system_id = first_dir
                system_title, core = ROM_SYSTEMS[first_dir]
                core_data = (system_id, system_title, core)
            else:
                core_data = extension_defaults.get(path.suffix.lower())
            if not core_data:
                continue
            system_id, system_title, core = core_data
            game = {
                "name": path.stem.replace("_", " ").replace("-", " ").strip() or path.name,
                "filename": path.name,
                "path": rel,
                "url": f"/games/roms/{rel}",
                "system": system_id,
                "systemTitle": system_title,
                "core": core,
                "size": path.stat().st_size,
            }
            games.append(game)
            entry = systems.setdefault(system_id, {"id": system_id, "title": system_title, "count": 0})
            entry["count"] += 1
        emulator_ready = (self.settings.data_dir / "services" / "emulatorjs" / "data" / "loader.js").exists() or (
            REPO_ROOT / "frontend" / "shared" / "emulatorjs" / "data" / "loader.js"
        ).exists() or (
            REPO_ROOT / "frontend" / "shared" / "overland" / "emulatorjs" / "data" / "loader.js"
        ).exists()
        return {"ok": True, "systems": sorted(systems.values(), key=lambda item: item["title"]), "games": games, "emulatorReady": emulator_ready}

    def games_db(self) -> GamesDB:
        return GamesDB(self.settings)

    def open_games(self) -> list[dict]:
        return self.games_db().list_open_games()

    def save_open_games(self, games: list[dict]) -> None:
        db = self.games_db()
        db.clear_open_games()
        for game in games:
            db.save_game(game)

    def handle_mobile_games(self) -> None:
        payload = self.read_body()
        action = payload.get("action", "")
        games = self.open_games()
        db = self.games_db()
        if action == "create":
            game_id = payload.get("gameId") or f"game-{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
            game_type = payload.get("game") or payload.get("type") or payload.get("gameType") or "game"
            player_id = payload.get("playerId") or "player"
            player_name = payload.get("playerName") or "Player"
            game = {
                "id": game_id,
                "type": game_type,
                "title": payload.get("title") or game_type.replace("-", " ").title(),
                "status": "waiting",
                "mode": payload.get("mode"),
                "difficulty": payload.get("difficulty"),
                "players": [{"id": player_id, "name": player_name, "mark": "A"}],
                "created": datetime.now().isoformat(),
                "updated": datetime.now().isoformat(),
            }
            db.save_game(game)
            return self.send_json({"ok": True, "game": game, "games": db.list_open_games()})
        if action == "join":
            game_id = payload.get("gameId")
            player_id = payload.get("playerId") or "player"
            for game in games:
                if game.get("id") == game_id:
                    if not any(player.get("id") == player_id for player in game.get("players", [])):
                        game.setdefault("players", []).append({"id": player_id, "name": payload.get("playerName") or "Player", "mark": chr(65 + len(game.get("players", [])))})
                    db.save_game(game)
                    return self.send_json({"ok": True, "game": game})
        if action == "state":
            game_id = payload.get("gameId")
            game = next((item for item in games if item.get("id") == game_id), None)
            return self.send_json({"ok": bool(game), "game": game, "error": None if game else "Game not found"})
        if action in {"delete", "reset"}:
            game_id = payload.get("gameId")
            games = db.delete_game(game_id)
            return self.send_json({"ok": True, "games": games})
        if action == "move":
            game_id = payload.get("gameId")
            for game in games:
                if game.get("id") == game_id:
                    game["lastMove"] = payload
                    for key, value in payload.items():
                        if key not in {"action", "gameId", "playerId"} and value is not None:
                            game[key] = value
                    db.save_game(game)
                    return self.send_json({"ok": True, "game": game})
        return self.send_json({"ok": True, "games": games})

    def scoreboard(self) -> dict:
        return self.games_db().scoreboard()

    def handle_game_stats(self) -> None:
        payload = self.read_body()
        action = payload.get("action", "scoreboard")
        if action in {"scoreboard", ""}:
            return self.send_json({"ok": True, "scoreboard": self.scoreboard()})
        if action == "active-games":
            games = self.open_games()
            return self.send_json({"ok": True, "games": games, "activeGames": games})
        if action == "clear-active-games":
            games = self.games_db().clear_open_games()
            return self.send_json({"ok": True, "games": games, "activeGames": games})
        if action == "clear-active-game":
            game_id = payload.get("gameId")
            games = self.games_db().delete_game(game_id)
            return self.send_json({"ok": True, "games": games, "activeGames": games})
        if action == "merge":
            try:
                scoreboard = self.games_db().merge_identities(payload.get("sourceId", ""), payload.get("targetId", ""))
                return self.send_json({"ok": True, "scoreboard": scoreboard})
            except ValueError as exc:
                return self.send_json({"ok": False, "error": str(exc)}, status=400)
        if action == "wipe":
            scoreboard = self.games_db().wipe_scores(str(payload.get("game") or "all"))
            return self.send_json({"ok": True, "scoreboard": scoreboard})
        if str(action).startswith("record-"):
            scoreboard = self.games_db().record_score(payload)
            return self.send_json({"ok": True, "scoreboard": scoreboard})
        return self.send_json({"ok": True, "scoreboard": self.scoreboard()})

    def license_plates(self) -> dict:
        return self.games_db().license_plates()

    def handle_license_plates(self) -> None:
        payload = self.read_body()
        data = self.games_db().save_license_plates(payload)
        return self.send_json({"ok": True, **data})

    def trivia_questions_dir(self) -> Path:
        target = self.settings.data_dir / "trivia" / "questions"
        target.mkdir(parents=True, exist_ok=True)
        return target

    def trivia_question_files(self) -> dict:
        files = []
        for path in sorted(self.trivia_questions_dir().glob("*.json")):
            if path.name.startswith("."):
                continue
            files.append({"name": path.name, "size": path.stat().st_size, "updated": datetime.fromtimestamp(path.stat().st_mtime).isoformat()})
        return {"ok": True, "path": str(self.trivia_questions_dir()), "files": files, "manifest": self.trivia_manifest()}

    def trivia_manifest(self) -> dict:
        categories = []
        total = 0
        for path in sorted(self.trivia_questions_dir().glob("*.json")):
            if path.name == "manifest.json" or path.name.startswith("."):
                continue
            data = read_json(path, {})
            questions = data.get("questions", []) if isinstance(data, dict) else []
            difficulties = {"easy": 0, "medium": 0, "hard": 0}
            for question in questions:
                difficulty = str(question.get("difficulty") or "").lower() if isinstance(question, dict) else ""
                if difficulty in difficulties:
                    difficulties[difficulty] += 1
            count = len(questions)
            total += count
            slug = data.get("slug") or path.stem if isinstance(data, dict) else path.stem
            category = data.get("category") or slug.replace("-", " ").title() if isinstance(data, dict) else path.stem.replace("-", " ").title()
            categories.append({"category": category, "slug": slug, "file": path.name, "questionCount": count, "difficulties": difficulties})
        return {"version": 1, "categories": categories, "totalQuestions": total}

    def handle_trivia_question_upload(self) -> None:
        try:
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                return self.send_json({"ok": False, "error": "Expected multipart/form-data with a file field."}, status=400)
            upload = self.read_multipart_upload("file")
            if not upload:
                return self.send_json({"ok": False, "error": "No file provided."}, status=400)
            filename = self.safe_upload_name(Path(upload["filename"]).name)
            if not filename.endswith(".json"):
                return self.send_json({"ok": False, "error": "Trivia question files must be .json."}, status=400)
            raw = upload["content"]
            data = json.loads(raw.decode("utf-8"))
            if filename != "manifest.json" and (not isinstance(data, dict) or not isinstance(data.get("questions"), list)):
                return self.send_json({"ok": False, "error": "Question JSON must contain a questions array."}, status=400)
            target = self.trivia_questions_dir() / filename
            target.write_bytes(raw)
            return self.send_json({"ok": True, "file": filename, "files": self.trivia_question_files()["files"]})
        except json.JSONDecodeError as exc:
            return self.send_json({"ok": False, "error": f"Invalid JSON: {exc}"}, status=400)
        except Exception as exc:  # noqa: BLE001 - HTTP boundary
            return self.send_json({"ok": False, "error": str(exc)}, status=500)

    def upload_targets(self) -> list[dict]:
        return [
            {
                "id": "music",
                "title": "Music",
                "description": "Audio files for the persistent OIAB music player.",
                "path": str(self.settings.data_dir / "media" / "music"),
                "publicBase": "/media/music/",
                "accept": ".mp3,.m4a,.aac,.ogg,.wav,.flac",
                "extensions": [".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac"],
            },
            {
                "id": "trivia",
                "title": "Trivia Questions",
                "description": "Trail Trivia category JSON files.",
                "path": str(self.trivia_questions_dir()),
                "publicBase": "/trivia/questions/",
                "accept": "application/json,.json",
                "extensions": [".json"],
            },
            {
                "id": "maps",
                "title": "Map Packs",
                "description": "Local PMTiles archives for Maps v2. Large packs are usually copied directly to disk.",
                "path": str(self.settings.data_dir / "maps" / "packs"),
                "publicBase": "/maps/packs/",
                "accept": ".pmtiles",
                "extensions": [".pmtiles"],
            },
            {
                "id": "books",
                "title": "Books",
                "description": "Komga ebook/PDF library files.",
                "path": str(self.settings.data_dir / "media" / "books"),
                "publicBase": "/media/books/",
                "accept": ".epub,.pdf,.cbz,.cbr",
                "extensions": [".epub", ".pdf", ".cbz", ".cbr"],
            },
            {
                "id": "comics",
                "title": "Comics",
                "description": "Komga comic archives and PDFs.",
                "path": str(self.settings.data_dir / "media" / "comics"),
                "publicBase": "/media/comics/",
                "accept": ".cbz,.cbr,.pdf",
                "extensions": [".cbz", ".cbr", ".pdf"],
            },
            {
                "id": "zim",
                "title": "Kiwix ZIM",
                "description": "Offline Wikipedia/Kiwix ZIM files.",
                "path": str(self.settings.data_dir / "content" / "zim"),
                "publicBase": "/content/zim/",
                "accept": ".zim",
                "extensions": [".zim"],
            },
            {
                "id": "roms",
                "title": "ROMs",
                "description": "Local emulator ROM library. Only upload ROMs you are legally allowed to use.",
                "path": str(self.settings.data_dir / "games" / "roms"),
                "publicBase": "/games/roms/",
                "accept": ".nes,.sfc,.smc,.gba,.gb,.gbc,.gen,.md,.sms,.gg,.n64,.z64,.v64,.zip",
                "extensions": [".nes", ".sfc", ".smc", ".gba", ".gb", ".gbc", ".gen", ".md", ".sms", ".gg", ".n64", ".z64", ".v64", ".zip"],
            },
            {
                "id": "visualizers",
                "title": "Visualizer Images",
                "description": "Images usable by music visualizer modes.",
                "path": str(self.settings.data_dir / "media" / "music" / "visualizers"),
                "publicBase": "/media/music/visualizers/",
                "accept": ".png,.jpg,.jpeg,.webp,.gif",
                "extensions": [".png", ".jpg", ".jpeg", ".webp", ".gif"],
            },
            {
                "id": "uploads",
                "title": "General Uploads",
                "description": "General-purpose local files.",
                "path": str(self.settings.data_dir / "media" / "uploads"),
                "publicBase": "/uploads/",
                "accept": "",
                "extensions": [],
            },
        ]

    def upload_target(self, target_id: str) -> dict:
        target_id = str(target_id or "uploads").strip().lower()
        targets = {target["id"]: target for target in self.upload_targets()}
        if target_id not in targets:
            raise ValueError(f"Unknown upload target: {target_id}")
        return targets[target_id]

    def upload_files(self, target_id: str) -> dict:
        try:
            target = self.upload_target(target_id)
        except ValueError as exc:
            return {"ok": False, "error": str(exc), "files": []}
        root = Path(target["path"])
        root.mkdir(parents=True, exist_ok=True)
        files = []
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.name.startswith("."):
                continue
            rel = path.relative_to(root).as_posix()
            files.append(
                {
                    "name": rel,
                    "size": path.stat().st_size,
                    "updated": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
                    "url": f"{target['publicBase']}{rel}",
                }
            )
        return {"ok": True, "target": target, "files": files}

    def handle_file_upload(self, target_id: str) -> None:
        try:
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                return self.send_json({"ok": False, "error": "Expected multipart/form-data with a file field."}, status=400)
            target = self.upload_target(target_id)
            upload = self.read_multipart_upload("file")
            if not upload:
                return self.send_json({"ok": False, "error": "No file provided."}, status=400)
            filename = self.safe_upload_name(Path(upload["filename"]).name)
            suffix = Path(filename).suffix.lower()
            allowed = [str(ext).lower() for ext in target.get("extensions", [])]
            if allowed and suffix not in allowed:
                return self.send_json({"ok": False, "error": f"{target['title']} uploads must use: {', '.join(allowed)}"}, status=400)
            raw = upload["content"]
            if target["id"] == "trivia":
                try:
                    data = json.loads(raw.decode("utf-8"))
                except json.JSONDecodeError as exc:
                    return self.send_json({"ok": False, "error": f"Invalid JSON: {exc}"}, status=400)
                if filename != "manifest.json" and (not isinstance(data, dict) or not isinstance(data.get("questions"), list)):
                    return self.send_json({"ok": False, "error": "Question JSON must contain a questions array."}, status=400)
            root = Path(target["path"])
            root.mkdir(parents=True, exist_ok=True)
            destination = root / filename
            destination.write_bytes(raw)
            if target["id"] == "music":
                cache = self.settings.data_dir / "media" / "music-library.json"
                if cache.exists():
                    cache.unlink()
            if target["id"] == "maps":
                self.app_db().rescan_map_packs()
            return self.send_json({"ok": True, "target": target["id"], "file": filename, "files": self.upload_files(target["id"]).get("files", [])})
        except ValueError as exc:
            return self.send_json({"ok": False, "error": str(exc)}, status=400)
        except Exception as exc:  # noqa: BLE001 - HTTP boundary
            return self.send_json({"ok": False, "error": str(exc)}, status=500)

    @staticmethod
    def safe_upload_name(name: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip(".-")
        return cleaned or "upload.json"

    def read_multipart_upload(self, field_name: str) -> dict | None:
        content_type = self.headers.get("Content-Type", "")
        match = re.search(r'boundary="?([^";]+)"?', content_type)
        if not match:
            return None
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return None
        raw = self.rfile.read(length)
        boundary = ("--" + match.group(1)).encode("utf-8")
        for part in raw.split(boundary):
            part = part.strip(b"\r\n")
            if not part or part == b"--" or b"\r\n\r\n" not in part:
                continue
            header_blob, body = part.split(b"\r\n\r\n", 1)
            headers = header_blob.decode("utf-8", errors="replace")
            if f'name="{field_name}"' not in headers:
                continue
            filename_match = re.search(r'filename="([^"]*)"', headers)
            filename = filename_match.group(1) if filename_match else ""
            if body.endswith(b"\r\n"):
                body = body[:-2]
            if body.endswith(b"--"):
                body = body[:-2]
            return {"filename": filename, "content": body}
        return None

    def app_layout(self) -> dict:
        return {
            "schema": 1,
            "settingsPassword": "",
            "hiddenAppIds": ["legacy-home", "legacy-admin"],
            "folders": [
                {"id": "games", "title": "Games", "icon": "/maps/overland/overland-folder-games.svg", "protected": False, "appIds": ["scoreboard", "chess", "checkers", "minesweeper", "blockfall", "claimline", "blank-slate", "word-tile-arena", "connect-four", "battleship", "dots-and-boxes", "hangman", "word-grid", "pattern-match", "web-emulator", "drums", "trivia", "tic-tac-toe", "license-plates"]},
                {"id": "reading", "title": "Reading", "icon": "/maps/overland/overland-folder-reading.svg", "protected": False, "appIds": ["wikipedia", "books", "komga"]},
                {"id": "settings", "title": "Settings", "icon": "/maps/overland/overland-folder-settings.svg", "protected": True, "appIds": ["overland-settings", "gps-status", "system-monitor", "https-settings", "file-uploads", "map-packs", "service-manager", "game-data", "audio-test"]},
            ],
        }


def run() -> None:
    parser = argparse.ArgumentParser(description="Run the Overland In A Box standalone backend.")
    parser.add_argument("--host", default=SETTINGS.bind_host)
    parser.add_argument("--port", type=int, default=SETTINGS.http_port)
    args = parser.parse_args()
    ensure_data_layout(SETTINGS)
    bootstrap = ensure_default_world_map(SETTINGS)
    handler = OIABHandler
    handler.settings = SETTINGS
    httpd = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"OIAB serving http://{args.host}:{args.port} with data at {SETTINGS.data_dir}")
    print(f"Map bootstrap: {bootstrap.get('status')}")
    httpd.serve_forever()


if __name__ == "__main__":
    run()
