from __future__ import annotations

import json
import hashlib
import re
import shutil
import sqlite3
import subprocess
import xml.etree.ElementTree as ET
from math import asin, cos, radians, sin, sqrt
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit
from typing import Any, Iterator

from .config import REPO_ROOT, Settings
from .storage import EMPTY_FEATURE_COLLECTION, read_json


def now_iso() -> str:
    return datetime.now().isoformat()


def json_dumps(value: Any) -> str:
    return json.dumps(value, indent=2, sort_keys=True, default=str)


def json_loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def bool_int(value: Any, default: bool = False) -> int:
    if value is None:
        return 1 if default else 0
    if isinstance(value, bool):
        return 1 if value else 0
    return 1 if str(value).strip().lower() in {"1", "true", "yes", "on", "shown", "enabled"} else 0


def parse_json_text(value: str | None) -> Any | None:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def child_text(node: ET.Element, names: list[str]) -> str:
    wanted = set(names)
    for child in node.iter():
        if child is node:
            continue
        if local_name(child.tag) in wanted and child.text:
            return child.text.strip()
    return ""


def normalize_folder_path(value: Any, default: str = "Unfiled") -> str:
    raw = str(value or default or "Unfiled").strip().replace("\\", "/")
    parts = [part.strip() for part in raw.split("/") if part.strip()]
    return "/".join(parts) or default or "Unfiled"


def valid_lat_lon(lat: float, lon: float) -> bool:
    return -85 <= lat <= 85 and -180 <= lon <= 180


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371000.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * radius * asin(sqrt(a))


def node_coordinates(node: ET.Element) -> list[float]:
    lat = float(node.attrib.get("lat", ""))
    lon = float(node.attrib.get("lon", ""))
    if not valid_lat_lon(lat, lon):
        raise ValueError(f"Point is out of range: {lat}, {lon}")
    ele = child_text(node, ["ele"])
    return [lon, lat, float(ele)] if ele else [lon, lat]


def parse_kml_coordinates(text: str) -> list[list[float]]:
    coords: list[list[float]] = []
    for token in re.split(r"\s+", (text or "").strip()):
        if not token:
            continue
        parts = token.split(",")
        if len(parts) < 2:
            continue
        lon = float(parts[0])
        lat = float(parts[1])
        if not valid_lat_lon(lat, lon):
            raise ValueError(f"KML point is out of range: {lat}, {lon}")
        coords.append([lon, lat, float(parts[2])] if len(parts) > 2 and parts[2] else [lon, lat])
    return coords


def numeric_value(value: Any) -> int | float | None:
    if value is None or value == "":
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed.is_integer():
        return int(parsed)
    return parsed


def iso_plus_minutes(minutes: Any) -> str | None:
    value = numeric_value(minutes)
    if value is None or value <= 0:
        return None
    return (datetime.now() + timedelta(minutes=float(value))).isoformat(timespec="seconds")


def iso_is_stale(value: Any) -> bool:
    if not value:
        return False
    try:
        return datetime.fromisoformat(str(value)) < datetime.now()
    except ValueError:
        return False


