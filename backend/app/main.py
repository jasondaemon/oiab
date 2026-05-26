from __future__ import annotations

import argparse
import json
import mimetypes
import os
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from .config import REPO_ROOT, SETTINGS, Settings, ensure_data_layout
from .gps.gpsd import read_gpsd
from .services import list_services
from .storage import folders_from_places, read_json, read_places, save_waypoint


mimetypes.add_type("application/octet-stream", ".pmtiles")
mimetypes.add_type("application/x-protobuf", ".pbf")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/manifest+json", ".webmanifest")


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
        if path in {"/api/map-data", "/maps-data"}:
            places = read_places(self.settings)
            return self.send_json({"ok": True, "places": places, "folders": folders_from_places(places)})
        if path in {"/api/tracks/current", "/maps-tracks-current"}:
            return self.send_json(self.current_track())
        if path in {"/api/services", "/services-status"}:
            return self.send_json({"ok": True, "services": list_services()})
        if path in {"/music-api/library", "/api/music/library"}:
            refresh = "refresh=1" in parsed.query
            return self.send_json(self.music_library(refresh=refresh))
        if path in {"/music-api/visualizer-images", "/api/music/visualizer-images"}:
            return self.send_json({"ok": True, "images": []})
        if path in {"/roms-api/library", "/api/roms"}:
            return self.send_json({"ok": True, "systems": [], "roms": []})
        if path in {"/mobile-games", "/api/mobile-games"}:
            return self.send_json({"ok": True, "games": self.open_games()})
        if path in {"/game-stats", "/api/game-stats"}:
            return self.send_json({"ok": True, "scoreboard": self.scoreboard()})
        if path in {"/license-plates", "/api/license-plates"}:
            return self.send_json(self.license_plates())
        if path in {"/api/apps", "/overland/apps.json", "/maps/overland/apps.json"}:
            return self.serve_file(REPO_ROOT / "config" / "apps.json")
        if path == "/app-layout":
            return self.send_json({"ok": True, "layout": self.app_layout()})

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
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(file_size))
            self.end_headers()
            return
        if path in {"/api/health", "/health"}:
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

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
            return self.send_json({"ok": False, "error": "Optional service actions are stubbed in this base extraction."}, status=501)
        if path in {"/mobile-games", "/api/mobile-games"}:
            return self.handle_mobile_games()
        if path in {"/game-stats", "/api/game-stats"}:
            return self.handle_game_stats()
        if path in {"/license-plates", "/api/license-plates"}:
            return self.handle_license_plates()
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
        self.send_header("Content-Type", content_type)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
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

    def resolve_static(self, path: str) -> Path | None:
        if path in {"/", "/overland/", "/overland/index.html"}:
            return REPO_ROOT / "frontend" / "shell" / "index.html"
        if path in {"/universal-shell.css", "/universal-shell.js", "/overland-shell.css", "/overland-shell.js"}:
            return REPO_ROOT / "frontend" / "shell" / path.removeprefix("/")
        if path == "/overland/legacy.html":
            return REPO_ROOT / "frontend" / "shell" / "legacy.html"
        if path.startswith("/overland/"):
            return self.safe_join(REPO_ROOT / "frontend" / "shell", path.removeprefix("/overland/"))
        if path in {"/maps-v2", "/maps-v2/"}:
            return REPO_ROOT / "frontend" / "maps" / "index.html"
        if path.startswith("/maps-v2/"):
            return self.safe_join(REPO_ROOT / "frontend" / "maps", path.removeprefix("/maps-v2/"))
        if path.startswith("/maps-v2-packs/") or path.startswith("/maps/packs/"):
            rel = path.split("/packs/", 1)[-1] if "/packs/" in path else path.removeprefix("/maps-v2-packs/")
            return self.safe_join(self.settings.data_dir / "maps" / "packs", rel)
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
        if path in {"/gps-status", "/gps-status/"}:
            return REPO_ROOT / "frontend" / "mobile" / "gps-status.html"
        if path.startswith("/maps/overland/"):
            return self.safe_join(REPO_ROOT / "frontend" / "shared" / "overland", path.removeprefix("/maps/overland/"))
        if path.startswith("/media/music/"):
            return self.safe_join(self.settings.data_dir / "media" / "music", path.removeprefix("/media/music/"))
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
        }

    def map_packs(self) -> dict:
        registry = read_json(self.settings.map_pack_registry, None) if self.settings.map_pack_registry else None
        if not registry:
            registry = read_json(REPO_ROOT / "config" / "map-packs.json", {"active_basemap": "protomaps_conus", "basemaps": []})
        basemaps = []
        for pack in registry.get("basemaps", []):
            item = dict(pack)
            url = str(item.get("url") or "")
            if url.startswith("/maps/packs/"):
                file_path = self.settings.data_dir / "maps" / "packs" / url.removeprefix("/maps/packs/")
                item["exists"] = file_path.exists()
                item["size_bytes"] = file_path.stat().st_size if file_path.exists() else 0
            else:
                item.setdefault("exists", False)
                item.setdefault("size_bytes", 0)
            basemaps.append(item)
        return {"ok": True, "active": registry.get("active_basemap") or registry.get("active"), "basemaps": basemaps}

    def current_track(self) -> dict:
        track_file = self.settings.data_dir / "tracks" / "current.geojson"
        track = read_json(track_file, {"type": "FeatureCollection", "features": []})
        return {"ok": True, "recording": False, "status": "inactive", "track": track}

    def music_library(self, refresh: bool = False) -> dict:
        cache = self.settings.data_dir / "media" / "music-library.json"
        if cache.exists() and not refresh:
            return read_json(cache, {"ok": True, "tracks": []})
        root = self.settings.data_dir / "media" / "music"
        tracks = []
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in {".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac"}:
                continue
            rel = path.relative_to(root)
            title = path.stem.replace("_", " ").replace("-", " ").strip() or path.name
            folder = str(rel.parent) if str(rel.parent) != "." else "Music"
            tracks.append(
                {
                    "id": str(rel),
                    "title": title,
                    "artist": "Unknown Artist",
                    "album": folder.split(os.sep)[-1] if folder else "Unknown Album",
                    "folder": folder,
                    "audioUrl": f"/media/music/{rel.as_posix()}",
                    "coverUrl": "/maps/overland/tunes.png",
                }
            )
        payload = {"ok": True, "tracks": tracks, "count": len(tracks)}
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return payload

    def open_games(self) -> list[dict]:
        data = read_json(self.settings.data_dir / "games" / "mobile-games.json", {"games": []})
        return [game for game in data.get("games", []) if game.get("status") not in {"complete", "finished", "deleted"}]

    def save_open_games(self, games: list[dict]) -> None:
        target = self.settings.data_dir / "games" / "mobile-games.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps({"games": games}, indent=2), encoding="utf-8")

    def handle_mobile_games(self) -> None:
        payload = self.read_body()
        action = payload.get("action", "")
        games = self.open_games()
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
            games.append(game)
            self.save_open_games(games)
            return self.send_json({"ok": True, "game": game, "games": games})
        if action == "join":
            game_id = payload.get("gameId")
            player_id = payload.get("playerId") or "player"
            for game in games:
                if game.get("id") == game_id:
                    if not any(player.get("id") == player_id for player in game.get("players", [])):
                        game.setdefault("players", []).append({"id": player_id, "name": payload.get("playerName") or "Player", "mark": chr(65 + len(game.get("players", [])))})
                    game["updated"] = datetime.now().isoformat()
                    self.save_open_games(games)
                    return self.send_json({"ok": True, "game": game})
        if action == "state":
            game_id = payload.get("gameId")
            game = next((item for item in games if item.get("id") == game_id), None)
            return self.send_json({"ok": bool(game), "game": game, "error": None if game else "Game not found"})
        if action in {"delete", "reset"}:
            game_id = payload.get("gameId")
            games = [game for game in games if game.get("id") != game_id]
            self.save_open_games(games)
            return self.send_json({"ok": True, "games": games})
        if action == "move":
            game_id = payload.get("gameId")
            for game in games:
                if game.get("id") == game_id:
                    game["lastMove"] = payload
                    game["updated"] = datetime.now().isoformat()
                    self.save_open_games(games)
                    return self.send_json({"ok": True, "game": game})
        return self.send_json({"ok": True, "games": games})

    def scoreboard(self) -> dict:
        return read_json(
            self.settings.data_dir / "games" / "scoreboard.json",
            {"totals": {"matches": 0, "players": 0}, "overall": [], "games": {}, "recent": [], "players": []},
        )

    def handle_game_stats(self) -> None:
        payload = self.read_body()
        action = payload.get("action", "scoreboard")
        if action in {"scoreboard", ""}:
            return self.send_json({"ok": True, "scoreboard": self.scoreboard()})
        if action == "active-games":
            return self.send_json({"ok": True, "games": self.open_games()})
        if action == "clear-active-games":
            self.save_open_games([])
            return self.send_json({"ok": True, "games": []})
        if action == "clear-active-game":
            game_id = payload.get("gameId")
            games = [game for game in self.open_games() if game.get("id") != game_id]
            self.save_open_games(games)
            return self.send_json({"ok": True, "games": games})
        if str(action).startswith("record-"):
            scoreboard = self.scoreboard()
            recent = scoreboard.setdefault("recent", [])
            recent.insert(0, {**payload, "created": datetime.now().isoformat()})
            scoreboard.setdefault("totals", {})["matches"] = len(recent)
            target = self.settings.data_dir / "games" / "scoreboard.json"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(scoreboard, indent=2), encoding="utf-8")
            return self.send_json({"ok": True, "scoreboard": scoreboard})
        return self.send_json({"ok": True, "scoreboard": self.scoreboard()})

    def license_plates(self) -> dict:
        return read_json(self.settings.data_dir / "games" / "license-plates.json", {"ok": True, "plates": {}})

    def handle_license_plates(self) -> None:
        payload = self.read_body()
        target = self.settings.data_dir / "games" / "license-plates.json"
        data = self.license_plates()
        data.update(payload)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return self.send_json({"ok": True, **data})

    def app_layout(self) -> dict:
        return {
            "schema": 1,
            "settingsPassword": "",
            "hiddenAppIds": ["legacy-home", "legacy-admin"],
            "folders": [
                {"id": "games", "title": "Games", "icon": "/maps/overland/overland-folder-games.svg", "protected": False, "appIds": ["scoreboard", "chess", "checkers", "minesweeper", "blockfall", "claimline", "blank-slate", "word-tile-arena", "connect-four", "battleship", "dots-and-boxes", "hangman", "word-grid", "pattern-match", "drums", "trivia", "tic-tac-toe", "license-plates"]},
                {"id": "reading", "title": "Reading", "icon": "/maps/overland/overland-folder-reading.svg", "protected": False, "appIds": ["wikipedia", "books", "komga"]},
                {"id": "settings", "title": "Settings", "icon": "/maps/overland/overland-folder-settings.svg", "protected": True, "appIds": ["overland-settings", "gps-status", "system-monitor", "file-uploads", "service-manager"]},
            ],
        }


def run() -> None:
    parser = argparse.ArgumentParser(description="Run the Overland In A Box standalone backend.")
    parser.add_argument("--host", default=SETTINGS.bind_host)
    parser.add_argument("--port", type=int, default=SETTINGS.http_port)
    args = parser.parse_args()
    ensure_data_layout(SETTINGS)
    handler = OIABHandler
    handler.settings = SETTINGS
    httpd = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"OIAB serving http://{args.host}:{args.port} with data at {SETTINGS.data_dir}")
    httpd.serve_forever()


if __name__ == "__main__":
    run()
