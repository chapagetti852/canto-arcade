// 香港通 phase 1 (games/hk-map/docs/ARCHITECTURE.md): the open world prototype at ?world.
// You start at Tsing Yi, walk one 30 m tile per step with the arrow keys, the sea stops you, the camera
// keeps a fixed, pixel-sharp zoom (about 15 tiles along the shorter side), standing by a landmark shows its name, and only the ground near you
// stays loaded. Teleports (eval) only set up a spot; the walking itself is real key presses.
const frame = `document.getElementById('game-frame')`;
const W = `${frame}.contentWindow.__hkWorld()`;
/** page-side: move the player to a cell (setup only) */
const put = (x, y) => `{ const w0 = ${W}, nx = ${x}, ny = ${y}; w0.route = []; w0.px = nx; w0.py = ny; w0.player.setPosition(...w0.cellCenter(nx, ny)); w0.loadChunks(); }`;

export default [
  { name: 'arcade room opens', action: 'waitFor', expression: `game.scene.isActive('ArcadeScene')`, timeout: 10000 },
  {
    name: 'open 香港通 with ?world',
    action: 'eval',
    code: `const f = document.createElement('iframe'); f.id = 'game-frame'; f.src = 'games/hk-map/?world';
      f.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:99999';
      document.body.appendChild(f);`,
  },
  { name: 'the ground around you is drawn', action: 'waitFor', expression: `(() => { try { return ${W}.ready; } catch (e) { return false; } })()`, timeout: 30000 },
  { name: 'you start at Tsing Yi station (cell 1052, 819)', action: 'expect', expect: { expression: `Math.abs(${W}.px - 1052) + Math.abs(${W}.py - 819) <= 6`, equals: true } },
  { name: 'sharp pixels: each tile pixel is a whole number of screen pixels', action: 'expect', expect: { expression: `(() => { const z = ${W}.cameras.main.zoom * ${frame}.contentWindow.devicePixelRatio; return Math.abs(z - Math.round(z)) < 1e-6; })()`, equals: true } },
  { name: 'zoomed in like Pokémon: 11–20 tiles along the shorter side', action: 'expect', expect: { expression: `(() => { const s = ${W}, n = Math.min(s.scale.width, s.scale.height) / (16 * s.cameras.main.zoom); return n >= 11 && n <= 20; })()`, equals: true } },
  { name: 'standing by Tsing Yi station shows its name', action: 'expect', expect: { expression: `${W}.near && ${W}.near.k`, equals: 'S:TSY' } },
  { name: 'iframe has the keyboard', action: 'eval', code: `${frame}.contentWindow.focus()` },

  // walking: find an open stretch near the start (setup), then hold → for real
  {
    name: 'set up: an open stretch of 8 cells eastward near Tsing Yi',
    action: 'eval',
    code: `const s = ${W}, g = s.grid; let spot = null;
      for (let r = 0; r < 40 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = 1052 + dx, y = 819 + dy; let ok = true; for (let k = 0; k <= 8; k++) if (!g.canStand(x + k, y)) { ok = false; break; }
        if (ok) { spot = [x, y]; break; } }
      window.__spot = spot; ${put('spot[0]', 'spot[1]')}`,
  },
  { name: 'settle', action: 'wait', ms: 500 },
  { name: 'hold → for 700 ms', action: 'key', key: 'ArrowRight', duration: 700 },
  { name: 'stop', action: 'wait', ms: 500 },
  { name: 'walked east 2–7 whole cells', action: 'expect', expect: { expression: `(() => { const d = ${W}.px - window.__spot[0]; return d >= 2 && d <= 7; })()`, equals: true } },
  { name: '…and not sideways', action: 'expect', expect: { expression: `${W}.py - window.__spot[1]`, equals: 0 } },
  { name: 'standing exactly on a cell when stopped', action: 'expect', expect: { expression: `(() => { const s = ${W}, [x, y] = s.cellCenter(s.px, s.py); return !s.moving && s.player.x === x && s.player.y === y; })()`, equals: true } },

  // the sea blocks
  {
    name: 'set up: on the shore with the sea to the east',
    action: 'eval',
    code: `const s = ${W}, g = s.grid; let spot = null;
      for (let r = 0; r < 60 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = 1052 + dx, y = 819 + dy; if (g.canStand(x, y) && [0, 1, 2].includes(g.at(x + 1, y)) && [0, 1, 2].includes(g.at(x + 3, y))) { spot = [x, y]; break; } }
      window.__shore = spot; ${put('spot[0]', 'spot[1]')}`,
  },
  { name: 'settle on the shore', action: 'wait', ms: 500 },
  { name: 'walk into the sea (hold →)', action: 'key', key: 'ArrowRight', duration: 600 },
  { name: 'still on the shore', action: 'expect', expect: { expression: `${W}.px === window.__shore[0] && ${W}.py === window.__shore[1]`, equals: true } },

  // smooth enough, and only nearby ground in memory
  { name: 'walk west for a while', action: 'key', key: 'ArrowLeft', duration: 1500 },
  { name: 'frame rate while walking (headless, software-rendered)', action: 'sample', expression: `${frame}.contentWindow.__hkWorld().game.loop.actualFps`, duration: 1500, interval: 250, expect: { stat: 'mean', atLeast: 25 } },
  { name: 'jump to Central (setup)', action: 'eval', code: `const c = ${W}.grid.nearestStandable(1225, 1103); ${put('c[0]', 'c[1]')}` },
  { name: 'let Central load', action: 'waitFor', expression: `(() => { const s = ${W}; return s.chunks.has(Math.floor(s.px / 32) + ',' + Math.floor(s.py / 32)); })()`, timeout: 15000 },
  { name: 'only the ground near you stays loaded (≤ 49 chunks)', action: 'expect', expect: { expression: `${W}.chunks.size`, atMost: 49 } },
  { name: 'chunk painting time (median ms, worker)', action: 'expect', expect: { expression: `(() => { const a = [...${W}.paintMs].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; })()`, atMost: 400 } },
  { name: 'Central', action: 'screenshot' },
  { name: 'close the frame', action: 'eval', code: `${frame}.remove()` },
];
