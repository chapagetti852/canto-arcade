// 香港通 keeps your progress: a save from any earlier build (key hkmapgame-v3) loads, shows on the home
// screen, and is written back under the same key. Guards the move to a Vite/TypeScript build.
const frame = `document.getElementById('game-frame')`;
const SAVE = { v: 3, items: { 'S:TSY': { s: '2026-11-01', l: 2, y: 2, days: ['2026-11-01', '2026-11-02'], m: '2026-11-02' }, 'S:ADM': { s: '2026-11-02' }, 'S:TST': { s: '2026-11-03' } }, points: { '2026-11-02': 250 }, flags: { intro: 1 }, levels: {}, sent: {} };

export default [
  { name: 'arcade room opens', action: 'waitFor', expression: `game.scene.isActive('ArcadeScene')`, timeout: 10000 },
  {
    name: 'an old save, then open 香港通',
    action: 'eval',
    code: `localStorage.setItem('hkmapgame-v3', ${JSON.stringify(JSON.stringify(SAVE))});
      const f = document.createElement('iframe'); f.id = 'game-frame'; f.src = 'games/hk-map/';
      f.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:99999';
      document.body.appendChild(f);`,
  },
  { name: 'splash shows', action: 'waitFor', expression: `(() => { try { const s = ${frame}.contentDocument.querySelector('#splash'); return !!s && !s.hidden; } catch (e) { return false; } })()`, timeout: 20000 },
  { name: 'tap the splash', action: 'eval', code: `${frame}.contentDocument.querySelector('#splash').click()` },
  { name: 'home shows', action: 'waitFor', expression: `!!${frame}.contentDocument.querySelector('#center .home')`, timeout: 5000 },
  { name: 'rank from the saved points', action: 'expect', expect: { expression: `${frame}.contentDocument.querySelector('#center .lnk').textContent`, contains: '街坊' } },
  { name: 'practice counts the 2 met-but-not-mastered places', action: 'expect', expect: { expression: `${frame}.contentDocument.querySelector('#center [data-a=practice]').textContent.trim()`, contains: '· 2' } },
  { name: 'into free roam (arriving in Kwai Tsing meets the district)', action: 'eval', code: `${frame}.contentDocument.querySelector('#center [data-a=roam]').click()` },
  { name: 'roam settles', action: 'wait', ms: 1500 },
  { name: '見過 4/244: the 3 saved places + Kwai Tsing', action: 'expect', expect: { expression: `${frame}.contentDocument.querySelector('#rd').textContent`, equals: '見過 4/244' } },
  { name: 'the save is still under its key, records intact', action: 'expect', expect: { expression: `(() => { const o = JSON.parse(localStorage.getItem('hkmapgame-v3')); return o.v + ' ' + o.items['S:TSY'].m + ' ' + Object.keys(o.items).length; })()`, equals: '3 2026-11-02 4' } },
  { name: 'close the frame', action: 'eval', code: `${frame}.remove()` },
];
