import { esc } from "../core/util";
import { UI, rel } from "./dom";

// ---------- mascot 包仔 Bāaujái ----------
const BAO = {
  pal: { a: '#5a3214', b: '#fff1d6', r: '#d8432a', e: '#2b1a10', p: '#ff9aa8', m: '#7a2a18' },
  top: ['......aaaa......', '....aabbbbaa....', '...abbbrrbbba...', '..abbbrrrrbbba..', '.abbbbbrrbbbbba.', '.abbbbbbbbbbbba.', 'abbbbbbbbbbbbbba'],
  bottom: ['.abbbbbbbbbbbba.', '..aabbbbbbbbaa..', '....aaaaaaaa....', '................'],
  face: { ok: ['abbbeebbbbeebbba', 'abbbeebbbbeebbba', 'abpbbbbbbbbbbpba', 'abbbbbbmmbbbbbba', 'abbbbbbbbbbbbbba'], happy: ['abbbbebbbbebbbba', 'abbbebebbebebbba', 'abpbbbbbbbbbbpba', 'abbbbbmbbmbbbbba', 'abbbbbbmmbbbbbba'], sad: ['abbbebebbebebbba', 'abbbbebbbbebbbba', 'abpbbbbbbbbbbpba', 'abbbbbbmmbbbbbba', 'abbbbbmbbmbbbbba'] },
  url: {},
};
for (const [mood, face] of Object.entries(BAO.face)) { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); [...BAO.top, ...face, ...BAO.bottom].forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = BAO.pal[ch]; g.fillRect(x, y, 1, 1); } })); BAO.url[mood] = c.toDataURL(); }
const SAY = {
  hi: [['你好！', 'Néih hóu!', 'Hello!'], ['歡迎返嚟！', 'Fūnyìhng fāanlàih!', 'Welcome back!']],
  good: [['好嘢！', 'Hóu yéh!', 'Yay!'], ['犀利！', 'Sāileih!', 'Awesome!'], ['叻仔！', 'Lēkjái!', 'Clever!'], ['正呀！', 'Jeng a!', 'Great!'], ['冇問題！', 'Móuh mahntàih!', 'No problem!']],
  bad: [['唔緊要', 'M̀gányiu', 'Never mind'], ['差少少', 'Chā síusíu', 'Almost!'], ['再嚟過', 'Joi làih gwo', 'Try again'], ['慢慢嚟', 'Maahnmáan làih', 'Take it easy'], ['加油！', 'Gāyàuh!', 'Keep going!']],
  tone: [['留意聲調！', 'Làuhyi sīngdiuh!', 'Watch the tones!']],
  go: [['一齊去搭港鐵啦！', 'Yātchàih heui daap Góngtit lā!', "Let's ride the MTR!"]],
  fast: [['快啲！快啲！', 'Faai dī! Faai dī!', 'Hurry! Hurry!']],
};
let baoTimer = null;
function placeBao() { const vw = UI.root.clientWidth, rb = rel(UI.sheet), docked = !UI.sheet.hidden && rb.left > vw * 0.3 && rb.width < vw * 0.7; const b = UI.sheet.hidden || docked ? 0 : UI.root.clientHeight - rb.top; UI.bao.style.bottom = `calc(${b + 6}px + var(--safe-b))`; }
function showBao(mood = 'ok') { UI.bao.hidden = false; UI.bao.querySelector('img').src = BAO.url[mood]; placeBao(); }
function hideBao() { UI.bao.hidden = true; UI.bao.querySelector('.bub').hidden = true; }
function baoSay(ph, mood = 'happy', ms = 2600) {
  if (!ph) return; showBao(mood); const bub = UI.bao.querySelector('.bub');
  bub.innerHTML = `<b>${esc(ph[0])}</b><i>${esc(ph[1])}</i>${ph[2] ? `<s>${esc(ph[2])}</s>` : ''}`; bub.hidden = false;
  UI.bao.classList.remove('pop'); void UI.bao.offsetWidth; UI.bao.classList.add('pop');
  clearTimeout(baoTimer); baoTimer = setTimeout(() => { bub.hidden = true; if (!UI.bao.hidden) UI.bao.querySelector('img').src = BAO.url.ok; }, ms);
}

export { SAY, baoSay, hideBao, placeBao, showBao };
