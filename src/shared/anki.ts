// AnkiConnect, the Anki add-on that listens on your Mac at 127.0.0.1:8765. Works from desktop
// Chrome once https://chapagetti852.github.io is in its webCorsOriginList (Chrome may ask once to
// let the site reach local devices). Everything here runs only in the private Anki mode.

const URL = 'http://127.0.0.1:8765';

export async function anki<T = unknown>(action: string, params: Record<string, unknown> = {}, timeoutMs = 8000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(URL, { method: 'POST', body: JSON.stringify({ action, version: 6, params }), signal: ctl.signal });
    const j = (await r.json()) as { result: T; error: string | null };
    if (j.error) throw new Error(j.error);
    return j.result;
  } finally {
    clearTimeout(t);
  }
}

/** Is Anki open and letting us in? Quick, never throws. */
export async function ankiReachable(): Promise<boolean> {
  try {
    await anki('version', {}, 2500);
    return true;
  } catch {
    return false;
  }
}

/** Several actions in one request (AnkiConnect "multi"). */
export async function ankiMulti<T = unknown>(actions: { action: string; params?: Record<string, unknown> }[]): Promise<T[]> {
  const res = await anki<{ result: T; error: string | null }[] | T[]>('multi', { actions: actions.map((a) => ({ ...a, version: 6 })) }, 30000);
  return res.map((r) => (r && typeof r === 'object' && 'result' in (r as object) ? (r as { result: T; error: string | null }) : { result: r as T, error: null }))
    .map((r) => { if (r.error) throw new Error(r.error); return r.result; });
}

const chunks = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Unsuspend these cards and make them due today, first in the queue. */
export async function unsuspendDueToday(cards: number[]): Promise<void> {
  if (!cards.length) return;
  await anki('unsuspend', { cards });
  await anki('setDueDate', { cards, days: '0' });
}

interface NoteInfo { noteId: number; modelName: string; tags: string[]; fields: Record<string, { value: string; order: number }>; cards: number[] }
interface CardInfo { cardId: number; deckName: string; queue: number; type: number; interval: number }

const clean = (s: string): string =>
  s.replace(/\[sound:[^\]]*\]/g, '').replace(/<br\s*\/?>/gi, ' / ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 400);

/** A snapshot of every Cantonese note: fields (text only), tags, decks and card state. */
export async function ankiSnapshot(onProgress?: (done: number, total: number) => void): Promise<object> {
  const ids = await anki<number[]>('findNotes', { query: '"note:Cantonese (Yale)" OR "note:Cantonese Tones" OR "note:Cantonese Dialogue"' }, 30000);
  const notes: object[] = [];
  for (const part of chunks(ids, 250)) {
    const infos = await anki<NoteInfo[]>('notesInfo', { notes: part }, 60000);
    const cards = await anki<CardInfo[]>('cardsInfo', { cards: infos.flatMap((n) => n.cards) }, 60000);
    const byId = new Map(cards.map((c) => [c.cardId, c]));
    for (const n of infos) {
      const cs = n.cards.map((c) => byId.get(c)).filter((c): c is CardInfo => !!c);
      const fields = Object.fromEntries(Object.entries(n.fields).sort((a, b) => a[1].order - b[1].order).map(([k, v]) => [k, clean(v.value)]).filter(([, v]) => v));
      notes.push({
        id: n.noteId, model: n.modelName, fields, tags: n.tags,
        decks: [...new Set(cs.map((c) => c.deckName))],
        cards: cs.map((c) => ({ suspended: c.queue === -1, state: ['new', 'learning', 'review', 'relearning'][c.type] ?? String(c.type), ivl: c.interval })),
      });
    }
    onProgress?.(notes.length, ids.length);
  }
  return { exported: new Date().toISOString(), count: notes.length, notes };
}
