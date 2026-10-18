import { type ReactNode, useEffect, useRef } from 'react';
import { haptic } from '../lib/haptics.ts';
import {
  presentation,
  project,
  rubberband,
  type Spring,
  spring,
} from '../lib/motion.ts';
import { sfx } from '../lib/sound.ts';

export default function SwipeRow({
  children,
  label,
  onCommit,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onCommit: () => void;
  disabled?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLSpanElement>(null);
  const travel = useRef<Spring | null>(null);
  const g = useRef<{
    x0: number;
    y0: number;
    start: number;
    dx: number;
    pid: number;
    lock: 'x' | null;
    stage: number;
    samples: { t: number; x: number }[];
  } | null>(null);
  const moved = useRef(false);
  function motion() {
    travel.current ??= spring((x) => {
      if (face.current) face.current.style.transform = `translateX(${x}px)`;
      if (hint.current)
        hint.current.style.opacity = String(
          Math.min(
            1,
            Math.max(0, -x / ((wrap.current?.offsetWidth ?? 1) * 0.3)),
          ),
        );
    });
    return travel.current;
  }
  useEffect(() => () => travel.current?.stop(), []);
  function release(cancelled = false) {
    const s = g.current;
    g.current = null;
    if (s?.lock !== 'x') return;
    const w = wrap.current?.offsetWidth ?? 1;
    const a = s.samples[0];
    const b = s.samples[s.samples.length - 1];
    const velocity =
      a && b && b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
    const projected = s.dx + project(velocity);
    if (
      !cancelled &&
      velocity <= 50 &&
      -s.dx > w * 0.3 &&
      -projected > w * 0.6
    ) {
      motion().to(-w, {
        velocity,
        precision: 2,
        onComplete: () => {
          onCommit();
          motion().set(0);
        },
      });
    } else motion().to(0, { velocity: cancelled ? 0 : velocity });
  }
  return (
    <div ref={wrap} className="relative isolate overflow-hidden rounded-2xl">
      <div
        className="absolute inset-0 -z-10 flex items-center justify-end rounded-2xl bg-ink px-5"
        aria-hidden="true"
      >
        <span
          ref={hint}
          className="font-bold font-display text-[15px] text-milk opacity-0"
        >
          {label}
        </span>
      </div>
      <div
        ref={face}
        className="touch-pan-y"
        onPointerDown={(e) => {
          if (disabled || e.button !== 0 || e.pointerType === 'mouse') return;
          const left = wrap.current?.getBoundingClientRect().left ?? 0;
          if (e.clientX < 20 || e.clientX < left) return;
          const current = face.current ? presentation(face.current).x : 0;
          motion().set(current, motion().velocity);
          moved.current = false;
          g.current = {
            x0: e.clientX,
            y0: e.clientY,
            start: current,
            dx: current,
            pid: e.pointerId,
            lock: null,
            stage: 0,
            samples: [{ t: performance.now(), x: e.clientX }],
          };
        }}
        onPointerMove={(e) => {
          const s = g.current;
          if (!s || s.pid !== e.pointerId) return;
          const dx = e.clientX - s.x0;
          const dy = e.clientY - s.y0;
          if (!s.lock) {
            if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
              g.current = null;
              motion().to(0);
              return;
            }
            if (Math.abs(dx) < 8) return;
            s.lock = 'x';
            moved.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          const w = wrap.current?.offsetWidth ?? 1;
          const raw = s.start + dx;
          s.dx =
            raw > 0
              ? rubberband(raw, w)
              : raw < -w * 0.8
                ? -w * 0.8 + rubberband(raw + w * 0.8, w)
                : raw;
          const stage = -s.dx > w * 0.6 ? 2 : -s.dx > w * 0.3 ? 1 : 0;
          if (stage !== s.stage) {
            s.stage = stage;
            haptic.tick();
            sfx.tick();
          }
          s.samples.push({ t: performance.now(), x: e.clientX });
          while (
            s.samples.length > 2 &&
            (s.samples[0]?.t ?? 0) < performance.now() - 90
          )
            s.samples.shift();
          motion().set(s.dx);
        }}
        onPointerUp={() => release()}
        onPointerCancel={() => release(true)}
        onClickCapture={(e) => {
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
