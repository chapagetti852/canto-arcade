// Tiny synthesized arcade sounds (no audio files). The context starts on the first input,
// as browsers require.
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'square', vol = 0.05): void {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime + at);
  g.gain.setValueAtTime(vol, a.currentTime + at);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + at);
  o.stop(a.currentTime + at + dur + 0.02);
}

export const sfx = {
  unlock: (): void => { ac(); },
  blip: (): void => tone(880, 0, 0.06, 'square', 0.03),
  step: (): void => tone(120 + Math.random() * 40, 0, 0.03, 'triangle', 0.02),
  coin: (): void => { tone(988, 0, 0.08); tone(1319, 0.08, 0.25); },
  nope: (): void => { tone(220, 0, 0.08, 'sawtooth', 0.03); tone(165, 0.09, 0.12, 'sawtooth', 0.03); },
};
