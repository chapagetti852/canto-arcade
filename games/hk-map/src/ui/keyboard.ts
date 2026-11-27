// The in-game keyboard for typing names on touch screens (the phone's own keyboard never opens).
//
// Built for Cantonese romanisation: a row of tone keys on top (ā á a àh áh ah in Yale — a tone key re-tones
// the syllable just typed; 1–6 in Jyutping), then only the letters the romanisation uses, in their QWERTY
// places (no q r v x; z only for Jyutping), so every key is bigger than on a phone keyboard. Bottom row:
// delete (hold to repeat), space, OK. Keys are at least 44 px tall and react on touch-down.
import { JP, TONE_KEYS } from '../core/rom';
import { toneInput } from '../yale/yale';

const ROWS = [
  ['w', 'e', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  [...(JP ? ['z'] : []), 'c', 'b', 'n', 'm', '⌫'],
];

export interface KeyboardOpts { onEnter: () => void; onKey?: () => void }

/** Put the keyboard under `input` (inside `host`), and make `input` display-only. Returns a remover. */
export function attachKeyboard(host: HTMLElement, input: HTMLInputElement, opts: KeyboardOpts): () => void {
  input.readOnly = true;
  input.setAttribute('inputmode', 'none');
  input.tabIndex = -1;
  const kb = document.createElement('div');
  kb.className = 'vkb';
  kb.setAttribute('data-no-rom', '');
  const key = (k: string, cls = '', label = k) => `<button type="button" class="vk ${cls}" data-k="${k}">${label}</button>`;
  kb.innerHTML =
    `<div class="vkr tones">${TONE_KEYS.map(([n, l]) => key('t' + n, 'tone', JP ? l : `<b>${l}</b><small>${n}</small>`)).join('')}</div>` +
    ROWS.map((r) => `<div class="vkr">${r.map((k) => (k === '⌫' ? key('del', 'wide', '⌫') : key(k))).join('')}</div>`).join('') +
    `<div class="vkr">${key('space', 'space', 'space')}${key('ok', 'ok gold', '✓ OK')}</div>`;
  host.appendChild(kb);

  const changed = () => { input.dispatchEvent(new Event('input', { bubbles: true })); opts.onKey?.(); };
  const end = () => input.setSelectionRange(input.value.length, input.value.length);
  const press = (k: string) => {
    if (k === 'ok') { opts.onEnter(); return; }
    if (k === 'del') input.value = input.value.normalize('NFC').slice(0, -1);
    else if (k === 'space') { if (input.value && !input.value.endsWith(' ')) input.value += ' '; }
    else if (k[0] === 't' && k.length === 2) {
      const n = +k[1];
      if (JP) input.value += String(n);
      else { end(); if (!toneInput(input, n)) return; }
    } else input.value += k;
    end();
    try { navigator.vibrate?.(4); } catch { /* not everywhere */ }
    changed();
  };
  let repeat = 0;
  const stop = () => { clearInterval(repeat); repeat = 0; };
  kb.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-k]'); if (!b) return;
    e.preventDefault(); b.classList.add('down');
    const k = b.dataset.k!; press(k);
    if (k === 'del') { stop(); const t0 = Date.now(); repeat = window.setInterval(() => { if (Date.now() - t0 > 400) press('del'); }, 70); }
  });
  const up = (e: Event) => { stop(); (e.target as HTMLElement).closest('[data-k]')?.classList.remove('down'); };
  kb.addEventListener('pointerup', up); kb.addEventListener('pointercancel', up); kb.addEventListener('pointerleave', up);
  document.body.classList.add('vkb-on');
  return () => { stop(); kb.remove(); if (!document.querySelector('.vkb')) document.body.classList.remove('vkb-on'); };
}
