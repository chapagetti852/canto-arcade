# 香港通 Hēunggóng Tūng — source

The built game is in `../../public/games/hk-map/` (what the arcade serves). This folder rebuilds it.

- `src/` — `index.html` (template; fonts are inlined at build), `app.js` (the game), `mini.js` (mini-games, spliced into app.js).
- `build/make_data.py` — `data/data4.json` + `data/photos4.json` + `build/*.json` → `js/data.js`, `js/icons.js`.
- `build/build.py` — subsets the pixel fonts (`vendor/font-zh`, Fusion Pixel 12px, OFL; `vendor/fp2.woff2`) for the characters in use, writes `index.html` and `js/app.js`, bumps the service-worker cache version.
- Run both: `npm run hkmap` from the repo root.
- `build/render_map.py` — redraws `img/map.png`, `img/areas.png`, `img/cn.png` and the ferry piers/routes (`build/ferries.json`). Needs inputs too big for the repo: the iB5000 coastline GeoJSON (aknopla/hk-terrestrial-geojson) and land/China masks; point `HKMAP_EXTERNAL` at a folder holding `hk-terrestrial-geojson/` and `geo/`. Rarely needed — the map picture is committed.
- Audio clips live in `public/games/hk-map/audio/` (Azure zh-HK; `hkmap_<key>.mp3` names, `ph_<hash>.mp3` voice lines). New lines are recorded from the game's Settings in Joseph's Anki mode.
- More background: `canto-course/games/hk-map-game-notes.md`.
