// Both games ship inside the arcade, and your existing progress shows on their machines.
export default [
  { name: 'arcade room opens', action: 'waitFor', expression: `game.scene.isActive('ArcadeScene')`, timeout: 10000 },
  {
    name: 'fetch both games',
    action: 'eval',
    code: `Promise.all(['../games/hk-map/', '../games/hk-map/js/app.js', '../games/hk-map/img/map.png', '../games/canto-numbers/'].map(u => fetch(u).then(r => r.status))).then(s => { window.__status = s.join(','); })`,
  },
  { name: 'let the fetches land', action: 'wait', ms: 1500 },
  { name: 'every game file is there', action: 'expect', expect: { expression: `window.__status`, equals: '200,200,200,200' } },
  {
    name: 'pretend you have map and numbers progress, then reopen the arcade',
    action: 'eval',
    code: `localStorage.setItem('hkmapgame-v3', JSON.stringify({ items: { 'S:TSY': { s: '2026-11-01' }, 'S:ADM': { s: '2026-11-02' } } })); localStorage.setItem('canto-numbers-v1', JSON.stringify({ best: { 'read-1': 120 } })); scene('ArcadeScene').scene.restart();`,
  },
  { name: 'arcade back', action: 'waitFor', expression: `game.scene.isActive('ArcadeScene') && scene('ArcadeScene').player`, timeout: 5000 },
  {
    name: 'the machines show it',
    action: 'expect',
    expect: { expression: `scene('ArcadeScene').children.list.filter(o => o.type === 'Text').map(o => o.text).filter(t => t === '見過 2/244' || t === '最高 120').length`, equals: 2 },
  },
  { name: 'progress', action: 'screenshot' },
];
