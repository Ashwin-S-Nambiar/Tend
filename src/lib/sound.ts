import { createStore } from './store.ts';

export const soundStore = createStore('tend:sound', true);

type Nav = Navigator & {
  audioSession?: { type: string };
  userActivation?: { hasBeenActive: boolean };
};

let ctx: AudioContext | null = null;
let white: AudioBuffer | null = null;

function audio() {
  const nav = navigator as Nav;
  if (nav.userActivation && !nav.userActivation.hasBeenActive) return null;
  if (!ctx) {
    if (!('AudioContext' in window)) return null;
    if (nav.audioSession) nav.audioSession.type = 'ambient';
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(o: {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(o.gain ?? 0.05, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t);
  osc.stop(t + o.dur + 0.03);
}

function noise(o: {
  dur: number;
  gain?: number;
  freq?: number;
  q?: number;
  delay?: number;
}) {
  const c = audio();
  if (!c) return;
  if (!white) {
    white = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = white.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = white;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 800, t);
  f.frequency.exponentialRampToValueAtTime((o.freq ?? 800) * 2.2, t + o.dur);
  f.Q.value = o.q ?? 0.7;
  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(o.gain ?? 0.04, t + o.dur * 0.4);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f).connect(amp).connect(c.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + o.dur + 0.02);
}

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const play = (fn: () => void) => () => {
  if (!soundStore.get() || document.hidden || still()) return;
  try {
    fn();
  } catch {}
};

export const sfx = {
  taken: play(() => {
    tone({ freq: 660, dur: 0.35, gain: 0.07 });
    tone({ freq: 990, dur: 0.4, gain: 0.06, delay: 0.09 });
  }),
  skip: play(() => tone({ freq: 330, to: 280, dur: 0.12, gain: 0.05 })),
  snooze: play(() => {
    tone({ freq: 1200, dur: 0.04, gain: 0.03 });
    tone({ freq: 1200, dur: 0.04, gain: 0.03, delay: 0.09 });
  }),
  whoosh: play(() => noise({ dur: 0.28, gain: 0.03, freq: 500 })),
  night: play(() => {
    tone({ freq: 392, dur: 1.1, gain: 0.05 });
    tone({ freq: 587, dur: 1.2, gain: 0.035, delay: 0.14 });
  }),
  tick: play(() => tone({ freq: 1800, dur: 0.02, gain: 0.02 })),
  tap: play(() => tone({ freq: 740, to: 560, dur: 0.035, gain: 0.02 })),
};
