// The arcade works end to end: you spawn, walk to a machine, it tells you what it is,
// and starting it heads to the game. (`window.__noNavigate` keeps the test on this page.)
export default [
  { name: 'arcade room opens', action: 'waitFor', expression: `game.scene.isActive('ArcadeScene')`, timeout: 10000 },
  { name: 'stay on this page when a game starts; start in the middle (the harness\'s focus click counts as a tap-to-walk)', action: 'eval', code: `window.__noNavigate = true; const s = scene('ArcadeScene'); s.target = null; s.player.setPosition(240, 205);` },
  { name: 'arcade', action: 'screenshot' },
  { name: 'note where you start', action: 'eval', code: `window.__x0 = scene('ArcadeScene').player.x` },
  { name: 'walk left', action: 'key', key: 'ArrowLeft', duration: 400 },
  { name: 'walking moves you', action: 'expect', expect: { expression: `window.__x0 - scene('ArcadeScene').player.x`, above: 15 } },
  { name: 'step up to 香港通', action: 'eval', code: `const s = scene('ArcadeScene'); s.target = null; s.player.setPosition(104, 140);` },
  { name: 'walk up to the cabinet', action: 'key', key: 'ArrowUp', duration: 300 },
  { name: 'the machine knows you are there', action: 'expect', expect: { expression: `scene('ArcadeScene').near && scene('ArcadeScene').near.id`, equals: 'hk-map' } },
  { name: 'cabinets are solid', action: 'expect', expect: { expression: `scene('ArcadeScene').player.y`, atLeast: 123 } },
  { name: 'at-the-machine', action: 'screenshot' },
  { name: 'press space to play', action: 'press', key: 'Space' },
  { name: 'it starts 香港通', action: 'expect', expect: { expression: `scene('ArcadeScene').launching`, equals: 'hk-map' } },
  { name: 'and remembers it', action: 'expect', expect: { expression: `JSON.parse(localStorage.getItem('canto-arcade-v1')).last`, equals: 'hk-map' } },
];
