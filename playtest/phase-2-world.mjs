// 香港通 phase 2 (games/hk-map/docs/ARCHITECTURE.md): in the open world (?world), ride the MTR between
// stations you have met, and open the Town Map. Keys are real presses; teleports and the save are setup.
const frame = `document.getElementById('game-frame')`;
const D = `${frame}.contentDocument`;
const W = `${frame}.contentWindow.__hkWorld()`;
const SAVE = { v: 3, items: { 'S:TSY': { s: '2026-11-01' }, 'S:CEN': { s: '2026-11-02' } }, flags: { intro: 1 }, points: {}, levels: {}, sent: {} };

export default [
  { name: 'arcade room opens', action: 'waitFor', expression: `game.scene.isActive('ArcadeScene')`, timeout: 10000 },
  {
    name: 'met Tsing Yi and Central; open the world',
    action: 'eval',
    code: `localStorage.setItem('hkmapgame-v3', ${JSON.stringify(JSON.stringify(SAVE))});
      const f = document.createElement('iframe'); f.id = 'game-frame'; f.src = 'games/hk-map/?world';
      f.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:99999'; document.body.appendChild(f);`,
  },
  { name: 'the world is ready', action: 'waitFor', expression: `(() => { try { return ${W}.ready; } catch (e) { return false; } })()`, timeout: 30000 },
  { name: 'standing by Tsing Yi station', action: 'expect', expect: { expression: `${W}.near && ${W}.near.k`, equals: 'S:TSY' } },
  { name: 'iframe has the keyboard', action: 'eval', code: `${frame}.contentWindow.focus()` },

  // the MTR
  { name: 'Enter at the station', action: 'press', key: 'Enter' },
  { name: '搭港鐵 opens', action: 'waitFor', expression: `!!${D}.querySelector('#ride-menu')`, timeout: 3000 },
  { name: 'it lists the met stations only (Central, not Tsing Yi itself or unmet ones)', action: 'expect', expect: { expression: `[...${D}.querySelectorAll('#ride-menu [data-k]')].map(b => b.dataset.k).join(',')`, equals: 'S:CEN' } },
  { name: 'choose Central', action: 'eval', code: `${D}.querySelector('#ride-menu [data-k="S:CEN"]').click()` },
  { name: 'ride', action: 'waitFor', expression: `!${W}.riding && ${W}.near && ${W}.near.k === 'S:CEN'`, timeout: 15000 },
  { name: 'out on the doorstep of Central station', action: 'expect', expect: { expression: `(() => { const s = ${W}, c = s.marks.find(m => m.it.k === 'S:CEN').cell; return Math.max(Math.abs(s.px - c[0]), Math.abs(s.py - c[1])); })()`, atMost: 3 } },
  { name: 'Central', action: 'screenshot' },

  // the Town Map
  { name: 'press M', action: 'press', key: 'm' },
  { name: 'the Town Map opens', action: 'waitFor', expression: `!!${D}.querySelector('#townmap:not([hidden])')`, timeout: 3000 },
  { name: 'your marker is where you are', action: 'expect', expect: { expression: `(() => { const s = ${W}, m = ${D}.querySelector('#tm-you'), c = ${D}.querySelector('#townmap canvas').getBoundingClientRect(), r = m.getBoundingClientRect();
      const fx = (r.left + r.width / 2 - c.left) / c.width, fy = (r.top + r.height / 2 - c.top) / c.height;
      return Math.abs(fx - (s.px + 0.5) / s.grid.w) < 0.01 && Math.abs(fy - (s.py + 0.5) / s.grid.h) < 0.01; })()`, equals: true } },
  { name: 'Town Map', action: 'screenshot' },
  { name: 'Esc closes it', action: 'press', key: 'Escape' },
  { name: 'closed', action: 'expect', expect: { expression: `!${D}.querySelector('#townmap:not([hidden])')`, equals: true } },
  { name: 'let spoken names finish loading', action: 'waitFor', expression: `${frame}.contentWindow.performance.getEntriesByType('resource').filter(e => e.name.includes('/audio/')).every(e => e.responseEnd > 0)`, timeout: 8000 },
  { name: 'a moment more', action: 'wait', ms: 1500 },
  { name: 'close the frame', action: 'eval', code: `${frame}.remove()` },
];
