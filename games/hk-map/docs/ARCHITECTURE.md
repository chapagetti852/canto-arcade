# 香港通 — architecture (brownfield)

The plan for turning 香港通 from a map with many modes into **one open-world game**: a fixed-zoom,
tile-based Hong Kong you walk around like Pokémon, where every activity is found in the world or
in one pause menu, and new areas open as you earn badges. Executed phase by phase with
`/phaser-dev`; every phase leaves a working, deployable game.

Decisions taken with the owner (2026-11-27): 1 tile = 30 m with a fixed camera; tiles in 香港通's own
code-drawn pixel style; the 20 levels become badges that open up areas; refactor first.

## 1. Current state (Nov 2026)

| Part | What it is |
|---|---|
| `src/app.js` (1,562 lines) + `src/mini.js` (270) | The whole game in one closure. `build/build.py` splices `mini.js` in, inlines subset pixel fonts into `index.html`, bumps the service-worker version. |
| Globals | `HK_DATA`, `HK_PHOTOS`, `HK_GAL`, `HK_AUDIO` (`js/data.js`, from `build/make_data.py`), `HK_ICONS` (`js/icons.js`), `Phaser`, `Tone`, `zzfx`, `confetti` (vendored scripts). |
| Scenes | One `MapScene`: the territory as one 2258×1664 picture (`img/map.png`, 30 m per pixel, world units are 60 m), markers, labels, MTR lines drawn as a schematic, particles, a vignette. |
| Modes | The `G` object (`app.js` ~942–1315): `boot`, `home`, `journey`, `level`, `pickRide`, tours/quizzes (`stopCard`, `qFind`, `end`), `practice`, `rush`, `roam`. Each mode calls `G.enter()` which clears the DOM UI and map effects; async work checks `G.alive(run)`. |
| UI | DOM overlay (`#hud`, `#sheet`, `#side`, `#center`, `#modal`, `#pad`, `#zoom`, Bāaujái) over the canvas. |
| State | One save object `ST`, localStorage key **`hkmapgame-v3`** (+ IndexedDB `hkmapgame`), merged with the gist sync and read by the arcade (`src/logic/hkmapAnki.ts`). |
| Assets | Committed in `public/games/hk-map/` (audio 4.1 MB, img, js). |

**Main sources of coupling:** module-wide mutable state (`ST`, `MAP`, `KEYS`, `factIt`, `DIR`, …)
read and written from everywhere; each mode owns the camera, rules and DOM; the map picture doubles
as the collision data (`isWater`, `isRoad` read its pixels).

## 2. Target shape

```
BootScene ──► MapScene (today's map; later the Town Map in the pause menu)
          └─► WorldScene (phase 1+: fixed-zoom tile world, the player, NPCs, places)
                 ├─ launches PauseMenu (DOM): 圖鑑, Town Map, practice, snacks, settings
                 └─ activities at places: lessons, quizzes, rush hour, MTR rides, mini-games
```

State: `ST` stays the single source of truth for progress (same key, same record shape: `items[k].s/l/y/m/days`,
`points`, `levels`, `sent`, …). New fields are added, never renamed. Badges = `ST.levels`.

## 3. Module structure (end of phase 0)

```
games/hk-map/
├── index.html                ← the page and its CSS; fonts inlined at build by a Vite plugin
├── public/                   ← audio/, img/, js/ (data.js, icons.js, tone.js, zzfx.js, confetti.js), sw.js, manifest
├── assets/fp.woff2           ← the subset pixel font (build/fonts.py)
├── build/                    ← make_data.py, fonts.py, render_map.py
├── src/
│   ├── main.js               ← start(): the Phaser game, the visual-viewport fix, the playtest hook
│   ├── core/       util ($, esc, pick, DATA/ITEMS…), anki (flag), state (ST, stars, points, ranks, missions), save (local, folder, gist sync)
│   ├── audio/      music (Tone.js tunes + ZzFX sfx), voice (clips, Azure, device voice)
│   ├── yale/       answer checking, tone typing
│   ├── ui/         dom (UI, KEYS, toasts, banners), bao, typing, fact, photos (galleries, lightbox, Wikipedia), modal, collection, settings
│   ├── map/        geo (district/area lookup, line bounds, ride stops)
│   ├── scenes/     MapScene
│   ├── game/       G: the modes
│   ├── world/      free-roam extras (neighbours, the cat, snacks) + the walking keys
│   └── minigames/  the four mini-games
└── docs/ARCHITECTURE.md
```

