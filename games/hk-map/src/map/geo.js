import { BY, DATA, GEO, ITEMS, LINES } from "../core/util.js";
import { MAP } from "../scenes/MapScene.js";

function lineBounds(id) { const pts = LINES[id].seq.flat().map(c => BY['S:' + c]); return [Math.min(...pts.map(p => p.x)), Math.min(...pts.map(p => p.y)), Math.max(...pts.map(p => p.x)), Math.max(...pts.map(p => p.y))]; }
function inPoly(pt, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]; if (((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) c = !c; } return c; }
const DISTS = ITEMS.filter(i => i.t === 'd');
const AREA_BY = {}; for (const [k, v] of Object.entries(DATA.areaIdx || {})) AREA_BY[v[0] + ':' + v[1]] = k;
/* which district (ch 0) or region (ch 1) is under this point? read from the pixel-exact area picture; a tap just off the coast counts for the nearest shore */
function areaKeyAt(x, y, ch) { const v = MAP && MAP.areaVal(x, y, ch); return v ? AREA_BY[ch + ':' + v] || null : null; }
const districtAt = (x, y) => { const k = areaKeyAt(x, y, 0); return k ? DISTS.find(d => d.k === k) || null : DISTS.find(d => inPoly({ x, y }, GEO[d.k].poly)) || null; };
function rideStops(id) { const out = [], seen = new Set(); for (const seg of LINES[id].seq) { let prev = null; for (const c of seg) { const it = BY['S:' + c]; if (!seen.has(c)) { out.push({ it, from: prev }); seen.add(c); } prev = it; } } return out; }
const lineOf = it => it.t === 's' ? it.lines[0] : null;

export { DISTS, areaKeyAt, districtAt, inPoly, lineBounds, rideStops };
