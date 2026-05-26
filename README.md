# Overland In A Box

Overland In A Box (OIAB) is a standalone offline-first overlanding web platform. It is extracted from the earlier IIAB Overland work, but this repository is not an Internet-in-a-Box module and does not require IIAB, IIAB Ansible roles, `/opt/iiab`, `/library`, or `/etc/iiab`.

The base install is intentionally lean:

- responsive Overland shell UI
- Maps v2 with MapLibre, PMTiles, and local map-pack registry
- USB GPS/gpsd location endpoint with stabilized location output
- waypoints, folders, current track display stubs, and quick waypoint save
- persistent music player and local music scanner
- file/static upload data layout
- local games launcher and score/open-game storage foundation
- optional service manager framework
- certificate and hostname configuration docs/scripts

Optional services such as Jellyfin, Komga, Kiwix/Wikipedia, and Minecraft are represented as managed service manifests. They are not installed by default.

## Quick Start

```bash
cd /path/to/oiab_src
cp config/oiab.env.example config/oiab.env
scripts/dev.sh
```

Then open:

```text
http://localhost:8080/
```

The default production hostname is configurable and defaults to:

```text
overland.daemonadventures.net
```

## Data Directory

By default, runtime data lives under:

```text
/data/oiab
```

For local development, override it:

```bash
export OIAB_DATA_DIR="$PWD/data"
scripts/dev.sh
```

## Map Packs

Maps are core to OIAB, but map data is not committed to git.

Default expected PMTiles path:

```text
/data/oiab/maps/packs/protomaps-conus.pmtiles
```

The registry is configurable through `OIAB_MAP_PACK_REGISTRY` and defaults to:

```text
/data/oiab/maps/registry.json
```

If no PMTiles pack is present, `/maps-v2/` shows a friendly missing-pack state instead of crashing.

## Current Status

This is the first standalone extraction pass. It is runnable, but intentionally preserves several compatibility aliases while we migrate individual apps away from legacy naming and API shapes.

See:

- [Architecture](ARCHITECTURE.md)
- [Migration Notes](MIGRATION.md)
- [Data Layout](DATA_LAYOUT.md)
- [TODO](TODO.md)
- [Third Party Notices](THIRD_PARTY_NOTICES.md)

