import Phaser from 'phaser';
import { $, BY, DATA, GEO, ITEMS, esc, ic, isArea } from "../core/util";
import { MUSIC, sfx } from "../audio/music";
import { KEYS, UI, bind, burst, toast } from "../ui/dom";
import { DISTS, districtAt } from "../map/geo";
import { VOICES, sayLine } from "../audio/voice";
import { closeModal, openModal } from "../ui/modal";
import { MGrun } from "../minigames/mini";
import { G } from "../game/G";
import { MAP } from "../scenes/MapScene";
import { save } from "../core/save";
import { ST, addPoints, hashStr, mission, today } from "../core/state";

// ---------- the open world of free roam: neighbours, Pòhpó's cat, street snacks ----------
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const GREET = [['早晨！', 'Jóusàhn!', 'Good morning!'], ['食咗飯未呀？', 'Sihkjó faahn meih a?', 'Eaten yet? (= how are you)'], ['呢排點呀？', 'Nīpàaih dím a?', 'How have you been lately?'], ['去邊呀？', 'Heui bīn a?', 'Where are you off to?'],
  ['好耐冇見！', 'Hóu noih móuh gin!', 'Long time no see!'], ['搵日一齊食飯吖！', 'Wányaht yātchàih sihkfaahn ā!', "Let's have a meal together some day!"], ['今日好熱呀！', 'Gāmyaht hóu yiht a!', "It's so hot today!"], ['你識講廣東話㗎？好叻呀！', 'Néih sīk góng Gwóngdūngwá ga? Hóu lek a!', 'You speak Cantonese? Impressive!'],
  ['飲咗茶未呀？', 'Yámjó chàh meih a?', 'Had your yum cha yet?'], ['慢慢行呀！', 'Maahnmáan hàahng a!', 'Take care! (lit. walk slowly)'], ['忙到死呀！', 'Mòhng dou séi a!', "I'm so busy!"], ['嘛嘛哋啦！', 'Màhmádéi lā!', 'So-so!'], ['冇嘢做呀，好得閒！', 'Móuh yéh jouh a, hóu dākhàahn!', 'Nothing to do, so free!'], ['遲啲見！', 'Chìhdī gin!', 'See you later!']];
const SNACKS = [['蛋撻', 'daahntāat', 'egg tart', 0], ['菠蘿包', 'bōlòhbāau', 'pineapple bun', 1], ['魚蛋', 'yùhdáan', 'curry fish balls', 3], ['雞蛋仔', 'gāidáanjái', 'egg waffle', 1], ['燒賣', 'sīumáai', 'siu mai', 3], ['碗仔翅', 'wúnjáichi', 'imitation shark fin soup', 2],
  ['奶茶', 'náaihchàh', 'milk tea', 4], ['叉燒包', 'chāsīubāau', 'BBQ pork bun', 1], ['腸粉', 'chéungfán', 'rice noodle roll', 2], ['格仔餅', 'gaakjáibéng', 'grid waffle', 0], ['牛雜', 'ngàuhjaahp', 'beef offal', 3], ['臭豆腐', 'chaudauhfuh', 'stinky tofu', 3],
  ['楊枝甘露', 'yèuhngjī gāmlouh', 'mango pomelo sago', 5], ['西多士', 'sāidōsí', 'HK French toast', 0], ['鴛鴦', 'yūnyēung', 'coffee + milk tea', 4], ['檸檬茶', 'nìhngmūngchàh', 'lemon tea', 4], ['菠蘿油', 'bōlòhyàuh', 'pineapple bun with butter', 1], ['雪糕', 'syutgōu', 'ice cream (from the Mister Softee van)', 5],
  ['缽仔糕', 'butjáigōu', 'bowl pudding', 5], ['豆腐花', 'dauhfuhfā', 'tofu pudding', 2], ['車仔麵', 'chējáimihn', 'cart noodles', 2], ['雲吞麵', 'wàhntānmihn', 'wonton noodles', 2], ['糖水', 'tòhngséui', 'sweet soup', 2], ['涼茶', 'lèuhngchàh', 'herbal tea', 4]];
