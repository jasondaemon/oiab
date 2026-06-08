#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
from pathlib import Path


def copy_if_exists(src: Path, dst: Path) -> None:
    if not src.exists():
        print(f"skip missing {src}")
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f"copied {src} -> {dst}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Scaffold migration from an existing pre-OIAB Overland install into OIAB data paths.")
    parser.add_argument("--source-data", default="/srv/trailer/maps-admin/data", help="legacy maps-admin data directory")
    parser.add_argument("--target-data", default="/data/oiab", help="OIAB_DATA_DIR")
    args = parser.parse_args()

    source = Path(args.source_data)
    target = Path(args.target_data)

    copy_if_exists(source / "trailer-places.geojson", target / "waypoints" / "trailer-places.geojson")
    copy_if_exists(source / "mobile-games.json", target / "games" / "mobile-games.json")
    copy_if_exists(source / "game-stats.json", target / "games" / "scoreboard.json")

    print("Migration scaffold complete. Tracks, settings, and map registries may still need manual review.")


if __name__ == "__main__":
    main()