Shared values that several modules replace are written only through setters in their home module:
`setST` (core/state), `setKEYS` (ui/dom), `setFactIt` (ui/fact).

Built by Vite into `public/games/hk-map/` (git-ignored, like Canto Numbers), as `index.html` + `js/app.js`
so the service worker and the arcade's links stay as they are.

## 4. Phases

### Phase 0a — Vite workspace, ES module, same game
Status: [x] done (2026-11-27)

Scope: `games/hk-map` becomes an npm workspace (Vite). Static files move to `games/hk-map/public/`.
`app.js` + `mini.js` become one ES module (`src/main.js`) importing Phaser from npm (4.2.1, the
version vendored today). Fonts are still subset by Python and inlined into `index.html` at build.
No behaviour change.

| Exit condition | Playtest assertion | Kind |
|---|---|---|
| Every screen opens, no errors, at desktop and iPhone size | `playtest/back-button.mjs` + harness error checks pass | auto |
| Progress saved by the old build loads | seed `hkmapgame-v3` → `見過` count on home matches | auto |
| Arcade still finds the game and its Anki list | `playtest/games.mjs` passes | auto |
| Looks the same | before/after screenshots compared | human |

### Phase 0b — Split into modules
Status: [x] done (2026-11-27): 21 modules; the biggest are MapScene (483 lines) and G (396), to be split further as phases 1–3 replace them.

Scope: the one module split along its existing sections (layout above). Cross-module writes to shared
state go through small setters; no logic changes. A `window.__hk` hook stays for playtests.

| Exit condition | Playtest assertion | Kind |
|---|---|---|
| Same as 0a | all playtests pass | auto |
| No module over ~400 lines | line count check | auto |

### Phase 0c — TypeScript, module by module
Status: [~] started (2026-11-27): `src/types.ts` (data and save shapes), `globals.d.ts`, and strict TS for
`core/util`, `core/anki`, `core/state`, `map/geo`, `yale/yale`; unit tests for Yale checking and tone typing
(`tests/yale.test.ts`); `tsc` and the tests are part of `npm run verify`. The UI, map scene and modes stay JS
(`allowJs`) until phases 1–3 replace them; new code is TypeScript.

### Phase 1 — World prototype (Tsing Yi + Kwai Chung)
Status: [x] done — verified 2026-11-27 (`playtest/phase-1-world.mjs`, desktop and iPhone; `tests/grid.test.ts`)

Opened with `?world` (games/hk-map/?world); reads progress, never writes it. The whole territory is walkable,
not just Tsing Yi: the ground comes from the map picture, so there was no reason to stop at one district.

- **Ground**: `build/world.py` reads `public/img/map.png` back into one terrain class per 30 m cell
  (`public/img/world.png`, 22 classes: deep/shallow sea, sand, grass, woods, scrub, hilltop, farmland, town,
  industry, park, airport, runway, motorway, road, reservoir, fish ponds, the mainland, bridges, piers,
  containers). Vegetation takes its band from the height grid; the old map's 2-pixel dithers are smoothed
  with a 5×5 majority; road outlines are dropped so roads are as wide as their surface.
- **Tile art** (`src/overworld/tiles.ts`): painted per chunk (32×32 cells, 512 px) in a Web Worker,
  ~22 ms a chunk. Quarter-tile rounding (coasts, woods, fields), 45° corners on diagonal roads, seamless
  patterns (waves, tufts, bushes, tree crowns), town cells as blocks of buildings on a fixed street grid
  (a street every 4 cells across and 5 down; industry 7 × 6), pavements along roads.
- **Walking** (`src/overworld/grid.ts`): one cell per step, 6 cells/s (12 with Shift or on a long tapped
  route), arrow keys/WASD, an on-screen pad on touch screens, tap-to-walk (breadth-first path up to 40 cells).
  Water, the mainland, buildings and container stacks block.
  *Changed from the plan:* no Grid Engine. It needs a Phaser Tilemap, and a whole-territory Tilemap is 3.7 M
  tile objects; the ground here is baked chunk images, and grid stepping is ~80 lines with unit tests.
  Grid Engine stays an option for NPC movement later.