const POPO_V = VOICES[2], POPO = { ask: '有冇見過我隻貓呀？', thanks: '多謝晒！你真係好人！', again: '多謝晒你呀！' };
const AUG = [['Bonjour！我係Augustin！', 'Bonjour! Ngóh haih Augustin!', "Bonjour! I'm Augustin!"], ['我鍾意喺樹屋度彈結他！', 'Ngóh jūngyi hái syuhūk douh tàahn gittā!', 'I love playing guitar up in my tree house!'], ['南丫島好靚呀！', "Nàahm'ā Dóu hóu leng a!", 'Lamma is so beautiful!'], ['一齊唱歌啦！', 'Yātchàih cheunggō lā!', "Let's sing together!"], ['慢慢嚟，唔使急！', 'Maahnmáan làih, m̀sái gāp!', 'Take it easy, no rush!']];
const ABAAK = { wait: ['想出海？行多幾個地方先啦！', 'Séung chēut hói? Hàahng dō géi go deihfong sīn lā!', 'Want to go to sea? Walk a few more districts first!'], give: ['你行咗咁多地方，隻帆船借俾你！', 'Néih hàahngjó gam dō deihfong, jek fàahnsyùhn je béi néih!', "You've walked so many places — I'll lend you my junk!"], bye: ['一路順風！', 'Yātlouh seuhnfūng!', 'Bon voyage! (lit. a fair wind all the way)'] };
const FOLK = [ // [key, lon, lat, textures, voice, sfx, lines]
  ['bird', 114.1725, 22.3250, ['birdpa'], 1, 'chirp', [['隻雀仔好靚㗎！', 'Jek jeukjái hóu leng ga!', 'My little bird is so pretty! (Yuen Po Street Bird Garden)'], ['聽吓佢唱歌！', 'Tēng háh kéuih cheunggō!', 'Listen to it sing!']]],
  ['taichi', 114.1880, 22.2815, ['taichi0', 'taichi1'], 0, 'chime', [['早晨！一齊打太極啦！', 'Jóusàhn! Yātchàih dá taaigihk lā!', 'Morning! Come do tai chi with us!'], ['慢慢嚟，深呼吸。', 'Maahnmáan làih, sām fūkāp.', 'Slowly now — deep breaths.']]],
  ['mj', 114.1610, 22.3305, ['mjt'], 2, 'clack', [['食糊！', 'Sihkwùh!', 'Mahjong — I win!'], ['一齊打麻雀吖！', 'Yātchàih dá màhjeuk ā!', 'Come play mahjong with us!']]]];
