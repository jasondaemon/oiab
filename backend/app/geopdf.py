from __future__ import annotations

import json
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

from .app_db import AppDB
from .config import Settings


def now_iso() -> str:
    return datetime.now().isoformat()


def safe_geopdf_id(filename: str) -> str:
    stem = Path(filename or "geopdf").stem.lower()
    cleaned = re.sub(r"[^a-z0-9]+", "-", stem).strip("-")
    return f"geopdf_{cleaned or 'map'}"


def unique_geopdf_id(settings: Settings, filename: str) -> str:
    base = safe_geopdf_id(filename)
    candidate = base
    index = 2
    processed_root = settings.data_dir / "geopdf" / "processed"
    with AppDB(settings).connect() as conn:
        while (processed_root / candidate).exists() or conn.execute("SELECT id FROM map_overlays WHERE id = ?", (candidate,)).fetchone():
            candidate = f"{base}_{index}"
            index += 1
    return candidate


def require_gdal_tools() -> dict[str, str]:
    required = ("gdalinfo", "gdalwarp", "gdal2tiles.py")
    tools = {tool: shutil.which(tool) for tool in required}
    missing = [tool for tool in required if not tools.get(tool)]
    if missing:
        raise ValueError(
            "GDAL is not installed or not available in the OIAB runtime. Missing: "
            + ", ".join(missing)
            + ". Install GDAL tools such as gdal-bin, then rebuild/restart OIAB."
        )
    return {key: str(value) for key, value in tools.items() if value}


def run_command(command: list[str], *, timeout: int = 3600) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, text=True, capture_output=True, timeout=timeout, check=False)


def validate_pdf(path: Path) -> None:
    if path.suffix.lower() != ".pdf":
        raise ValueError("GeoPDF imports must be PDF files.")
    with path.open("rb") as handle:
        header = handle.read(5)
    if header != b"%PDF-":
        raise ValueError("Uploaded file is not a valid PDF.")


def bounds_from_gdalinfo(info: dict[str, Any]) -> list[float]:
    extent = info.get("wgs84Extent")
    if isinstance(extent, dict):
        coords = extent.get("coordinates")
        if isinstance(coords, list) and coords and isinstance(coords[0], list):
            points = coords[0]
            lons = [float(point[0]) for point in points if isinstance(point, list) and len(point) >= 2]
            lats = [float(point[1]) for point in points if isinstance(point, list) and len(point) >= 2]
            if lons and lats:
                return [min(lons), min(lats), max(lons), max(lats)]
    return []


def projection_from_gdalinfo(info: dict[str, Any]) -> str:
    coordinate_system = info.get("coordinateSystem")
    if isinstance(coordinate_system, dict):
        for key in ("wkt", "projjson"):
            value = coordinate_system.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
            if isinstance(value, dict):
                name = value.get("name")
                if isinstance(name, str) and name.strip():
                    return name.strip()
    return ""


def is_georeferenced(info: dict[str, Any]) -> bool:
    if bounds_from_gdalinfo(info):
        return True
    if info.get("geoTransform") and info.get("coordinateSystem"):
        return True
    corners = info.get("cornerCoordinates")
    return isinstance(corners, dict) and bool(corners.get("upperLeft") and corners.get("lowerRight") and info.get("coordinateSystem"))


def render_dpi(settings: Settings) -> int:
    return max(72, min(1200, int(settings.geopdf_render_dpi)))


def gdal_pdf_config(settings: Settings) -> list[str]:
    return ["--config", "GDAL_PDF_DPI", str(render_dpi(settings))]


def load_gdalinfo(settings: Settings, path: Path) -> dict[str, Any]:
    result = run_command(["gdalinfo", *gdal_pdf_config(settings), "-json", "-mdd", "all", str(path)], timeout=120)
    if result.returncode != 0:
        raise ValueError(f"gdalinfo failed: {result.stderr.strip() or result.stdout.strip()}")
    try:
        info = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Could not parse gdalinfo JSON: {exc}") from exc
    if not is_georeferenced(info):
        raise ValueError("PDF is not georeferenced or GDAL could not read its geospatial metadata.")
    bounds = bounds_from_gdalinfo(info)
    if not bounds:
        raise ValueError("Could not determine GeoPDF bounds in WGS84.")
    return info


def default_zoom_range(settings: Settings) -> tuple[int, int]:
    min_zoom = max(0, min(22, int(settings.geopdf_min_zoom)))
    max_zoom = max(min_zoom, min(22, int(settings.geopdf_max_zoom)))
    return min_zoom, max_zoom


