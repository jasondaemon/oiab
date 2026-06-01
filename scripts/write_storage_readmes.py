#!/usr/bin/env python3
"""Write concise README files into the host storage tree.

This is intentionally host-oriented. It documents the directories exposed
through File Browser so the storage root is understandable to an operator
without needing repo context.
"""

from __future__ import annotations

import argparse
from pathlib import Path


README_MAP: dict[str, str] = {
    "backups": """# Backups

Purpose:
- Manual or scripted backup output.

Typical contents:
- Exported databases
- Configuration snapshots
- Archived content bundles

Notes:
- Safe place for restore points before large upgrades or migrations.
""",
    "crafty": """# Crafty

Purpose:
- Persistent state for the Crafty Controller Minecraft admin stack.

Typical contents:
- Crafty configuration
- Server metadata
- Admin UI state

Notes:
- This is service state, not general user content.
""",
    "data": """# Data

Purpose:
- Shared persistent application data root.

Typical contents:
- OIAB database
- Map registries
- Overlay caches
- Track and waypoint storage
- Service state stored under OIAB-managed paths

Notes:
- This is the main durable application data area for OIAB.
""",
    "deployments": """# Deployments

Purpose:
- Deployment artifacts, helper output, and staging material used during updates.

Typical contents:
- Release bundles
- Temporary deployment state
- Build or rollout notes

Notes:
- Administrative area. Not general end-user content.
""",
    "docs": """# Docs

Purpose:
- Host-side operational notes and documentation.

Typical contents:
- Setup notes
- Service instructions
- Upgrade or maintenance references

Notes:
- Administrative area for the appliance operator.
""",
    "filebrowser": """# File Browser

Purpose:
- Persistent state for the File Browser service.

Typical contents:
- File Browser database
- Service configuration
- Session or application state

Notes:
- This is service state. The actual browsed files live elsewhere under /srv/trailer.
""",
    "https": """# HTTPS

Purpose:
- Certificate and HTTPS helper material stored outside the container.

Typical contents:
- Local certificates
- Trust/export files
- HTTPS helper state

Notes:
- Administrative/security data. Keep this durable across rebuilds.
""",
    "iiab": """# IIAB Residual Content

Purpose:
- Legacy-named storage retained only because OIAB still uses the ZIM library path here.

Typical contents:
- zims

Notes:
- This is not an active IIAB runtime tree anymore.
- OIAB still mounts /srv/trailer/iiab/zims for Kiwix/ZIM content.
""",
    "jellyfin": """# Jellyfin

Purpose:
- Persistent state for the Jellyfin service.

Typical contents:
- Service configuration
- Cache
- Metadata

Notes:
- Media files themselves typically live under /srv/trailer/media.
""",
    "komga": """# Komga

Purpose:
- Persistent state for the Komga service.

Typical contents:
- Service configuration
- Metadata and indexes

Notes:
- Book and comic content typically lives under /srv/trailer/media/books.
""",
    "media": """# Media

Purpose:
- Main user media library root.

Typical contents:
- Music
- Books
- Comics
- Other imported media

Notes:
- This is user content and is intended to survive rebuilds.
""",
    "migration_data": """# Migration Data

Purpose:
- Consolidated legacy IIAB-era files and application trees kept for reference or recovery.

Typical contents:
- Old maps-admin tree
- Old music-player tree
- Old system-monitor tree
- Previous IIAB snapshots

Notes:
- Not part of the active OIAB runtime.
- Kept only for audit, manual extraction, or one-off recovery.
""",
    "mindustry": """# Mindustry

Purpose:
- Persistent data related to Mindustry if used on this appliance.

Typical contents:
- Saves
- Server state
- Mods or configuration

Notes:
- Game-specific persistent storage.
""",
    "minecraft": """# Minecraft

Purpose:
- Persistent Minecraft server and related management data.

Typical contents:
- World data
- Server configuration
- Plugins or mods
- Admin tooling state

Notes:
- Critical persistent game state. Back up before large server changes.
""",
    "oiab": """# OIAB Source and Deployment

Purpose:
- Live OIAB source tree and deployment working copy on the host.

Typical contents:
- Docker compose files
- Backend/frontend source
- Scripts and deployment helpers

Notes:
- Administrative/deployment area, not end-user content.
""",
    "roms": """# ROMs

Purpose:
- User game ROM library for emulator services.

Typical contents:
- Console ROMs
- BIOS files if required
- Per-platform game content

Notes:
- User content. Keep this persistent and organized by platform.
""",
    "scripts": """# Scripts

Purpose:
- Host-side operational scripts and helpers.

Typical contents:
- Maintenance scripts
- Import/export helpers
- One-off admin tools

Notes:
- Administrative area for the operator.
""",
    "terraria": """# Terraria

Purpose:
- Persistent Terraria server or save data, if used.

Typical contents:
- World saves
- Server configuration
- Mods or related content

Notes:
- Game-specific persistent storage.
""",
    "wikis": """# Wikis

Purpose:
- Extracted or curated wiki content served directly by OIAB.

Typical contents:
- Standalone wiki exports
- Minecraft or Pokemon wiki content
- Other local web-readable knowledge bases

Notes:
- Distinct from ZIM libraries under /srv/trailer/iiab/zims.
""",
}


NESTED_READMES: dict[str, str] = {
    "data/oiab": """# OIAB Managed Data

Purpose:
- Durable OIAB application data.

Typical contents:
- oiab.sqlite
- maps/
- waypoints/
- tracks/
- media-derived caches
- service state mirrored under OIAB ownership

Notes:
- This is the primary persistent data root mounted into the OIAB container.
""",
    "media/books": """# Books

Purpose:
- User e-book and comic library root.

Typical contents:
- Ebooks
- Comics

Notes:
- Komga reads content from here through configured subdirectories.
""",
    "media/music": """# Music

Purpose:
- User music library.

Typical contents:
- MP3, FLAC, and other supported audio files
- Album folders

Notes:
- OIAB scans this library for local music playback and artwork extraction.
""",
    "iiab/zims": """# ZIM Library

Purpose:
- Offline ZIM archives still used by OIAB through Kiwix.

Typical contents:
- Wikipedia ZIMs
- Vikidia ZIMs
- Other packaged offline knowledge archives

Notes:
- The directory name is legacy, but the content is still active in OIAB.
""",
}


def write_readme(target: Path, content: str) -> None:
    target.mkdir(parents=True, exist_ok=True)
    (target / "README.md").write_text(content.rstrip() + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="/srv/trailer", help="Host storage root to document")
    args = parser.parse_args()

    root = Path(args.root)
    for name, content in README_MAP.items():
        directory = root / name
        if directory.is_dir():
            write_readme(directory, content)

    for relpath, content in NESTED_READMES.items():
        directory = root / relpath
        if directory.is_dir():
            write_readme(directory, content)

    print(f"Wrote storage README files under {root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
