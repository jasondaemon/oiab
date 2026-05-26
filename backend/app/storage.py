from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from .config import Settings


EMPTY_FEATURE_COLLECTION = {"type": "FeatureCollection", "features": []}


def read_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    tmp.replace(path)


def places_file(settings: Settings) -> Path:
    return settings.data_dir / "waypoints" / "trailer-places.geojson"


def read_places(settings: Settings) -> dict[str, Any]:
    from .app_db import AppDB

    return AppDB(settings).places_geojson()


def save_waypoint(settings: Settings, payload: dict[str, Any]) -> dict[str, Any]:
    from .app_db import AppDB

    return AppDB(settings).save_waypoint(payload)


def folders_from_places(places: dict[str, Any]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for feature in places.get("features", []):
        props = feature.get("properties") or {}
        folder = str(props.get("folder") or "Unfiled")
        counts[folder] = counts.get(folder, 0) + 1
    return [{"name": name, "count": count, "shown": True} for name, count in sorted(counts.items())]
