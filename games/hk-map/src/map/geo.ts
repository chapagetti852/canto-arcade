import { BY, DATA, GEO, ITEMS, LINES } from "../core/util";
import * as MapScene from "../scenes/MapScene";
import type { Item } from "../types";
/** the map scene (still JS): only its area lookup is used here */
const map = () => (MapScene as unknown as { MAP: { areaVal(x: number, y: number, ch: number): number } | null }).MAP;

function lineBounds(id: string): [number, number, number, number] { const pts = LINES[id].seq.flat().map(c => BY['S:' + c]); return [Math.min(...pts.map(p => p.x)), Math.min(...pts.map(p => p.y)), Math.max(...pts.map(p => p.x)), Math.max(...pts.map(p => p.y))]; }
function inPoly(pt: { x: number; y: number }, poly: [number, number][]) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]; if (((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) c = !c; } return c; }
const DISTS = ITEMS.filter(i => i.t === 'd');
const AREA_BY: Record<string, string> = {}; for (const [k, v] of Object.entries(DATA.areaIdx || {})) AREA_BY[v[0] + ':' + v[1]] = k;
/* which district (ch 0) or region (ch 1) is under this point? read from the pixel-exact area picture; a tap just off the coast counts for the nearest shore */
function areaKeyAt(x: number, y: number, ch: number): string | null { const m = map(), v = m && m.areaVal(x, y, ch); return v ? AREA_BY[ch + ':' + v] || null : null; }
const districtAt = (x: number, y: number): Item | null => { const k = areaKeyAt(x, y, 0); return k ? DISTS.find(d => d.k === k) || null : DISTS.find(d => inPoly({ x, y }, GEO[d.k].poly)) || null; };
function rideStops(id: string) { const out: { it: Item; from: Item | null }[] = [], seen = new Set<string>(); for (const seg of LINES[id].seq) { let prev: Item | null = null; for (const c of seg) { const it = BY['S:' + c]; if (!seen.has(c)) { out.push({ it, from: prev }); seen.add(c); } prev = it; } } return out; }

export { DISTS, areaKeyAt, districtAt, inPoly, lineBounds, rideStops };
