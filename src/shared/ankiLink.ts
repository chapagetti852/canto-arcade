// The private Anki mode: turned on per browser with ?anki (off with ?anki=off), shared with
// the map game's own flag so one switch covers the whole site. Classmates never see any of it.
import { type MapItem, type MapSave, markSent, readyForAnki, suspendedCardsQuery, today } from '../logic/hkmapAnki';
import { HKMAP_KEY } from '../logic/progress';
import { anki, ankiReachable, unsuspendDueToday } from './anki';

const FLAGS = ['canto-anki', 'hkmap-anki'];

export function ankiMode(): boolean {
  const p = new URLSearchParams(location.search);
  try {
    if (p.has('anki')) {
      for (const f of FLAGS) localStorage.setItem(f, p.get('anki') === 'off' ? '' : '1');
      history.replaceState(null, '', location.pathname);
    }
    return FLAGS.some((f) => !!localStorage.getItem(f));
  } catch {
    return false;
  }
}

let items: MapItem[] | null = null;
async function mapItems(): Promise<MapItem[]> {
  if (items) return items;
  const got = (await (await fetch('../games/hk-map/js/anki-items.json')).json()) as MapItem[];
  items = got;
  return got;
}
const mapSave = (): MapSave | null => { try { return JSON.parse(localStorage.getItem(HKMAP_KEY) ?? 'null'); } catch { return null; } };

/** 香港通 places learned but not yet in Anki (on the phone these wait for the Mac). */
export async function mapWaiting(): Promise<number> {
  return readyForAnki(await mapItems(), mapSave()).length;
}

/** Unsuspend every learned 香港通 place in Anki and mark it sent. Returns how many places and cards. */
export async function sendMapToAnki(): Promise<{ places: number; cards: number } | null> {
  if (!(await ankiReachable())) return null;
  const save = mapSave();
  const ready = readyForAnki(await mapItems(), save);
  if (!save || !ready.length) return { places: 0, cards: 0 };
  const found = await Promise.all(ready.map((i) => anki<number[]>('findCards', { query: suspendedCardsQuery(i) })));
  const cards = [...new Set(found.flat())];
  await unsuspendDueToday(cards);
  // re-read in case the save changed meanwhile, then mark these places as sent
  const fresh = mapSave() ?? save;
  localStorage.setItem(HKMAP_KEY, JSON.stringify(markSent(fresh, ready.map((i) => i[0]), today())));
  return { places: ready.length, cards: cards.length };
}
