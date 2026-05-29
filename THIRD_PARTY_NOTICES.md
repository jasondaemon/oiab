# Third Party Notices

This file tracks third-party components and content used or prepared for OIAB. It should be updated whenever dependencies/assets are added.

## MapLibre GL JS

Maps v2 includes local MapLibre GL JS/CSS assets under `frontend/maps/vendor/`.

- Project: https://maplibre.org/
- License: BSD-style license. Verify exact bundled version/license before release packaging.

## PMTiles / Protomaps

Maps v2 includes PMTiles protocol support under `frontend/maps/vendor/`.

- Project: https://github.com/protomaps/PMTiles
- License: BSD-style license. Verify exact bundled version/license before release packaging.

## maps.black / maps.black Concepts

Maps v2 was prototyped from the direction of maps.black / MapLibre / Protomaps-style rendering concepts. Any copied code/assets must retain their upstream license. Current OIAB work should prefer original code/assets and documented third-party library use.

- Upstream repository inspected locally: `maps-black-upstream`
- Upstream license file: MIT License
- Copied notice: `licenses/maps-black-MIT-LICENSE.md`
- Raster Natural Earth assets in that upstream include separate CC0 license files.

## Legacy IIAB / maps.black Visual Assets

OIAB may temporarily incorporate license-compatible map styling ideas, sprites, CSS, or symbols from the earlier IIAB/maps.black-derived map runtime while Maps v2 matures. Keep these assets segregated under legacy map asset folders and document exact provenance before public release.

Current original OIAB map icons live under:

```text
frontend/maps/icons
```

Current legacy imports:

- `frontend/maps/map-style.json` is derived from `maps-black-upstream/styles/naturalearth-protomaps/protomaps/light/style.json`.
- `frontend/maps/sprites/legacy/protomaps-light/` contains the corresponding Protomaps light sprite JSON/PNG assets from maps.black upstream.
- `frontend/maps/styles/legacy/protomaps-light/` contains the upstream `LICENSE.txt` and `SOURCE.txt` files for that style.

Legacy imports should live under:

```text
frontend/maps/icons/legacy
frontend/maps/sprites/legacy
frontend/maps/styles/legacy
```

Future original replacements should live under:

```text
frontend/maps/icons/oiab
frontend/maps/sprites/oiab
frontend/maps/styles/oiab
```

## OpenStreetMap Data

Map packs based on OpenStreetMap data must preserve appropriate attribution:

```text
© OpenStreetMap contributors
```

## Noto Sans Glyph PBF Files

Maps v2 includes local glyph PBF files for Noto Sans Regular/Bold. Noto fonts are distributed under the SIL Open Font License. Verify generated glyph packaging before release.

## chess.js

The mobile chess game includes `frontend/mobile/vendor/chess.js` and its license file.

## Particula-Inspired Visualizer

The music visualizer includes an original local canvas mode inspired by the MIT-licensed Particula project:

- Project: https://github.com/Humprt/particula
- License: MIT

No third-party runtime dependency is loaded at playback time.

## audioMotion-analyzer-Inspired Visualizer

Some local canvas spectrum visualizer modes are inspired by audioMotion-analyzer concepts:

- Project: https://github.com/hvianna/audioMotion-analyzer
- License: AGPL-3.0-or-later

No audioMotion-analyzer source code is bundled, copied, imported, or linked.

## EmulatorJS

The optional emulator shell is designed to use a locally cached EmulatorJS runtime installed outside this repository. Emulator runtime files, libretro cores, and ROMs are not committed.

## File Browser

File Browser is a core managed component for browsing and uploading OIAB media, maps, books, ROMs, and backups on the local appliance.

- Project: https://filebrowser.org/
- Source: https://github.com/filebrowser/filebrowser
- License: Apache-2.0

## Jellyfin

Jellyfin is represented as an optional managed service.

- Project: https://jellyfin.org/
- License: GPLv2

## Komga

Komga is represented as an optional managed service.

- Project: https://komga.org/
- License: MIT

## Kiwix

Kiwix is represented as an optional managed service.

- Project: https://www.kiwix.org/

## Game And Music Assets

Some copied frontend game/audio assets came from prior local OIAB/Overland work. Before public release, confirm provenance/license for:

- `frontend/mobile/blockfall-sounds/*`
- `frontend/shared/overland/drums/*`
- game SVG icons under `frontend/shared/overland/`
