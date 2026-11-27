# 香港通 — architecture (brownfield)

The plan for turning 香港通 from a map with many modes into **one open-world game**: a fixed-zoom,
tile-based Hong Kong you walk around like Pokémon, where every activity is found in the world or
in one pause menu, and new areas open as you earn badges. Executed phase by phase with
`/phaser-dev`; every phase leaves a working, deployable game.

Decisions taken with Joseph (2026-11-27): 1 tile = 30 m with a fixed camera; tiles in 香港通's own
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
├── index.html                ← template; fonts inlined at build by a Vite plugin
├── public/                   ← audio/, img/, js/ (data.js, icons.js, tone.js, zzfx.js, confetti.js), sw.js, manifest
├── build/                    ← make_data.py, fonts.py (subset), render_map.py
├── src/
│   ├── main.js               ← start(): Phaser game, boot
│   ├── core/       state, save & sync, anki flag, points/ranks/missions, util ($, esc, pick…)
│   ├── audio/      music (Tone.js), sfx (ZzFX), voice (clips, Azure, device voice)
│   ├── yale/       answer checking, tone typing
│   ├── ui/         dom helpers, Bāaujái, typing panel, fact card, photos & lightbox, modal, collection, settings
│   ├── scenes/     MapScene
│   ├── game/       G: the modes
│   ├── world/      free-roam extras (neighbours, cat, snacks)
│   └── minigames/  the four mini-games
└── docs/ARCHITECTURE.md
```

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
Status: [ ] todo

Scope: the one module split along its existing sections (layout above). Cross-module writes to shared
state go through small setters; no logic changes. A `window.__hk` hook stays for playtests.

| Exit condition | Playtest assertion | Kind |
|---|---|---|
| Same as 0a | all playtests pass | auto |
| No module over ~400 lines | line count check | auto |

### Phase 0c — TypeScript, module by module
Status: [ ] todo

Scope: rename modules to `.ts` one at a time with real types for the save (`SaveState`), items,
levels and the scene. `tsc --noEmit` joins `npm run verify`.

### Phase 1 — World prototype (Tsing Yi + Kwai Chung)
Status: [ ] todo

Scope: a `WorldScene` with 16 px tiles at 30 m, built from the map data as autotiles (sea, coast,
hills, urban blocks, roads, parks, reservoirs), loaded in chunks; fixed camera (~25 tiles across on a
phone, ~40 on a computer); the player walks tile by tile (Grid Engine); landmarks as sprites.

| Exit condition | Playtest assertion | Kind |
|---|---|---|
| Walking moves one tile per step | after `hold ArrowRight` the player's tile x increases | auto |
| Sea blocks walking | walking into the harbour leaves the tile unchanged | auto |
| Smooth on a phone | FPS ≥ 50 in `--device iphone` while walking | auto |
| Reads as a game, not a map | — | human |

### Phase 2 — The whole territory, stations, Town Map
### Phase 3 — Modes move into the world (chapters & badges, practice, rush, rides, mini-games, 圖鑑)

Detailed when we reach them.

## 5. Phaser 4 notes
- `TilemapGPULayer` (`map.createLayer(..., true)`) draws a whole layer in one quad, up to 4096×4096 tiles,
  one tileset; the territory at 30 m is 2258×1664 tiles. Tile objects still cost memory, so the world is
  loaded in chunks.
- Canvas renderer is deprecated: WebGL only.
- `DynamicTexture`/`RenderTexture` need an explicit `render()`.
