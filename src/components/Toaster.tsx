import { useLayoutEffect, useRef, useState } from 'react';
import {
  cancelAnimations,
  EASE,
  presentation,
  reducedMotion,
  type Spring,
  spring,
} from '../lib/motion.ts';
import { useStore } from '../lib/store.ts';
import type { Toast } from '../lib/toast.ts';
import { dismiss, toastStore } from '../lib/toast.ts';

export default function Toaster() {
  const t = useStore(toastStore);
  const el = useRef<HTMLDivElement>(null);
  const x0 = useRef<{ x: number; start: number } | null>(null);
  const travel = useRef<Spring | null>(null);
  const [last, setLast] = useState<Toast | null>(null);
  const shown = t ?? last;
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const current = presentation(node);
    cancelAnimations(node);
    if (t) {
      node.style.transform = '';
      node.style.opacity = '';
      setLast(t);
      node.animate(
        reducedMotion()
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              {
                opacity: current.opacity < 1 ? current.opacity : 0,
                transform: 'translateY(8px)',
              },
              { opacity: 1, transform: 'translateY(0)' },
            ],
        { duration: reducedMotion() ? 100 : 200, easing: EASE },
      );
    } else {
      const animation = node.animate(
        [
          { opacity: current.opacity, transform: current.transform },
          {
            opacity: 0,
            transform: reducedMotion()
              ? current.transform
              : `translate(${current.x}px, 6px)`,
          },
        ],
        { duration: 120, easing: EASE, fill: 'forwards' },
      );
      animation.finished
        .then(() => {
          if (!toastStore.get()) setLast(null);
        })
        .catch(() => {});
    }
    return () => {
      cancelAnimations(node);
      travel.current?.stop();
    };
  }, [t]);
  function settle(from: number) {
    travel.current ??= spring((x) => {
      if (el.current) {
        el.current.style.transform = `translateX(${x}px)`;
        el.current.style.opacity = String(Math.max(0, 1 - Math.abs(x) / 180));
      }
    });
    travel.current.set(from);
    travel.current.to(0);
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-60 flex justify-center px-3 lap:justify-end lap:px-6"
      style={{
        bottom: 'calc(12px + var(--dock, 0px) + max(var(--sab), var(--kb)))',
      }}
    >
      <div role="status" aria-live="polite" className="sr-only">
        {t?.text ?? ''}
      </div>
      {shown && (
        <div
          ref={el}
          className="pointer-events-auto flex w-full max-w-110 touch-pan-y items-center gap-3 rounded-btn bg-ink py-2 pr-2 pl-4 font-semibold text-[15px] text-milk shadow-[0_12px_32px_rgba(14,21,40,0.24)]"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            const current = presentation(e.currentTarget);
            cancelAnimations(e.currentTarget);
            travel.current?.stop();
            x0.current = { x: e.clientX, start: current.x };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (x0.current === null || !el.current) return;
            const dx = x0.current.start + e.clientX - x0.current.x;
            el.current.style.transform = `translateX(${dx}px)`;
            el.current.style.opacity = String(
              Math.max(0, 1 - Math.abs(dx) / 180),
            );
          }}
          onPointerCancel={() => {
            x0.current = null;
            if (el.current) settle(presentation(el.current).x);
          }}
          onPointerUp={(e) => {
            const dx =
              x0.current === null
                ? 0
                : x0.current.start + e.clientX - x0.current.x;
            x0.current = null;
            if (Math.abs(dx) > 70) dismiss();
            else if (el.current) settle(dx);
          }}
        >
          <span className="min-w-0 flex-1 py-2" aria-hidden="true">
            {shown.text}
          </span>
          {shown.undo && (
            <button
              type="button"
              className="press min-h-11 rounded-xl px-3 font-display font-extrabold text-(--toast-accent)"
              data-key="⌘Z"
              onClick={() => {
                shown.undo?.();
                dismiss();
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
