export type Mood = 'hello' | 'idle' | 'due' | 'sleep';

const TAU = Math.PI * 2;
const AX = 100;
const AY = 70;
const SEP = 15;

type S = { x: number; v: number };
const sp = (x: number): S => ({ x, v: 0 });

function spring(
  s: S,
  target: number,
  dt: number,
  response: number,
  damping: number,
) {
  const k = (TAU / response) ** 2;
  const c = (4 * Math.PI * damping) / response;
  s.v += (k * (target - s.x) - c * s.v) * dt;
  s.x += s.v * dt;
}

type Rig = {
  svg: SVGSVGElement;
  eyes: SVGPathElement[];
  mood: Mood;
  track: boolean;
  vis: boolean;
  glance: { x: number; y: number; until: number };
  nextBlink: number;
  blink0: number;
  pokeUntil: number;
  gx: S;
  gy: S;
  k: S;
  span: S;
  sw: S;
  w: S[];
  h: S[];
};

const pointer = { x: 0, y: 0, t: -1e9 };
const rigs = new Set<Rig>();
let raf = 0;
let last = 0;

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function target(e: Rig, t: number) {
  const m = e.mood;
  let w = [12, 12];
  let h = [26, 26];
  let k = 0;
  let span = 24;
  let sw = 7.5;
  let gx = e.glance.x;
  let gy = e.glance.y;
  let track = e.track;
  let blink = true;
  if (m === 'due') {
    w = [14, 14];
    h = [30, 30];
    gx = -5;
    gy = 7;
    track = false;
  }
  if (m === 'hello') {
    k = 1;
    span = 26;
    sw = 8;
    gx = 0;
    gy = -2;
    track = false;
    blink = false;
  }
  if (m === 'sleep') {
    k = -1;
    span = 22;
    sw = 5.5;
    gx = 0;
    gy = 9;
    track = false;
    blink = false;
  }
  if (track && pointer.t > t - 2500) {
    const b = e.svg.getBoundingClientRect();
    const dx = pointer.x - (b.left + b.width / 2);
    const dy = pointer.y - (b.top + b.height * 0.4);
    const d = Math.hypot(dx, dy) || 1;
    const mag = Math.min(1, d / 320);
    gx = (dx / d) * mag * 13;
    gy = (dy / d) * mag * 9;
  }
  if (t < e.pokeUntil) {
    w = [22, 22];
    h = [24, 24];
    k = 0;
  }
  return { w, h, k, span, sw, gx, gy, blink };
}

function reset(e: Rig) {
  const tg = target(e, performance.now());
  e.gx = sp(tg.gx);
  e.gy = sp(tg.gy);
  e.k = sp(tg.k);
  e.span = sp(tg.span);
  e.sw = sp(tg.sw);
  e.w = tg.w.map(sp);
  e.h = tg.h.map(sp);
}

function blinkAmt(e: Rig, t: number) {
  const d = t - e.blink0;
  if (d < 0 || d > 190) return 0;
  const q = d < 70 ? d / 70 : 1 - (d - 70) / 120;
  return q * q * (3 - 2 * q);
}

const f2 = (n: number) => n.toFixed(2);

function draw(e: Rig, t: number) {
  const nx = Math.max(-1, Math.min(1, e.gx.x / 13));
  const bl = blinkAmt(e, t);
  const kk = Math.max(-1, Math.min(1, e.k.x));
  const m = Math.abs(kk);
  const s = kk < 0 ? -1 : 1;
  const A = e.span.x;
  e.eyes.forEach((p, i) => {
    const side = i ? 1 : -1;
    const far = Math.sign(nx) === side;
    const a = Math.abs(nx) * (1 - m);
    const w = e.w[i]?.x ?? 12;
    const L = Math.max(0.01, (e.h[i]?.x ?? 26) - w);
    const pts = [
      [0, -L / 2],
      [0, 0],
      [0, L / 2],
    ] as const;
    const arc = [
      [-A / 2, s * A * 0.2],
      [0, -s * A * 0.6],
      [A / 2, s * A * 0.2],
    ] as const;
    const q = pts.map(([x, y], j) => {
      const [ax, ay] = arc[j] ?? [0, 0];
      return [x + (ax - x) * m, y + (ay - y) * m] as const;
    });
    const cx = AX + side * SEP * (1 - 0.14 * a) * (1 + 0.12 * m) + e.gx.x;
    const cy = AY + (i ? 2 : 0) * (1 - m) + e.gy.x;
    const sx = far ? 1 - 0.2 * a : 1 + 0.06 * a;
    const sy = (1 - 0.9 * bl) * (far ? 1 - 0.08 * a : 1);
    const r = nx * 18 * (1 - m);
    const [q0, q1, q2] = q as [
      readonly [number, number],
      readonly [number, number],
      readonly [number, number],
    ];
    p.setAttribute(
      'd',
      `M${f2(q0[0])} ${f2(q0[1])}Q${f2(q1[0])} ${f2(q1[1])} ${f2(q2[0])} ${f2(q2[1])}`,
    );
    p.setAttribute('stroke-width', f2(w + (e.sw.x - w) * m));
    p.setAttribute(
      'transform',
      `translate(${f2(cx)} ${f2(cy)}) rotate(${f2(r)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`,
    );
  });
}

