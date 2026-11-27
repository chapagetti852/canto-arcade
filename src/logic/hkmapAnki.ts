// Which 香港通 places are ready to go to Anki. Mirrors the map game's own rules
// (games/hk-map/src: mastered(), ankiReady()) so both agree on what "learned" means.

/** [item key, item type, the Anki search that finds its note] — from games/hk-map/public/js/anki-items.json */
export type MapItem = [key: string, type: string, query: string];

export interface ItemRecord { s?: unknown; l?: number; y?: number; m?: unknown; days?: unknown[] }
export interface MapSave { items?: Record<string, ItemRecord>; sent?: Record<string, string>; updated?: number; [k: string]: unknown }

/** Learned in the game: ticked as known, or met on 2+ days with enough right answers (lines: 3 typed). */
export function mastered(type: string, r: ItemRecord | undefined): boolean {
  if (!r) return false;
  if (r.m) return true;
  const days = (r.days ?? []).length >= 2;
  return type === 'l' ? (r.y ?? 0) >= 3 && days : (r.l ?? 0) >= 2 && (r.y ?? 0) >= 2 && days;
}

export function readyForAnki(items: MapItem[], save: MapSave | null): MapItem[] {
  if (!save?.items) return [];
  const sent = save.sent ?? {};
  return items.filter(([k, t]) => mastered(t, save.items![k]) && !sent[k]);
}

/** Only cards still suspended: a note already in your active deck (e.g. 中環) is never rescheduled. */
export const suspendedCardsQuery = ([, , q]: MapItem): string => `(${q}) is:suspended`;

export function markSent(save: MapSave, keys: string[], day: string, now = Date.now()): MapSave {
  const sent = { ...(save.sent ?? {}) };
  for (const k of keys) sent[k] = day;
  return { ...save, sent, updated: now };
}

export const today = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
