// Paints world chunks off the main thread, so walking never waits for tile art.
// Messages in: { init: { w, h, cells } } once, then { cx, cy } per chunk. Out: { cx, cy, px } (RGBA, transferred).
import { CHUNK, Grid } from './grid';
import { paintChunk } from './tiles';
import { TILE } from './terrain';

let grid: Grid | null = null;

self.onmessage = (e: MessageEvent) => {
  const d = e.data;
  if (d.init) { grid = new Grid(d.init.w, d.init.h, d.init.cells); return; }
  if (!grid) return;
  const t = performance.now();
  const px = paintChunk(grid, d.cx, d.cy, new Uint8ClampedArray(CHUNK * TILE * CHUNK * TILE * 4));
  (self as unknown as Worker).postMessage({ cx: d.cx, cy: d.cy, px, ms: performance.now() - t }, [px.buffer]);
};
