import { $, BUNDLED, ITEMS, esc, ic } from "../core/util";
import { ANKI } from "../core/anki";
import { JP } from "../core/rom";
import { setRomanisation } from "../../../../src/shared/romanisation";
import { MUSIC } from "../audio/music";
import { bind } from "./dom";
import { audioFor, azure, fileOf, lineFile, lineUrl, playUrl, saveToFolder } from "../audio/voice";
import { BOX, closeModal, openModal } from "./modal";
import { allLines } from "../world/roam";
import { MAP } from "../scenes/MapScene";
import { DIR, SYNC, dbGet, dbSet, dirOK, importState, publicState, reconnectFolder, save, useFolder } from "../core/save";
import { ST, ankiReady, fresh, setST, today } from "../core/state";

// ---------- settings ----------
let resetArmed = false;
function openSettings() {
  const s = ST.settings, ready = ANKI ? ankiReady() : [];
  openModal(`<div class="hd">${ic('settings-cog')}<h2>設定 <span class="y">Chitdihng</span></h2><button class="iconbtn" data-a="x">${ic('close')}</button></div>
  <div data-no-rom><h3>拼音 Romanisation</h3>
  <div class="rowb"><button class="btn sm ${JP ? '' : 'gold'}" data-a="yale">Yale · Gwóngdūngwá</button><button class="btn sm ${JP ? 'gold' : ''}" data-a="jyutping">Jyutping · gwong2 dung1 waa2</button></div>
  <p>How Cantonese is written in every game of the arcade, and how you type your answers. Yale (tone marks) is what the CLA textbooks use; Jyutping (tone numbers) is common in dictionaries and apps. Your progress is the same either way.</p></div>
  <h3>${ic('music')} Music & sound</h3>
  <div class="rowb"><button class="btn sm ${s.music ? 'gold' : ''}" data-a="music">♪ Music ${s.music ? 'on' : 'off'}</button><button class="btn sm ${s.sfx ? 'gold' : ''}" data-a="sfx">Sound effects ${s.sfx ? 'on' : 'off'}</button><button class="btn sm ${s.tones ? 'gold' : ''}" data-a="tones">Tone keys ${s.tones ? 'on' : 'off'}</button></div>
  <p>Tone keys add ā á a àh áh ah buttons under the answer box (handy on phones). On a keyboard you can also type tone numbers: <span class="y">yau4 → yàuh</span>, <span class="y">sik1 → sīk</span>.</p>
  <h3>${ic('volume-3')} Voice</h3>
  <p>Names are spoken from recordings that ship with the game, or by your device's Cantonese voice. Optional: paste your own Azure Speech key for natural voices on every name — it stays in this browser only.</p>
  <label>Azure key (optional)</label><input id="m-key" type="password" value="${esc(s.key || '')}" placeholder="your Azure Speech key" autocomplete="off">
  <label>Region</label><input id="m-region" value="${esc(s.region || '')}" placeholder="eastasia">
  <label>Voice</label><select id="m-voice">${[['zh-HK-HiuMaanNeural', 'HiuMaan · female'], ['zh-HK-HiuGaaiNeural', 'HiuGaai · female'], ['zh-HK-WanLungNeural', 'WanLung · male']].map(([v, l]) => `<option value="${v}" ${v === s.voice ? 'selected' : ''}>${l}</option>`).join('')}</select>
  <div class="rowb"><button class="btn sm" data-a="test">試聽 Test</button><button class="btn sm" data-a="all">Make the missing sound files</button></div><div class="stt" id="m-audio"></div>
  <h3>${ic('download')} Your progress</h3>
  <p>Progress is saved in this browser. To move it to another device (or keep a backup), save it to a file and load it there.</p>
  <div class="rowb"><button class="btn sm" data-a="exp">${ic('download')} Save progress file</button><label class="btn sm" style="margin:0">${ic('upload')} Load progress file<input type="file" id="m-imp" accept=".json,application/json" hidden></label></div><div class="stt" id="m-prog"></div>
  ${ANKI ? `<h3>${ic('reload')} Sync my devices (private)</h3>
  ${SYNC.on() ? `<p>This browser shares progress with your other devices through a secret GitHub gist. It syncs on its own when you play, open or leave the game.</p>
  <div class="rowb"><button class="btn sm gold" data-a="syncnow">${ic('reload')} Sync now</button><button class="btn sm" data-a="syncoff">Stop syncing here</button></div><div class="stt" id="m-sync">${esc(SYNC.status())}</div>`
  : `<p>Paste a GitHub token that can only touch gists (make one at github.com → Settings → Developer settings → Tokens (classic), with just the <b>gist</b> box ticked). Use the same token on your Mac and your phone. It's stored in this browser only.</p>
  <label>GitHub token</label><input id="m-gh" type="password" placeholder="ghp_…" autocomplete="off"><div class="rowb"><button class="btn sm gold" data-a="syncon">Connect</button></div><div class="stt" id="m-sync"></div>`}
  <h3>${ic('upload')} Anki (private — only on this browser)</h3>
  <p>Mastered names that have a card in your deck: <b class="y">${ready.length}</b> ready${Object.keys(ST.sent).length ? ' · ' + Object.keys(ST.sent).length + ' already sent' : ''}. Copy the sync code and paste it to Claude ("sync my HK map game") — Claude unsuspends those cards in Anki.</p>
  <div class="rowb"><button class="btn sm gold" data-a="code" ${ready.length ? '' : 'disabled'}>${ic('copy')} Copy sync code</button>${window.showDirectoryPicker ? `<button class="btn sm" data-a="folder">${DIR ? (dirOK ? '✔ Folder linked: ' + esc(DIR.name) : 'Reconnect game folder') : 'Link game folder (desktop)'}</button>` : ''}<button class="btn sm ghost" data-a="ankioff">Turn Anki mode off</button></div>
  <textarea id="m-code" readonly hidden></textarea><div class="stt" id="m-anki"></div>` : ''}
  <h3>Start over</h3>
  <div class="rowb"><button class="btn sm" style="background:#7a1f1a" data-a="reset">${resetArmed ? 'Tap again to erase all progress' : 'Reset progress…'}</button></div>
  <p style="margin-top:14px">Credits: Phaser · Tone.js · ZzFX · canvas-confetti · pixelarticons · Fusion Pixel Font · Hong Kong coastline: Lands Department iB5000 via the CSDI Portal (HKSAR Government) · other map data © OpenStreetMap contributors (ODbL) · photos from Wikimedia Commons (credited on each card) · church data from GCatholic.org.</p>`);
  const st = (id, t) => { const e = $('#' + id); if (e) e.textContent = t; };
  const keep = () => { s.key = $('#m-key').value.trim(); s.region = $('#m-region').value.trim().toLowerCase(); s.voice = $('#m-voice').value; save(); };
  ['m-key', 'm-region', 'm-voice'].forEach(id => $('#' + id).addEventListener('change', keep));
  bind(BOX, {
    yale: () => { keep(); setRomanisation('yale'); location.reload(); }, jyutping: () => { keep(); setRomanisation('jyutping'); location.reload(); },
    x: () => { keep(); resetArmed = false; closeModal(); },
    music: () => { keep(); MUSIC.toggle(); openSettings(); }, sfx: () => { keep(); s.sfx = !s.sfx; save(); openSettings(); }, tones: () => { keep(); s.tones = !s.tones; ST.flags.tonesSet = 1; save(); openSettings(); },
    test: async () => { keep(); st('m-audio', 'Asking Azure…'); try { const b = await azure('尖沙咀'); MUSIC.duck(true); await playUrl(URL.createObjectURL(b)); st('m-audio', 'Works! 好嘢 Hóu yéh!'); } catch (e) { st('m-audio', s.key ? 'Azure did not answer (' + (e.message || e) + '). Check the key and region.' : 'No key: names use the recordings or your device voice.'); } finally { MUSIC.duck(false); } },
    all: async () => { keep(); let n = 0, made = 0, fail = 0, copied = 0; for (const it of ITEMS) { n++; const f = fileOf(it.k); if (BUNDLED.has(f)) continue; const have = await dbGet('audio', f); if (have) { if (ANKI && DIR && dirOK) { await saveToFolder(f, have); copied++; } continue; } if (!s.key) continue; st('m-audio', 'Making sound files… ' + n + '/' + ITEMS.length); try { await audioFor(it, true); made++; } catch (e) { if (++fail > 3) { st('m-audio', 'Stopped: ' + (e.message || e)); return; } } } for (const [hz, v] of allLines()) { const f = lineFile(hz, v); if (BUNDLED.has(f)) continue; const have = await dbGet('audio', f); if (have) { if (ANKI && DIR && dirOK) { await saveToFolder(f, have); copied++; } continue; } if (!s.key) continue; st('m-audio', 'Making voice lines… ' + hz); try { await lineUrl(hz, v, true); made++; } catch (e) { if (++fail > 3) { st('m-audio', 'Stopped: ' + (e.message || e)); return; } } }
      st('m-audio', 'Done: ' + made + ' new sound files' + (copied ? ', ' + copied + ' copied' : '') + '.' + (ANKI && dirOK ? ' Saved in your game folder too.' : '') + (!s.key && !made ? ' (No Azure key: nothing new made.)' : '')); },
    exp: () => { const b = new Blob([JSON.stringify(publicState(), null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'hk-map-progress-' + today() + '.json'; document.body.appendChild(a); a.click(); a.remove(); st('m-prog', 'Saved.'); },
    code: async () => { const ks = ankiReady().map(i => i.k); const code = 'HKMAP-ANKI ' + today() + ' ' + ks.join(' '); const ta = $('#m-code'); ta.hidden = false; ta.value = code; ta.select(); try { await navigator.clipboard.writeText(code); } catch (e) { document.execCommand && document.execCommand('copy'); } ks.forEach(k => ST.sent[k] = today()); save(); st('m-anki', 'Copied ' + ks.length + ' names. Paste the code to Claude.'); },
    folder: async () => { try { if (DIR && !dirOK && await reconnectFolder(true)) {} else { const h = await window.showDirectoryPicker({ id: 'hkmapgame', mode: 'readwrite' }); await dbSet('kv', 'dir', h); await useFolder(h); } openSettings(); } catch (e) { st('m-anki', e.message || String(e)); } },
    syncon: async () => { const t = ($('#m-gh') || {}).value || ''; if (!t.trim()) return st('m-sync', 'Paste the token first.'); st('m-sync', 'Connecting…'); await SYNC.connect(t); if (/failed/.test(SYNC.status())) { st('m-sync', SYNC.status()); SYNC.off(); } else openSettings(); },
    syncnow: async () => { st('m-sync', 'Syncing…'); await SYNC.run(); st('m-sync', SYNC.status()); },
    syncoff: () => { SYNC.off(); openSettings(); },
    ankioff: () => { try { localStorage.removeItem('hkmap-anki'); } catch (e) {} location.reload(); },
    reset: () => { keep(); if (!resetArmed) { resetArmed = true; openSettings(); return; } resetArmed = false; const k = ST.settings; setST(fresh()); ST.settings = k; save(); closeModal(); },
  });
  $('#m-imp').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { importState(JSON.parse(await f.text())); st('m-prog', 'Loaded. Welcome back!'); MAP.refresh(); } catch (err) { st('m-prog', 'Could not read that file: ' + (err.message || err)); } });
}

// ---------- start ----------

export { openSettings };
