# 香港通 Hēunggóng Tūng — source

An npm workspace built with Vite into `../../public/games/hk-map/` (what the arcade serves; git-ignored) by the root `npm run build:games`. The plan for turning it into one open-world game is in `docs/ARCHITECTURE.md`.

- `index.html` — the page and all its CSS. `__FONT__`/`__FONT2__` are replaced at build by the inlined pixel fonts (`vite.config.ts`).
- `src/` — the game as ES modules (Phaser from npm); the layout is in `docs/ARCHITECTURE.md`.
- `public/` — static files copied as they are: `audio/`, `img/`, `js/data.js` + `js/icons.js` (generated), vendored `js/tone.js`, `js/zzfx.js`, `js/confetti.js`, `sw.js` (`__BUILD__` becomes the build version), the manifest.
- `build/make_data.py` — `data/data4.json` + `data/photos4.json` + `build/*.json` → `public/js/data.js`, `public/js/icons.js`, `public/js/anki-items.json`.
- `build/fonts.py` — subsets the pixel fonts (`vendor/font-zh`, Fusion Pixel 12px, OFL) to the characters in use → `assets/fp.woff2` (committed; `vendor/fp2.woff2` is the second font).
- Run both: `npm run hkmap` from the repo root (Python 3 + fontTools), after changing data or adding Chinese/Yale text.
- `build/render_map.py` — redraws `public/img/map.png`, `areas.png`, `cn.png` and the ferry piers/routes (`build/ferries.json`). Needs inputs too big for the repo: the iB5000 coastline GeoJSON (aknopla/hk-terrestrial-geojson) and land/China masks; point `HKMAP_EXTERNAL` at a folder holding `hk-terrestrial-geojson/` and `geo/`. Rarely needed — the map picture is committed.
- Audio clips live in `public/audio/` (Azure zh-HK; `hkmap_<key>.mp3` names, `ph_<hash>.mp3` voice lines). New lines are recorded from the game's Settings in Joseph's Anki mode.
- `npm run dev -w games/hk-map` runs the game on its own (port 5174). Vite warns that the classic `js/*.js` scripts "can't be bundled": that is expected, they are loaded as they are.
- More background: `canto-course/games/hk-map-game-notes.md`.
