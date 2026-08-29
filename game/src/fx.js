// fx.js —— WebAudio 程序合成音效（零资源依赖）+ 首次手势解锁
let ac = null;

export function unlockAudio() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; }
  }
  if (ac && ac.state === 'suspended') ac.resume();
}

function tone(freq, dur, type, gain, delay, slideTo) {
  if (!ac) return;
  const t0 = ac.currentTime + (delay || 0);
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(gain || 0.06, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ac.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  move() { tone(180, 0.07, 'triangle', 0.05, 0, 140); },
  pickup() { tone(660, 0.09, 'square', 0.05); tone(880, 0.12, 'square', 0.05, 0.09); },
  gate() { tone(320, 0.25, 'sawtooth', 0.04, 0, 520); },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.05, i * 0.09));
  },
  hint() { tone(980, 0.08, 'sine', 0.05); },
};
