import { BUNDLED } from "../core/util.js";
import { ANKI } from "../core/anki.js";
import { MUSIC } from "./music.js";
import { DIR, dbGet, dbSet, dirOK } from "../core/save.js";
import { ST, hashStr } from "../core/state.js";

// ---------- names spoken: bundled recordings → saved Azure clips → your own Azure key → the device's Cantonese voice ----------
const fileOf = k => k.replace(':', '_') + '.mp3';
let VOICE = null;
function pickVoice() { try { const vs = speechSynthesis.getVoices(); VOICE = vs.find(v => /zh[-_]HK/i.test(v.lang)) || vs.find(v => /yue/i.test(v.lang)) || null; } catch (e) {} }
function playUrl(u) { return new Promise((res, rej) => { const a = new Audio(u); a.onended = res; a.onerror = rej; a.play().catch(rej); }); }
function speak(text) { return new Promise(res => { if (!window.speechSynthesis) return res(); try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-HK'; if (VOICE) u.voice = VOICE; u.rate = 0.85; u.onend = res; u.onerror = res; speechSynthesis.speak(u); setTimeout(res, 4000); } catch (e) { res(); } }); }
async function azure(text, voice) {
  const s = ST.settings; if (!s.key || !s.region) throw new Error('no key');
  const ssml = `<speak version="1.0" xml:lang="zh-HK"><voice name="${voice || s.voice}">${text.replace(/[<&>]/g, '')}</voice></speak>`;
  const r = await fetch(`https://${s.region.trim()}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': s.key.trim(), 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3' }, body: ssml });
  if (!r.ok) throw new Error('Azure ' + r.status); return await r.blob();
}
async function saveToFolder(f, b) { if (!ANKI || !DIR || !dirOK) return; try { const ad = await DIR.getDirectoryHandle('audio', { create: true }); const w = await (await ad.getFileHandle(f, { create: true })).createWritable(); await w.write(b); await w.close(); } catch (e) {} }
async function audioFor(it, make) {
  const f = fileOf(it.k);
  if (BUNDLED.has(f)) return 'audio/' + encodeURIComponent(f);
  const c = await dbGet('audio', f); if (c) return URL.createObjectURL(c);
  if (make && ST.settings.key && ST.settings.region) { const b = await azure(it.hz); await dbSet('audio', f, b); saveToFolder(f, b); return URL.createObjectURL(b); }
  return null;
}
let sayGen = 0;
/* spoken lines (neighbours, Pòhpó, snack names): a bundled Azure clip if the game ships one, else one made with your own key (kept in this browser), else the device voice */
const VOICES = ['zh-HK-HiuMaanNeural', 'zh-HK-WanLungNeural', 'zh-HK-HiuGaaiNeural'];
const lineFile = (hz, v) => 'ph_' + hashStr(v + '|' + hz).toString(36) + '.mp3';
async function lineUrl(hz, v, make) { const f = lineFile(hz, v); if (BUNDLED.has(f)) return 'audio/' + f; const c = await dbGet('audio', f); if (c) return URL.createObjectURL(c);
  if (make && ST.settings.key && ST.settings.region) { const b = await azure(hz, v); await dbSet('audio', f, b); saveToFolder(f, b); return URL.createObjectURL(b); } return null; }
async function sayLine(hz, v = VOICES[0]) { const g = ++sayGen; MUSIC.duck(true);
  try { const u = await lineUrl(hz, v, true).catch(() => null); if (g !== sayGen) return; if (u) { try { await playUrl(u); return; } catch (e) {} } await speak(hz); } finally { MUSIC.duck(false); } }
async function say(it) {
  if (!it) return; const g = ++sayGen; MUSIC.duck(true);
  try { const u = await audioFor(it, true).catch(() => null); if (g !== sayGen) return; if (u) { try { await playUrl(u); return; } catch (e) {} } await speak(it.hz); }
  finally { MUSIC.duck(false); }
}

export { VOICES, audioFor, azure, fileOf, lineFile, lineUrl, pickVoice, playUrl, saveToFolder, say, sayLine };
