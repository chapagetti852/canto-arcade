/* 香港通 Hēunggóng Tūng — a pixel field guide to Hong Kong.
   Map + game: Phaser 4 · music: Tone.js · sound effects: ZzFX · confetti: canvas-confetti · icons: pixelarticons.
   Everything you do is stored in this browser only (localStorage). No accounts, no server. */
const DATA = window.HK_DATA, PH = window.HK_PHOTOS || {}, ICONS = window.HK_ICONS || {}, BUNDLED = new Set(window.HK_AUDIO || []);
const ITEMS = DATA.items, BY = {}; ITEMS.forEach(i => BY[i.k] = i);
const GEO = DATA.geo, LEVELS = DATA.levels, LINES = DATA.lines, CAT = DATA.cat || {};
const PX_M = 60.2;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cls = '') => `<span class="ic ${cls}">${ICONS[n] || ''}</span>`;
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isArea = it => !!it && (it.t === 'd' || it.t === 'r');
const TYPE = { s: '港鐵站 station', p: '景點 sight', c: '天主教堂 church', d: '地區 district', r: '大區 region', l: '港鐵綫 MTR line' };
const typeColor = it => it.t === 'l' ? LINES[it.k.slice(2)].color : ({ s: '#2a7ab0', p: '#b0782a', c: '#8e44ad', d: '#3c4680', r: '#1d2340' })[it.t];
const touch = matchMedia('(pointer:coarse)').matches;

export { $, BUNDLED, BY, CAT, DATA, GEO, ITEMS, LEVELS, LINES, PH, PX_M, TYPE, esc, ic, isArea, pick, shuffle, sleep, touch, typeColor };