def metadata_path(settings: Settings, map_id: str) -> Path:
    return settings.data_dir / "geopdf" / "processed" / map_id / "metadata.json"


def load_metadata(settings: Settings, map_id: str) -> dict[str, Any]:
    path = metadata_path(settings, map_id)
    if not path.exists():
        raise ValueError("GeoPDF overlay not found.")
    return json.loads(path.read_text(encoding="utf-8"))


def tile_extension(settings: Settings) -> str:
    output_format = str(settings.geopdf_output_format or "png").strip().lower()
    return "jpg" if output_format in {"jpg", "jpeg"} else "png"


def tile_path(settings: Settings, map_id: str, z: int, x: int, y: int, extension: str | None = None) -> Path:
    root = (settings.data_dir / "geopdf" / "processed" / map_id / "tiles").resolve()
    ext = str(extension or tile_extension(settings)).strip(".").lower()
    if ext == "jpeg":
        ext = "jpg"
    if ext not in {"png", "jpg"}:
        raise ValueError("Unsupported GeoPDF tile extension.")
    path = (root / str(z) / str(x) / f"{y}.{ext}").resolve()
    path.relative_to(root)
    return path


def tile_template(map_id: str, version: str, extension: str = "png") -> str:
    ext = "jpg" if extension in {"jpg", "jpeg"} else "png"
    return f"/tiles/geopdf/{quote(map_id)}/{{z}}/{{x}}/{{y}}.{ext}?v={quote(version)}"


def register_overlay(settings: Settings, metadata: dict[str, Any]) -> None:
    db = AppDB(settings)
    map_id = str(metadata["id"])
    source_path = Path(str(metadata["source_path"]))
    meta_path = metadata_path(settings, map_id)
    version = f"{source_path.stat().st_size}-{source_path.stat().st_mtime_ns}" if source_path.exists() else str(metadata.get("updated_at") or "")
    metadata["tile_template"] = tile_template(map_id, version, str(metadata.get("tile_format") or "png"))
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.write_text(json.dumps(metadata, indent=2, sort_keys=True, default=str), encoding="utf-8")
    db.upsert_map_overlay(
        {
            "id": map_id,
            "name": metadata.get("display_name") or metadata.get("original_filename") or map_id,
            "type": "raster",
            "source_type": "geopdf_tiles",
            "category": "geopdf",
            "path": str(meta_path),
            "tiles": [metadata["tile_template"]],
            "offline_available": True,
            "online_available": False,
            "cache_mode": "offline_pack",
            "cache_status": "cached" if metadata.get("processing_status") == "complete" else metadata.get("processing_status", "processing"),
            "install_status": metadata.get("processing_status", "processing"),
            "enabled": False,
            "opacity": 0.85,
            "sort_order": 88,
            "minzoom": metadata.get("minZoom"),
            "maxzoom": metadata.get("maxZoom"),
            "bounds": metadata.get("bounds"),
            "tile_size": metadata.get("tileSize"),
            "description": "Imported georeferenced PDF map rendered as local raster tiles.",
            "error_message": metadata.get("error_message", ""),
            "original_filename": metadata.get("original_filename"),
            "source_path": str(source_path),
            "metadata_path": str(meta_path),
        },
        preserve_existing=True,
    )


def write_metadata(settings: Settings, metadata: dict[str, Any]) -> dict[str, Any]:
    map_id = str(metadata["id"])
    root = settings.data_dir / "geopdf" / "processed" / map_id
    root.mkdir(parents=True, exist_ok=True)
    metadata["updated_at"] = now_iso()
    path = root / "metadata.json"
    path.write_text(json.dumps(metadata, indent=2, sort_keys=True, default=str), encoding="utf-8")
    return metadata


