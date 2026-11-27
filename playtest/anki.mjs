// Anki mode end to end, with a stand-in AnkiConnect and a stand-in gist installed in the page
// (so this runs anywhere, CI included): a place learned on the phone arrives through the gist,
// its suspended cards get unsuspended and made due today, and the "sent" mark goes back up.
const fakes = `
  window.__ankiLog = [];
  const real = window.fetch.bind(window);
  const gist = { 'hkmap-progress.json': { content: JSON.stringify({ items: { 'S:JOR': { s: 'd1', l: 2, y: 2, days: ['d1', 'd2'] } }, sent: {}, updated: 5 }) } };
  window.__gist = gist;
  window.fetch = async (u, o = {}) => {
    const url = String(u);
    if (url.startsWith('http://127.0.0.1:8765')) {
      const b = JSON.parse(o.body), p = b.params || {};
      window.__ankiLog.push(b.action + (p.query ? ':' + p.query : '') + (p.cards ? ':' + p.cards.join('+') : '') + (p.days !== undefined ? ':days=' + p.days : ''));
      const result = { version: 6, findCards: (p.query || '').includes('mtr::JOR') ? [11, 12] : [], unsuspend: true, setDueDate: [true, true] }[b.action];
      return new Response(JSON.stringify({ result: result ?? null, error: null }));
    }
    if (url.startsWith('https://api.github.com')) {
      if (url.includes('/gists?')) return new Response(JSON.stringify([{ id: 'g1', description: 'HK map game progress (private sync)', files: { 'hkmap-progress.json': {} } }]));
      if (o.method === 'PATCH') { Object.assign(gist, JSON.parse(o.body).files); return new Response('{}'); }
      return new Response(JSON.stringify({ files: gist }));
    }
    return real(u, o);
  };
  localStorage.setItem('canto-anki', '1');
  localStorage.setItem('hkmap-sync', JSON.stringify({ token: 'test' }));
  localStorage.removeItem('hkmapgame-v3');
  scene('ArcadeScene').scene.restart();
`;

export default [
  { name: 'arcade room opens', action: 'waitFor', expression: `game.scene.isActive('ArcadeScene')`, timeout: 10000 },
  { name: 'classmates see no Anki light', action: 'expect', expect: { expression: `scene('ArcadeScene').light === null`, equals: true } },
  { name: 'turn on Anki mode with stand-in Anki and gist', action: 'eval', code: fakes },
  { name: 'the light turns green', action: 'waitFor', expression: `scene('ArcadeScene').light && scene('ArcadeScene').light.text === 'Anki ●'`, timeout: 8000 },
  { name: 'the place learned on the phone came through the gist', action: 'expect', expect: { expression: `!!JSON.parse(localStorage.getItem('hkmapgame-v3')).items['S:JOR']`, equals: true } },
  { name: 'only its suspended cards are looked up', action: 'expect', expect: { expression: `__ankiLog.includes('findCards:(tag:mtr::JOR) is:suspended')`, equals: true } },
  { name: 'they are unsuspended', action: 'expect', expect: { expression: `__ankiLog.includes('unsuspend:11+12')`, equals: true } },
  { name: 'and due today', action: 'expect', expect: { expression: `__ankiLog.includes('setDueDate:11+12:days=0')`, equals: true } },
  { name: 'marked as sent here', action: 'expect', expect: { expression: `!!JSON.parse(localStorage.getItem('hkmapgame-v3')).sent['S:JOR']`, equals: true } },
  { name: 'and in the gist, so the phone knows', action: 'expect', expect: { expression: `!!JSON.parse(__gist['hkmap-progress.json'].content).sent['S:JOR']`, equals: true } },
  { name: 'no settings ever go up', action: 'expect', expect: { expression: `'settings' in JSON.parse(__gist['hkmap-progress.json'].content)`, equals: false } },
  { name: 'you are told', action: 'expect', expect: { expression: `scene('ArcadeScene').children.list.some(o => o.type === 'Text' && o.text === '解鎖！')`, equals: true } },
  { name: 'sent', action: 'screenshot' },
  { name: 'open the Anki panel', action: 'eval', code: `scene('ArcadeScene').light.emit('pointerdown', {}, 0, 0, { stopPropagation() {} })` },
  { name: 'the panel shows', action: 'expect', expect: { expression: `!!document.querySelector('#anki-panel') && document.querySelector('#anki-panel').textContent.includes('connected')`, equals: true } },
  { name: 'panel', action: 'screenshot' },
  { name: 'a second round sends nothing again', action: 'eval', code: `window.__ankiLog = []; scene('ArcadeScene').ankiRound()` },
  { name: 'let it run', action: 'wait', ms: 800 },
  { name: 'nothing unsuspended twice', action: 'expect', expect: { expression: `__ankiLog.filter(a => a.startsWith('unsuspend')).length`, equals: 0 } },
];
