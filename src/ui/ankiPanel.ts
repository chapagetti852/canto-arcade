// The small Anki panel (private Anki mode only): status, sync, card snapshot. Plain DOM over the canvas.
import { ankiReachable, ankiSnapshot } from '../shared/anki';
import { today } from '../logic/hkmapAnki';

export interface PanelState { reachable: boolean; waiting: number; sync: string; lastSent: string }

let el: HTMLDivElement | null = null;

export function closeAnkiPanel(): void { el?.remove(); el = null; }

export function openAnkiPanel(s: PanelState, actions: { sync: () => void }): void {
  closeAnkiPanel();
  el = document.createElement('div');
  el.id = 'anki-panel';
  el.innerHTML = `
    <button class="x" aria-label="Close">✕</button>
    <h2>Anki <span class="${s.reachable ? 'on' : 'off'}">●</span></h2>
    <p>${s.reachable ? 'Anki is open and connected.' : 'Anki isn’t reachable. Open Anki on your Mac (with AnkiConnect) and use Chrome.'}</p>
    ${s.lastSent ? `<p>${s.lastSent}</p>` : ''}
    ${s.waiting ? `<p>香港通: ${s.waiting} learned place${s.waiting > 1 ? 's' : ''} waiting to go to Anki${s.reachable ? '' : ' (sent next time Anki is reachable)'}.</p>` : ''}
    <p class="dim">Sync: ${s.sync}</p>
    <div class="row">
      <button data-a="sync">Sync now</button>
      <button data-a="snap" ${s.reachable ? '' : 'disabled'}>Export card snapshot</button>
    </div>
    <p class="dim small" id="anki-msg"></p>
    <p class="dim small"><a href="?anki=off">Turn off Anki mode in this browser</a></p>`;
  document.body.appendChild(el);
  const msg = (t: string): void => { const m = el?.querySelector('#anki-msg'); if (m) m.textContent = t; };
  el.querySelector('.x')!.addEventListener('click', closeAnkiPanel);
  el.querySelector('[data-a="sync"]')!.addEventListener('click', () => { closeAnkiPanel(); actions.sync(); });
  el.querySelector('[data-a="snap"]')!.addEventListener('click', async () => {
    if (!(await ankiReachable())) { msg('Anki isn’t reachable.'); return; }
    try {
      msg('Reading your notes…');
      const snap = await ankiSnapshot((d, t) => msg(`Reading your notes… ${d}/${t}`));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(snap, null, 1)], { type: 'application/json' }));
      a.download = `anki-snapshot-${today()}.json`;
      a.click();
      msg('Saved to your Downloads. Upload it to the canto-course repo, in the anki folder.');
    } catch (e) {
      msg('Snapshot failed: ' + (e as Error).message);
    }
  });
}
