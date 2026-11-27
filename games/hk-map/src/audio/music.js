import { save } from "../core/save.js";
import { ST } from "../core/state.js";

// ---------- music (Tone.js) & sound effects (ZzFX) ----------
const MUSIC = (() => {
  let ready = false, cur = null, part = null, playing = null, vol = null, inst = {}, ducks = 0; const BASE = -11;
  const CH = { E: ['E', 'G#', 'B'], C: ['C', 'E', 'G'], Am: ['A', 'C', 'E'], F: ['F', 'A', 'C'], G: ['G', 'B', 'D'], Em: ['E', 'G', 'B'], Dm: ['D', 'F', 'A'], D: ['D', 'F#', 'A'], Bm: ['B', 'D', 'F#'] };
  const SONGS = { // original tunes written for this game (8th-note steps; '-' holds, '.' rests)
    title: { bpm: 132, bass: 'R.O.F.O.', drums: 'khshkksh', chords: ['C', 'Am', 'F', 'G', 'F', 'C', 'Dm', 'G'], lead: 'C5 . E5 G5 A5 - G5 E5 | D5 - E5 D5 C5 - A4 - | C5 . E5 G5 A5 - C6 A5 | G5 - - - . . E5 G5 | A5 - G5 A5 C6 - A5 G5 | E5 - D5 E5 G5 - E5 D5 | C5 . D5 E5 G5 E5 D5 A4 | C5 - - - . . . .',
      lead2: 'E5 . G5 C6 - - A5 G5 | A5 - G5 E5 D5 - - - | C5 . E5 G5 A5 - G5 E5 | D5 - - - . . . . | F5 - A5 C6 - A5 G5 F5 | E5 - G5 C6 - - G5 E5 | D5 . E5 G5 E5 D5 C5 A4 | C5 - - - . . . .' },
    ride: { bpm: 116, bass: 'RROROFRO', drums: 'khshkhsh', chords: ['G', 'Em', 'G', 'D', 'Em', 'C', 'D', 'G'], lead: 'G4 - B4 D5 - - B4 - | A4 - - G4 E4 - - - | G4 - B4 D5 - E5 D5 B4 | A4 - - - - - . . | B4 - D5 E5 - G5 E5 D5 | E5 - D5 B4 - A4 G4 - | A4 - B4 D5 - B4 A4 E4 | G4 - - - - - . .' },
    practice: { bpm: 100, bass: 'R...F...', drums: 'k.h.s.h.', chords: ['Am', 'Dm', 'C', 'Em', 'F', 'Am', 'G', 'Am'], lead: 'A4 - C5 - E5 - D5 C5 | D5 - - - . . . . | C5 - E5 - G5 - E5 D5 | E5 - - - . . . . | A5 - G5 E5 D5 - E5 G5 | E5 - D5 C5 A4 - - - | C5 D5 E5 - D5 C5 D5 - | A4 - - - . . . .' },
    roam: { bpm: 92, inst: 'pluck', arp: 'soft', bass: 'R...O...', drums: 'k...s..h', chords: ['C', 'Am', 'Dm', 'G', 'C', 'Am', 'F', 'G'],
      lead: 'E5 - G5 A5 G5 - E5 D5 | C5 - - D5 E5 - - - | A4 - C5 D5 E5 - G5 E5 | D5 - - - . . . . | E5 - G5 A5 C6 - A5 G5 | A5 - G5 E5 D5 - - - | C5 D5 E5 G5 E5 - D5 C5 | C5 - - - . . . .',
      lead2: 'G5 - A5 - C6 - A5 G5 | E5 - - - G5 - E5 D5 | C5 - D5 E5 - - D5 C5 | A4 - - - G4 - A4 - | C5 - - D5 E5 - G5 - | A5 - G5 - E5 - D5 - | E5 - G5 E5 D5 C5 A4 - | C5 - - - . . . .' },
    sea: { bpm: 84, inst: 'pluck', arp: 'soft', bass: 'R...O...', drums: 'k.......', chords: ['Am', 'G', 'F', 'G', 'Am', 'Em', 'F', 'G'],
      lead: 'A4 - - C5 D5 - E5 - | D5 - C5 - A4 - - - | G4 - A4 C5 - - D5 - | E5 - - - . . . . | A5 - G5 E5 - - D5 - | C5 - D5 E5 - - G4 - | A4 - C5 D5 E5 G5 E5 D5 | A4 - - - . . . .' },
    lamma: { bpm: 148, inst: 'pluck', bass: 'R.O.R.O.', drums: '.h.h.h.h', chords: ['Am', 'Am', 'Dm', 'Am', 'E', 'E', 'Am', 'Am'], /* Augustin's minor swing, for the tree house */
      lead: 'A4 C5 E5 A5 - G#5 A5 B5 | C6 - B5 A5 E5 - . . | D5 F5 A5 D6 - C6 A5 F5 | E5 - - - . . . . | B4 D5 E5 G#5 - B5 G#5 E5 | A5 - G#5 F5 E5 - D5 B4 | A4 C5 E5 A5 G#5 A5 C6 B5 | A5 - - - . . . .',
      lead2: 'E5 - A5 - C6 - B5 A5 | G#5 - A5 B5 C6 - - - | A5 - F5 - D5 - F5 A5 | G#5 - E5 - B4 - - - | E5 G#5 B5 E6 - D6 B5 G#5 | A5 - C6 - B5 - A5 G#5 | A5 E5 C5 A4 B4 C5 D5 E5 | A4 - - - . . . .' },
    mini: { bpm: 168, bass: 'RORORORO', drums: 'kkshkksh', chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'],
      lead: 'C5 E5 G5 E5 C6 - G5 - | B4 D5 G5 D5 B5 - G5 - | A4 C5 E5 C5 A5 - E5 - | F5 - A5 - C6 - A5 - | G5 - E5 G5 C6 - E5 - | D5 - G5 - B5 - D6 - | C6 - A5 F5 C5 - F5 A5 | G5 - - - B5 - D6 -' },
    rush: { bpm: 156, bass: 'RORORORO', drums: 'khshkksh', chords: ['Em', 'Bm', 'Em', 'G', 'C', 'D', 'Em', 'Em'], lead: 'E5 E5 G5 E5 A5 G5 E5 D5 | E5 - B4 - D5 - E5 - | E5 E5 G5 E5 A5 G5 B5 A5 | G5 - E5 - D5 - B4 - | C5 - E5 - G5 - E5 - | D5 - F#5 - A5 - F#5 - | E5 G5 B5 G5 A5 G5 E5 D5 | E5 - - - B4 - D5 -' },
  };
  const JINGLES = { softee: [['D5', 0, .2], ['F#5', .3, .2], ['A5', .6, .2], ['A5', .9, .4], ['A6', 1.5, .16], ['A6', 1.75, .16], ['F#6', 2.0, .16], ['F#6', 2.25, .3]], arrive: [['E5', 0, .16], ['C5', .2, .4]], doors: [['B5', 0, .06], ['B5', .12, .06], ['B5', .24, .06], ['B5', .36, .06], ['B5', .48, .06]], level: [['C5', 0, .1], ['E5', .1, .1], ['G5', .2, .1], ['C6', .3, .22], ['G5', .56, .1], ['C6', .68, .55]], mission: [['G5', 0, .09], ['B5', .1, .09], ['D6', .2, .09], ['G6', .31, .4]], win: [['C5', 0, .1], ['E5', .12, .1], ['G5', .24, .1], ['C6', .36, .1], ['E6', .48, .45]], stamp: [['G4', 0, .08], ['C5', .1, .3]] };
  function notes(str) { const ev = []; str.split(/\s+/).filter(t => t && t !== '|').forEach((t, i) => { const last = ev[ev.length - 1]; if (t === '-') { if (last && last.open) last.len++; } else if (t === '.') { if (last) last.open = false; } else ev.push({ i, n: t, len: 1, open: true }); }); return ev; }
  function build(S) {
    const T = 96, ev = [], leads = [S.lead, S.lead2].filter(Boolean), bars = S.chords.length * 8 * T, li = S.inst || 'lead';
    leads.forEach((L, k) => { for (const e of notes(L)) ev.push([k * bars + e.i * T, li, e.n, e.len * T - 12]); });
    /* the second time round, the arpeggio climbs an octave and the hats double: a little variety on long sessions */
    for (let k = 0; k < leads.length; k++) S.chords.forEach((c, b0) => { const ch = CH[c], b = b0 + k * S.chords.length;
      S.bass.split('').forEach((p, s) => { if (p !== '.') ev.push([(b * 8 + s) * T, 'bass', p === 'R' ? ch[0] + '2' : p === 'O' ? ch[0] + '3' : ch[2] + '2', T - 14]); });
      if (S.arp === 'soft') { for (let s = 0; s < 8; s++) if (s % 2 === 0) ev.push([b * 8 * T + s * T, 'arp', ch[[0, 2, 1, 2][s / 2]] + (k ? '5' : '4'), 80]); }
      else for (let s = 0; s < 16; s++) ev.push([b * 8 * T + s * 48, 'arp', ch[[0, 1, 2, 1][s % 4]] + (k ? '5' : '4'), 36]);
      S.drums.split('').forEach((p, s) => { const t = (b * 8 + s) * T; if (p === 'k') ev.push([t, 'kick', 'C1', 40]); if (p === 's') ev.push([t, 'snare', null, 40]); if (p === 'h' || (k && p === '.' && s % 2 && S.bpm > 110)) ev.push([t, 'hat', null, 20]); }); });
    return { ev, len: bars * leads.length };
  }
  function init() {
    if (ready || !window.Tone) return ready;
    try {
      vol = new Tone.Volume(BASE).toDestination();
      inst.lead = new Tone.Synth({ oscillator: { type: 'pulse', width: 0.25 }, envelope: { attack: 0.005, decay: 0.12, sustain: 0.45, release: 0.08 }, volume: -9 }).connect(vol);
      inst.bass = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.004, decay: 0.1, sustain: 0.7, release: 0.04 }, volume: -1 }).connect(vol);
      inst.arp = new Tone.Synth({ oscillator: { type: 'pulse', width: 0.125 }, envelope: { attack: 0.002, decay: 0.06, sustain: 0.05, release: 0.03 }, volume: -23 }).connect(vol);
      inst.pluck = new Tone.PluckSynth({ attackNoise: 1.2, dampening: 3600, resonance: 0.93, volume: 2 }).connect(vol); /* a guzheng-ish pluck for the wandering tunes */
      inst.kick = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 4, envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 }, volume: -9 }).connect(vol);
      const hp = new Tone.Filter(6500, 'highpass').connect(vol);
      inst.hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.01 }, volume: -20 }).connect(hp);
      inst.snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.02 }, volume: -17 }).connect(vol);
      inst.jingle = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.003, decay: 0.1, sustain: 0.4, release: 0.1 }, volume: -16 }).toDestination();
      ready = true;
    } catch (e) { ready = false; }
    return ready;
  }
  function stop() { if (!ready) return; try { playing = null; if (part) { part.dispose(); part = null; } Tone.Transport.stop(); Tone.Transport.cancel(); } catch (e) {} }
  function play(name) {
    if (name) cur = name;
    if (!ST.settings.music || !cur || !init() || Tone.context.state !== 'running') return;
    if (part && playing === cur && Tone.Transport.state === 'started') return;
    stop(); const S = SONGS[cur], b = build(S); Tone.Transport.bpm.value = S.bpm;
    part = new Tone.Part((time, e) => { try { const d = Tone.Ticks(e[3]).toSeconds(); if (e[1] === 'hat' || e[1] === 'snare') inst[e[1]].triggerAttackRelease(d, time); else inst[e[1]].triggerAttackRelease(e[2], d, time); } catch (err) {} }, b.ev.map(e => [e[0] + 'i', e]));
    playing = cur; part.loop = true; part.loopEnd = b.len + 'i'; part.start(0); Tone.Transport.position = 0; Tone.Transport.start('+0.05');
  }
  const tempo = bpm => { if (ready && part) Tone.Transport.bpm.rampTo(bpm, 1.5); };
  const duck = on => { if (!ready) return; ducks = Math.max(0, ducks + (on ? 1 : -1)); vol.volume.rampTo(ducks ? BASE - 14 : BASE, 0.15); };
  function jingle(name) { if (!ST.settings.sfx || !init() || Tone.context.state !== 'running') return; const t0 = Tone.now() + 0.03, J = JINGLES[name]; duck(true); J.forEach(([n, t, d]) => inst.jingle.triggerAttackRelease(n, d, t0 + t)); setTimeout(() => duck(false), (J[J.length - 1][1] + J[J.length - 1][2]) * 1000 + 150); }
  function unlock() {
    try { zzfxX.resume(); } catch (e) {}
    try { if (window.Tone) { const p = Tone.start(); if (p && p.then) p.then(() => play(), () => {}); } } catch (e) {}
    try { if (window.Tone && Tone.context.state === 'running') play(); } catch (e) {}
  }
  // keep trying on later taps until the audio is really running (iOS may refuse the first one)
  const retry = () => { try { if (window.Tone && Tone.context.state === 'running' && (!window.zzfxX || zzfxX.state === 'running')) { ['touchend', 'click', 'keydown'].forEach(t => document.removeEventListener(t, retry, true)); return; } } catch (e) {} unlock(); };
  ['touchend', 'click', 'keydown'].forEach(t => document.addEventListener(t, retry, true));
  return { play, stop, tempo, duck, jingle, unlock, toggle() { ST.settings.music = !ST.settings.music; save(); if (ST.settings.music) play(); else stop(); } };
})();
const SFX = { step: [.12, .05, 110, 0, .004, .03, 4, 1, , , , , , 2], splash: [.16, .1, 320, 0, .02, .12, 4, 1, -2, , , , , 3], meow: [.45, .05, 620, .03, .1, .22, 0, 1, 3, -.25, , , , , 14, , , .7], ding: [.45, 0, 1320, 0, .03, .45, 0, 1.6, , , , , .13], horn: [.5, 0, 98, .06, .45, .3, 2, 1, , , , , , .2, 3], whoosh: [.28, .2, 180, .12, .25, .45, 4, 1, 3, , , , , 6], cry: [.35, .05, 1900, .02, .06, .3, 0, 1, -9, , , , , , , , , .7], chime: [.45, 0, 988, 0, .05, .35, 0, 1, , , -247, .09], beep: [.35, 0, 520, 0, .04, .04, 2, 1, , , , , .09], neon: [.16, 0, 60, 0, .25, .05, 2, 1, , , , , , 1.5], clank: [.5, .1, 70, 0, .03, .2, 4, 2, , , , , , 2], blip: [.5, 0, 880, 0, .01, .05, 1], coin: [1, , 1675, , .06, .24, 1, 1.82, , , 837, .06], buzz: [.7, 0, 160, 0, .08, .22, 2, 1, -.6], stamp: [1.6, .1, 90, 0, .03, .25, 4, 2, , , , , , 1.2], sparkle: [.7, 0, 1400, .01, .04, .25, 0, 1, , , 700, .04, .06], pop: [.6, 0, 500, 0, .02, .08, 0, 1, 8], chirp: [.25, .05, 2300, 0, .02, .05, 0, 1, 25, , , , .05], clack: [.45, .1, 700, 0, 0, .03, 4, 1, , , , , .07], bump: [.5, 0, 140, 0, .03, .08, 0, 1, -4], whoosh: [.4, 0, 260, .08, .2, .35, 4, 1, 4] };
function sfx(name, mul) { if (!ST.settings.sfx || typeof zzfx !== 'function') return; try { const p = SFX[name].slice(); if (mul) p[2] *= mul; zzfx(...p); } catch (e) {} }

export { MUSIC, sfx };
