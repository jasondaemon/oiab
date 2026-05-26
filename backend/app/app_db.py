from __future__ import annotations

import json
import shutil
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
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
        if not self.migration_applied("map_pack_registry_v1"):
            try:
                details = self.import_map_pack_registry()
                self.rescan_map_packs()
                self.mark_migration("map_pack_registry_v1", details)
            except Exception as exc:  # noqa: BLE001 - migration boundary
                print(f"OIAB DB migration map_pack_registry_v1 failed: {exc}")

    def places_file(self) -> Path:
        return self.settings.data_dir / "waypoints" / "trailer-places.geojson"

    def current_track_file(self) -> Path:
        return self.settings.data_dir / "tracks" / "current.geojson"

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
        count = 0
        for feature in features:
            if not isinstance(feature, dict):
                continue
            geometry = feature.get("geometry") or {}
            props = feature.get("properties") or {}
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
        return count

    def import_track_geojson(self, path: Path) -> int:
        data = read_json(path, EMPTY_FEATURE_COLLECTION)
        features = data.get("features", []) if isinstance(data, dict) else []
        count = 0
        for feature in features:
            if isinstance(feature, dict) and (feature.get("geometry") or {}).get("type") == "LineString":
                self.import_track_feature(feature, default_status="current")
                count += 1
        return count

    def import_track_feature(self, feature: dict[str, Any], default_status: str = "saved") -> str:
        props = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        coords = geometry.get("coordinates") or []
        track_id = str(props.get("id") or f"track-{datetime.now().strftime('%Y%m%d%H%M%S%f')}")
        folder = props.get("folder") or "Recorded"
        folder_id = self.folder_id(folder)
        name = str(props.get("name") or props.get("title") or track_id)
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
            return {"ok": True, "recording": False, "status": "inactive", "track": EMPTY_FEATURE_COLLECTION}
        feature = self.row_to_track(row)
        return {
            "ok": True,
            "recording": row["status"] == "current",
            "status": row["status"],
            "point_count": len(feature["geometry"]["coordinates"]),
            "track": {"type": "FeatureCollection", "features": [feature]},
        }

    def import_map_pack_registry(self) -> dict[str, Any]:
        candidates = []
        if self.settings.map_pack_registry:
            candidates.append(self.settings.map_pack_registry)
        candidates.append(REPO_ROOT / "config" / "map-packs.json")
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

    def upsert_map_pack(self, pack: dict[str, Any], active: bool = False) -> None:
        pack_id = str(pack.get("id") or Path(str(pack.get("path") or pack.get("url") or "map-pack")).stem)
        name = str(pack.get("name") or pack_id.replace("-", " ").replace("_", " ").title())
        public_url = str(pack.get("public_url") or pack.get("url") or f"/maps/packs/{Path(str(pack.get('path') or pack_id + '.pmtiles')).name}")
        path = str(pack.get("path") or self.path_for_pack_url(public_url))
        style = str(pack.get("style_path") or pack.get("style") or "/maps-v2/map-style.json")
        file_path = self.resolve_pack_path(path)
        exists = file_path.exists()
        with self.connect() as conn:
            if active:
                conn.execute("UPDATE map_packs SET active = 0")
            conn.execute(
                """
                INSERT INTO map_packs(id, name, type, path, public_url, style_path, attribution,
                                      installed, active, size_bytes, metadata_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  type = excluded.type,
                  path = excluded.path,
                  public_url = excluded.public_url,
                  style_path = excluded.style_path,
                  attribution = excluded.attribution,
                  installed = excluded.installed,
                  active = CASE WHEN excluded.active = 1 THEN 1 ELSE map_packs.active END,
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
                    file_path.stat().st_size if exists else 0,
                    json_dumps(pack),
                    now_iso(),
                    now_iso(),
                ),
            )

    def resolve_pack_path(self, value: str) -> Path:
        path = Path(value)
        if path.is_absolute():
            return path
        if value.startswith("/maps/packs/"):
            return self.settings.data_dir / "maps" / "packs" / value.removeprefix("/maps/packs/")
        return self.settings.data_dir / "maps" / "packs" / path.name

    def path_for_pack_url(self, url: str) -> str:
        if url.startswith("/maps/packs/"):
            return str(self.settings.data_dir / "maps" / "packs" / url.removeprefix("/maps/packs/"))
        return url

    def rescan_map_packs(self) -> dict[str, Any]:
        packs_dir = self.settings.data_dir / "maps" / "packs"
        packs_dir.mkdir(parents=True, exist_ok=True)
        found = 0
        for path in sorted(packs_dir.glob("*.pmtiles")):
            pack_id = path.stem.lower().replace(" ", "-").replace("_", "-")
            self.upsert_map_pack(
                {
                    "id": pack_id,
                    "name": path.stem.replace("-", " ").replace("_", " ").title(),
                    "type": "pmtiles",
                    "path": str(path),
                    "url": f"/maps/packs/{path.name}",
                    "style": "/maps-v2/map-style.json",
                    "attribution": "© OpenStreetMap contributors",
                }
            )
            found += 1
        with self.connect() as conn:
            active = conn.execute("SELECT id FROM map_packs WHERE active = 1 AND installed = 1 LIMIT 1").fetchone()
            if not active:
                first = conn.execute("SELECT id FROM map_packs WHERE installed = 1 ORDER BY updated_at DESC LIMIT 1").fetchone()
                if first:
                    conn.execute("UPDATE map_packs SET active = CASE WHEN id = ? THEN 1 ELSE 0 END", (first["id"],))
        return {"found": found}

    def set_active_map_pack(self, pack_id: str) -> dict[str, Any]:
        with self.connect() as conn:
            row = conn.execute("SELECT id, installed FROM map_packs WHERE id = ?", (pack_id,)).fetchone()
            if not row:
                raise ValueError("Map pack not found.")
            if not row["installed"]:
                raise ValueError("Map pack file is not installed.")
            conn.execute("UPDATE map_packs SET active = CASE WHEN id = ? THEN 1 ELSE 0 END", (pack_id,))
        return self.map_pack_registry()

    def import_pmtiles_path(self, value: str, name: str | None = None) -> dict[str, Any]:
        path = Path(value).expanduser()
        if not path.exists() or not path.is_file() or path.suffix.lower() != ".pmtiles":
            raise ValueError("Provide a readable .pmtiles file path on the OIAB host.")
        target = self.settings.data_dir / "maps" / "packs" / path.name
        if path.resolve() != target.resolve():
            shutil.copy2(path, target)
        self.upsert_map_pack({"id": target.stem.lower().replace("_", "-"), "name": name or target.stem, "path": str(target), "url": f"/maps/packs/{target.name}"})
        return self.map_pack_registry()

    def map_pack_registry(self) -> dict[str, Any]:
        self.rescan_map_packs()
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM map_packs ORDER BY active DESC, name COLLATE NOCASE").fetchall()
        basemaps = []
        active = None
        for row in rows:
            path = self.resolve_pack_path(row["path"])
            exists = path.exists()
            item = {
                "id": row["id"],
                "name": row["name"],
                "type": row["type"],
                "path": row["path"],
                "url": row["public_url"],
                "public_url": row["public_url"],
                "style": row["style_path"] or "/maps-v2/map-style.json",
                "style_path": row["style_path"] or "/maps-v2/map-style.json",
                "attribution": row["attribution"] or "© OpenStreetMap contributors",
                "installed": bool(exists),
                "exists": bool(exists),
                "active": bool(row["active"] and exists),
                "size_bytes": path.stat().st_size if exists else 0,
                "created": row["created_at"],
                "updated": row["updated_at"],
            }
            if item["active"]:
                active = item["id"]
            basemaps.append(item)
        if active is None:
            installed = next((pack for pack in basemaps if pack["installed"]), None)
            active = installed["id"] if installed else (basemaps[0]["id"] if basemaps else None)
        return {"ok": True, "active": active, "active_basemap": active, "basemaps": basemaps}
