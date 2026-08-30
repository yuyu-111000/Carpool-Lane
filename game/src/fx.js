// fx.js —— WebAudio 程序合成音效（零资源依赖）：一套"夜路出租车"声音
let ac = null;
let master = null;
let noiseBuf = null;

export function unlockAudio() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.9;
      master.connect(ac.destination);
    } catch { ac = null; }
  }
  if (ac && ac.state === 'suspended') ac.resume();
}

function noise() {
  if (!noiseBuf) {
    const len = ac.sampleRate * 0.5;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function tone(freq, dur, type, gain, delay, slideTo) {
  if (!ac) return;
  const t0 = ac.currentTime + (delay || 0);
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain || 0.06, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + 0.03);
}

function whoosh(dur, gain, freq, delay) {
  if (!ac) return;
  const t0 = ac.currentTime + (delay || 0);
  const src = ac.createBufferSource();
  src.buffer = noise();
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t0);
  f.frequency.exponentialRampToValueAtTime(freq * 0.4, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0); src.stop(t0 + dur + 0.03);
}

export const sfx = {
  // 滑动：引擎低吼 + 胎噪
  move() {
    tone(70, 0.14, 'sawtooth', 0.05, 0, 130);
    whoosh(0.1, 0.05, 900);
  },
  // 掉头：转向嘀嗒 + 短引擎
  turn() {
    tone(150, 0.08, 'triangle', 0.05, 0, 90);
    tone(320, 0.04, 'square', 0.03, 0.06);
    tone(320, 0.04, 'square', 0.03, 0.11);
  },
  // 接人：出租车"叮-叮"
  pickup() {
    tone(880, 0.09, 'sine', 0.06);
    tone(1320, 0.14, 'sine', 0.06, 0.1);
  },
  // 道闸：栏杆伺服 + 落锁
  gate() {
    tone(120, 0.22, 'square', 0.04, 0, 300);
    tone(60, 0.06, 'square', 0.05, 0.2);
  },
  // 通关：喇叭 + 上扬小调
  win() {
    tone(440, 0.22, 'square', 0.04);
    tone(466, 0.22, 'square', 0.04);
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.15, 'triangle', 0.06, 0.24 + i * 0.09));
  },
  hint() { tone(980, 0.08, 'sine', 0.05); },
};