- **Camera**: fixed zoom, about 15 tiles along the shorter side, chosen so each tile pixel is a whole number
  of device pixels (sharp on a 3× iPhone).
- **Landmarks**: every station, sight and church on its cell (entrance / church / star sprites); standing
  within 2 cells shows its name (？？？ until met); Enter/Space/tap says it. District banners on entering.

| Exit condition | Playtest assertion | Kind |
|---|---|---|
| Start at Tsing Yi | player within 6 cells of cell (1052, 819) | auto ✓ |
| Fixed, sharp, zoomed-in camera | zoom × devicePixelRatio is whole; 11–20 tiles along the shorter side | auto ✓ |
| Walking moves whole cells | hold → 700 ms: 2–7 cells east, none sideways, standing exactly on a cell after | auto ✓ |
| Sea blocks walking | on a shore, hold → into the sea: same cell | auto ✓ |
| Landmark names | by Tsing Yi station, `near` is S:TSY | auto ✓ |
| Only nearby ground loaded | after a jump to Central, ≤ 49 chunks | auto ✓ |
| Chunk painting fast enough | median ≤ 400 ms (measured ~22 ms) | auto ✓ |
| Smooth on a phone | FPS while walking ≥ 25 headless (software rendering; measured 46 desktop, 60 iPhone) | auto ✓ |
| Reads as a game, not a map | — | human |
| Walking feels right on the phone (pad, tap-to-walk, speed) | — | human |

Known rough edges for phase 2: deep/shallow water boundary is scalloped; town blocks are a uniform grid
(no tower/estate variety yet); hills are uniform forest with no paths; MTR lines are not shown.

### Phase 2 — Stations, the Town Map, a more Hong Kong look
Status: [x] done — verified 2026-11-27 (`playtest/phase-2-world.mjs`, desktop and iPhone)

Scope (the whole territory is already walkable since phase 1):
- **Stations you walk into**: at a station you have met, Enter / Space / tapping it opens 搭港鐵: the other
  stations you have met; pick one, ride (fade, the line's colour), and come out on its doorstep.
- **Town Map** (M, or the HUD's 地圖 button): today's map picture with the MTR lines, every station (met
  ones bright), and where you are. The schematic belongs here, not under your feet.
- **Look**: smooth shallow/deep water; public-housing estate towers (the cross-shaped blocks) among the
  town blocks; tower blocks taller-looking than low-rise.

| Exit condition | Playtest assertion | Kind |
|---|---|---|
| Ride the MTR between met stations | by Tsing Yi, Enter → 搭港鐵 lists Central; choose it → within 3 cells of Central's station | auto ✓ |
| Unmet stations can't be ridden to | 搭港鐵 lists only met stations | auto ✓ |
| Town Map opens and shows you | M → the Town Map is open; your marker is at your cell; Esc closes it | auto ✓ |
| Hong Kong look | — | human |

Also done: diagonal roads drawn as even 45° bands (no staircases, no kerbs across the run); shallow vs deep
water by true distance from land; about one town block in five is a public-housing estate (two cross-shaped
towers on a plaza, with long shadows). Still to come: hill paths (needs trail data), MTR viaducts above ground.

### One site, one world (2026-11-27)
The open world is now the site's front page (no `?world` needed there; `games/hk-map/?world` still works), and
the Canto Arcade is a building in it by Tsing Yi station: Enter at its door goes to `arcade/`, and the arcade's
◀ 出街 brings you back to the street at its door (the world keeps where you stand in `hkmap-world-v1`). The HUD's
課 Lessons opens 香港通's lessons until phase 3 moves them into the world. Tested by `playtest/front-page.mjs`.

### Phase 3 — Modes move into the world (chapters & badges, practice, rush, rides, mini-games, 圖鑑)

Detailed when we reach them.

## 5. Phaser 4 notes
- `TilemapGPULayer` (`map.createLayer(..., true)`) draws a whole layer in one quad, up to 4096×4096 tiles,
  one tileset; the territory at 30 m is 2258×1664 tiles. Tile objects still cost memory, so the world is
  loaded in chunks.
- Canvas renderer is deprecated: WebGL only.
- `DynamicTexture`/`RenderTexture` need an explicit `render()`.
