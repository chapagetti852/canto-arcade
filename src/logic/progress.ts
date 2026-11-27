// Reads each game's own save (they all live in this browser, on the same site) to show your
// progress on the machines. Pure parsing; the scene passes in the raw localStorage strings.

export const ARCADE_KEY = 'canto-arcade-v1';
export const HKMAP_KEY = 'hkmapgame-v3';        // 香港通's save (unchanged since it moved into the arcade)
export const NUMBERS_KEY = 'canto-numbers-v1';  // Canto Numbers' save

export interface ArcadeSave { last: string | null; visits: Record<string, number> }

export function parseArcade(raw: string | null): ArcadeSave {
  try {
    const o = raw ? JSON.parse(raw) : null;
    return { last: typeof o?.last === 'string' ? o.last : null, visits: o?.visits && typeof o.visits === 'object' ? o.visits : {} };
  } catch {
    return { last: null, visits: {} };
  }
}

export function recordVisit(s: ArcadeSave, id: string): ArcadeSave {
  return { last: id, visits: { ...s.visits, [id]: (s.visits[id] ?? 0) + 1 } };
}

/** 香港通: how many places you have met (an item counts once it has been seen). */
export function hkMapMet(raw: string | null): number | null {
  try {
    const items = raw ? JSON.parse(raw)?.items : null;
    if (!items || typeof items !== 'object') return null;
    return Object.values(items as Record<string, { s?: unknown }>).filter((r) => r && r.s).length;
  } catch {
    return null;
  }
}

/** Canto Numbers: your best score in any mode and level. */
export function numbersBest(raw: string | null): number | null {
  try {
    const best = raw ? JSON.parse(raw)?.best : null;
    const vals = best && typeof best === 'object' ? Object.values(best).filter((v): v is number => typeof v === 'number') : [];
    return vals.length ? Math.max(...vals) : null;
  } catch {
    return null;
  }
}

/** The one-line progress shown under a machine. */
export function progressLine(id: string, get: (k: string) => string | null): string | null {
  if (id === 'hk-map') { const n = hkMapMet(get(HKMAP_KEY)); return n === null ? null : `見過 ${n}/244`; }
  if (id === 'canto-numbers') { const b = numbersBest(get(NUMBERS_KEY)); return b === null ? null : `最高 ${b}`; }
  return null;
}
