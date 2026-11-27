// Opens the open-world prototype (?world) instead of the usual game: its own Phaser game in #map,
// a small HUD, and an on-screen pad on touch screens.
import Phaser from 'phaser';
import { touch } from '../core/util';
import { OverworldScene } from './OverworldScene';
import type { Dir } from './terrain';

export function startOverworld(): Phaser.Game {
  document.body.classList.add('overworld');
  const hud = document.getElementById('hud')!;
  hud.hidden = false;
  hud.innerHTML = `<a class="iconbtn panel" href="./" title="Back to 香港通" style="text-decoration:none;display:flex;align-items:center;justify-content:center;width:44px">◀</a><div class="bar panel"><span class="big">漫遊</span><span class="y">Maahnyàuh</span><span class="t">· new open world (prototype)</span></div><button class="iconbtn panel" id="ow-map" title="Town Map (M)" style="width:auto;padding:0 10px">地圖</button>`;
  hud.style.pointerEvents = 'auto';

  const game = new Phaser.Game({
    type: Phaser.WEBGL, parent: 'map', backgroundColor: '#34628f', pixelArt: true, roundPixels: true, antialias: false,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' }, input: { activePointers: 2 }, scene: [OverworldScene],
  });
  (window as unknown as { __hkWorld: () => OverworldScene }).__hkWorld = () => game.scene.getScene('overworld') as OverworldScene;
  document.getElementById('ow-map')!.addEventListener('click', () => (game.scene.getScene('overworld') as OverworldScene | null)?.townMap());

  if (touch) { // a four-way pad, bottom left: hold a direction to walk
    const pad = document.getElementById('pad')!;
    pad.hidden = false;
    pad.innerHTML = `<div class="dpad">${(['up', 'left', 'right', 'down'] as Dir[]).map((d) => `<button class="btn" data-d="${d}">${{ up: '▲', down: '▼', left: '◀', right: '▶' }[d]}</button>`).join('')}</div>`;
    const scene = () => game.scene.getScene('overworld') as OverworldScene | null;
    pad.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) => {
      const on = (e: Event) => { e.preventDefault(); scene()?.setPad(b.dataset.d as Dir); };
      const off = (e: Event) => { e.preventDefault(); scene()?.setPad(null); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    });
  }
  return game;
}
