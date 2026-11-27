#!/usr/bin/env node
// The site's front page is the open world (香港通): this copies 香港通's built page to public/index.html
// with a <base> pointing at games/hk-map/ (so its scripts, pictures and sounds load from where they are),
// tells it to open the world, and gives it the site's own name, icon and manifest for the home screen.
// Run by `npm run build:games`, after 香港通 is built. public/index.html is git-ignored.
import fs from 'node:fs';

const src = 'public/games/hk-map/index.html', out = 'public/index.html';
let html = fs.readFileSync(src, 'utf8');
const swap = (from, to) => { if (!html.includes(from)) throw new Error(`front-page: "${from}" not found in ${src}`); html = html.replace(from, to); };
swap('<head>', '<head>\n<base href="games/hk-map/">\n<meta name="hk-start" content="world">');
// relative to the <base>: ../../ is the site root
swap('<link rel="icon" type="image/png" href="img/favicon.png">', '<link rel="icon" type="image/png" href="../../favicon.png">');
swap('<link rel="apple-touch-icon" href="img/icon-192.png">', '<link rel="apple-touch-icon" href="../../apple-touch-icon.png">');
swap('<link rel="manifest" href="manifest.webmanifest">', '<link rel="manifest" href="../../manifest.webmanifest">');
swap('<meta name="apple-mobile-web-app-title" content="香港通">', '<meta name="apple-mobile-web-app-title" content="Canto Arcade">');
html = html.replace(/<title>[^<]*<\/title>/, '<title>Canto Arcade · 香港通</title>');
fs.writeFileSync(out, html);
console.log('front page:', out, '(the open world, files from games/hk-map/)');
