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

## OpenStreetMap Data

Map packs based on OpenStreetMap data must preserve appropriate attribution:

```text
© OpenStreetMap contributors
```

## Noto Sans Glyph PBF Files

Maps v2 includes local glyph PBF files for Noto Sans Regular/Bold. Noto fonts are distributed under the SIL Open Font License. Verify generated glyph packaging before release.

## chess.js

The mobile chess game includes `frontend/mobile/vendor/chess.js` and its license file.

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

