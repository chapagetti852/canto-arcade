// Progress sync between the owner's own devices, through a secret GitHub gist — the same gist and
// token the map game has used since November (stored in this browser only, key `hkmap-sync`).
// One file per game; this keeps the map game's file name and merge rules so both stay compatible.
import { ARCADE_KEY, HKMAP_KEY, NUMBERS_KEY } from '../logic/progress';
import { mergeArcade, mergeMapSaves, mergeNumbers, publicMap } from '../logic/sync';

const CFG = 'hkmap-sync';
const DESC = 'HK map game progress (private sync)';
type Obj = Record<string, unknown>;

const FILES: { file: string; key: string; merge: (l: Obj, r: Obj | null) => Obj; up: (o: Obj) => Obj }[] = [
  { file: 'hkmap-progress.json', key: HKMAP_KEY, merge: mergeMapSaves, up: publicMap },
  { file: 'canto-numbers.json', key: NUMBERS_KEY, merge: mergeNumbers, up: (o) => ({ best: o.best ?? {}, name: o.name ?? '' }) },
  { file: 'canto-arcade.json', key: ARCADE_KEY, merge: mergeArcade, up: (o) => ({ visits: o.visits ?? {} }) },
];

const cfg = (): { token?: string; gist?: string; last?: number } => { try { return JSON.parse(localStorage.getItem(CFG) ?? '{}') ?? {}; } catch { return {}; } };
const setCfg = (c: object): void => { try { localStorage.setItem(CFG, JSON.stringify(c)); } catch { /* */ } };
const read = (k: string): Obj | null => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch { return null; } };

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch('https://api.github.com' + path, { cache: 'no-store', ...init, headers: { Authorization: 'Bearer ' + cfg().token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } });
  if (!r.ok) throw new Error('GitHub ' + r.status);
  return r.json() as Promise<T>;
}

export const syncOn = (): boolean => !!cfg().token;

/** Pull, merge and push every game's progress. Returns the keys whose local save changed. */
export async function syncAll(): Promise<string[]> {
  const c = cfg();
  if (!c.token) return [];
  if (!c.gist) {
    const list = await api<{ id: string; description: string; files: Obj }[]>('/gists?per_page=100');
    const g = list.find((x) => x.description === DESC && x.files['hkmap-progress.json']);
    if (!g) return []; // the map game creates the gist on first sync; nothing to do until then
    c.gist = g.id; setCfg(c);
  }
  const g = await api<{ files: Record<string, { content: string } | undefined> }>('/gists/' + c.gist);
  const changed: string[] = [];
  const patch: Record<string, { content: string }> = {};
  for (const f of FILES) {
    let remote: Obj | null = null;
    try { remote = g.files[f.file] ? JSON.parse(g.files[f.file]!.content) : null; } catch { remote = null; }
    const local = read(f.key);
    if (!local && !remote) continue;
    const merged = local ? f.merge(local, remote) : f.key === HKMAP_KEY ? remote! : f.merge({}, remote);
    if (JSON.stringify(merged) !== JSON.stringify(local)) { localStorage.setItem(f.key, JSON.stringify(merged)); changed.push(f.key); }
    const up = JSON.stringify(f.up(merged));
    if (!remote || up !== JSON.stringify(f.up(remote))) patch[f.file] = { content: up };
  }
  if (Object.keys(patch).length) await api('/gists/' + c.gist, { method: 'PATCH', body: JSON.stringify({ files: patch }) });
  setCfg({ ...cfg(), last: Date.now() });
  return changed;
}
