import Phaser from 'phaser';
import "./audio/music";
import "./ui/photos";
import "./yale/yale";
import "./ui/dom";
import "./ui/typing";
import { DATA, ITEMS, LEVELS, touch } from "./core/util";
import { ANKI, params } from "./core/anki";
import { placeBao } from "./ui/bao";
import { areaKeyAt } from "./map/geo";
import { pickVoice } from "./audio/voice";
import { closeModal, modalOpen } from "./ui/modal";
import { MG, openMinis, runMini } from "./minigames/mini";
import { showFact } from "./ui/fact";
import { openSnackBook } from "./world/roam";
import { openCollection } from "./ui/collection";
import { openSettings } from "./ui/settings";
import { G } from "./game/G";
import { MAP, MapScene } from "./scenes/MapScene";
import { SYNC, loadLocal, reconnectFolder } from "./core/save";
import { ST } from "./core/state";
import { checkAnswer, rom, watchRomanisation } from "./core/rom";
import { currentTyping } from "./ui/typing";

let GAME = null;
if (params.has('debug')) window.__hk = { G, map: () => MAP, ST: () => ST, areaKeyAt: (x, y, c) => areaKeyAt(x, y, c), runMini: id => runMini(id) };
function start() {
  watchRomanisation(); // Jyutping readers: every Yale word on screen shown in Jyutping
  loadLocal(); SYNC.run(); pickVoice(); try { speechSynthesis.onvoiceschanged = pickVoice; } catch (e) {}
  if (ANKI) reconnectFolder(false);
  // iPhone keyboard: iOS shrinks and scrolls the *visual* viewport only, so #ui is resized and moved to match it
  const vv = window.visualViewport; let vvRaf = 0, lastVV = '';
  const syncVV = () => { cancelAnimationFrame(vvRaf); vvRaf = requestAnimationFrame(() => {
    const h = vv ? vv.height : innerHeight, t = vv ? Math.max(0, vv.offsetTop) : 0, R = document.documentElement.style;
    R.setProperty('--vvh', Math.round(h) + 'px'); R.setProperty('--vvt', Math.round(t) + 'px');
    // keyboard = a text box has focus on a touch screen (iOS Chrome shrinks innerHeight too, so heights can't tell)
    const ae = document.activeElement, kb = touch && !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && ae.type !== 'checkbox' && ae.type !== 'file';
    const B = document.body.classList; B.toggle('kb', kb);
    const sw = screen.width, sh = screen.height, sideways = (screen.orientation && screen.orientation.type ? screen.orientation.type.startsWith('landscape') : innerWidth > innerHeight) && Math.min(sw, sh) <= 500;
    B.toggle('land', !kb && sideways); B.toggle('short', !kb && (sideways || innerHeight <= 500));
    if (!kb && (scrollY || document.documentElement.scrollTop)) scrollTo(0, 0);
    placeBao(); const key = Math.round(h) + 'x' + innerWidth; if (GAME && GAME.isBooted && GAME.canvas && key !== lastVV) { lastVV = key; GAME.scale.refresh(); } }); };
  if (vv) { vv.addEventListener('resize', syncVV); vv.addEventListener('scroll', syncVV); }
  addEventListener('focusout', () => setTimeout(syncVV, 120)); addEventListener('focusin', syncVV); addEventListener('resize', syncVV); addEventListener('orientationchange', () => setTimeout(syncVV, 300)); syncVV();
  window.addEventListener('resize', () => setTimeout(placeBao, 60));
  // offline support: the front page (Canto Town, at the site root) uses the site's worker, 香港通's own page its own
  const front = !!document.querySelector('meta[name=hk-start][content=world]');
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register(front ? '../../sw.js' : 'sw.js', front ? { scope: '../../' } : undefined).catch(() => {});
  document.fonts.load('12px FP', '港鐵Āā').catch(() => {}).finally(() => {
    // ?world: the new open world (phase 1 prototype, docs/ARCHITECTURE.md) instead of the usual game
    if (params.has('world') || document.querySelector('meta[name=hk-start][content=world]')) { document.getElementById('boot')?.remove(); import('./overworld/boot').then(m => { GAME = m.startOverworld(); }); return; }
    GAME = new Phaser.Game({ type: Phaser.AUTO, parent: 'map', backgroundColor: DATA.sea || '#3a6c9b', pixelArt: true, roundPixels: false, antialias: false,
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' }, loader: { imageLoadType: 'HTMLImageElement' }, input: { activePointers: 3 }, scene: [MapScene] });
  });
}
// For the arcade's playtests (playtest/back-button.mjs): drive the screens from outside the closure.
window.__hk = { G, LEVELS, ITEMS, MG, showFact, openCollection, openSettings, openMinis, openSnackBook, runMini, closeModal, modalOpen, currentTyping, checkAnswer, rom };
start();

