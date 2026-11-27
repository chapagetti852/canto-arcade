// The site is one world, Canto Town: its front page is 香港通's open world, the Canto Arcade is a building in it
// (by Tsing Yi station), and leaving the arcade puts you back on the street at its door.
// Runs from the arcade page (arcade/), opening the front page (../) in a full-window frame.
const frame = `document.getElementById('game-frame')`;
const FW = `${frame}.contentWindow`;
const W = `${FW}.__hkWorld()`;

export default [
  { name: 'arcade room opens', action: 'waitFor', expression: `game.scene.isActive('ArcadeScene')`, timeout: 10000 },
  {
    name: 'the front page, its offline worker, its icons (every format) and manifest',
    action: 'eval',
    code: `Promise.all(['../', '../sw.js', '../manifest.webmanifest', '../favicon.ico', '../favicon.svg', '../favicon.png', '../apple-touch-icon.png', '../icon-192.png', '../icon-512.png', '../icon-maskable-512.png'].map(u => fetch(u).then(async r => [r.status, u === '../' ? await r.text() : ''])))
      .then(rs => { window.__front = rs[0][1]; window.__status = rs.map(r => r[0]).join(','); });`,
  },
  { name: 'fetched', action: 'waitFor', expression: `!!window.__status`, timeout: 5000 },
  { name: 'all there', action: 'expect', expect: { expression: `window.__status`, equals: '200,200,200,200,200,200,200,200,200,200' } },
  { name: 'the front page is the open world, named Canto Town on the home screen', action: 'expect', expect: { expression: `window.__front.includes('<base href="games/hk-map/">') && window.__front.includes('content="world"') && window.__front.includes('content="Canto Town"') && window.__front.includes('<title>Canto Town</title>') && window.__front.includes('../../apple-touch-icon.png')`, equals: true } },
  {
    name: 'open the front page (a new visitor: no saved spot)',
    action: 'eval',
    code: `localStorage.removeItem('hkmap-world-v1'); const f = document.createElement('iframe'); f.id = 'game-frame'; f.src = '../';
      f.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:99999'; document.body.appendChild(f);`,
  },
  { name: 'you are in the world', action: 'waitFor', expression: `(() => { try { return ${W}.ready; } catch (e) { return false; } })()`, timeout: 30000 },
  { name: 'by Tsing Yi station', action: 'expect', expect: { expression: `Math.abs(${W}.px - 1052) + Math.abs(${W}.py - 819) <= 6`, equals: true } },
  { name: 'the Canto Arcade is a building close by', action: 'expect', expect: { expression: `(() => { const s = ${W}, m = s.marks.find(m => m.it.k === 'ARCADE'); return !!m && Math.max(Math.abs(m.cell[0] - 1052), Math.abs(m.cell[1] - 819)) <= 12; })()`, equals: true } },
  { name: 'set up: at its door', action: 'eval', code: `const s = ${W}, c = s.marks.find(m => m.it.k === 'ARCADE').cell; s.route = []; s.px = c[0]; s.py = c[1] + 1; s.player.setPosition(...s.cellCenter(s.px, s.py)); s.onArrive(); ${FW}.focus();` },
  { name: 'its name shows', action: 'expect', expect: { expression: `${W}.near && ${W}.near.k`, equals: 'ARCADE' } },
  { name: 'press Enter to go in', action: 'press', key: 'Enter' },
  { name: 'inside: the arcade room', action: 'waitFor', expression: `(() => { try { return ${FW}.location.pathname.endsWith('/arcade/') && ${FW}.__PHASER_GAME__ && ${FW}.__PHASER_GAME__.scene.isActive('ArcadeScene'); } catch (e) { return false; } })()`, timeout: 15000 },
  { name: 'the way out is there', action: 'expect', expect: { expression: `${frame}.contentDocument.querySelector('#exit-btn').getAttribute('href')`, equals: '../' } },
  { name: 'out to the street', action: 'eval', code: `${frame}.contentDocument.querySelector('#exit-btn').click()` },
  { name: 'back in the world', action: 'waitFor', expression: `(() => { try { return !!${FW}.__hkWorld && ${W}.ready; } catch (e) { return false; } })()`, timeout: 30000 },
  { name: 'standing at the arcade’s door', action: 'expect', expect: { expression: `${W}.near && ${W}.near.k`, equals: 'ARCADE' } },
  { name: 'world', action: 'screenshot' },
  { name: 'close the frame', action: 'eval', code: `${frame}.remove(); localStorage.removeItem('hkmap-world-v1');` },
];
