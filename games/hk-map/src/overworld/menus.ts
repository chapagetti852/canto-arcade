// The open world's two DOM screens: 搭港鐵 (pick a station to ride to) and the Town Map.
import { BY, LINES, esc } from '../core/util';
import { stars } from '../core/state';
import { rom } from '../core/rom';
import type { Item } from '../types';
import { CELLS_PER_UNIT } from './terrain';

const root = () => document.getElementById('ui')!;

/** 搭港鐵 at `from`: the other stations you have met, by line. Resolves with the chosen one, or null. */
export function rideMenu(from: Item): Promise<Item | null> {
  return new Promise((resolve) => {
    const met = Object.values(BY).filter((i) => i.t === 's' && i !== from && stars(i) > 0)
      .sort((a, b) => (a.lines?.[0] ?? '').localeCompare(b.lines?.[0] ?? '') || a.yale.localeCompare(b.yale));
    const el = document.createElement('div');
    el.id = 'ride-menu';
    el.className = 'ow-menu';
    el.innerHTML = `<div class="box panel"><div class="hd"><h2>搭港鐵 <span class="y">Daap Góngtit</span></h2><button class="iconbtn" data-x>✕</button></div>
      <p>From ${esc(from.hz)} <span class="y">${esc(from.yale)}</span> — where to?</p>
      ${met.length ? `<div class="snk">${met.map((i) => `<button class="sn" data-k="${esc(i.k)}" style="text-align:left;cursor:pointer;border-left:4px solid ${LINES[i.lines?.[0] ?? '']?.color ?? '#888'}"><b>${esc(i.hz)}</b><span class="y">${esc(i.yale)}</span><small>${esc(i.en)}</small></button>`).join('')}</div>`
        : '<p class="en">Meet more stations first — then you can ride between them.</p>'}</div>`;
    root().appendChild(el);
    const done = (it: Item | null) => { el.remove(); removeEventListener('keydown', key, true); resolve(it); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    addEventListener('keydown', key, true);
    el.querySelector('[data-x]')!.addEventListener('click', () => done(null));
    el.addEventListener('click', (e) => { if (e.target === el) done(null); });
    el.querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) => b.addEventListener('click', () => done(BY[b.dataset.k!])));
  });
}

let mapImg: HTMLImageElement | null = null;

/**
 * The Town Map: the old map picture (the same 30 m grid as the world), the MTR lines as a schematic over it,
 * every station (met ones bright, with their names), and a marker where you stand.
 */
export function openTownMap(px: number, py: number, gw: number, gh: number, onClose: () => void): () => void {
  let el = document.getElementById('townmap');
  if (!el) {
    el = document.createElement('div');
    el.id = 'townmap';
    el.className = 'ow-menu';
    el.innerHTML = `<div class="box panel tm"><div class="hd"><h2>地圖 <span class="y">Deihtòuh</span></h2><span class="en tm-where"></span><button class="iconbtn" data-x>✕</button></div><div class="tm-wrap"><div class="tm-inner"><canvas></canvas><i id="tm-you"></i></div></div></div>`;
    root().appendChild(el);
  }
  el.hidden = false;
  const canvas = el.querySelector('canvas')!, you = el.querySelector<HTMLElement>('#tm-you')!;
  const draw = () => {
    const box = el!.querySelector('.tm-wrap')!.getBoundingClientRect();
    const s = Math.min(box.width / gw, box.height / gh), w = Math.round(gw * s), h = Math.round(gh * s), dpr = window.devicePixelRatio || 1;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const g = canvas.getContext('2d')!; g.setTransform(dpr * s, 0, 0, dpr * s, 0, 0); g.imageSmoothingEnabled = false;
    if (mapImg?.complete) g.drawImage(mapImg, 0, 0, gw, gh);
    const at = (it: Item): [number, number] => [it.x * CELLS_PER_UNIT, it.y * CELLS_PER_UNIT];
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const L of Object.values(LINES)) for (const seq of L.seq) {
      const pts = seq.map((c) => BY['S:' + c]).filter(Boolean);
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...at(p)) : g.moveTo(...at(p))));
      g.strokeStyle = '#1d2340'; g.lineWidth = 7 / s; g.stroke(); g.strokeStyle = L.color; g.lineWidth = 4 / s; g.stroke();
    }
    g.font = `${12 / s}px FP, FP2, sans-serif`; g.textAlign = 'center';
    for (const it of Object.values(BY)) {
      if (it.t !== 's') continue; const [x, y] = at(it), met = stars(it) > 0, r = (met ? 4 : 3) / s;
      g.fillStyle = '#1d2340'; g.fillRect(x - r - 1 / s, y - r - 1 / s, 2 * r + 2 / s, 2 * r + 2 / s);
      g.fillStyle = met ? '#ffffff' : '#9a95a8'; g.fillRect(x - r, y - r, 2 * r, 2 * r);
      if (met) { g.lineWidth = 3 / s; g.strokeStyle = '#fbf3dd'; g.strokeText(it.hz, x, y - 7 / s); g.fillStyle = '#241a12'; g.fillText(it.hz, x, y - 7 / s); }
    }
    you.style.left = (px + 0.5) / gw * w + 'px'; you.style.top = (py + 0.5) / gh * h + 'px';
  };
  if (!mapImg) { mapImg = new Image(); mapImg.onload = draw; mapImg.src = 'img/map.png?v=__BUILD__'; }
  const where = el.querySelector('.tm-where')!;
  where.textContent = '';
  draw();
  const close = () => { el!.hidden = true; removeEventListener('keydown', key, true); removeEventListener('resize', draw); onClose(); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') { e.stopPropagation(); e.preventDefault(); close(); } };
  addEventListener('keydown', key, true); addEventListener('resize', draw);
  el.querySelector<HTMLButtonElement>('[data-x]')!.onclick = close;
  return close;
}

/** for the Town Map header: the district you are in */
export function setTownMapWhere(text: string) { const w = document.querySelector('#townmap .tm-where'); if (w) w.textContent = rom(text); }