class AppDB:
    """Primary durable OIAB store for map/user/settings data.

    The API intentionally returns legacy GeoJSON-compatible structures so the
    current frontend can keep working while the storage layer is hardened.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.db_path = settings.db_path or settings.data_dir / "db" / "oiab.sqlite"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.init()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout=5000")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA journal_mode=WAL")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def init(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                  id TEXT PRIMARY KEY,
                  applied_at TEXT NOT NULL,
                  details_json TEXT NOT NULL DEFAULT '{}'
                );

                CREATE TABLE IF NOT EXISTS folders (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT NOT NULL UNIQUE,
                  visible INTEGER NOT NULL DEFAULT 1,
                  sort_order INTEGER NOT NULL DEFAULT 0,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS waypoints (
                  id TEXT PRIMARY KEY,
                  folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
                  name TEXT NOT NULL,
                  category TEXT NOT NULL DEFAULT 'waypoint',
                  icon TEXT,
                  lat REAL NOT NULL,
                  lon REAL NOT NULL,
                  raw_lat REAL,
                  raw_lon REAL,
                  notes TEXT NOT NULL DEFAULT '',
                  source TEXT NOT NULL DEFAULT 'oiab',
                  color TEXT,
                  accuracy_m REAL,
                  hdop REAL,
                  speed_mph REAL,
                  heading_deg REAL,
                  stabilized INTEGER NOT NULL DEFAULT 0,
                  stabilization_mode TEXT,
                  properties_json TEXT NOT NULL DEFAULT '{}',
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_waypoints_folder
                  ON waypoints(folder_id);
                CREATE INDEX IF NOT EXISTS idx_waypoints_category
                  ON waypoints(category);
                CREATE INDEX IF NOT EXISTS idx_waypoints_updated
                  ON waypoints(updated_at);

                CREATE TABLE IF NOT EXISTS tracks (
                  id TEXT PRIMARY KEY,
                  folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
                  name TEXT NOT NULL,
                  status TEXT NOT NULL DEFAULT 'saved',
                  source TEXT NOT NULL DEFAULT 'oiab',
                  color TEXT,
                  properties_json TEXT NOT NULL DEFAULT '{}',
                  started_at TEXT,
                  ended_at TEXT,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_tracks_folder
                  ON tracks(folder_id);
                CREATE INDEX IF NOT EXISTS idx_tracks_status
                  ON tracks(status);
                CREATE INDEX IF NOT EXISTS idx_tracks_updated
                  ON tracks(updated_at);

                CREATE TABLE IF NOT EXISTS track_points (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                  seq INTEGER NOT NULL,
                  lat REAL NOT NULL,
                  lon REAL NOT NULL,
                  alt_m REAL,
                  speed_mph REAL,
                  heading_deg REAL,
                  accuracy_m REAL,
                  hdop REAL,
                  source TEXT,
                  raw_lat REAL,
                  raw_lon REAL,
                  timestamp TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  UNIQUE(track_id, seq)
                );

                CREATE INDEX IF NOT EXISTS idx_track_points_track
                  ON track_points(track_id, seq);
                CREATE INDEX IF NOT EXISTS idx_track_points_timestamp
                  ON track_points(timestamp);

                CREATE TABLE IF NOT EXISTS map_packs (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  type TEXT NOT NULL DEFAULT 'pmtiles',
                  path TEXT NOT NULL,
                  public_url TEXT NOT NULL,
                  style_path TEXT,
                  attribution TEXT,
                  installed INTEGER NOT NULL DEFAULT 0,
                  active INTEGER NOT NULL DEFAULT 0,
                  enabled INTEGER NOT NULL DEFAULT 0,
                  size_bytes INTEGER NOT NULL DEFAULT 0,
                  metadata_json TEXT NOT NULL DEFAULT '{}',
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_map_packs_active
                  ON map_packs(active, installed);

                CREATE TABLE IF NOT EXISTS map_settings (
                  key TEXT PRIMARY KEY,
                  value_json TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS map_layer_visibility (
                  layer_id TEXT PRIMARY KEY,
                  visible INTEGER NOT NULL DEFAULT 1,
                  updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS map_overlays (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  type TEXT NOT NULL,
                  source_url TEXT NOT NULL DEFAULT '',
                  path TEXT,
                  source_layer TEXT,
                  tiles_json TEXT NOT NULL DEFAULT '[]',
                  layers_json TEXT NOT NULL DEFAULT '[]',
                  attribution TEXT,
                  online_available INTEGER NOT NULL DEFAULT 0,
                  offline_available INTEGER NOT NULL DEFAULT 0,
                  cache_mode TEXT NOT NULL DEFAULT 'none',
                  enabled INTEGER NOT NULL DEFAULT 0,
                  opacity REAL NOT NULL DEFAULT 1.0,
                  sort_order INTEGER NOT NULL DEFAULT 100,
                  metadata_json TEXT NOT NULL DEFAULT '{}',
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_map_overlays_enabled
                  ON map_overlays(enabled, sort_order);

                CREATE TABLE IF NOT EXISTS app_settings (
                  key TEXT PRIMARY KEY,
                  value_json TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS sync_metadata (
                  key TEXT PRIMARY KEY,
                  value_json TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );
                """
            )
        self.import_legacy_once()

    def migration_applied(self, migration_id: str) -> bool:
        with self.connect() as conn:
            row = conn.execute("SELECT 1 FROM schema_migrations WHERE id = ?", (migration_id,)).fetchone()
            return bool(row)

    def mark_migration(self, migration_id: str, details: dict[str, Any] | None = None) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO schema_migrations(id, applied_at, details_json)
                VALUES (?, ?, ?)
                """,
                (migration_id, now_iso(), json_dumps(details or {})),
            )

    def backup_file(self, path: Path) -> str | None:
        if not path.exists() or not path.is_file():
            return None
        target_dir = self.settings.data_dir / "backups" / "migrations"
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / f"{path.name}.{datetime.now().strftime('%Y%m%d%H%M%S')}.bak"
        shutil.copy2(path, target)
        return str(target)

    def import_legacy_once(self) -> None:
        if not self.migration_applied("legacy_json_geojson_v1"):
            details: dict[str, Any] = {}
            try:
                details["places_backup"] = self.backup_file(self.places_file())
                details["places_imported"] = self.import_places_geojson(self.places_file())
                details["track_backup"] = self.backup_file(self.current_track_file())
                details["track_imported"] = self.import_track_geojson(self.current_track_file())
                self.mark_migration("legacy_json_geojson_v1", details)
            except Exception as exc:  # noqa: BLE001 - migration boundary
                print(f"OIAB DB migration legacy_json_geojson_v1 failed: {exc}")
        if not self.migration_applied("legacy_track_points_jsonl_v1"):
            details: dict[str, Any] = {}
            try:
                details["track_points_backup"] = self.backup_file(self.track_points_file())
                details["track_metadata_backup"] = self.backup_file(self.current_track_metadata_file())
                details["track_points_import"] = self.import_track_points_jsonl(
                    self.track_points_file(),
                    self.current_track_metadata_file(),
                )
                self.mark_migration("legacy_track_points_jsonl_v1", details)
            except Exception as exc:  # noqa: BLE001 - migration boundary
                print(f"OIAB DB migration legacy_track_points_jsonl_v1 failed: {exc}")
        if not self.migration_applied("legacy_data_repair_v1"):
            details: dict[str, Any] = {}
            try:
                if self.waypoint_count() == 0 and self.places_file().exists():
                    details["places_reimported"] = self.import_places_geojson(self.places_file())
                if self.track_count() == 0 and self.track_points_file().exists():
                    details["track_points_reimported"] = self.import_track_points_jsonl(
                        self.track_points_file(),
                        self.current_track_metadata_file(),
                    )
                self.mark_migration("legacy_data_repair_v1", details)
            except Exception as exc:  # noqa: BLE001 - migration boundary
                print(f"OIAB DB migration legacy_data_repair_v1 failed: {exc}")
        if not self.migration_applied("map_pack_registry_v1"):
            try:
                details = self.import_map_pack_registry()
                self.rescan_map_packs()
                self.mark_migration("map_pack_registry_v1", details)
            except Exception as exc:  # noqa: BLE001 - migration boundary
                print(f"OIAB DB migration map_pack_registry_v1 failed: {exc}")
        if not self.migration_applied("map_pack_enabled_v1"):
            try:
                with self.connect() as conn:
                    columns = {row["name"] for row in conn.execute("PRAGMA table_info(map_packs)").fetchall()}
                    if "enabled" not in columns:
                        conn.execute("ALTER TABLE map_packs ADD COLUMN enabled INTEGER NOT NULL DEFAULT 0")
                    conn.execute("UPDATE map_packs SET enabled = CASE WHEN active = 1 THEN 1 ELSE enabled END")
                    conn.execute("UPDATE map_packs SET enabled = 1 WHERE id = 'world_overview' AND installed = 1")
                self.mark_migration("map_pack_enabled_v1", {"ok": True})
            except Exception as exc:  # noqa: BLE001 - migration boundary
                print(f"OIAB DB migration map_pack_enabled_v1 failed: {exc}")

    def places_file(self) -> Path:
        return self.settings.data_dir / "waypoints" / "trailer-places.geojson"

    def current_track_file(self) -> Path:
        return self.settings.data_dir / "tracks" / "current.geojson"

    def current_track_metadata_file(self) -> Path:
        return self.settings.data_dir / "tracks" / "current-track.json"

    def track_points_file(self) -> Path:
        return self.settings.data_dir / "tracks" / "track-points.jsonl"

    def waypoint_count(self) -> int:
        with self.connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS c FROM waypoints").fetchone()
            return int(row["c"] if row else 0)

    def track_count(self) -> int:
        with self.connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS c FROM tracks").fetchone()
            return int(row["c"] if row else 0)

    def folder_id(self, name: str | None, visible: bool = True) -> int:
        folder = str(name or "Unfiled").strip() or "Unfiled"
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO folders(name, visible, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET updated_at = excluded.updated_at
                """,
                (folder, bool_int(visible, True), now_iso(), now_iso()),
            )
            row = conn.execute("SELECT id FROM folders WHERE name = ?", (folder,)).fetchone()
            return int(row["id"])

    def folder_name(self, folder_id: int | None) -> str:
        if not folder_id:
            return "Unfiled"
        with self.connect() as conn:
            row = conn.execute("SELECT name FROM folders WHERE id = ?", (folder_id,)).fetchone()
            return str(row["name"]) if row else "Unfiled"

    def import_places_geojson(self, path: Path) -> int:
        data = read_json(path, EMPTY_FEATURE_COLLECTION)
        features = data.get("features", []) if isinstance(data, dict) else []
        return self.import_geojson_features(features)

    def import_geojson_features(self, features: list[dict[str, Any]]) -> int:
        count = 0
        for feature in features:
            if not isinstance(feature, dict):
                continue
            geometry = feature.get("geometry") or {}
            props = feature.get("properties") or {}
            if feature.get("id") and not props.get("id"):
                props = {**props, "id": str(feature.get("id"))}
            if geometry.get("type") == "Point":
                coords = geometry.get("coordinates") or []
                if len(coords) < 2:
                    continue
                self.save_waypoint(
                    {
                        **props,
                        "lon": coords[0],
                        "lat": coords[1],
                        "folder": props.get("folder") or "Unfiled",
                        "category": props.get("category") or "waypoint",
                    }
                )
                count += 1
            elif geometry.get("type") == "LineString":
                self.import_track_feature(feature)
                count += 1
            elif geometry.get("type") == "MultiLineString":
                for index, coords in enumerate(geometry.get("coordinates") or []):
                    if not isinstance(coords, list) or len(coords) < 2:
                        continue
                    split = {
                        **feature,
                        "geometry": {"type": "LineString", "coordinates": coords},
                        "properties": {
                            **props,
                            "id": f"{props.get('id') or feature.get('id') or 'track'}-{index + 1}",
                            "name": f"{props.get('name') or props.get('title') or 'Route'} {index + 1}",
                        },
                    }
                    self.import_track_feature(split)
                    count += 1
        return count

    def import_upload(self, filename: str, content: bytes, folder: str | None = None) -> dict[str, Any]:
        suffix = Path(filename or "uploaded").suffix.lower()
        default_folder = Path(filename or "Imported").stem or "Imported"
        target_folder = normalize_folder_path(folder, default_folder)
        import_id = datetime.now().strftime("%Y%m%d-%H%M%S%f")
        if suffix == ".gpx":
            features = self.parse_gpx_features(content, filename, target_folder, import_id)
        elif suffix in {".geojson", ".json"}:
            features = self.parse_geojson_upload(content, filename, target_folder, import_id)
        elif suffix == ".kml":
            features = self.parse_kml_features(content, filename, target_folder, import_id)
        else:
            raise ValueError("Unsupported import type. Use GPX, GeoJSON/JSON, or KML.")
        count = self.import_geojson_features(features)
        return {"count": count, "import_id": import_id, "folder": target_folder}

    def parse_geojson_upload(self, content: bytes, filename: str, folder: str, import_id: str) -> list[dict[str, Any]]:
        try:
            incoming = json.loads(content.decode("utf-8"))
        except Exception as exc:  # noqa: BLE001 - user upload boundary
            raise ValueError(f"Could not parse GeoJSON: {exc}") from exc
        raw_features = incoming.get("features", []) if incoming.get("type") == "FeatureCollection" else [incoming] if incoming.get("type") == "Feature" else []
        if not raw_features:
            raise ValueError("GeoJSON must be a FeatureCollection or Feature.")
        base_name = Path(filename or "GeoJSON import").stem or "GeoJSON import"
        features: list[dict[str, Any]] = []
        for index, feature in enumerate(raw_features):
            if not isinstance(feature, dict):
                continue
            geometry = feature.get("geometry") or {}
            if geometry.get("type") not in {"Point", "LineString", "MultiLineString"}:
                continue
            props = dict(feature.get("properties") or {})
            props["name"] = str(props.get("name") or props.get("title") or f"{base_name} {index + 1}")
            props["category"] = str(props.get("category") or ("route" if geometry.get("type") != "Point" else "waypoint"))
            props["folder"] = normalize_folder_path(props.get("folder") or folder, folder)
            props["source"] = filename or "GeoJSON import"
            props["import_id"] = import_id
            props["import_name"] = base_name
            props["created"] = props.get("created") or now_iso()
            features.append({"type": "Feature", "id": str(feature.get("id") or props.get("id") or f"{import_id}-geojson-{index}"), "geometry": geometry, "properties": props})
        if not features:
            raise ValueError("No supported GeoJSON Point, LineString, or MultiLineString features were found.")
        return features

    def parse_gpx_features(self, content: bytes, filename: str, folder: str, import_id: str) -> list[dict[str, Any]]:
        try:
            root = ET.fromstring(content)
        except ET.ParseError as exc:
            raise ValueError(f"Could not parse GPX XML: {exc}") from exc
        base_name = Path(filename or "GPX import").stem or "GPX import"
        features: list[dict[str, Any]] = []
        point_count = 0
        max_points = 100000

        def next_id(prefix: str) -> str:
            return f"{import_id}-{prefix}-{len(features)}"

        for node in root.iter():
            if local_name(node.tag) != "wpt":
                continue
            coords = node_coordinates(node)
            point_count += 1
            name = child_text(node, ["name"]) or f"{base_name} waypoint {point_count}"
            notes = child_text(node, ["desc", "cmt"])
            features.append({
                "type": "Feature",
                "id": next_id("wpt"),
                "geometry": {"type": "Point", "coordinates": coords},
                "properties": {
                    "name": name,
                    "category": "waypoint",
                    "icon": "pin",
                    "folder": folder,
                    "notes": notes,
                    "source": filename or "GPX import",
                    "import_id": import_id,
                    "import_name": base_name,
                    "created": now_iso(),
                },
            })

        for trk in [node for node in root.iter() if local_name(node.tag) == "trk"]:
            track_name = child_text(trk, ["name"]) or base_name
            segment_index = 0
            for seg in [node for node in trk.iter() if local_name(node.tag) == "trkseg"]:
                coords = []
                for pt in [node for node in seg.iter() if local_name(node.tag) == "trkpt"]:
                    coords.append(node_coordinates(pt))
                    point_count += 1
                    if point_count > max_points:
                        raise ValueError(f"GPX import is too large; limit is {max_points} points.")
                if len(coords) >= 2:
                    segment_index += 1
                    suffix = f" segment {segment_index}" if segment_index > 1 else ""
                    features.append({
                        "type": "Feature",
                        "id": next_id("trk"),
                        "geometry": {"type": "LineString", "coordinates": coords},
                        "properties": {
                            "name": f"{track_name}{suffix}",
                            "category": "route",
                            "folder": folder,
                            "notes": "Imported GPX track.",
                            "source": filename or "GPX import",
                            "import_id": import_id,
                            "import_name": base_name,
                            "created": now_iso(),
                        },
                    })

        for rte in [node for node in root.iter() if local_name(node.tag) == "rte"]:
            coords = []
            route_name = child_text(rte, ["name"]) or f"{base_name} route"
            for pt in [node for node in rte.iter() if local_name(node.tag) == "rtept"]:
                coords.append(node_coordinates(pt))
                point_count += 1
                if point_count > max_points:
                    raise ValueError(f"GPX import is too large; limit is {max_points} points.")
            if len(coords) >= 2:
                features.append({
                    "type": "Feature",
                    "id": next_id("rte"),
                    "geometry": {"type": "LineString", "coordinates": coords},
                    "properties": {
                        "name": route_name,
                        "category": "route",
                        "folder": folder,
                        "notes": "Imported GPX route.",
                        "source": filename or "GPX import",
                        "import_id": import_id,
                        "import_name": base_name,
                        "created": now_iso(),
                    },
                })
        if not features:
            raise ValueError("No GPX waypoints, tracks, or routes were found.")
        return features

    def parse_kml_features(self, content: bytes, filename: str, folder: str, import_id: str) -> list[dict[str, Any]]:
        try:
            root = ET.fromstring(content)
        except ET.ParseError as exc:
            raise ValueError(f"Could not parse KML XML: {exc}") from exc
        base_name = Path(filename or "KML import").stem or "KML import"
        features: list[dict[str, Any]] = []

        def next_id(prefix: str) -> str:
            return f"{import_id}-{prefix}-{len(features)}"

        for placemark in [node for node in root.iter() if local_name(node.tag) == "Placemark"]:
            name = child_text(placemark, ["name"]) or f"{base_name} {len(features) + 1}"
            notes = child_text(placemark, ["description"])
            for point in [node for node in placemark.iter() if local_name(node.tag) == "Point"]:
                coords_node = next((node for node in point.iter() if local_name(node.tag) == "coordinates"), None)
                coords = parse_kml_coordinates(coords_node.text if coords_node is not None else "")
                if coords:
                    features.append({
                        "type": "Feature",
                        "id": next_id("kml-point"),
                        "geometry": {"type": "Point", "coordinates": coords[0]},
                        "properties": {"name": name, "category": "waypoint", "icon": "pin", "folder": folder, "notes": notes, "source": filename or "KML import", "import_id": import_id, "import_name": base_name, "created": now_iso()},
                    })
            for line in [node for node in placemark.iter() if local_name(node.tag) == "LineString"]:
                coords_node = next((node for node in line.iter() if local_name(node.tag) == "coordinates"), None)
                coords = parse_kml_coordinates(coords_node.text if coords_node is not None else "")
                if len(coords) >= 2:
                    features.append({
                        "type": "Feature",
                        "id": next_id("kml-line"),
                        "geometry": {"type": "LineString", "coordinates": coords},
                        "properties": {"name": name, "category": "route", "folder": folder, "notes": notes, "source": filename or "KML import", "import_id": import_id, "import_name": base_name, "created": now_iso()},
                    })
        if not features:
            raise ValueError("No supported KML Point or LineString placemarks were found.")
        return features

    def import_track_geojson(self, path: Path) -> int:
        data = read_json(path, EMPTY_FEATURE_COLLECTION)
        features = data.get("features", []) if isinstance(data, dict) else []
        count = 0
        for feature in features:
            if isinstance(feature, dict) and (feature.get("geometry") or {}).get("type") == "LineString":
                self.import_track_feature(feature, default_status="current")
                count += 1
        return count

    def import_track_points_jsonl(self, path: Path, metadata_path: Path | None = None) -> dict[str, Any]:
        metadata = read_json(metadata_path, {}) if metadata_path and metadata_path.exists() else {}
        grouped: dict[str, list[dict[str, Any]]] = {}
        line_errors = 0
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                raw = line.strip()
                if not raw:
                    continue
                try:
                    point = json.loads(raw)
                    lat = float(point["lat"])
                    lon = float(point["lon"])
                except (json.JSONDecodeError, KeyError, TypeError, ValueError):
                    line_errors += 1
                    continue
                if not valid_lat_lon(lat, lon):
                    line_errors += 1
                    continue
                track_id = str(point.get("track_id") or metadata.get("id") or path.stem)
                grouped.setdefault(track_id, []).append({**point, "lat": lat, "lon": lon})
        if not grouped:
            return {"tracks": 0, "points": 0, "line_errors": line_errors}

        def point_timestamp(point: dict[str, Any]) -> str:
            if point.get("timestamp"):
                return str(point["timestamp"])
            t_ms = numeric_value(point.get("t_ms"))
            if t_ms is not None:
                return datetime.fromtimestamp(float(t_ms) / 1000.0, tz=timezone.utc).isoformat().replace("+00:00", "Z")
            return now_iso()

        def sort_key(point: dict[str, Any]) -> tuple[str, float]:
            timestamp = point_timestamp(point)
            t_ms = numeric_value(point.get("t_ms"))
            return (timestamp, float(t_ms or 0))

        folder_id = self.folder_id("Recorded")
        imported_tracks = 0
        imported_points = 0
        imported_ids: list[str] = []
        with self.connect() as conn:
            for track_id, points in grouped.items():
                ordered = sorted(points, key=sort_key)
                if len(ordered) < 2:
                    continue
                status_raw = str(metadata.get("status") or "saved").lower()
                status = "current" if status_raw in {"active", "current", "recording"} else "saved"
                first_ts = point_timestamp(ordered[0])
                last_ts = point_timestamp(ordered[-1])
                name = str(metadata.get("name") or f"Recorded {track_id.removeprefix('track-')}")
                source = str(metadata.get("source") or ordered[0].get("source") or "legacy-gps")
                props = {
                    **(metadata if isinstance(metadata, dict) else {}),
                    "id": track_id,
                    "name": name,
                    "folder": "Recorded",
                    "legacy_import": True,
                    "source_file": str(path),
                    "point_count": len(ordered),
                }
                conn.execute(
                    """
                    INSERT INTO tracks(id, folder_id, name, status, source, color, properties_json,
                                       started_at, ended_at, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                      folder_id = excluded.folder_id,
                      name = excluded.name,
                      status = excluded.status,
                      source = excluded.source,
                      color = excluded.color,
                      properties_json = excluded.properties_json,
                      started_at = excluded.started_at,
                      ended_at = excluded.ended_at,
                      updated_at = excluded.updated_at
                    """,
                    (
                        track_id,
                        folder_id,
                        name,
                        status,
                        source,
                        metadata.get("color") or "#ffd34f",
                        json_dumps(props),
                        metadata.get("started_at") or first_ts,
                        metadata.get("ended_at") or metadata.get("paused_at") or (last_ts if status != "current" else None),
                        metadata.get("started_at") or first_ts,
                        now_iso(),
                    ),
                )
                conn.execute("DELETE FROM track_points WHERE track_id = ?", (track_id,))
                for seq, point in enumerate(ordered):
                    alt_m = self.optional_float(point.get("alt_m") or point.get("alt") or point.get("elevation"))
                    conn.execute(
                        """
                        INSERT INTO track_points(track_id, seq, lat, lon, alt_m, speed_mph, heading_deg,
                                                 accuracy_m, hdop, source, raw_lat, raw_lon, timestamp, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            track_id,
                            seq,
                            float(point["lat"]),
                            float(point["lon"]),
                            alt_m,
                            self.optional_float(point.get("speed_mph")),
                            self.optional_float(point.get("heading_deg")),
                            self.optional_float(point.get("accuracy_m")),
                            self.optional_float(point.get("hdop")),
                            point.get("source") or source,
                            self.optional_float(point.get("raw_lat") or point.get("lat")),
                            self.optional_float(point.get("raw_lon") or point.get("lon")),
                            point_timestamp(point),
                            now_iso(),
                        ),
                    )
                imported_tracks += 1
                imported_points += len(ordered)
                imported_ids.append(track_id)
        return {"tracks": imported_tracks, "points": imported_points, "line_errors": line_errors, "ids": imported_ids}

    def import_track_feature(self, feature: dict[str, Any], default_status: str = "saved") -> str:
        props = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        coords = geometry.get("coordinates") or []
        folder = props.get("folder") or "Recorded"
        folder_id = self.folder_id(folder)
        name = str(props.get("name") or props.get("title") or "Route")
        track_id = str(props.get("id") or self.stable_track_id(props, coords, name, folder))
        status = str(props.get("status") or default_status)
        created = str(props.get("timestamp") or props.get("created_at") or now_iso())
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO tracks(id, folder_id, name, status, source, color, properties_json, started_at, ended_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  folder_id = excluded.folder_id,
                  name = excluded.name,
                  status = excluded.status,
                  source = excluded.source,
                  color = excluded.color,
                  properties_json = excluded.properties_json,
                  updated_at = excluded.updated_at
                """,
                (
                    track_id,
                    folder_id,
                    name,
                    status,
                    props.get("source") or "oiab",
                    props.get("color"),
                    json_dumps(props),
                    props.get("started_at"),
                    props.get("ended_at"),
                    created,
                    now_iso(),
                ),
            )
            conn.execute("DELETE FROM track_points WHERE track_id = ?", (track_id,))
            for seq, coord in enumerate(coords):
                if not isinstance(coord, list) or len(coord) < 2:
                    continue
                conn.execute(
                    """
                    INSERT INTO track_points(track_id, seq, lon, lat, alt_m, timestamp, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        track_id,
                        seq,
                        float(coord[0]),
                        float(coord[1]),
                        float(coord[2]) if len(coord) > 2 and coord[2] is not None else None,
                        props.get("timestamp") or created,
                        now_iso(),
                    ),
                )
        return track_id

    @staticmethod
    def stable_track_id(props: dict[str, Any], coords: list[Any], name: str, folder: str) -> str:
        endpoints: list[Any] = []
        if coords:
            endpoints.append(coords[0])
            endpoints.append(coords[-1])
        payload = {
            "folder": folder,
            "name": name,
            "source": props.get("source") or props.get("import_name") or "",
            "count": len(coords),
            "endpoints": endpoints,
        }
        digest = hashlib.sha1(json.dumps(payload, sort_keys=True, default=str).encode("utf-8")).hexdigest()[:20]
        return f"track-{digest}"

    def dedupe_duplicate_tracks(self) -> int:
        deleted = 0
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT t.id, t.folder_id, t.name, t.source, t.updated_at,
                       (SELECT COUNT(*) FROM track_points p WHERE p.track_id = t.id) AS point_count
                FROM tracks t
                WHERE t.status != 'current'
                ORDER BY t.updated_at DESC
                """
            ).fetchall()
            groups: dict[tuple[Any, ...], list[sqlite3.Row]] = {}
            for row in rows:
                key = (row["folder_id"], row["name"], row["source"], int(row["point_count"] or 0))
                groups.setdefault(key, []).append(row)
            for duplicates in groups.values():
                if len(duplicates) < 2:
                    continue
                for row in duplicates[1:]:
                    conn.execute("DELETE FROM tracks WHERE id = ?", (row["id"],))
                    deleted += 1
        return deleted

    def save_waypoint(self, payload: dict[str, Any]) -> dict[str, Any]:
        lat = float(payload["lat"])
        lon = float(payload["lon"])
        category = str(payload.get("category") or payload.get("type") or "waypoint")
        folder_id = self.folder_id(str(payload.get("folder") or "Quick Save"))
        waypoint_id = str(payload.get("id") or f"wp-{datetime.now().strftime('%Y%m%d%H%M%S%f')}")
        name = str(payload.get("name") or f"{category.title()} - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        created = str(payload.get("timestamp") or payload.get("created_at") or now_iso())
        props = dict(payload)
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO waypoints(id, folder_id, name, category, icon, lat, lon, raw_lat, raw_lon,
                                      notes, source, color, accuracy_m, hdop, speed_mph, heading_deg,
                                      stabilized, stabilization_mode, properties_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  folder_id = excluded.folder_id,
                  name = excluded.name,
                  category = excluded.category,
                  icon = excluded.icon,
                  lat = excluded.lat,
                  lon = excluded.lon,
                  raw_lat = excluded.raw_lat,
                  raw_lon = excluded.raw_lon,
                  notes = excluded.notes,
                  source = excluded.source,
                  color = excluded.color,
                  accuracy_m = excluded.accuracy_m,
                  hdop = excluded.hdop,
                  speed_mph = excluded.speed_mph,
                  heading_deg = excluded.heading_deg,
                  stabilized = excluded.stabilized,
                  stabilization_mode = excluded.stabilization_mode,
                  properties_json = excluded.properties_json,
                  updated_at = excluded.updated_at
                """,
                (
                    waypoint_id,
                    folder_id,
                    name,
                    category,
                    payload.get("icon"),
                    lat,
                    lon,
                    self.optional_float(payload.get("raw_lat")),
                    self.optional_float(payload.get("raw_lon")),
                    str(payload.get("notes") or ""),
                    str(payload.get("source") or "oiab"),
                    payload.get("color"),
                    self.optional_float(payload.get("accuracy_m")),
                    self.optional_float(payload.get("hdop")),
                    self.optional_float(payload.get("speed_mph")),
                    self.optional_float(payload.get("heading_deg")),
                    bool_int(payload.get("stabilized"), False),
                    payload.get("stabilization_mode"),
                    json_dumps(props),
                    created,
                    now_iso(),
                ),
            )
        return self.waypoint_feature(waypoint_id)

    @staticmethod
    def optional_float(value: Any) -> float | None:
        if value in {None, ""}:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def waypoint_feature(self, waypoint_id: str) -> dict[str, Any]:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM waypoints WHERE id = ?", (waypoint_id,)).fetchone()
            if not row:
                raise ValueError("Waypoint not found.")
            return self.row_to_waypoint(row)

    def row_to_waypoint(self, row: sqlite3.Row) -> dict[str, Any]:
        props = json_loads(row["properties_json"], {})
        props.update(
            {
                "id": row["id"],
                "name": row["name"],
                "category": row["category"],
                "folder": self.folder_name(row["folder_id"]),
                "icon": row["icon"],
                "notes": row["notes"],
                "source": row["source"],
                "color": row["color"],
                "accuracy_m": row["accuracy_m"],
                "hdop": row["hdop"],
                "speed_mph": row["speed_mph"],
                "heading_deg": row["heading_deg"],
                "stabilized": bool(row["stabilized"]),
                "stabilization_mode": row["stabilization_mode"],
                "raw_lat": row["raw_lat"],
                "raw_lon": row["raw_lon"],
                "timestamp": row["created_at"],
            }
        )
        return {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [row["lon"], row["lat"]]},
            "properties": props,
        }

    def places_geojson(self) -> dict[str, Any]:
        features: list[dict[str, Any]] = []
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM waypoints ORDER BY updated_at DESC").fetchall()
            features.extend(self.row_to_waypoint(row) for row in rows)
            tracks = conn.execute("SELECT * FROM tracks ORDER BY updated_at DESC").fetchall()
            features.extend(self.row_to_track(row) for row in tracks)
        return {"type": "FeatureCollection", "features": features}

    def row_to_track(self, row: sqlite3.Row) -> dict[str, Any]:
        props = json_loads(row["properties_json"], {})
        props.update(
            {
                "id": row["id"],
                "name": row["name"],
                "category": "route",
                "folder": self.folder_name(row["folder_id"]),
                "status": row["status"],
                "source": row["source"],
                "color": row["color"] or "#ffd34f",
                "timestamp": row["created_at"],
            }
        )
        with self.connect() as conn:
            points = conn.execute(
                "SELECT lon, lat, alt_m FROM track_points WHERE track_id = ? ORDER BY seq",
                (row["id"],),
            ).fetchall()
        coords = [[point["lon"], point["lat"]] if point["alt_m"] is None else [point["lon"], point["lat"], point["alt_m"]] for point in points]
        return {"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords}, "properties": props}

    def folders(self) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT f.name, f.visible,
                       (SELECT COUNT(*) FROM waypoints w WHERE w.folder_id = f.id) +
                       (SELECT COUNT(*) FROM tracks t WHERE t.folder_id = f.id) AS count
                FROM folders f
                ORDER BY f.name COLLATE NOCASE
                """
            ).fetchall()
        return [{"name": row["name"], "count": int(row["count"] or 0), "shown": bool(row["visible"])} for row in rows]

    def map_items(self) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        with self.connect() as conn:
            for row in conn.execute(
                """
                SELECT w.id, w.name, w.category, w.icon, w.source, w.notes, w.color, w.lat, w.lon,
                       w.properties_json, w.created_at, w.updated_at, f.name AS folder
                FROM waypoints w
                LEFT JOIN folders f ON f.id = w.folder_id
                ORDER BY COALESCE(f.name, 'Unfiled') COLLATE NOCASE, w.name COLLATE NOCASE
                """
            ).fetchall():
                props = json_loads(row["properties_json"], {})
                items.append({
                    "id": row["id"],
                    "kind": "waypoint",
                    "name": row["name"],
                    "category": row["category"],
                    "icon": row["icon"] or props.get("icon") or "",
                    "folder": row["folder"] or "Unfiled",
                    "source": row["source"],
                    "notes": row["notes"],
                    "url": props.get("url") or props.get("website") or "",
                    "color": row["color"],
                    "lat": row["lat"],
                    "lon": row["lon"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                })
            for row in conn.execute(
                """
                SELECT t.id, t.name, t.status, t.source, t.color, t.properties_json,
                       t.created_at, t.updated_at, f.name AS folder,
                       (SELECT COUNT(*) FROM track_points p WHERE p.track_id = t.id) AS point_count
                FROM tracks t
                LEFT JOIN folders f ON f.id = t.folder_id
                ORDER BY COALESCE(f.name, 'Unfiled') COLLATE NOCASE, t.name COLLATE NOCASE
                """
            ).fetchall():
                props = json_loads(row["properties_json"], {})
                items.append({
                    "id": row["id"],
                    "kind": "track",
                    "name": row["name"],
                    "category": props.get("category") or "route",
                    "folder": row["folder"] or "Unfiled",
                    "source": row["source"],
                    "status": row["status"],
                    "point_count": int(row["point_count"] or 0),
                    "notes": props.get("notes") or props.get("description") or "",
                    "url": props.get("url") or props.get("website") or "",
                    "road_type": props.get("road_type") or props.get("route_type") or "",
                    "color": row["color"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                })
        return sorted(items, key=lambda item: (str(item["folder"]).lower(), str(item["name"]).lower()))

    def manage_data_snapshot(self) -> dict[str, Any]:
        return {
            "ok": True,
            "folders": self.folders(),
            "items": self.map_items(),
            "places": self.places_geojson(),
        }

    def add_folder(self, name: str) -> dict[str, Any]:
        folder = normalize_folder_path(name, "")
        if not folder:
            raise ValueError("Folder name is required.")
        self.folder_id(folder)
        return {"folder": folder}

    def set_folder_visibility(self, folder: str, visible: bool) -> dict[str, Any]:
        folder_name = normalize_folder_path(folder)
        folder_id = self.folder_id(folder_name)
        with self.connect() as conn:
            conn.execute("UPDATE folders SET visible = ?, updated_at = ? WHERE id = ?", (bool_int(visible), now_iso(), folder_id))
        return {"folder": folder_name, "visible": bool(visible)}

    def selected_item_ids(self, item_ids: list[str] | None, folder_paths: list[str] | None) -> tuple[set[str], set[str]]:
        waypoint_ids = set()
        track_ids = set()
        selected = {str(item).strip() for item in (item_ids or []) if str(item).strip()}
        folders = [normalize_folder_path(path, "") for path in (folder_paths or []) if normalize_folder_path(path, "")]

        def folder_matches(folder: str, selected_folder: str) -> bool:
            return folder == selected_folder or folder.startswith(selected_folder + "/")

        for item in self.map_items():
            if item["id"] in selected or any(folder_matches(str(item["folder"]), folder) for folder in folders):
                if item["kind"] == "track":
                    track_ids.add(str(item["id"]))
                else:
                    waypoint_ids.add(str(item["id"]))
        return waypoint_ids, track_ids

    def move_items(self, item_ids: list[str], folder_paths: list[str], target_folder: str) -> dict[str, Any]:
        target = normalize_folder_path(target_folder, "")
        if not target:
            raise ValueError("Target folder is required.")
        source_folders = [normalize_folder_path(path, "") for path in folder_paths if normalize_folder_path(path, "")]
        for source in source_folders:
            if target == source or target.startswith(source + "/"):
                raise ValueError("Cannot move a folder into itself or one of its child folders.")
        waypoint_ids, track_ids = self.selected_item_ids(item_ids, folder_paths)
        if not waypoint_ids and not track_ids:
            raise ValueError("Select at least one item or folder to move.")
        folder_id = self.folder_id(target)
        with self.connect() as conn:
            if waypoint_ids:
                conn.executemany("UPDATE waypoints SET folder_id = ?, updated_at = ? WHERE id = ?", [(folder_id, now_iso(), item_id) for item_id in waypoint_ids])
            if track_ids:
                conn.executemany("UPDATE tracks SET folder_id = ?, updated_at = ? WHERE id = ?", [(folder_id, now_iso(), item_id) for item_id in track_ids])
        return {"count": len(waypoint_ids) + len(track_ids), "folder": target}

    def rename_item(self, item_id: str, name: str) -> dict[str, Any]:
        item_id = str(item_id or "").strip()
        new_name = str(name or "").strip()
        if not item_id or not new_name:
            raise ValueError("Item id and new name are required.")
        with self.connect() as conn:
            cur = conn.execute("UPDATE waypoints SET name = ?, updated_at = ? WHERE id = ?", (new_name, now_iso(), item_id))
            count = cur.rowcount
            if count == 0:
                cur = conn.execute("UPDATE tracks SET name = ?, updated_at = ? WHERE id = ?", (new_name, now_iso(), item_id))
                count = cur.rowcount
        if not count:
            raise ValueError("Item was not found.")
        return {"count": count, "id": item_id, "name": new_name}

    def update_item_details(self, item_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        item_id = str(item_id or "").strip()
        if not item_id:
            raise ValueError("Item id is required.")
        name = str(payload.get("name") or "").strip()
        folder = normalize_folder_path(str(payload.get("folder") or ""), "")
        category = str(payload.get("category") or "").strip()
        icon = str(payload.get("icon") or "").strip()
        notes = str(payload.get("notes") or payload.get("description") or "").strip()
        url = str(payload.get("url") or payload.get("website") or "").strip()
        road_type = str(payload.get("road_type") or payload.get("route_type") or "").strip()
        color = str(payload.get("color") or "").strip() or None
        folder_id = self.folder_id(folder) if folder else None
        with self.connect() as conn:
            waypoint = conn.execute("SELECT * FROM waypoints WHERE id = ?", (item_id,)).fetchone()
            if waypoint:
                props = json_loads(waypoint["properties_json"], {})
                if url:
                    props["url"] = url
                    props["website"] = url
                else:
                    props.pop("url", None)
                    props.pop("website", None)
                if notes:
                    props["description"] = notes
                    props["notes"] = notes
                else:
                    props.pop("description", None)
                    props.pop("notes", None)
                if icon:
                    props["icon"] = icon
                else:
                    props.pop("icon", None)
                conn.execute(
                    """
                    UPDATE waypoints
                    SET name = COALESCE(NULLIF(?, ''), name),
                        folder_id = COALESCE(?, folder_id),
                        category = COALESCE(NULLIF(?, ''), category),
                        icon = COALESCE(NULLIF(?, ''), icon),
                        notes = ?,
                        color = ?,
                        properties_json = ?,
                        updated_at = ?
                    WHERE id = ?
                    """,
                    (name, folder_id, category, icon, notes, color, json_dumps(props), now_iso(), item_id),
                )
                return {"count": 1, "id": item_id, "kind": "waypoint"}
            track = conn.execute("SELECT * FROM tracks WHERE id = ?", (item_id,)).fetchone()
            if track:
                props = json_loads(track["properties_json"], {})
                if notes:
                    props["notes"] = notes
                    props["description"] = notes
                else:
                    props.pop("notes", None)
                    props.pop("description", None)
                if url:
                    props["url"] = url
                    props["website"] = url
                else:
                    props.pop("url", None)
                    props.pop("website", None)
                if category:
                    props["category"] = category
                if road_type:
                    props["road_type"] = road_type
                else:
                    props.pop("road_type", None)
                    props.pop("route_type", None)
                conn.execute(
                    """
                    UPDATE tracks
                    SET name = COALESCE(NULLIF(?, ''), name),
                        folder_id = COALESCE(?, folder_id),
                        color = ?,
                        properties_json = ?,
                        updated_at = ?
                    WHERE id = ?
                    """,
                    (name, folder_id, color, json_dumps(props), now_iso(), item_id),
                )
                return {"count": 1, "id": item_id, "kind": "track"}
        raise ValueError("Item was not found.")

    def bulk_update_items(self, item_ids: list[str], folder_paths: list[str], payload: dict[str, Any]) -> dict[str, Any]:
        waypoint_ids, track_ids = self.selected_item_ids(item_ids, folder_paths)
        if not waypoint_ids and not track_ids:
            raise ValueError("Select at least one item or folder to update.")
        category = str(payload.get("category") or payload.get("type") or "").strip()
        color = str(payload.get("color") or "").strip()
        icon = str(payload.get("icon") or "").strip()
        if not category and not color and not icon:
            raise ValueError("Choose a color, type, or icon to apply.")
        updated = 0
        with self.connect() as conn:
            if waypoint_ids:
                for item_id in waypoint_ids:
                    row = conn.execute("SELECT id, properties_json FROM waypoints WHERE id = ?", (item_id,)).fetchone()
                    if not row:
                        continue
                    props = json_loads(row["properties_json"], {})
                    if category:
                        props["category"] = category
                    if icon:
                        props["icon"] = icon
                    conn.execute(
                        """
                        UPDATE waypoints
                        SET category = COALESCE(NULLIF(?, ''), category),
                            icon = COALESCE(NULLIF(?, ''), icon),
                            color = COALESCE(NULLIF(?, ''), color),
                            properties_json = ?,
                            updated_at = ?
                        WHERE id = ?
                        """,
                        (category, icon, color, json_dumps(props), now_iso(), row["id"]),
                    )
                    updated += 1
            if track_ids:
                for item_id in track_ids:
                    row = conn.execute("SELECT id, properties_json FROM tracks WHERE id = ?", (item_id,)).fetchone()
                    if not row:
                        continue
                    props = json_loads(row["properties_json"], {})
                    if category:
                        props["category"] = category
                    if icon:
                        props["icon"] = icon
                    conn.execute(
                        """
                        UPDATE tracks
                        SET color = COALESCE(NULLIF(?, ''), color),
                            properties_json = ?,
                            updated_at = ?
                        WHERE id = ?
                        """,
                        (color, json_dumps(props), now_iso(), row["id"]),
                    )
                    updated += 1
        return {"count": updated}

    def rename_folder(self, old_folder: str, new_folder: str) -> dict[str, Any]:
        old_name = normalize_folder_path(old_folder, "")
        new_name = normalize_folder_path(new_folder, "")
        if not old_name or not new_name:
            raise ValueError("Old and new folder names are required.")
        if new_name == old_name:
            return {"count": 0, "folder": new_name}
        if new_name.startswith(old_name + "/"):
            raise ValueError("Cannot rename a folder into itself or one of its child folders.")
        updates: list[tuple[int, str]] = []
        with self.connect() as conn:
            folders = conn.execute("SELECT id, name FROM folders").fetchall()
            for row in folders:
                name = str(row["name"])
                if name == old_name or name.startswith(old_name + "/"):
                    relative = name[len(old_name):].strip("/")
                    next_name = normalize_folder_path("/".join(part for part in [new_name, relative] if part))
                    updates.append((int(row["id"]), next_name))
            for folder_id, next_name in updates:
                conn.execute(
                    """
                    INSERT INTO folders(name, visible, created_at, updated_at)
                    VALUES (?, 1, ?, ?)
                    ON CONFLICT(name) DO UPDATE SET updated_at = excluded.updated_at
                    """,
                    (next_name, now_iso(), now_iso()),
                )
                new_row = conn.execute("SELECT id FROM folders WHERE name = ?", (next_name,)).fetchone()
                conn.execute("UPDATE waypoints SET folder_id = ?, updated_at = ? WHERE folder_id = ?", (new_row["id"], now_iso(), folder_id))
                conn.execute("UPDATE tracks SET folder_id = ?, updated_at = ? WHERE folder_id = ?", (new_row["id"], now_iso(), folder_id))
                conn.execute("DELETE FROM folders WHERE id = ?", (folder_id,))
        return {"count": len(updates), "folder": new_name}

    def delete_items(self, item_ids: list[str], folder_paths: list[str]) -> dict[str, Any]:
        waypoint_ids, track_ids = self.selected_item_ids(item_ids, folder_paths)
        if not waypoint_ids and not track_ids:
            raise ValueError("Select at least one item or folder to delete.")
        with self.connect() as conn:
            if waypoint_ids:
                conn.executemany("DELETE FROM waypoints WHERE id = ?", [(item_id,) for item_id in waypoint_ids])
            if track_ids:
                conn.executemany("DELETE FROM tracks WHERE id = ?", [(item_id,) for item_id in track_ids])
        return {"count": len(waypoint_ids) + len(track_ids)}

    def export_gpx(self) -> str:
        places = self.places_geojson()
        lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<gpx version="1.1" creator="Overland In A Box" xmlns="http://www.topografix.com/GPX/1/1">',
        ]
        for feature in places.get("features", []):
            props = feature.get("properties") or {}
            geometry = feature.get("geometry") or {}
            coords = geometry.get("coordinates") or []
            name = str(props.get("name") or props.get("id") or "OIAB item")
            notes = str(props.get("notes") or "")
            if geometry.get("type") == "Point" and len(coords) >= 2:
                lines.append(f'  <wpt lat="{coords[1]}" lon="{coords[0]}">')
                lines.append(f"    <name>{self.xml_escape(name)}</name>")
                if notes:
                    lines.append(f"    <desc>{self.xml_escape(notes)}</desc>")
                lines.append("  </wpt>")
            elif geometry.get("type") == "LineString" and len(coords) >= 2:
                lines.append("  <trk>")
                lines.append(f"    <name>{self.xml_escape(name)}</name>")
                lines.append("    <trkseg>")
                for coord in coords:
                    if len(coord) >= 2:
                        lines.append(f'      <trkpt lat="{coord[1]}" lon="{coord[0]}"></trkpt>')
                lines.append("    </trkseg>")
                lines.append("  </trk>")
        lines.append("</gpx>")
        return "\n".join(lines) + "\n"

    @staticmethod
    def xml_escape(value: str) -> str:
        return (
            value.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&apos;")
        )

    def current_track(self) -> dict[str, Any]:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM tracks
                WHERE status = 'current'
                ORDER BY updated_at DESC
                LIMIT 1
                """
            ).fetchone()
        if not row:
            return {
                "ok": True,
                "recording": False,
                "status": "inactive",
                "manual_recording": bool(self.app_setting("map_manual_recording", False)),
                "track": EMPTY_FEATURE_COLLECTION,
            }
        feature = self.row_to_track(row)
        props = feature.get("properties", {}) if isinstance(feature, dict) else {}
        return {
            "ok": True,
            "recording": row["status"] == "current",
            "status": row["status"],
            "manual_recording": bool(self.app_setting("map_manual_recording", False)),
            "track_mode": "manual" if props.get("manual_recorded") else "auto",
            "point_count": len(feature["geometry"]["coordinates"]),
            "track": {"type": "FeatureCollection", "features": [feature]},
        }

    def track_recording_status(self) -> dict[str, Any]:
        current = self.current_track()
        current["folder"] = "Recorded"
        return current

    def record_location_point(self, location: dict[str, Any]) -> dict[str, Any]:
        manual_recording = bool(self.app_setting("map_manual_recording", False))
        if self.app_setting("map_auto_recording", True) is False and not manual_recording:
            return {"ok": True, "recording": False, "reason": "auto_recording_disabled"}
        stable = location.get("stable") if isinstance(location.get("stable"), dict) else location
        if not isinstance(stable, dict):
            return {"ok": False, "recording": False, "reason": "no_stable_location"}
        if not stable.get("valid", location.get("valid", False)) and not (stable.get("lat") and stable.get("lon")):
            return {"ok": False, "recording": False, "reason": "invalid_location"}
        try:
            lat = float(stable["lat"])
            lon = float(stable["lon"])
        except (KeyError, TypeError, ValueError):
            return {"ok": False, "recording": False, "reason": "missing_coordinates"}
        if not valid_lat_lon(lat, lon):
            return {"ok": False, "recording": False, "reason": "coordinates_out_of_range"}
        speed_mph = self.optional_float(stable.get("speed_mph") or location.get("speed_mph")) or 0.0
        if not manual_recording and speed_mph < 2.0:
            return {"ok": True, "recording": False, "reason": "below_speed_threshold"}

        raw = location.get("raw") if isinstance(location.get("raw"), dict) else {}
        timestamp_value = str(stable.get("timestamp") or location.get("timestamp") or now_iso())
        recorded_folder_id = self.folder_id("Recorded")
        with self.connect() as conn:
            track = conn.execute(
                "SELECT * FROM tracks WHERE status = 'current' ORDER BY updated_at DESC LIMIT 1"
            ).fetchone()
            if not track:
                track_id = f"recorded-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
                conn.execute(
                    """
                    INSERT INTO tracks(id, folder_id, name, status, source, color, properties_json, started_at, created_at, updated_at)
                    VALUES (?, ?, ?, 'current', ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        track_id,
                        recorded_folder_id,
                        f"Recorded {datetime.now().strftime('%Y%m%d-%H%M%S')}",
                        str(location.get("active_source") or location.get("source") or "gps"),
                        "#ffd34f",
                        json_dumps({"folder": "Recorded", "category": "route", "auto_recorded": not manual_recording, "manual_recorded": manual_recording}),
                        timestamp_value,
                        now_iso(),
                        now_iso(),
                    ),
                )
            else:
                track_id = str(track["id"])

            last = conn.execute(
                "SELECT * FROM track_points WHERE track_id = ? ORDER BY seq DESC LIMIT 1",
                (track_id,),
            ).fetchone()
            if last:
                moved = distance_m(float(last["lat"]), float(last["lon"]), lat, lon)
                if moved < 10:
                    return {"ok": True, "recording": True, "reason": "deduped", "distance_m": round(moved, 2)}
                seq = int(last["seq"]) + 1
            else:
                seq = 0
            conn.execute(
                """
                INSERT INTO track_points(track_id, seq, lon, lat, alt_m, speed_mph, heading_deg,
                                         accuracy_m, hdop, source, raw_lat, raw_lon, timestamp, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    track_id,
                    seq,
                    lon,
                    lat,
                    self.optional_float(stable.get("alt_m")),
                    speed_mph,
                    self.optional_float(stable.get("heading_deg")),
                    self.optional_float(stable.get("accuracy_m")),
                    self.optional_float(stable.get("hdop")),
                    str(location.get("active_source") or location.get("source") or stable.get("source") or "gps"),
                    self.optional_float(raw.get("lat")),
                    self.optional_float(raw.get("lon")),
                    timestamp_value,
                    now_iso(),
                ),
            )
            conn.execute("UPDATE tracks SET updated_at = ? WHERE id = ?", (now_iso(), track_id))
        return {"ok": True, "recording": True, "track_id": track_id, "point_added": True}

    def stop_current_track(self) -> dict[str, Any]:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT * FROM tracks WHERE status = 'current' ORDER BY updated_at DESC LIMIT 1"
            ).fetchone()
            if not row:
                self.set_app_setting("map_manual_recording", False)
                return {"ok": True, "stopped": False, "reason": "no_current_track"}
            conn.execute(
                "UPDATE tracks SET status = 'saved', ended_at = ?, updated_at = ? WHERE id = ?",
                (now_iso(), now_iso(), row["id"]),
            )
        self.set_app_setting("map_manual_recording", False)
        return {"ok": True, "stopped": True, "track_id": str(row["id"])}

    def start_manual_track(self) -> dict[str, Any]:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT * FROM tracks WHERE status = 'current' ORDER BY updated_at DESC LIMIT 1"
            ).fetchone()
            if row:
                conn.execute(
                    "UPDATE tracks SET status = 'saved', ended_at = ?, updated_at = ? WHERE id = ?",
                    (now_iso(), now_iso(), row["id"]),
                )
        self.set_app_setting("map_manual_recording", True)
        return {"ok": True, "manual_recording": True}

    def import_map_pack_registry(self) -> dict[str, Any]:
        candidates = []
        if self.settings.map_pack_registry:
            candidates.append(self.settings.map_pack_registry)
        imported = 0
        active = ""
        for path in candidates:
            registry = read_json(path, None)
            if not isinstance(registry, dict):
                continue
            active = str(registry.get("active_basemap") or registry.get("active") or active)
            for pack in registry.get("basemaps", []) or []:
                if not isinstance(pack, dict):
                    continue
                self.upsert_map_pack(pack, active=pack.get("id") == active)
                imported += 1
        return {"imported": imported, "active": active}

    def upsert_map_pack(self, pack: dict[str, Any], active: bool = False, enabled: bool | None = None) -> None:
        pack_id = str(pack.get("id") or Path(str(pack.get("path") or pack.get("url") or "map-pack")).stem)
        name = str(pack.get("name") or pack_id.replace("-", " ").replace("_", " ").title())
        public_url = str(pack.get("public_url") or pack.get("url") or f"/maps/packs/{Path(str(pack.get('path') or pack_id + '.pmtiles')).name}")
        path = str(pack.get("path") or self.path_for_pack_url(public_url))
        style = str(pack.get("style_path") or pack.get("style") or "/maps-v2/map-style.json")
        file_path = self.resolve_pack_path(path)
        exists = file_path.exists()
        if enabled is None:
            enabled = bool(pack.get("enabled", active))
        metadata = self.enrich_map_pack_metadata(pack, file_path if exists else None)
        with self.connect() as conn:
            if active:
                conn.execute("UPDATE map_packs SET active = 0")
            conn.execute(
                """
                INSERT INTO map_packs(id, name, type, path, public_url, style_path, attribution,
                                      installed, active, enabled, size_bytes, metadata_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  type = excluded.type,
                  path = excluded.path,
                  public_url = excluded.public_url,
                  style_path = excluded.style_path,
                  attribution = excluded.attribution,
                  installed = excluded.installed,
                  active = CASE WHEN excluded.active = 1 THEN 1 ELSE map_packs.active END,
                  enabled = excluded.enabled,
                  size_bytes = excluded.size_bytes,
                  metadata_json = excluded.metadata_json,
                  updated_at = excluded.updated_at
                """,
                (
                    pack_id,
                    name,
                    str(pack.get("type") or "pmtiles"),
                    path,
                    public_url,
                    style,
                    str(pack.get("attribution") or "© OpenStreetMap contributors"),
                    1 if exists else 0,
                    1 if active else 0,
                    1 if enabled else 0,
                    file_path.stat().st_size if exists else 0,
                    json_dumps(metadata),
                    now_iso(),
                    now_iso(),
                ),
            )

    def enrich_map_pack_metadata(self, pack: dict[str, Any], file_path: Path | None) -> dict[str, Any]:
        metadata = dict(pack)
        catalog = metadata.get("catalog") if isinstance(metadata.get("catalog"), dict) else {}
        metadata["catalog_minzoom"] = numeric_value(
            catalog.get("minzoom")
            or catalog.get("min_zoom")
            or pack.get("catalog_minzoom")
            or pack.get("minzoom")
            or pack.get("min_zoom")
        )
        metadata["catalog_maxzoom"] = numeric_value(
            catalog.get("maxzoom")
            or catalog.get("max_zoom")
            or pack.get("catalog_maxzoom")
            or pack.get("maxzoom")
            or pack.get("max_zoom")
        )
        if not file_path or not file_path.exists() or file_path.suffix.lower() != ".pmtiles":
            return metadata
        actual = self.read_pmtiles_archive_metadata(file_path)
        metadata["actual_metadata"] = actual
        metadata["actual_minzoom"] = numeric_value(actual.get("minzoom"))
        metadata["actual_maxzoom"] = numeric_value(actual.get("maxzoom"))
        metadata["actual_bounds"] = actual.get("bounds")
        metadata["actual_center"] = actual.get("center")
        metadata["actual_vector_layers"] = actual.get("vector_layers")
        return metadata

    @staticmethod
    def read_pmtiles_archive_metadata(file_path: Path) -> dict[str, Any]:
        pmtiles = shutil.which("pmtiles")
        if not pmtiles:
            return {"ok": False, "error": "pmtiles CLI is not installed."}

        def run_show(flag: str) -> Any | None:
            result = subprocess.run(
                [pmtiles, "show", str(file_path), flag],
                text=True,
                capture_output=True,
                timeout=20,
                check=False,
            )
            if result.returncode != 0:
                return {"ok": False, "command": [pmtiles, "show", str(file_path), flag], "stderr": result.stderr[-2000:]}
            return parse_json_text(result.stdout)

        header = run_show("--header-json")
        tilejson = run_show("--tilejson")
        header_obj = header if isinstance(header, dict) else {}
        tilejson_obj = tilejson if isinstance(tilejson, dict) else {}
        return {
            "ok": bool(header_obj or tilejson_obj),
            "header": header,
            "tilejson": tilejson,
            "bounds": tilejson_obj.get("bounds") or header_obj.get("bounds"),
            "center": tilejson_obj.get("center") or header_obj.get("center"),
            "minzoom": tilejson_obj.get("minzoom") if tilejson_obj.get("minzoom") is not None else header_obj.get("minzoom"),
            "maxzoom": tilejson_obj.get("maxzoom") if tilejson_obj.get("maxzoom") is not None else header_obj.get("maxzoom"),
            "vector_layers": tilejson_obj.get("vector_layers"),
        }

    def catalog_pack_for_filename(self, filename: str) -> dict[str, Any] | None:
        catalog = read_json(REPO_ROOT / "config" / "map-pack-catalog.json", {"packs": []})
        for pack in catalog.get("packs", []) or []:
            if not isinstance(pack, dict):
                continue
            if str(pack.get("expected_filename") or "") == filename:
                return pack
        return None

    def resolve_pack_path(self, value: str) -> Path:
        value = urlsplit(str(value)).path
        path = Path(value)
        if path.is_absolute():
            return path
        if value.startswith("/maps/packs/"):
            return self.settings.data_dir / "maps" / "packs" / value.removeprefix("/maps/packs/")
        return self.settings.data_dir / "maps" / "packs" / path.name

    def path_for_pack_url(self, url: str) -> str:
        url = urlsplit(str(url)).path
        if url.startswith("/maps/packs/"):
            return str(self.settings.data_dir / "maps" / "packs" / url.removeprefix("/maps/packs/"))
        return url

    @staticmethod
    def versioned_pack_url(public_url: str, path: Path) -> str:
        base = urlsplit(str(public_url)).path
        if not path.exists() or not path.is_file():
            return base
        stat = path.stat()
        return f"{base}?v={stat.st_size}-{stat.st_mtime_ns}"

    def rescan_map_packs(self) -> dict[str, Any]:
        packs_dir = self.settings.data_dir / "maps" / "packs"
        packs_dir.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            existing_rows = {
                row["id"]: row
                for row in conn.execute("SELECT id, active, enabled FROM map_packs").fetchall()
            }
        found = 0
        for path in sorted(packs_dir.glob("*.pmtiles")):
            catalog_pack = self.catalog_pack_for_filename(path.name) or {}
            pack_id = str(catalog_pack.get("id") or path.stem.lower().replace(" ", "-").replace("_", "-"))
            existing = existing_rows.get(pack_id)
            self.upsert_map_pack(
                {
                    "id": pack_id,
                    "name": catalog_pack.get("name") or path.stem.replace("-", " ").replace("_", " ").title(),
                    "type": "pmtiles",
                    "path": str(path),
                    "url": f"/maps/packs/{path.name}",
                    "style": catalog_pack.get("style") or "/maps-v2/map-style.json",
                    "attribution": catalog_pack.get("attribution") or "© OpenStreetMap contributors",
                    "catalog": catalog_pack,
                },
                active=bool(existing["active"]) if existing else False,
                enabled=bool(existing["enabled"]) if existing else (pack_id == "world_overview"),
            )
            found += 1
        with self.connect() as conn:
            active = conn.execute("SELECT id FROM map_packs WHERE active = 1 AND installed = 1 LIMIT 1").fetchone()
            if not active:
                world = conn.execute("SELECT id FROM map_packs WHERE id = 'world_overview' AND installed = 1 LIMIT 1").fetchone()
                first = world or conn.execute("SELECT id FROM map_packs WHERE installed = 1 ORDER BY updated_at DESC LIMIT 1").fetchone()
                if first:
                    conn.execute("UPDATE map_packs SET active = CASE WHEN id = ? THEN 1 ELSE 0 END", (first["id"],))
            conn.execute("UPDATE map_packs SET enabled = 1 WHERE id = 'world_overview' AND installed = 1")
        return {"found": found}

    def set_active_map_pack(self, pack_id: str) -> dict[str, Any]:
        with self.connect() as conn:
            row = conn.execute("SELECT id, installed FROM map_packs WHERE id = ?", (pack_id,)).fetchone()
            if not row:
                raise ValueError("Map pack not found.")
            if not row["installed"]:
                raise ValueError("Map pack file is not installed.")
            conn.execute("UPDATE map_packs SET active = CASE WHEN id = ? THEN 1 ELSE 0 END", (pack_id,))
            conn.execute("UPDATE map_packs SET enabled = CASE WHEN id = ? THEN 1 ELSE 0 END", (pack_id,))
        return self.map_pack_registry()

    def disable_map_pack(self, pack_id: str) -> dict[str, Any]:
        with self.connect() as conn:
            row = conn.execute("SELECT id, installed FROM map_packs WHERE id = ?", (pack_id,)).fetchone()
            if not row:
                raise ValueError("Map pack not found.")
            if pack_id == "world_overview":
                raise ValueError("World Overview stays enabled as the base map.")
            conn.execute("UPDATE map_packs SET enabled = 0 WHERE id = ?", (pack_id,))
        return self.map_pack_registry()

    def import_pmtiles_path(self, value: str, name: str | None = None) -> dict[str, Any]:
        path = Path(value).expanduser()
        if not path.exists() or not path.is_file() or path.suffix.lower() != ".pmtiles":
            raise ValueError("Provide a readable .pmtiles file path on the OIAB host.")
        target = self.settings.data_dir / "maps" / "packs" / path.name
        if path.resolve() != target.resolve():
            shutil.copy2(path, target)
        catalog_pack = self.catalog_pack_for_filename(target.name) or {}
        self.upsert_map_pack(
            {
                "id": catalog_pack.get("id") or target.stem.lower().replace("_", "-"),
                "name": name or catalog_pack.get("name") or target.stem,
                "path": str(target),
                "url": f"/maps/packs/{target.name}",
                "style": catalog_pack.get("style") or "/maps-v2/map-style.json",
                "attribution": catalog_pack.get("attribution") or "© OpenStreetMap contributors",
                "catalog": catalog_pack,
            },
            enabled=(catalog_pack.get("id") == "world_overview"),
        )
        return self.map_pack_registry()

    def map_pack_registry(self) -> dict[str, Any]:
        self.rescan_map_packs()
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM map_packs ORDER BY active DESC, name COLLATE NOCASE").fetchall()
        basemaps = []
        active = None
        enabled_ids: list[str] = []
        for row in rows:
            path = self.resolve_pack_path(row["path"])
            exists = path.exists()
            try:
                metadata = json.loads(row["metadata_json"] or "{}")
            except Exception:  # noqa: BLE001
                metadata = {}
            catalog = metadata.get("catalog") if isinstance(metadata.get("catalog"), dict) else {}
            catalog_minzoom = metadata.get("catalog_minzoom")
            catalog_maxzoom = metadata.get("catalog_maxzoom")
            actual_minzoom = metadata.get("actual_minzoom")
            actual_maxzoom = metadata.get("actual_maxzoom")
            if actual_minzoom is None and isinstance(metadata.get("actual_metadata"), dict):
                actual_minzoom = metadata["actual_metadata"].get("minzoom")
            if actual_maxzoom is None and isinstance(metadata.get("actual_metadata"), dict):
                actual_maxzoom = metadata["actual_metadata"].get("maxzoom")
            if catalog_minzoom is None:
                catalog_minzoom = catalog.get("minzoom") or catalog.get("min_zoom")
            if catalog_maxzoom is None:
                catalog_maxzoom = catalog.get("maxzoom") or catalog.get("max_zoom")
            effective_minzoom = actual_minzoom if actual_minzoom is not None else catalog_minzoom
            effective_maxzoom = actual_maxzoom if actual_maxzoom is not None else catalog_maxzoom
            base_url = urlsplit(str(row["public_url"] or f"/maps/packs/{path.name}")).path
            versioned_url = self.versioned_pack_url(base_url, path)
            size_bytes = path.stat().st_size if exists else 0
            mtime_ns = path.stat().st_mtime_ns if exists else 0
            mtime = path.stat().st_mtime if exists else 0
            item = {
                "id": row["id"],
                "name": row["name"],
                "type": row["type"],
                "path": row["path"],
                "url": versioned_url,
                "public_url": versioned_url,
                "base_url": base_url,
                "style": row["style_path"] or "/maps-v2/map-style.json",
                "style_path": row["style_path"] or "/maps-v2/map-style.json",
                "attribution": row["attribution"] or "© OpenStreetMap contributors",
                "installed": bool(exists),
                "exists": bool(exists),
                "active": bool(row["active"] and exists),
                "enabled": bool(row["active"] and exists),
                "size_bytes": size_bytes,
                "mtime": mtime,
                "mtime_ns": mtime_ns,
                "version": f"{size_bytes}-{mtime_ns}" if exists else "",
                "created": row["created_at"],
                "updated": row["updated_at"],
                "bbox": metadata.get("actual_bounds") or metadata.get("bbox") or catalog.get("bbox"),
                "bounds": metadata.get("actual_bounds") or metadata.get("bbox") or catalog.get("bbox"),
                "catalog_minzoom": catalog_minzoom,
                "catalog_maxzoom": catalog_maxzoom,
                "catalog_min_zoom": catalog_minzoom,
                "catalog_max_zoom": catalog_maxzoom,
                "actual_minzoom": actual_minzoom,
                "actual_maxzoom": actual_maxzoom,
                "actual_min_zoom": actual_minzoom,
                "actual_max_zoom": actual_maxzoom,
                "actual_bounds": metadata.get("actual_bounds"),
                "actual_center": metadata.get("actual_center"),
                "minzoom": effective_minzoom,
                "maxzoom": effective_maxzoom,
                "min_zoom": effective_minzoom,
                "max_zoom": effective_maxzoom,
                "metadata_source": "actual_pmtiles" if actual_maxzoom is not None or actual_minzoom is not None else "catalog",
                "region_type": metadata.get("region_type") or catalog.get("region_type"),
                "country": metadata.get("country") or catalog.get("country"),
                "state": metadata.get("state") or catalog.get("state"),
            }
            if item["active"]:
                active = item["id"]
            if item["enabled"]:
                enabled_ids.append(item["id"])
            basemaps.append(item)
        if active is None:
            installed = next((pack for pack in basemaps if pack["id"] == "world_overview" and pack["installed"]), None)
            installed = installed or next((pack for pack in basemaps if pack["installed"]), None)
            active = installed["id"] if installed else None
        enabled_ids = [active] if active else []
        return {"ok": True, "active": active, "active_basemap": active, "enabled_pack_ids": enabled_ids, "basemaps": basemaps}

    def map_overlay_catalog(self) -> dict[str, Any]:
        catalog = read_json(REPO_ROOT / "config" / "map-overlays.json", {"version": 1, "overlays": []})
        overlays = [item for item in catalog.get("overlays", []) or [] if isinstance(item, dict)]
        return {"ok": True, "version": catalog.get("version", 1), "overlays": overlays}

    def resolve_overlay_path(self, value: str) -> Path:
        raw = urlsplit(str(value or "")).path
        path = Path(raw)
        if path.is_absolute():
            return path
        if raw.startswith("/maps/overlays/"):
            return self.settings.data_dir / "maps" / "overlays" / raw.removeprefix("/maps/overlays/")
        return self.settings.data_dir / "maps" / "overlays" / path.name

    def overlay_public_url_for_path(self, path: Path) -> str:
        overlays_root = (self.settings.data_dir / "maps" / "overlays").resolve()
        resolved = path.resolve()
        try:
            relative = resolved.relative_to(overlays_root)
            return "/maps/overlays/" + "/".join(relative.parts)
        except ValueError:
            return ""

    def overlay_path_is_public(self, path: Path | None) -> bool:
        if path is None:
            return False
        overlays_root = (self.settings.data_dir / "maps" / "overlays").resolve()
        try:
            path.resolve().relative_to(overlays_root)
            return True
        except (OSError, ValueError):
            return False

    def versioned_overlay_url(self, public_url: str, path: Path | None) -> str:
        base = urlsplit(str(public_url or "")).path
        if not base:
            return ""
        if not path or not path.exists() or not path.is_file():
            return base
        stat = path.stat()
        return f"{base}?v={stat.st_size}-{stat.st_mtime_ns}"

    def upsert_map_overlay(self, overlay: dict[str, Any], preserve_existing: bool = True) -> None:
        overlay_id = str(overlay.get("id") or Path(str(overlay.get("source_url") or overlay.get("path") or "overlay")).stem)
        if not overlay_id:
            raise ValueError("Overlay id is required.")
        overlay_type = str(overlay.get("type") or overlay.get("source_type") or "geojson").lower()
        if overlay_type in {"raster_xyz", "arcgis_raster"}:
            overlay_type = "raster"
        if overlay_type in {"pmtiles_vector", "generated_pmtiles"}:
            overlay_type = "pmtiles"
        if overlay_type == "cached_geojson":
            overlay_type = "geojson"
        name = str(overlay.get("name") or overlay_id.replace("-", " ").replace("_", " ").title())
        source_url = str(overlay.get("source_url") or overlay.get("url") or "")
        path_value = str(overlay.get("path") or "")
        local_path = str(overlay.get("local_path") or "")
        if not path_value and local_path:
            path_value = local_path
        if not source_url and path_value:
            source_url = self.overlay_public_url_for_path(Path(path_value))
        if not path_value and source_url.startswith("/maps/overlays/"):
            path_value = str(self.resolve_overlay_path(source_url))
        path = self.resolve_overlay_path(path_value or source_url) if (path_value or source_url) else None
        offline_available = bool(overlay.get("offline_available", False))
        if path and path.exists():
            offline_available = True
        tiles = overlay.get("tiles") if isinstance(overlay.get("tiles"), list) else []
        if not tiles and overlay.get("url_template"):
            tiles = [str(overlay.get("url_template"))]
        online_available = bool(
            overlay.get("online_available", False)
            or str(source_url).startswith(("http://", "https://"))
            or any(str(tile).startswith(("http://", "https://")) for tile in tiles)
        )
        layers = overlay.get("layers") if isinstance(overlay.get("layers"), list) else []
        metadata = {
            key: value
            for key, value in overlay.items()
            if key not in {"id", "name", "type", "source_url", "url", "path", "source_layer", "tiles", "layers", "attribution", "online_available", "offline_available", "cache_mode", "enabled", "opacity", "sort_order"}
        }
        if path:
            metadata.setdefault("local_path", str(path))
            metadata.setdefault("size_bytes", path.stat().st_size if path.exists() and path.is_file() else 0)
        metadata.setdefault("category", overlay.get("category") or "user")
        metadata.setdefault("source_type", overlay.get("source_type") or overlay_type)
        metadata.setdefault("url_template", overlay.get("url_template") or (tiles[0] if tiles else ""))
        metadata.setdefault("online_required", bool(overlay.get("online_required", online_available and not offline_available)))
        metadata.setdefault("cache_status", overlay.get("cache_status") or ("cached" if path and path.exists() else "not_cached"))
        metadata.setdefault("layer_order", overlay.get("layer_order", overlay.get("sort_order", 100)))
        metadata.setdefault("minzoom", overlay.get("minzoom"))
        metadata.setdefault("maxzoom", overlay.get("maxzoom"))
        metadata.setdefault("style", overlay.get("style") or "")
        metadata.setdefault("refresh_interval_minutes", overlay.get("refresh_interval_minutes"))
        metadata.setdefault("install_status", overlay.get("install_status") or ("installed" if path and path.exists() else "available"))
        metadata.setdefault("error_message", overlay.get("error_message") or "")
        with self.connect() as conn:
            existing = conn.execute("SELECT * FROM map_overlays WHERE id = ?", (overlay_id,)).fetchone()
            if existing and preserve_existing:
                enabled = bool(existing["enabled"])
                opacity = float(existing["opacity"])
                sort_order = int(existing["sort_order"])
                existing_metadata = json_loads(existing["metadata_json"], {})
                for key in ("last_fetch_at", "expires_at", "cache_status", "install_status", "error_message", "local_path", "size_bytes"):
                    if existing_metadata.get(key) not in (None, ""):
                        metadata[key] = existing_metadata[key]
                existing_path = str(existing["path"] or "")
                existing_source_url = str(existing["source_url"] or "")
                existing_file = self.resolve_overlay_path(existing_path or existing_source_url) if (existing_path or existing_source_url) else None
                if existing_file and existing_file.exists() and existing_source_url.startswith("/maps/overlays/") and self.overlay_path_is_public(existing_file):
                    path = existing_file
                    source_url = existing_source_url
                    offline_available = True
                    overlay_type = str(existing["type"] or overlay_type)
                    overlay["source_layer"] = existing["source_layer"]
            else:
                enabled = bool(overlay.get("enabled", overlay.get("enabled_default", False)))
                opacity = float(overlay.get("opacity", 1.0))
                sort_order = int(overlay.get("sort_order", overlay.get("layer_order", 100)))
            conn.execute(
                """
                INSERT INTO map_overlays(id, name, type, source_url, path, source_layer,
                                         tiles_json, layers_json, attribution,
                                         online_available, offline_available, cache_mode,
                                         enabled, opacity, sort_order, metadata_json,
                                         created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  type = excluded.type,
                  source_url = excluded.source_url,
                  path = excluded.path,
                  source_layer = excluded.source_layer,
                  tiles_json = excluded.tiles_json,
                  layers_json = excluded.layers_json,
                  attribution = excluded.attribution,
                  online_available = excluded.online_available,
                  offline_available = excluded.offline_available,
                  cache_mode = excluded.cache_mode,
                  enabled = excluded.enabled,
                  opacity = excluded.opacity,
                  sort_order = excluded.sort_order,
                  metadata_json = excluded.metadata_json,
                  updated_at = excluded.updated_at
                """,
                (
                    overlay_id,
                    name,
                    overlay_type,
                    source_url,
                    str(path) if path else path_value or None,
                    overlay.get("source_layer"),
                    json_dumps(tiles),
                    json_dumps(layers),
                    overlay.get("attribution"),
                    bool_int(online_available),
                    bool_int(offline_available),
                    str(overlay.get("cache_mode") or metadata.get("cache_mode") or "none"),
                    bool_int(enabled),
                    max(0.0, min(1.0, opacity)),
                    sort_order,
                    json_dumps(metadata),
                    now_iso(),
                    now_iso(),
                ),
            )

    def rescan_map_overlays(self) -> dict[str, Any]:
        overlays_dir = self.settings.data_dir / "maps" / "overlays"
        overlays_dir.mkdir(parents=True, exist_ok=True)
        imported = 0
        catalog_overlays = self.map_overlay_catalog().get("overlays", [])
        catalog_paths: set[Path] = set()
        catalog_rel_paths: set[str] = set()
        managed_mvum_outputs = {
            "mvum/geojson/mvum-roads-us.geojson",
            "mvum/pmtiles/mvum-roads-us.pmtiles",
            "mvum/geojson/mvum-trails-us.geojson",
            "mvum/pmtiles/mvum-trails-us.pmtiles",
            "public-lands/blm-sma-latest.geojson",
            "public-lands/blm-sma-latest.pmtiles",
        }
        catalog_rel_paths.update(managed_mvum_outputs)
        for overlay in catalog_overlays:
            for value in (overlay.get("path"), overlay.get("local_path"), overlay.get("source_url")):
                if not value:
                    continue
                raw = str(value)
                if raw.startswith(("http://", "https://")):
                    continue
                if raw.startswith("/maps/overlays/"):
                    catalog_rel_paths.add(raw.removeprefix("/maps/overlays/"))
                    continue
                if raw.startswith("/data/oiab/maps/overlays/"):
                    catalog_rel_paths.add(raw.removeprefix("/data/oiab/maps/overlays/"))
                try:
                    catalog_paths.add(self.resolve_overlay_path(raw).resolve())
                except OSError:
                    continue
        for overlay in catalog_overlays:
            self.upsert_map_overlay(overlay, preserve_existing=True)
            imported += 1
        if catalog_paths or catalog_rel_paths:
            with self.connect() as conn:
                rows = conn.execute("SELECT id, path, source_url FROM map_overlays WHERE id LIKE 'local_%'").fetchall()
                for row in rows:
                    raw = str(row["path"] or row["source_url"] or "")
                    if not raw:
                        continue
                    candidate = self.resolve_overlay_path(raw)
                    try:
                        rel_key = "/".join(candidate.relative_to(overlays_dir).parts)
                    except ValueError:
                        rel_key = candidate.name
                    outside_public_root = not self.overlay_path_is_public(candidate)
                    is_mvum_source = rel_key.startswith("mvum/source/")
                    if outside_public_root or is_mvum_source or candidate.resolve() in catalog_paths or rel_key in catalog_rel_paths:
                        conn.execute("DELETE FROM map_overlays WHERE id = ?", (row["id"],))
        scanned = 0
        local_files = [
            path for path in sorted([*overlays_dir.rglob("*.geojson"), *overlays_dir.rglob("*.json"), *overlays_dir.rglob("*.pmtiles")])
            if path.is_file() and not path.name.endswith(".part")
        ]
        for path in local_files:
            try:
                rel_key = "/".join(path.relative_to(overlays_dir).parts)
            except ValueError:
                rel_key = path.name
            if rel_key.startswith("mvum/source/"):
                continue
            if path.resolve() in catalog_paths or rel_key in catalog_rel_paths:
                continue
            overlay_id = f"local_{path.stem.lower().replace(' ', '_').replace('-', '_')}"
            overlay_type = "pmtiles" if path.suffix.lower() == ".pmtiles" else "geojson"
            self.upsert_map_overlay(
                {
                    "id": overlay_id,
                    "name": path.stem.replace("-", " ").replace("_", " ").title(),
                    "type": overlay_type,
                    "source_type": "pmtiles_vector" if overlay_type == "pmtiles" else "geojson",
                    "path": str(path),
                    "source_url": self.overlay_public_url_for_path(path),
                    "offline_available": True,
                    "online_available": False,
                    "cache_mode": "manual_download",
                    "cache_status": "cached",
                    "enabled": False,
                    "opacity": 0.8,
                    "sort_order": 200 + scanned,
                    "source_layer": "default",
                    "notes": "Auto-registered local overlay. PMTiles vector overlays need source_layer/layer styling configured before enabling.",
                },
                preserve_existing=True,
            )
            scanned += 1
        return {"catalog": imported, "local_files": scanned}

    def row_to_map_overlay(self, row: sqlite3.Row) -> dict[str, Any]:
        path = self.resolve_overlay_path(row["path"] or row["source_url"])
        source_url = str(row["source_url"] or "")
        public_path = self.overlay_path_is_public(path) if (row["path"] or str(source_url).startswith("/maps/overlays/")) else False
        exists = path.exists() and public_path if row["path"] or str(source_url).startswith("/maps/overlays/") else False
        if source_url.startswith("/maps/overlays/") and not public_path:
            source_url = ""
        if exists and source_url.startswith("/maps/overlays/"):
            source_url = self.versioned_overlay_url(source_url, path)
        metadata = json_loads(row["metadata_json"], {})
        cache_status = str(metadata.get("cache_status") or ("cached" if exists else "not_cached"))
        if exists and cache_status == "not_cached":
            cache_status = "cached"
        if not exists and row["cache_mode"] == "offline_pack" and cache_status == "cached":
            cache_status = "not_cached"
        if cache_status == "cached" and iso_is_stale(metadata.get("expires_at")):
            cache_status = "stale"
        cache_mode = row["cache_mode"]
        size_bytes = metadata.get("size_bytes")
        if exists:
            size_bytes = path.stat().st_size
        elif cache_mode in {"offline_pack", "latest_snapshot", "manual_download"}:
            size_bytes = 0
        available = bool(row["online_available"] or exists)
        if cache_mode == "latest_snapshot" and source_url.startswith("/maps/overlays/"):
            available = exists
        item = {
            "id": row["id"],
            "name": row["name"],
            "type": row["type"],
            "source_type": metadata.get("source_type") or row["type"],
            "source_url": source_url,
            "url": source_url,
            "path": row["path"],
            "local_path": metadata.get("local_path") if self.overlay_path_is_public(Path(str(metadata.get("local_path")))) else row["path"],
            "source_layer": row["source_layer"],
            "tiles": json_loads(row["tiles_json"], []),
            "layers": json_loads(row["layers_json"], []),
            "attribution": row["attribution"] or "",
            "category": metadata.get("category") or "user",
            "description": metadata.get("description") or "",
            "url_template": metadata.get("url_template") or "",
            "minzoom": metadata.get("minzoom"),
            "maxzoom": metadata.get("maxzoom"),
            "online_required": bool(metadata.get("online_required", False)),
            "online_available": bool(row["online_available"]),
            "offline_available": bool(row["offline_available"] and exists),
            "available": available,
            "exists": exists,
            "cache_mode": cache_mode,
            "cache_status": cache_status,
            "last_fetch_at": metadata.get("last_fetch_at"),
            "expires_at": metadata.get("expires_at"),
            "size_bytes": size_bytes or 0,
            "style": metadata.get("style") or "",
            "refresh_interval_minutes": metadata.get("refresh_interval_minutes"),
            "install_status": metadata.get("install_status") or "",
            "error_message": metadata.get("error_message") or "",
            "feature_count": metadata.get("feature_count"),
            "source_size_bytes": metadata.get("source_size_bytes"),
            "layer_order": metadata.get("layer_order", row["sort_order"]),
            "enabled": bool(row["enabled"]),
            "opacity": float(row["opacity"]),
            "sort_order": int(row["sort_order"]),
            "metadata": metadata,
            "created": row["created_at"],
            "updated": row["updated_at"],
        }
        if item["id"] in {"mvum_roads_us", "mvum_trails_us"}:
            explicit_url = self.settings.mvum_roads_url if item["id"] == "mvum_roads_us" else self.settings.mvum_trails_url
            source_download_url = explicit_url or self.settings.mvum_mapserver_url
            source_mode = "file_or_download" if explicit_url else "arcgis_rest"
            tools = {tool: bool(shutil.which(tool)) for tool in ("ogr2ogr", "tippecanoe", "pmtiles")}
            required_tools = ["ogr2ogr"] if explicit_url else []
            optional_tools = ["tippecanoe", "pmtiles"]
            missing_required_tools = [tool for tool in required_tools if not tools.get(tool)]
            missing_optional_tools = [tool for tool in optional_tools if not tools.get(tool)]
            item["source_download_url"] = source_download_url
            item["mvum_source_mode"] = source_mode
            item["source_url_configured"] = bool(source_download_url)
            item["tools"] = tools
            item["required_tools"] = required_tools
            item["optional_tools"] = optional_tools
            item["missing_tools"] = missing_required_tools
            item["missing_required_tools"] = missing_required_tools
            item["missing_optional_tools"] = missing_optional_tools
            item["install_available"] = bool(source_download_url) and not missing_required_tools
            if exists:
                item["cache_status"] = "cached" if item["cache_status"] == "not_cached" else item["cache_status"]
                item["install_status"] = "installed" if item["install_status"] in {"", "source_url_not_configured", "manual_download"} else item["install_status"]
            elif not source_download_url:
                item["install_status"] = "source_url_not_configured"
            elif missing_required_tools:
                item["install_status"] = "missing_tools"
            else:
                stale_source_error = "source URL is not configured" in str(item.get("error_message") or "")
                if item["install_status"] in {"source_url_not_configured", "missing_tools", "manual_download", "installed"} or stale_source_error:
                    item["install_status"] = "ready"
                    if stale_source_error:
                        item["error_message"] = ""
                item["cache_status"] = "not_cached"
        if item["id"] == "firms_active_hotspots":
            stored_key = str(self.app_setting("firms_map_key", "") or "").strip()
            env_key = str(self.settings.firms_map_key or "").strip()
            key_configured = bool(stored_key or env_key)
            item["key_configured"] = key_configured
            item["refresh_available"] = key_configured
            item["key_source"] = "saved" if stored_key else "env" if env_key else ""
            if not key_configured and not item["exists"]:
                item["error_message"] = item["error_message"] or "OIAB_FIRMS_MAP_KEY is required for live NASA FIRMS refresh."
        if item["id"] == "nws_active_alerts":
            item["key_configured"] = True
            item["refresh_available"] = True
        if item["id"] == "usgs_topo":
            item["online_only"] = True
            item["configured_url"] = bool(item["tiles"] or item["url_template"] or item["source_url"])
        return item

    def map_overlay_registry(self) -> dict[str, Any]:
        self.rescan_map_overlays()
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM map_overlays ORDER BY sort_order, name COLLATE NOCASE").fetchall()
        overlays = [self.row_to_map_overlay(row) for row in rows]
        return {
            "ok": True,
            "overlays": overlays,
            "enabled_overlay_ids": [item["id"] for item in overlays if item["enabled"] and item["available"]],
            "storage_root": str(self.settings.data_dir / "maps" / "overlays"),
            "cache_root": str(self.settings.data_dir / "maps" / "cache"),
        }

    def set_map_overlay_enabled(self, overlay_id: str, enabled: bool) -> dict[str, Any]:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM map_overlays WHERE id = ?", (overlay_id,)).fetchone()
            if not row:
                raise ValueError("Map overlay not found.")
            if enabled:
                item = self.row_to_map_overlay(row)
                if not item["available"]:
                    detail = item.get("error_message") or item.get("install_status") or item.get("cache_status") or "overlay data is not installed"
                    raise ValueError(f"{item['name']} is not available: {detail}.")
            conn.execute("UPDATE map_overlays SET enabled = ?, updated_at = ? WHERE id = ?", (bool_int(enabled), now_iso(), overlay_id))
        return self.map_overlay_registry()

    def set_map_overlay_opacity(self, overlay_id: str, opacity: Any) -> dict[str, Any]:
        value = numeric_value(opacity)
        if value is None:
            raise ValueError("Opacity must be a number from 0 to 1.")
        with self.connect() as conn:
            row = conn.execute("SELECT id FROM map_overlays WHERE id = ?", (overlay_id,)).fetchone()
            if not row:
                raise ValueError("Map overlay not found.")
            conn.execute("UPDATE map_overlays SET opacity = ?, updated_at = ? WHERE id = ?", (max(0.0, min(1.0, float(value))), now_iso(), overlay_id))
        return self.map_overlay_registry()

    def set_map_overlay_order(self, overlay_id: str, sort_order: Any) -> dict[str, Any]:
        value = numeric_value(sort_order)
        if value is None:
            raise ValueError("Sort order must be a number.")
        with self.connect() as conn:
            row = conn.execute("SELECT id FROM map_overlays WHERE id = ?", (overlay_id,)).fetchone()
            if not row:
                raise ValueError("Map overlay not found.")
            conn.execute("UPDATE map_overlays SET sort_order = ?, updated_at = ? WHERE id = ?", (int(value), now_iso(), overlay_id))
        return self.map_overlay_registry()

    def app_setting(self, key: str, default: Any = None) -> Any:
        with self.connect() as conn:
            row = conn.execute("SELECT value_json FROM app_settings WHERE key = ?", (key,)).fetchone()
        if not row:
            return default
        return json_loads(row["value_json"], default)

    def set_app_setting(self, key: str, value: Any) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO app_settings(key, value_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                  value_json = excluded.value_json,
                  updated_at = excluded.updated_at
                """,
                (key, json_dumps(value), now_iso()),
            )

    def firms_map_key(self) -> str:
        stored = str(self.app_setting("firms_map_key", "") or "").strip()
        return stored or str(self.settings.firms_map_key or "").strip()

    def set_firms_map_key(self, value: str) -> dict[str, Any]:
        key = str(value or "").strip()
        self.set_app_setting("firms_map_key", key)
        registry = self.map_overlay_registry()
        registry["firms_key_configured"] = bool(key)
        return registry

    def clear_map_overlay_cache(self, overlay_id: str) -> dict[str, Any]:
        self.rescan_map_overlays()
        removed: list[str] = []
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM map_overlays WHERE id = ?", (overlay_id,)).fetchone()
            if not row:
                raise ValueError("Map overlay not found.")
            item = self.row_to_map_overlay(row)
            paths: list[Path] = []
            if item.get("path"):
                paths.append(self.resolve_overlay_path(str(item["path"])))
            if overlay_id in {"mvum_roads_us", "mvum_trails_us"}:
                base = "mvum-roads-us" if overlay_id == "mvum_roads_us" else "mvum-trails-us"
                root = self.settings.data_dir / "maps" / "overlays" / "mvum"
                paths.extend(
                    [
                        root / "source" / f"{base}.arcgis.geojson",
                        root / "source" / f"{base}.zip",
                        root / "geojson" / f"{base}.raw.geojson",
                        root / "geojson" / f"{base}.geojson",
                        root / "pmtiles" / f"{base}.pmtiles",
                    ]
                )
            for path in paths:
                if not self.overlay_path_is_public(path):
                    continue
                if path.exists() and path.is_file():
                    path.unlink()
                    removed.append(str(path))

            metadata = json_loads(row["metadata_json"], {})
            metadata.update(
                {
                    "cache_status": "not_cached",
                    "install_status": "ready" if overlay_id in {"mvum_roads_us", "mvum_trails_us"} else "not_cached",
                    "error_message": "",
                    "size_bytes": 0,
                    "feature_count": None,
                    "last_fetch_at": None,
                    "expires_at": None,
                }
            )
            if overlay_id.startswith("local_"):
                conn.execute("DELETE FROM map_overlays WHERE id = ?", (overlay_id,))
            else:
                conn.execute(
                    """
                    UPDATE map_overlays
                    SET enabled = 0, offline_available = 0, metadata_json = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (json_dumps(metadata), now_iso(), overlay_id),
                )
        result = self.map_overlay_registry()
        result["removed"] = removed
        return result

    def update_map_overlay_metadata(self, overlay_id: str, updates: dict[str, Any], *, path: str | None = None, source_url: str | None = None, overlay_type: str | None = None, source_layer: str | None = None) -> dict[str, Any]:
        self.rescan_map_overlays()
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM map_overlays WHERE id = ?", (overlay_id,)).fetchone()
            if not row:
                raise ValueError("Map overlay not found.")
            metadata = json_loads(row["metadata_json"], {})
            metadata.update({key: value for key, value in updates.items() if value is not None})
            final_path = path if path is not None else row["path"]
            final_url = source_url if source_url is not None else row["source_url"]
            final_type = overlay_type if overlay_type is not None else row["type"]
            final_source_layer = source_layer if source_layer is not None else row["source_layer"]
            if final_path:
                overlay_path = Path(final_path)
                metadata["local_path"] = str(overlay_path)
                metadata["size_bytes"] = overlay_path.stat().st_size if overlay_path.exists() and overlay_path.is_file() else 0
            conn.execute(
                """
                UPDATE map_overlays
                SET type = ?, path = ?, source_url = ?, source_layer = ?, offline_available = ?, metadata_json = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    final_type,
                    final_path,
                    final_url,
                    final_source_layer,
                    bool_int(Path(final_path).exists() if final_path else row["offline_available"]),
                    json_dumps(metadata),
                    now_iso(),
                    overlay_id,
                ),
            )
        return self.map_overlay_registry()

    def mark_overlay_refresh(self, overlay_id: str, *, output_path: Path | None, ok: bool, error: str = "", fetched_at: str | None = None, extra: dict[str, Any] | None = None) -> dict[str, Any]:
        self.rescan_map_overlays()
        fetched = fetched_at or now_iso()
        row = None
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM map_overlays WHERE id = ?", (overlay_id,)).fetchone()
        metadata = json_loads(row["metadata_json"], {}) if row else {}
        expires_at = iso_plus_minutes(metadata.get("refresh_interval_minutes"))
        updates = {
            "last_fetch_at": fetched if ok else metadata.get("last_fetch_at"),
            "expires_at": expires_at if ok else metadata.get("expires_at"),
            "cache_status": "cached" if ok else "failed",
            "install_status": "cached" if ok else "refresh_failed",
            "error_message": "" if ok else error,
        }
        if extra:
            updates.update(extra)
        source_url = self.overlay_public_url_for_path(output_path) if output_path else None
        return self.update_map_overlay_metadata(overlay_id, updates, path=str(output_path) if output_path else None, source_url=source_url)
