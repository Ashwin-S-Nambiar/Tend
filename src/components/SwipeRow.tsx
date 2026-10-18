import { type ReactNode, useRef } from 'react';
import { haptic } from '../lib/haptics.ts';
import { sfx } from '../lib/sound.ts';

const DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';

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
  const g = useRef<{
    x0: number;
    y0: number;
    dx: number;
    pid: number;
    lock: 'x' | 'y' | null;
    stage: number;
    samples: { t: number; x: number }[];
  } | null>(null);
  const moved = useRef(false);

  function set(dx: number) {
    const f = face.current;
    const w = wrap.current?.offsetWidth ?? 1;
    if (f) f.style.transform = `translateX(${dx}px)`;
    if (hint.current)
      hint.current.style.opacity = String(Math.min(1, -dx / (w * 0.3)));
  }

  function settle(from: number) {
    const f = face.current;
    if (!f) return;
    f.animate(
      [{ transform: `translateX(${from}px)` }, { transform: 'translateX(0)' }],
      {
        duration: 320,
        easing: DRAWER,
      },
    );
    f.style.transform = '';
    if (hint.current) hint.current.style.opacity = '0';
  }

  return (
    <div ref={wrap} className="relative isolate overflow-hidden rounded-[16px]">
      <div
        className="absolute inset-0 -z-10 flex items-center justify-end rounded-[16px] bg-ink px-5"
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
          for (const a of face.current?.getAnimations() ?? []) a.cancel();
          moved.current = false;
          g.current = {
            x0: e.clientX,
            y0: e.clientY,
            dx: 0,
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
              return;
            }
            if (Math.abs(dx) < 8) return;
            s.lock = 'x';
            moved.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          const w = wrap.current?.offsetWidth ?? 1;
          const raw = Math.min(0, dx);
          s.dx =
            raw < -w * 0.8 ? -w * 0.8 - Math.sqrt(-raw - w * 0.8) * 2 : raw;
          const stage = -s.dx > w * 0.6 ? 2 : -s.dx > w * 0.3 ? 1 : 0;
          if (stage !== s.stage) {
            s.stage = stage;
            haptic.tick();
            sfx.tick();
          }
          s.samples.push({ t: performance.now(), x: e.clientX });
          const cut = performance.now() - 90;
          while (s.samples.length > 2 && (s.samples[0]?.t ?? 0) < cut)
            s.samples.shift();
          set(s.dx);
        }}
        onPointerUp={() => {
          const s = g.current;
          g.current = null;
          if (s?.lock !== 'x') return;
          const w = wrap.current?.offsetWidth ?? 1;
          const a = s.samples[0];
          const b = s.samples[s.samples.length - 1];
          const v = a && b && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
          if (-s.dx > w * 0.6 || (-s.dx > w * 0.3 && v < -0.5)) {
            const f = face.current;
            f?.animate(
              [
                { transform: `translateX(${s.dx}px)` },
                { transform: `translateX(${-w}px)` },
              ],
              {
                duration: 180,
                easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
              },
            ).finished.then(() => {
              if (f) f.style.transform = '';
              if (hint.current) hint.current.style.opacity = '0';
              onCommit();
            });
            return;
          }
          settle(s.dx);
        }}
        onPointerCancel={() => {
          const s = g.current;
          g.current = null;
          if (s?.lock === 'x') settle(s.dx);
        }}
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