const SOFTEE = [['雪糕車嚟喇！', 'Syutgōuchē làih la!', 'The ice-cream van is here!'], ['要唔要雪糕呀？', 'Yiu m̀yiu syutgōu a?', 'Want some ice cream?']];
const seaAt = (x, y) => MAP.isWater(x, y) && !!ST.flags.junk; // without the junk you walk; water underfoot is just a stream or a channel you're hopping
const greetVoice = ph => VOICES[GREET.indexOf(ph) % 3];
const allLines = () => [...GREET.map(g => [g[0], greetVoice(g)]), ...Object.values(POPO).map(h => [h, POPO_V]), ...SNACKS.map(s => [s[0], VOICES[0]]), ...AUG.map(l => [l[0], VOICES[1]]), ...Object.values(ABAAK).map(l => [l[0], VOICES[1]]), ...FOLK.flatMap(f => f[6].map(l => [l[0], VOICES[f[4]]])), ...SOFTEE.map(l => [l[0], VOICES[1]])];
let SNACK_AT = null; // where each snack hides: fixed for everyone, spread across town
function snackSpots() {
  if (SNACK_AT) return SNACK_AT; const R = seeded(852), out = [];
  for (let k = 0; k < 40000 && out.length < SNACKS.length; k++) { const x = 40 + R() * (DATA.W - 80), y = 40 + R() * (DATA.H - 80); if (MAP.isWater(x, y) || !districtAt(x, y) || !(MAP.isUrban(x, y) || R() < 0.15)) continue; if (out.some(o => Math.hypot(o.x - x, o.y - y) < 48)) continue; out.push({ x, y }); }
  return SNACK_AT = out;
}
function landNear(R, x, y, r, urban = true) { for (let k = 0; k < 300; k++) { const a = R() * 6.283, d = R() * r, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (!MAP.isWater(px, py) && (!urban || MAP.isUrban(px, py) || k > 200)) return { x: px, y: py }; } return { x, y }; }
function openSnackBook() {
  const got = ST.flags.snk || {}, rv = ST.flags.rv || {}, n = SNACKS.filter(s => got[s[0]]).length, SP = snackSpots();
  openModal(`<div class="hd">${ic('coffee')}<h2>小食 <span class="y">Síusihk</span></h2><button class="iconbtn" data-a="x">${ic('close')}</button></div>
  <p>Street snacks hidden around Hong Kong: <b>${n} / ${SNACKS.length}</b> found · districts walked: <b>${Object.keys(rv).length} / ${DISTS.length}</b>. Walk over a sparkle in free roam to pick one up.</p>
  <div class="snk">${SNACKS.map((s, i) => got[s[0]] ? `<div class="sn"><b>${esc(s[0])}</b><span class="y">${esc(s[1])}</span><small>${esc(s[2])}</small></div>` : `<div class="sn no"><b>？？</b><small>somewhere in ${(d => d ? esc(d.hz) + ' ' + esc(d.yale) : 'Hong Kong')(SP[i] && districtAt(SP[i].x, SP[i].y))}</small></div>`).join('')}</div>`);
  bind($('#modal'), { x: () => closeModal(G.mode !== 'roam') });
}
function makeWorld(tr, run) {
  const F = ST.flags, day = today(), R = seeded(hashStr('npc')), people = [], WB = {};
  F.snk = F.snk || {}; F.rv = F.rv || {};
  const bubble = (o, ph, ms = 3600) => { if (o.bub) o.bub.destroy(); const t = MAP.add.text(o.s.x, o.s.y - o.s.displayHeight - 0.5, ph[0] + '\n' + ph[1], { fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: '12px', color: '#1d2340', backgroundColor: '#fbf3dd', padding: { x: 5, y: 3 }, align: 'center', resolution: 3 }).setOrigin(0.5, 1); t.fixed = 1.2; MAP.fx.add(t); o.bub = t; o.bubT = ms; };
  // neighbours: a couple in every district, a few more around home in Tsing Yi
  for (const d of DISTS) { const g = GEO[d.k]; if (!g || !g.poly) continue; const xs = g.poly.map(p => p[0]), ys = g.poly.map(p => p[1]);
    for (let n = 0, k = 0; n < 2 && k < 400; k++) { const x = Math.min(...xs) + R() * (Math.max(...xs) - Math.min(...xs)), y = Math.min(...ys) + R() * (Math.max(...ys) - Math.min(...ys)); if (MAP.isWater(x, y) || districtAt(x, y) !== d || (!MAP.isUrban(x, y) && k < 300)) continue; people.push({ x, y }); n++; } }
  const home = BY['S:TSY']; for (let n = 0; n < 3; n++) people.push(landNear(R, home.x, home.y, 40));
  const npcs = people.map((p, i) => { const s = MAP.add.image(p.x, p.y, 'npc' + (i % 5)).setOrigin(0.5, 1); s.fixed = 2.0; MAP.fx.add(s); return { s, hx: p.x, hy: p.y, tx: p.x, ty: p.y, wait: R() * 4000, ph: GREET[i % GREET.length], last: -1e9 }; });
  // Pòhpó and her cat (a new hiding place every day)
  const pp = landNear(seeded(7), home.x + 8, home.y + 6, 10), popo = { s: MAP.add.image(pp.x, pp.y, 'popo').setOrigin(0.5, 1), last: -1e9 }; popo.s.fixed = 2.0; MAP.fx.add(popo.s);
  if (!F.cat || F.cat.day !== day) { const r2 = seeded(hashStr(day + 'cat')), far = DISTS.filter(d => d.k !== (districtAt(home.x, home.y) || {}).k), d = far[Math.floor(r2() * far.length)], c = BY[d.k] || d; F.cat = { day, d: d.k, done: false, ...landNear(r2, c.x, c.y, 30) }; }
  const catD = BY[F.cat.d] || DISTS.find(d => d.k === F.cat.d) || { hz: '', yale: '', en: '' };
  const cat = { s: MAP.add.image(F.cat.x, F.cat.y, 'cat').setOrigin(0.5, 1), follow: false }; cat.s.fixed = 2; MAP.fx.add(cat.s); cat.s.setVisible(!F.cat.done);
  // snacks still to find
  const spots = snackSpots(), snacks = SNACKS.map((sn, i) => ({ sn, p: spots[i] })).filter(o => o.p && !F.snk[o.sn[0]]).map(o => { const s = MAP.add.image(o.p.x, o.p.y, 'snk' + o.sn[3]).setOrigin(0.5, 1); s.fixed = 2.0; MAP.fx.add(s); return Object.assign(o, { s }); });
  const WPt = (lo, la) => ({ x: (lo - 113.80) * 1850 * Math.cos(22.35 * Math.PI / 180), y: (22.58 - la) * 1850 }), put = (tex, p) => { const s = MAP.add.image(p.x, p.y, tex).setOrigin(0.5, 1); s.fixed = 2; MAP.fx.add(s); return s; };
  const fade = o => { const d = Math.hypot(o.s.x - tr.x, o.s.y - tr.y), a = Phaser.Math.Clamp((90 - d) / 20, 0, 1); o.s.setAlpha(a).setVisible(a > 0); return d; };
  const talk = (o, ph, voice, ms) => { bubble(o, ph, ms); sayLine(ph[0], voice); if (!o.met) { o.met = true; addPoints(2); mission('greet'); } };
  // Augustin, jamming in his tree house on the hill above Yung Shue Wan
  const ap = landNear(seeded(33), ...Object.values(WPt(114.1180, 22.2230)), 2, false), tree = { s: put('thouse', ap) }, aug = { s: put('aug0', ap), last: -1e9, n: 0, nt: 0 }; tree.s.fixed = 3.2; /* a building, not a person: drawn a bit bigger */
  // the fisherman 阿伯 on the Aberdeen waterfront, who lends his junk to seasoned walkers
  const abaak = { s: put('abaak', landNear(seeded(44), ...Object.values(WPt(114.1545, 22.2490)), 5, false)), last: -1e9 };
  const folk = FOLK.map(([k, lo, la, tx, v, fx, lines]) => { const p = landNear(seeded(hashStr(k)), ...Object.values(WPt(lo, la)), 4, false), o = { k, tx, v, fx, lines, n: 0, last: -1e9, s: put(tx[0], p), x: p.x, y: p.y };
    if (k === 'taichi') o.more = [put(tx[1], p), put(tx[0], p)]; return o; });
  // Mister Softee, crawling up and down Nathan Road with his jingle
  const vp = [[114.1722, 22.2962], [114.1718, 22.3000], [114.1712, 22.3040], [114.1702, 22.3085]].map(p => WPt(...p)), van = { s: put('softee', vp[0]), path: vp, f: 0, dir: 1, last: -1e9, jt: -1e9, n: 0 };
  const hud = () => { const e = $('#rs'); if (e) e.innerHTML = `${ic('coffee')} ${SNACKS.filter(s => F.snk[s[0]]).length}/${SNACKS.length}`; };
  setTimeout(hud, 0);
  const grab = i => { const o = snacks[i]; F.snk[o.sn[0]] = day; MAP.pop(o.s.x, o.s.y - 2, true, 18); o.s.destroy(); snacks.splice(i, 1); sfx('coin'); setTimeout(() => sayLine(o.sn[0], VOICES[0]), 350); addPoints(5); mission('snack'); const n = SNACKS.filter(s => F.snk[s[0]]).length; toast(o.sn[0] + ' +5', o.sn[1], o.sn[2] + ' · 小食 ' + n + '/' + SNACKS.length); hud(); save(); };
  let t = 0;
  return {
    tick(dt, moved, sea) { t += dt; const z = MAP.cam.zoom, near = (o, r) => Math.hypot(o.s.x - tr.x, o.s.y - tr.y) < r;
      for (const o of npcs) { // amble about a little, stay on land, say hello when you pass
        { const d = Math.hypot(o.s.x - tr.x, o.s.y - tr.y), a = Phaser.Math.Clamp((75 - d) / 20, 0, 1); o.s.setAlpha(a).setVisible(a > 0); if (!a) continue; } /* neighbours appear as you approach: less clutter, more discovery */
        if ((o.wait -= dt) <= 0) { const p = landNear(R, o.hx, o.hy, 6); o.tx = p.x; o.ty = p.y; o.wait = 2500 + R() * 5000; }
        const vx = o.tx - o.s.x, vy = o.ty - o.s.y, d = Math.hypot(vx, vy); if (d > 0.2) { o.s.x += vx / d * Math.min(d, 2.2 * dt / 1000); o.s.y += vy / d * Math.min(d, 2.2 * dt / 1000); o.s.setFlipX(vx > 0); o.s.y += Math.sin(t / 90) * 0.02; }
        if (!sea && near(o, 8) && t - o.last > 25000 && t - (WB.t || -1e9) > 3500) { o.last = t; WB.t = t; for (const q of npcs) if (q.bub && q !== o) { q.bub.destroy(); q.bub = null; } bubble(o, o.ph); sayLine(o.ph[0], greetVoice(o.ph)); if (!o.greeted) { o.greeted = true; addPoints(1); mission('greet'); } }
        if (o.bub) { o.bub.setPosition(o.s.x, o.s.y - o.s.displayHeight - 0.5); if ((o.bubT -= dt) <= 0) { o.bub.destroy(); o.bub = null; } } }
      // Pòhpó
      if (!sea && near(popo, 9) && t - popo.last > 9000) { popo.last = t;
        if (F.cat.done) { bubble(popo, [POPO.again, 'Dōjeh saai néih a!', 'Thank you so much!']); sayLine(POPO.again, POPO_V); }
        else if (cat.follow) { F.cat.done = true; cat.follow = false; cat.s.setVisible(false); bubble(popo, [POPO.thanks, 'Dōjeh saai! Néih jānhaih hóu yàhn!', 'Thank you! What a kind person!'], 4500); sayLine(POPO.thanks, POPO_V); sfx('sparkle'); burst(0.5, 0.45, 50); addPoints(20); mission('cat'); toast('搵返隻貓！ +20', 'Wánfāan jek māau!', "Pòhpó's cat is home safe."); save(); }
        else { bubble(popo, [POPO.ask, 'Yáuh móuh gingwo ngóh jek māau a?', ''], 5000); sayLine(POPO.ask, POPO_V); setTimeout(() => G.alive(run) && toast('婆婆 Pòhpó', '佢去咗' + catD.hz + ' · Kéuih heuijó ' + catD.yale, 'Her orange cat wandered off to ' + catD.en + '. Find it and walk it home!', 4200), 900); } }
      if (popo.bub) { popo.bub.setPosition(popo.s.x, popo.s.y - popo.s.displayHeight - 0.5); if ((popo.bubT -= dt) <= 0) { popo.bub.destroy(); popo.bub = null; } }
      // the cat: found → follows you home
      if (!F.cat.done) { if (!cat.follow && !sea && near(cat, 7)) { cat.follow = true; sfx('meow'); MAP.pop(cat.s.x, cat.s.y - 2, true, 10); toast('喵～', 'Mīu~', 'You found the cat! Walk it back to Pòhpó in Tsing Yi.'); }
        if (cat.follow) { const bx = tr.x + (tr.flipX ? -5 : 5), by = tr.y + 1; cat.s.x += (bx - cat.s.x) * Math.min(1, dt / 220); cat.s.y += (by - cat.s.y) * Math.min(1, dt / 220); cat.s.setFlipX(!tr.flipX); cat.s.setVisible(!sea); } else cat.s.y = F.cat.y + (Math.floor(t / 700) % 2 ? -0.2 : 0); }
      const sW = 2 / z;
      // Augustin: strums when you're near, music notes drift up, and his swing tune takes over the music
      { const d = fade(tree); aug.s.setAlpha(tree.s.alpha).setVisible(tree.s.visible).setPosition(tree.s.x - 6.4 * sW, tree.s.y - 9.6 * sW);
        if (d < 70) { if ((aug.nt += dt) > 230) { aug.nt = 0; aug.s.setTexture(aug.s.texture.key === 'aug0' ? 'aug1' : 'aug0'); if (Math.random() < 0.35) { const n = MAP.add.text(aug.s.x + (Math.random() * 6 - 3) * sW, aug.s.y - 12 * sW, Math.random() < 0.5 ? '♪' : '♫', { fontFamily: 'serif', fontSize: '14px', color: '#5a3a8a', resolution: 3 }).setOrigin(0.5); n.fixed = 1; MAP.fx.add(n); MAP.tweens.add({ targets: n, y: n.y - 14 * sW, x: n.x + (Math.random() - 0.5) * 8 * sW, alpha: 0, duration: 1600, onComplete: () => n.destroy() }); } } }
        if (d < 32 && !WB.lamma) { WB.lamma = true; MUSIC.play('lamma'); } else if (d > 48 && WB.lamma) { WB.lamma = false; MUSIC.play(sea ? 'sea' : 'roam'); }
        if (!sea && d < 10 && t - aug.last > 14000) { aug.last = t; const first = !aug.met; talk(aug, AUG[aug.n++ % AUG.length], VOICES[1], 4200); if (first) { addPoints(8); sfx('sparkle'); setTimeout(() => G.alive(run) && toast('識咗新朋友！', 'Sīkjó sān pàhngyáuh!', 'Augustin, a French guitarist, jams in his tree house on Lamma.', 4200), 1200); } }
        if (aug.bub) { aug.bub.setPosition(aug.s.x, aug.s.y - aug.s.displayHeight - 0.5); if ((aug.bubT -= dt) <= 0) { aug.bub.destroy(); aug.bub = null; } } }
      // 阿伯 and his junk
      { const d = fade(abaak); if (!sea && d < 9 && t - abaak.last > 9000) { abaak.last = t; const n = Object.keys(F.rv).length;
          if (F.junk) talk(abaak, ABAAK.bye, VOICES[1]);
          else if (n >= 8) { F.junk = day; talk(abaak, ABAAK.give, VOICES[1], 5000); sfx('sparkle'); burst(0.5, 0.45, 50); addPoints(20); save(); setTimeout(() => G.alive(run) && toast('解鎖帆船！ +20', 'Gáaisó fàahnsyùhn!', 'You can sail across the sea now — just walk into the water.', 5000), 1400); }
          else { talk(abaak, [ABAAK.wait[0], ABAAK.wait[1], ABAAK.wait[2] + ' (' + n + '/8 districts)'], VOICES[1], 4600); } }
        if (abaak.bub) { abaak.bub.setPosition(abaak.s.x, abaak.s.y - abaak.s.displayHeight - 0.5); if ((abaak.bubT -= dt) <= 0) { abaak.bub.destroy(); abaak.bub = null; } } }
      // the regulars: bird-garden grandpa, the tai chi aunties, a mahjong table
      for (const o of folk) { const d = fade(o);
        if (o.more) { const ph = Math.floor(t / 1600) % 2; o.more.forEach((m, k) => m.setPosition(o.x + (k ? 7 : -7) * sW, o.y).setAlpha(o.s.alpha).setVisible(o.s.visible).setTexture(o.tx[(ph + k + 1) % 2]).setFlipX(k === 0)); o.s.setTexture(o.tx[ph]); }
        if (o.k === 'bird' && d < 40 && Math.random() < dt / 2600) sfx('chirp', 0.8 + Math.random() * 0.4);
        if (o.k === 'mj' && d < 40 && Math.random() < dt / 1800) sfx('clack', 0.9 + Math.random() * 0.3);
        if (!sea && d < 9 && t - o.last > 16000) { o.last = t; sfx(o.fx); talk(o, o.lines[o.n++ % o.lines.length], VOICES[o.v]); }
        if (o.bub) { o.bub.setPosition(o.s.x, o.s.y - o.s.displayHeight - 0.5); if ((o.bubT -= dt) <= 0) { o.bub.destroy(); o.bub = null; } } }
      // Mister Softee: drives, stops, plays the jingle when you're close; the first visit gets you a 雪糕
      { van.f += van.dir * dt / 26000; if (van.f > 1 || van.f < 0) { van.dir *= -1; van.f = Phaser.Math.Clamp(van.f, 0, 1); } const p = MAP.ptAt(van.path, van.f), q = MAP.ptAt(van.path, Phaser.Math.Clamp(van.f + van.dir * 0.01, 0, 1)); van.s.setPosition(p.x, p.y).setFlipX(q.x > p.x); const d = fade(van);
        if (d < 30 && t - van.jt > 14000) { van.jt = t; MUSIC.jingle('softee'); }
        if (!sea && d < 9 && t - van.last > 15000) { van.last = t; talk(van, SOFTEE[van.n++ % SOFTEE.length], VOICES[1]); const i = snacks.findIndex(o => o.sn[0] === '雪糕'); if (i >= 0) setTimeout(() => G.alive(run) && snacks[i] && snacks[i].sn[0] === '雪糕' && grab(i), 1500); }
        if (van.bub) { van.bub.setPosition(van.s.x, van.s.y - van.s.displayHeight - 0.5); if ((van.bubT -= dt) <= 0) { van.bub.destroy(); van.bub = null; } } }
      // snacks: bob and twinkle; walk over one to pick it up
      if ((WB.tw = (WB.tw || 0) + dt) > 260 && snacks.length) { WB.tw = 0; const v = MAP.cam.worldView, vis = snacks.filter(o => v.contains(o.s.x, o.s.y)); if (vis.length) { const o = vis[(Math.random() * vis.length) | 0]; MAP.burstEm.ops.scaleX.start = MAP.burstEm.ops.scaleY.start = 1.2 / z; MAP.burstEm.explode(1, o.s.x + (Math.random() - 0.5) * 4, o.s.y - 3); } }
      for (let i = snacks.length - 1; i >= 0; i--) { const o = snacks[i]; o.s.y = o.p.y - 1 - Math.abs(Math.sin(t / 380 + i)) * 1.5; o.s.setAlpha(z > 1.6 ? Phaser.Math.Clamp((110 - Math.hypot(o.s.x - tr.x, o.s.y - tr.y)) / 25, 0, 1) : 0);
        if (!sea && near(o, 6)) grab(i); }
    },
    district(d) { if (d && !F.rv[d.k]) { F.rv[d.k] = day; save(); } },
  };
}
function nearestItem(x, y, rad) { let best = null, bd = rad; for (const o of ITEMS) { if (o.t === 'l' || isArea(o)) continue; const d = Math.hypot(o.x - x, o.y - y); if (d < bd) { bd = d; best = o; } } return best; }
function toastMini(s) { const t = document.createElement('div'); t.className = 'toast'; t.style.padding = '4px 12px'; t.innerHTML = `<i>${esc(s)}</i>`; UI.toasts.appendChild(t); setTimeout(() => t.remove(), 1300); }
const KDOWN = {}, PADV = { x: 0, y: 0, m: 0 };
window.addEventListener('keydown', e => {
  if (MGrun && (e.key === 'Escape' || !(document.activeElement && document.activeElement.tagName === 'INPUT'))) { if (MGrun.key(e)) { e.preventDefault(); return; } }
  const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (typing || $('#modal').style.display === 'flex') return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; KDOWN[k === 'shift' ? 'Shift' : k] = true; if (e.key === 'Shift') KDOWN.Shift = true;
  if (k === 'm' && G.mode !== 'boot') { MUSIC.toggle(); toastMini(ST.settings.music ? '♪ Music on' : '♪ Music off'); return; }
  if (KEYS[k] || KEYS[e.key]) { e.preventDefault(); (KEYS[k] || KEYS[e.key])(); }
  else if (/^Arrow/.test(e.key) && G.mode === 'roam') e.preventDefault();
});
window.addEventListener('keyup', e => { if (MGrun && /^Arrow|^[ad]$/.test(e.key)) MGrun.key(e); const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; KDOWN[k] = false; if (e.key === 'Shift') KDOWN.Shift = false; });
window.addEventListener('blur', () => { for (const k in KDOWN) KDOWN[k] = false; });

export { KDOWN, PADV, SNACKS, allLines, makeWorld, nearestItem, openSnackBook, seaAt, toastMini };
