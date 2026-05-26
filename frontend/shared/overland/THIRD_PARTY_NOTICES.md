# Third-Party Notices

## Particula

The Overland music visualizer includes a local canvas visualizer named
"Particula Sphere" inspired by the MIT-licensed Particula project:

- Project: https://github.com/Humprt/particula
- License: MIT
- Copyright: Copyright (c) 2025 Humprt

The implementation in `overland-music.js` is adapted for IIAB Overland as a
local, offline, Pi-friendly 2D canvas renderer. It does not import Particula's
standalone application, CDN dependencies, audio controls, or GUI.

## audioMotion-analyzer

The Overland music visualizer includes local spectrum-analyzer visualizer modes
inspired by audioMotion-analyzer:

- Project: https://github.com/hvianna/audioMotion-analyzer
- License: AGPL-3.0-or-later

No audioMotion-analyzer source code is bundled, copied, imported, or linked.
The local Overland implementation uses the browser Web Audio API and canvas
rendering written specifically for this project.

## EmulatorJS

The optional Overland web emulator shell is designed to use a locally cached
EmulatorJS runtime installed outside this repository:

- Project: https://github.com/EmulatorJS/EmulatorJS
- CDN/runtime source: https://cdn.emulatorjs.org/stable/data/

The IIAB Overland repository does not commit EmulatorJS runtime files or
libretro core data. `overland-install-emulatorjs` downloads those assets onto
the OIAB data directory under `OIAB_DATA_DIR/games/emulatorjs/data/` so they can be used offline.

## chess.js

The mobile Chess app vendors chess.js for local, offline chess move generation
and rule handling:

- Project: https://github.com/jhlywa/chess.js
- Package: chess.js 1.4.0
- License: BSD-2-Clause

The vendored browser module is stored at `mobile-shell/frontend/vendor/chess.js`
with its license at `mobile-shell/frontend/vendor/chess-js-LICENSE`.

## MapLibre GL JS

Overland Maps v2 vendors MapLibre GL JS for local vector map rendering:

- Project: https://github.com/maplibre/maplibre-gl-js
- Package: MapLibre GL JS 5.5.0
- License: BSD-3-Clause

The vendored browser files are stored under
`overland-maps-v2/frontend/vendor/`.

## PMTiles JavaScript

Overland Maps v2 vendors PMTiles JavaScript support so local `.pmtiles`
archives can be read directly by MapLibre without an external tile server:

- Project: https://github.com/protomaps/PMTiles
- Package: PMTiles 4.3.0
- License: BSD-3-Clause

The vendored browser file is stored at
`overland-maps-v2/frontend/vendor/pmtiles.js`.

## Noto Sans Glyph PBFs

Overland Maps v2 includes a minimal offline MapLibre glyph set for common Latin
labels:

- Font: Noto Sans
- License: SIL Open Font License 1.1
- Source project: https://fonts.google.com/noto/specimen/Noto+Sans

The generated glyph PBF files are stored under
`overland-maps-v2/frontend/fonts/`.
