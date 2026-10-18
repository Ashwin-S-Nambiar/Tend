import { useRef } from 'react';
import { useStore } from '../lib/store.ts';
import { dismiss, toastStore } from '../lib/toast.ts';

export default function Toaster() {
  const t = useStore(toastStore);
  const el = useRef<HTMLDivElement>(null);
  const x0 = useRef<number | null>(null);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-3 lap:justify-end lap:px-6"
      style={{
        bottom: 'calc(12px + var(--dock, 0px) + max(var(--sab), var(--kb)))',
      }}
    >
      <div role="status" aria-live="polite" className="sr-only">
        {t?.text ?? ''}
      </div>
      {t && (
        <div
          key={t.id}
          ref={el}
          className="fade-in pointer-events-auto flex w-full max-w-110 touch-pan-y items-center gap-3 rounded-[18px] bg-ink py-2 pr-2 pl-4 font-semibold text-[15px] text-milk shadow-[0_12px_32px_rgba(14,21,40,0.24)]"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            x0.current = e.clientX;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (x0.current === null || !el.current) return;
            const dx = e.clientX - x0.current;
            el.current.style.transform = `translateX(${dx}px)`;
            el.current.style.opacity = String(
              Math.max(0, 1 - Math.abs(dx) / 180),
            );
          }}
          onPointerUp={(e) => {
            const dx = x0.current === null ? 0 : e.clientX - x0.current;
            x0.current = null;
            if (Math.abs(dx) > 70) dismiss();
            else if (el.current) {
              el.current.style.transform = '';
              el.current.style.opacity = '';
            }
          }}
        >
          <span className="min-w-0 flex-1 py-2" aria-hidden="true">
            {t.text}
          </span>
          {t.undo && (
            <button
              type="button"
              className="press min-h-11 rounded-xl px-3 font-display font-extrabold text-(--toast-accent)"
              data-key="⌘Z"
              onClick={() => {
                t.undo?.();
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
