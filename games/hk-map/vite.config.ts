import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** One version per build: cache-busts the map pictures and names the service worker's cache. */
const BUILD = new Date().toISOString().replace(/\D/g, '').slice(0, 12);

/**
 * 香港通's build steps that are not plain bundling:
 * - the pixel fonts (subset by `npm run fonts` into assets/fp.woff2, plus vendor/fp2.woff2) are inlined
 *   into index.html, so the first frame never shows a fallback font;
 * - `__BUILD__` in the game code and the service worker becomes this build's version.
 */
function hkmap(): Plugin {
  let outDir = 'dist';
  const b64 = (p: string) => readFileSync(p).toString('base64');
  return {
    name: 'hkmap',
    configResolved(c) { outDir = c.build.outDir; },
    transformIndexHtml(html) {
      return html.replace('__FONT__', b64('assets/fp.woff2')).replace('__FONT2__', b64('vendor/fp2.woff2'));
    },
    transform(code, id) {
      if (id.includes('/src/') && code.includes('__BUILD__')) return code.replaceAll('__BUILD__', BUILD);
    },
    closeBundle() {
      const sw = join(outDir, 'sw.js');
      if (existsSync(sw)) writeFileSync(sw, readFileSync(sw, 'utf8').replaceAll('__BUILD__', BUILD));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [hkmap()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600, // Phaser alone is ~1.4 MB minified
    rollupOptions: {
      output: {
        // Fixed names: the service worker lists them, and the arcade's playtest checks js/app.js.
        entryFileNames: 'js/app.js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: 'assets/[name][extname]',
        // Phaser in its own file, so it stays cached when only game code changes.
        manualChunks: (id: string) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
  },
  server: { port: 5174, host: true },
});