function step(e: Rig, t: number, dt: number) {
  if (t > e.nextBlink) {
    e.blink0 = t;
    e.nextBlink = t + 2400 + Math.random() * 3600;
  }
  if (t > e.glance.until && pointer.t < t - 2500) {
    const g = [
      [0, 0],
      [8, -5],
      [-9, -3],
      [6, 5],
      [-4, -7],
      [10, 0],
    ][Math.floor(Math.random() * 6)] ?? [0, 0];
    e.glance = {
      x: g[0] ?? 0,
      y: g[1] ?? 0,
      until: t + 1600 + Math.random() * 2600,
    };
  }
  const tg = target(e, t);
  if (!tg.blink) e.blink0 = -1e9;
  const n = Math.ceil(dt / (1 / 120));
  const h = dt / n;
  for (let j = 0; j < n; j++) {
    spring(e.gx, tg.gx, h, 0.32, 0.82);
    spring(e.gy, tg.gy, h, 0.32, 0.82);
    spring(e.k, tg.k, h, 0.3, 0.8);
    spring(e.span, tg.span, h, 0.3, 0.9);
    spring(e.sw, tg.sw, h, 0.3, 0.9);
    for (let i = 0; i < 2; i++) {
      const wi = e.w[i];
      const hi = e.h[i];
      if (wi) spring(wi, tg.w[i] ?? 12, h, 0.3, 0.7);
      if (hi) spring(hi, tg.h[i] ?? 26, h, 0.3, 0.7);
    }
  }
  draw(e, t);
}

function loop(t: number) {
  const dt = Math.min((t - last) / 1000, 0.05);
  last = t;
  let any = false;
  if (!document.hidden) {
    for (const e of rigs) {
      if (!e.vis) continue;
      any = true;
      step(e, t, dt);
    }
  }
  raf = any ? requestAnimationFrame(loop) : 0;
}

function wake() {
  if (raf || still() || document.hidden) return;
  last = performance.now();
  raf = requestAnimationFrame(loop);
}

const io = new IntersectionObserver((entries) => {
  for (const x of entries) {
    for (const e of rigs) if (e.svg === x.target) e.vis = x.isIntersecting;
  }
  wake();
});

function poke(e: Rig) {
  e.pokeUntil = performance.now() + 600;
  if (!still() && 'vibrate' in navigator) {
    try {
      navigator.vibrate(8);
    } catch {}
  }
  if (still()) {
    reset(e);
    draw(e, performance.now());
    setTimeout(() => {
      reset(e);
      draw(e, performance.now());
    }, 600);
  }
  wake();
}

export function startPips() {
  addEventListener(
    'pointermove',
    (ev) => {
      pointer.x = ev.clientX;
      pointer.y = ev.clientY;
      pointer.t = performance.now();
      wake();
    },
    { passive: true },
  );
  document.addEventListener('visibilitychange', wake);
  for (const svg of document.querySelectorAll<SVGSVGElement>('svg.pip')) {
    const eyes = [...svg.querySelectorAll<SVGPathElement>('.eye')];
    if (eyes.length !== 2) continue;
    const e: Rig = {
      svg,
      eyes,
      mood: (svg.dataset.mood as Mood) ?? 'idle',
      track: 'track' in svg.dataset,
      vis: false,
      glance: { x: 0, y: 0, until: 0 },
      nextBlink: performance.now() + Math.random() * 3000,
      blink0: -1e9,
      pokeUntil: 0,
      gx: sp(0),
      gy: sp(0),
      k: sp(0),
      span: sp(24),
      sw: sp(7.5),
      w: [sp(12), sp(12)],
      h: [sp(26), sp(26)],
    };
    reset(e);
    rigs.add(e);
    io.observe(svg);
    svg.addEventListener('pointerdown', () => poke(e));
  }
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener(
    'change',
    () => {
      for (const e of rigs) {
        reset(e);
        draw(e, performance.now());
      }
      wake();
    },
  );
}
