# Canto Arcade (廣東話機舖 Gwóngdūngwá Gēipou)

Cantonese learning games in one place: a Phaser 4 arcade room you walk around; each machine opens one game. Live at https://chapagetti852.github.io/canto-arcade/ (GitHub Pages, deployed by `.github/workflows/deploy-pages.yml` on every push to `main`, after `npm run verify` passes).

**Course context lives in the private repo `chapagetti852/canto-course`** — read its `CLAUDE.md` before any Cantonese content work (Yale only, CLA spellings, lenient answer checking, the owner's Anki setup, the textbook transcriptions). Attach it to the session if it isn't there.

## Hard rules
- Yale with tone marks only; never Jyutping, Mandarin or simplified characters.
- This repo is **public** and classmates may play: no Anki data, Azure key, GitHub token or textbook text in it. Secrets live only in the owner's browser (localStorage). Anki features appear only in the private Anki mode. Nothing in the games may refer to the owner personally (no "your parish", names, or home): classmates may play.
- Never break saved progress: games keep their saves in the browser under fixed keys (`hkmapgame-v3` + IndexedDB `hkmapgame` for 香港通, `canto-numbers-v1` for Canto Numbers, `canto-arcade-v1` for the room). The whole site shares one origin, so moving files around is safe; renaming a key is not.

## Layout
| Path | What |
|---|---|
| `src/` | The arcade (TypeScript, Phaser 4.2, from the phaser-init scaffold). `scenes/ArcadeScene.ts` is the room; `logic/machines.ts` lists the machines (add a game = one entry); `logic/progress.ts` reads each game's save to show progress on its machine. |
| `games/hk-map/` | 香港通, the HK map game (an npm workspace, Vite). Code in `src/`, static files (audio, img, data) in `public/`, plan in `docs/ARCHITECTURE.md`. Built into `public/games/hk-map/` (git-ignored) by `npm run build:games`. `npm run hkmap` (Python 3 + fontTools) regenerates its data and pixel font after data or text changes. `build/render_map.py` (the map picture) also needs big external inputs not kept here; see `games/hk-map/README.md`. |
| `games/canto-numbers/` | Canto Numbers (TypeScript/Phaser, an npm workspace). Built into `public/games/canto-numbers/` by `npm run build:games` (part of `npm run build`; that folder is git-ignored). |
| `playtest/` | Browser scenarios run by `npm run verify` — each feature gets one. |
| `tools/subset-zh.py` | Rebuilds the 12px pixel font (Fusion Pixel, OFL) for every character used in `src/`. Run `npm run font` after adding Chinese or Yale text to the arcade. |

## Commands
- `npm run dev` — the arcade with hot reload (run `npm run build:games` once first so both games exist). `npm run dev -w games/hk-map` runs 香港通 on its own.
- `npm run verify` — typecheck + unit tests (arcade, Canto Numbers, 香港通) + production-build playtests (desktop, and the back-button check at iPhone size). The deploy gate.
- In a sandbox without Playwright's own browser: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/*/chrome-headless-shell | head -1) npm run verify`.

## Anki (private Anki mode)
Every game except Canto Numbers is built around the first learning of Anki cards: cards start suspended; the game teaches them; learned cards are unsuspended and made due today. See `canto-course/CLAUDE.md`.
- **Anki mode** is per browser: `?anki` turns it on (`?anki=off` off); flags `canto-anki` / `hkmap-anki` (shared with 香港通). Only then does the arcade show the Anki light (top right) and run `ArcadeScene.ankiRound()` on every visit.
- **Sync** (`src/shared/gist.ts`): the owner's secret gist, token in this browser only (`hkmap-sync`, set up once in 香港通 → Settings). Files: `hkmap-progress.json` (map; same merge as the map game, `settings` never uploaded), `canto-numbers.json` (best scores), `canto-arcade.json` (visits). Merges in `src/logic/sync.ts`.
- **AnkiConnect** (`src/shared/anki.ts`): `http://127.0.0.1:8765`, from desktop Chrome on the owner's Mac (`https://chapagetti852.github.io` is in its `webCorsOriginList`). The CSP in `vite.config.ts` allows it and `api.github.com`.
- **香港通 → Anki** (`src/shared/ankiLink.ts`, rules in `src/logic/hkmapAnki.ts`, item list `games/hk-map/public/js/anki-items.json` from `make_data.py`): learned-but-unsent places → `findCards "(<query>) is:suspended"` → `unsuspend` + `setDueDate 0` → marked in the map save's `sent` → synced back up. Only suspended cards are ever touched. Played on the phone = waits in the save until the arcade next runs on the Mac with Anki open.
- **New games** should follow the same shape: learned items recorded in the game's own save, a "ready" rule, and a send step in `ankiRound()`.
- **Card snapshot**: the Anki panel's "Export card snapshot" downloads every Cantonese note (fields as text, tags, decks, card states) for `canto-course/anki/`.
- `playtest/anki.mjs` covers all of this with a stand-in AnkiConnect and gist installed in the page.

## Working style
- New games' Anki cards are prepared (and suspended) in the owner's claude.ai "Cantonese Learning" project, which can reach the owner's Mac; cloud sessions work from `canto-course/anki/anki-snapshot-*.json` and test Anki with stand-ins.
Use the phaser4-gamedev skills (phaser-coder, phaser-scene, phaser-ui, phaser-playtest, …). Verify in the browser before reporting done. Keep replies to the owner concise and simple.
