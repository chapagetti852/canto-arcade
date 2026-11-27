# Canto Arcade (廣東話機舖 Gwóngdūngwá Gēipou)

Joseph's Cantonese learning games in one place: a Phaser 4 arcade room you walk around; each machine opens one of his games. Live at https://chapagetti852.github.io/canto-arcade/ (GitHub Pages, deployed by `.github/workflows/deploy-pages.yml` on every push to `main`, after `npm run verify` passes).

**Course context lives in the private repo `chapagetti852/canto-course`** — read its `CLAUDE.md` before any Cantonese content work (Yale only, CLA spellings, lenient answer checking, his Anki setup, the textbook transcriptions). Attach it to the session if it isn't there.

## Hard rules
- Yale with tone marks only; never Jyutping, Mandarin or simplified characters.
- This repo is **public** and classmates may play: no Anki data, Azure key, GitHub token or textbook text in it. Secrets live only in Joseph's browser (localStorage). Anki features appear only in his private Anki mode.
- Never break saved progress: games keep their saves in the browser under fixed keys (`hkmapgame-v3` + IndexedDB `hkmapgame` for 香港通, `canto-numbers-v1` for Canto Numbers, `canto-arcade-v1` for the room). The whole site shares one origin, so moving files around is safe; renaming a key is not.

## Layout
| Path | What |
|---|---|
| `src/` | The arcade (TypeScript, Phaser 4.2, from the phaser-init scaffold). `scenes/ArcadeScene.ts` is the room; `logic/machines.ts` lists the machines (add a game = one entry); `logic/progress.ts` reads each game's save to show progress on its machine. |
| `public/games/hk-map/` | 香港通, the built HK map game (static files, committed). |
| `games/hk-map/` | Its source (`src/app.js`, `src/mini.js`, `src/index.html`), build scripts and inputs. Rebuild with `npm run hkmap` (Python 3 + fontTools), which writes into `public/games/hk-map/`. `build/render_map.py` (the map picture) also needs big external inputs not kept here; see `games/hk-map/README.md`. |
| `games/canto-numbers/` | Canto Numbers (TypeScript/Phaser, an npm workspace). Built into `public/games/canto-numbers/` by `npm run build:games` (part of `npm run build`; that folder is git-ignored). |
| `playtest/` | Browser scenarios run by `npm run verify` — each feature gets one. |
| `tools/subset-zh.py` | Rebuilds the 12px pixel font (Fusion Pixel, OFL) for every character used in `src/`. Run `npm run font` after adding Chinese or Yale text to the arcade. |

## Commands
- `npm run dev` — the arcade with hot reload (run `npm run build:games` once first so Canto Numbers exists).
- `npm run verify` — typecheck + unit tests (arcade and Canto Numbers) + production-build playtest. The deploy gate.
- In a sandbox without Playwright's own browser: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/*/chrome-headless-shell | head -1) npm run verify`.

## The Anki principle (games to come)
Every game except Canto Numbers is built around the first learning of Anki cards: cards start suspended; the game teaches them; learned cards are unsuspended (due today) via AnkiConnect from desktop Chrome, or queued on the phone and applied later. See `canto-course/CLAUDE.md`.

## Working style
Use the phaser4-gamedev skills (phaser-coder, phaser-scene, phaser-ui, phaser-playtest, …). Verify in the browser before reporting done. Keep replies to Joseph concise and simple.