def process_geopdf(settings: Settings, source_path: Path, map_id: str | None = None, display_name: str | None = None) -> dict[str, Any]:
    tools = require_gdal_tools()
    validate_pdf(source_path)
    map_id = map_id or unique_geopdf_id(settings, source_path.name)
    min_zoom, max_zoom = default_zoom_range(settings)
    processed_root = settings.data_dir / "geopdf" / "processed" / map_id
    processed_root.mkdir(parents=True, exist_ok=True)
    tiles_dir = processed_root / "tiles"
    work_dir = processed_root / "work"
    work_dir.mkdir(parents=True, exist_ok=True)
    warped = work_dir / "warped.tif"
    info = load_gdalinfo(settings, source_path)
    bounds = bounds_from_gdalinfo(info)
    metadata = {
        "id": map_id,
        "original_filename": source_path.name,
        "display_name": display_name or source_path.stem.replace("-", " ").replace("_", " ").strip() or source_path.name,
        "source_path": str(source_path),
        "tile_path": str(tiles_dir),
        "tile_template": tile_template(map_id, "processing", tile_extension(settings)),
        "minZoom": min_zoom,
        "maxZoom": max_zoom,
        "tileSize": int(settings.geopdf_tile_size),
        "tile_format": tile_extension(settings),
        "render_dpi": render_dpi(settings),
        "bounds": bounds,
        "original_crs": projection_from_gdalinfo(info),
        "processing_status": "processing",
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "gdal_tools": tools,
        "commands": [],
        "error_message": "",
    }
    write_metadata(settings, metadata)
    register_overlay(settings, metadata)

    warp_cmd = [
        "gdalwarp",
        *gdal_pdf_config(settings),
        "-overwrite",
        "-t_srs", "EPSG:3857",
        "-dstalpha",
        "-r", "bilinear",
        "-of", "GTiff",
        str(source_path),
        str(warped),
    ]
    warp = run_command(warp_cmd, timeout=3600)
    metadata["commands"].append({"command": warp_cmd, "returncode": warp.returncode, "stderr": warp.stderr[-4000:]})
    if warp.returncode != 0:
        raise ValueError(f"Tile reprojection failed: {warp.stderr.strip() or warp.stdout.strip()}")

    if tiles_dir.exists():
        shutil.rmtree(tiles_dir)
    zoom_arg = f"{min_zoom}-{max_zoom}"
    tiles_cmd = [
        "gdal2tiles.py",
        "--xyz",
        "-w", "none",
        "--tilesize", str(int(settings.geopdf_tile_size)),
        "--tiledriver", "JPEG" if tile_extension(settings) == "jpg" else "PNG",
        "-z", zoom_arg,
        "-r", "bilinear",
        str(warped),
        str(tiles_dir),
    ]
    tiles = run_command(tiles_cmd, timeout=7200)
    metadata["commands"].append({"command": tiles_cmd, "returncode": tiles.returncode, "stderr": tiles.stderr[-4000:]})
    if tiles.returncode != 0:
        raise ValueError(f"Tile generation failed: {tiles.stderr.strip() or tiles.stdout.strip()}")

    tile_count = sum(1 for path in tiles_dir.rglob(f"*.{tile_extension(settings)}") if path.is_file())
    size_bytes = sum(path.stat().st_size for path in tiles_dir.rglob("*") if path.is_file())
    metadata.update(
        {
            "processing_status": "complete",
            "tile_count": tile_count,
            "size_bytes": size_bytes,
            "updated_at": now_iso(),
        }
    )
    write_metadata(settings, metadata)
    register_overlay(settings, metadata)
    return metadata


def import_geopdf_bytes(settings: Settings, filename: str, content: bytes) -> dict[str, Any]:
    if Path(filename or "").suffix.lower() != ".pdf":
        raise ValueError("GeoPDF imports must use a .pdf file.")
    if not content.startswith(b"%PDF-"):
        raise ValueError("Uploaded file is not a valid PDF.")
    originals = settings.data_dir / "geopdf" / "originals"
    originals.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "-", Path(filename).name).strip(".-") or "map.pdf"
    destination = originals / safe_name
    if destination.exists():
        suffix = destination.suffix
        stem = destination.stem
        destination = originals / f"{stem}-{datetime.now().strftime('%Y%m%d%H%M%S')}{suffix}"
    destination.write_bytes(content)
    validate_pdf(destination)
    return {"source_path": str(destination), "map_id": unique_geopdf_id(settings, destination.name)}


def list_geopdfs(settings: Settings) -> list[dict[str, Any]]:
    processed = settings.data_dir / "geopdf" / "processed"
    items: list[dict[str, Any]] = []
    for path in sorted(processed.glob("*/metadata.json")):
        try:
            items.append(json.loads(path.read_text(encoding="utf-8")))
        except Exception:
            continue
    return items


def update_geopdf(settings: Settings, map_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    metadata = load_metadata(settings, map_id)
    if updates.get("display_name"):
        metadata["display_name"] = str(updates["display_name"]).strip()
    write_metadata(settings, metadata)
    register_overlay(settings, metadata)
    return metadata


def delete_geopdf(settings: Settings, map_id: str) -> dict[str, Any]:
    metadata = load_metadata(settings, map_id)
    processed_root = settings.data_dir / "geopdf" / "processed" / map_id
    if processed_root.exists():
        shutil.rmtree(processed_root)
    with AppDB(settings).connect() as conn:
        conn.execute("DELETE FROM map_overlays WHERE id = ?", (map_id,))
    return {"ok": True, "deleted": map_id, "metadata": metadata}
