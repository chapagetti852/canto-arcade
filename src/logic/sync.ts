// How saves from two devices are combined. Pure functions, unit-tested.

type Json = unknown;
const isObj = (v: Json): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 香港通's merge, exactly as in the map game: counts take the higher, day lists join, ticks stay
 *  ticked; `missions` and `roamAt` (and anything else) come from the newer save. */
const NEWER = new Set(['missions', 'roamAt']);
export function mergeMap(a: Json, b: Json, bNew: boolean, key?: string): Json {
  if (a === undefined || a === null) return b;
  if (b === undefined || b === null) return a;
  if (key && NEWER.has(key)) return bNew ? b : a;
  if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
  if (typeof a === 'boolean' && typeof b === 'boolean') return a || b;
  if (Array.isArray(a) && Array.isArray(b)) return a.concat(b).every((x) => typeof x !== 'object') ? [...new Set([...a, ...b])] : bNew ? b : a;
  if (isObj(a) && isObj(b)) {
    const o: Record<string, Json> = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = mergeMap(a[k], b[k], bNew, k);
    return o;
  }
  return bNew ? b : a;
}

/** Combine two 香港通 saves (settings stay per device). */
export function mergeMapSaves(local: Record<string, Json>, remote: Record<string, Json> | null): Record<string, Json> {
  const { settings, ...l } = local;
  if (!remote || !isObj(remote.items)) return { ...l, ...(settings ? { settings } : {}) };
  const { settings: _s, ...r } = remote;
  const lu = Number(l.updated ?? 0), ru = Number(r.updated ?? 0);
  const m = mergeMap(l, r, ru > lu) as Record<string, Json>;
  m.updated = Math.max(lu, ru);
  return { ...m, ...(settings ? { settings } : {}) };
}

/** Canto Numbers: best scores take the higher per mode/level; settings stay per device. */
export function mergeNumbers(local: Record<string, Json>, remote: Record<string, Json> | null): Record<string, Json> {
  if (!remote) return local;
  const best: Record<string, number> = { ...((isObj(local.best) ? local.best : {}) as Record<string, number>) };
  for (const [k, v] of Object.entries(isObj(remote.best) ? remote.best : {})) if (typeof v === 'number') best[k] = Math.max(best[k] ?? 0, v);
  return { ...local, best, name: local.name || remote.name || '' };
}

/** The arcade room: visit counts take the higher; where you stand stays per device. */
export function mergeArcade(local: Record<string, Json>, remote: Record<string, Json> | null): Record<string, Json> {
  if (!remote) return local;
  const visits: Record<string, number> = { ...((isObj(local.visits) ? local.visits : {}) as Record<string, number>) };
  for (const [k, v] of Object.entries(isObj(remote.visits) ? remote.visits : {})) if (typeof v === 'number') visits[k] = Math.max(visits[k] ?? 0, v);
  return { ...local, visits };
}

/** What goes up to the gist: never device settings (the map's settings hold the Azure key). */
export function publicMap(save: Record<string, Json>): Record<string, Json> {
  const { settings: _s, ...rest } = save;
  return rest;
}
