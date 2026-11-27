// How Cantonese is written in the whole arcade: Yale or Jyutping. Asked on the first visit; the small
// "拼音" button (top left) opens it again. Every game reads the same choice (src/shared/romanisation.ts).
import { getRomanisation, romanisationChosen, setRomanisation, type Romanisation } from '../shared/romanisation';

let el: HTMLDivElement | null = null;

export function closeRomPanel(): void { el?.remove(); el = null; }

export function openRomPanel(onChange: (r: Romanisation) => void, first = false): void {
  closeRomPanel();
  const cur = getRomanisation();
  el = document.createElement('div');
  el.id = 'rom-panel';
  el.className = 'pixel-panel';
  el.innerHTML = `
    ${first ? '' : '<button class="x" aria-label="Close">✕</button>'}
    <h2>${first ? '歡迎！ Welcome!' : '拼音 Romanisation'}</h2>
    <p>How should Cantonese be written in the games?</p>
    <div class="choices">
      <button data-r="yale" class="${cur === 'yale' && !first ? 'sel' : ''}"><b>Yale</b><span>廣東話 Gwóngdūngwá</span><small>tone marks · the CLA textbooks</small></button>
      <button data-r="jyutping" class="${cur === 'jyutping' && !first ? 'sel' : ''}"><b>Jyutping</b><span>廣東話 gwong2 dung1 waa2</span><small>tone numbers · dictionaries and apps</small></button>
    </div>
    <p class="dim small">You can change this any time with 拼音 (top left) or in a game's settings. Your progress stays the same.</p>`;
  document.body.appendChild(el);
  el.querySelector('.x')?.addEventListener('click', closeRomPanel);
  el.querySelectorAll<HTMLButtonElement>('[data-r]').forEach((b) => b.addEventListener('click', () => {
    const r = b.dataset.r as Romanisation;
    setRomanisation(r); closeRomPanel(); onChange(r);
  }));
}

/** The 拼音 button, and the first-visit question. */
export function setupRomanisation(onChange: (r: Romanisation) => void): void {
  if (document.getElementById('rom-btn')) return; // the room restarts; the button stays
  const btn = document.createElement('button');
  btn.id = 'rom-btn';
  const label = () => { btn.textContent = `拼音 ${getRomanisation() === 'jyutping' ? 'Jyutping' : 'Yale'}`; };
  const changed = (r: Romanisation) => { label(); onChange(r); };
  label();
  btn.addEventListener('click', () => (el ? closeRomPanel() : openRomPanel(changed)));
  document.body.appendChild(btn);
  if (!romanisationChosen()) openRomPanel(changed, true);
}
