import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from 'react';

const DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';
const OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wide = () =>
  matchMedia('(min-width: 600px) and (min-height: 501px)').matches;

export default function Sheet({
  open,
  onClose,
  onClosed,
  label,
  children,
  header,
  footer,
  pushHistory = true,
  size = 'md',
  tone,
  detents = false,
}: {
  open: boolean;
  onClose: () => void;
  onClosed?: () => void;
  label: string;
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  pushHistory?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'milk';
  detents?: boolean;
}) {
  const base = useRef(0);
  const id = useId();
  const dlg = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const closing = useRef(false);
  const openedAt = useRef(0);
  const pushed = useRef(false);
  const cb = useRef(onClose);
  cb.current = onClose;
  const closed = useRef(onClosed);
  closed.current = onClosed;
  const drag = useRef<{
    y0: number;
    dy: number;
    samples: { t: number; y: number }[];
    pid: number;
    armed: boolean;
  } | null>(null);

  const finish = useCallback(() => {
    const d = dlg.current;
    if (d?.open) d.close();
    closing.current = false;
    const el = opener.current as HTMLElement | null;
    if (el?.isConnected) el.focus({ preventScroll: true });
    closed.current?.();
  }, []);

  const animateOut = useCallback(
    (fromY = 0) => {
      const p = panel.current;
      const s = scrim.current;
      if (!p || !s || closing.current) return;
      closing.current = true;
      if (still()) {
        p.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 160,
          fill: 'forwards',
        });
        s.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 160,
          fill: 'forwards',
        }).onfinish = finish;
        return;
      }
      p.animate(
        wide()
          ? [
              { opacity: 1, transform: 'translateY(0) scale(1)' },
              { opacity: 0, transform: 'translateY(8px) scale(0.98)' },
            ]
          : [
              { transform: `translateY(${fromY}px)` },
              { transform: 'translateY(100%)' },
            ],
        { duration: 200, easing: OUT, fill: 'forwards' },
      );
      s.animate([{ opacity: getComputedStyle(s).opacity }, { opacity: 0 }], {
        duration: 200,
        easing: OUT,
        fill: 'forwards',
      }).onfinish = finish;
    },
    [finish],
  );

  const requestClose = useCallback(() => {
    if (pushed.current && history.state?.sheet === id) history.back();
    else cb.current();
  }, [id]);

  useLayoutEffect(() => {
    const d = dlg.current;
    const p = panel.current;
    const s = scrim.current;
    if (!d || !p || !s) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      openedAt.current = performance.now();
      closing.current = false;
      d.showModal();
      p.focus({ preventScroll: true });
      for (const a of p.getAnimations()) a.cancel();
      for (const a of s.getAnimations()) a.cancel();
      if (still()) {
        p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
        s.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
      } else if (wide()) {
        p.animate(
          [
            { opacity: 0, transform: 'translateY(12px) scale(0.97)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
          ],
          { duration: 260, easing: OUT },
        );
        s.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 260,
          easing: OUT,
        });
      } else {
        const half = detents ? Math.round(p.offsetHeight * 0.45) : 0;
        base.current = half;
        p.style.transform = half ? `translateY(${half}px)` : '';
        if (body.current) body.current.style.overflowY = half ? 'hidden' : '';
        p.animate(
          [
            { transform: 'translateY(100%)' },
            { transform: `translateY(${half}px)` },
          ],
          {
            duration: 380,
            easing: DRAWER,
          },
        );
        s.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 380,
          easing: DRAWER,
        });
      }
      if (pushHistory && history.state?.sheet !== id) {
        history.pushState({ ...(history.state ?? {}), sheet: id }, '');
        pushed.current = true;
      }
    } else if (!open && d.open) {
      animateOut();
      if (pushed.current && history.state?.sheet === id) {
        pushed.current = false;
        history.back();
      }
      pushed.current = false;
    }
  }, [open, id, animateOut, pushHistory, detents]);

  useEffect(() => {
    const onPop = () => {
      if (pushed.current && history.state?.sheet !== id) {
        pushed.current = false;
        cb.current();
      }
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [id]);

  useEffect(
    () => () => {
      if (dlg.current?.open) dlg.current.close();
    },
    [],
  );

  function lockBody() {
    if (body.current)
      body.current.style.overflowY = base.current > 0 ? 'hidden' : '';
  }

  function setY(y: number) {
    const p = panel.current;
    const s = scrim.current;
    if (!p || !s) return;
    p.style.transform = `translateY(${y}px)`;
    const h = p.offsetHeight || 1;
    const from = detents ? Math.round(h * 0.45) : 0;
    s.style.opacity = String(
      Math.max(0, 1 - Math.max(0, y - from) / (h - from || 1)),
    );
  }

  function down(e: React.PointerEvent, fromBody: boolean) {
    if (wide() || e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (
      t.closest('button, a, input, select, textarea, [data-nodrag]') &&
      !fromBody
    )
      return;
    if (
      fromBody &&
      (t.closest('input, select, textarea, [data-nodrag]') ||
        (base.current === 0 && (body.current?.scrollTop ?? 0) > 0))
    )
      return;
    drag.current = {
      y0: e.clientY,
      dy: 0,
      samples: [{ t: performance.now(), y: e.clientY }],
      pid: e.pointerId,
      armed: !fromBody,
    };
    if (!fromBody)
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent) {
    const g = drag.current;
    if (!g || g.pid !== e.pointerId) return;
    let dy = e.clientY - g.y0;
    if (!g.armed) {
      if (Math.abs(dy) < 6) return;
      if (
        base.current === 0 &&
        (dy < 0 || (body.current?.scrollTop ?? 0) > 0)
      ) {
        drag.current = null;
        return;
      }
      g.armed = true;
      g.y0 = e.clientY;
      dy = 0;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    const at = base.current + dy;
    const y = at >= 0 ? at : -Math.sqrt(-at) * 2;
    g.dy = y;
    g.samples.push({ t: performance.now(), y: e.clientY });
    const cut = performance.now() - 90;
    while (g.samples.length > 2 && (g.samples[0]?.t ?? 0) < cut)
      g.samples.shift();
    for (const a of panel.current?.getAnimations() ?? []) a.cancel();
    setY(y);
  }

  function up(e: React.PointerEvent) {
    const g = drag.current;
    drag.current = null;
    if (!g || g.pid !== e.pointerId || !g.armed) return;
    const p = panel.current;
    const s = scrim.current;
    if (!p || !s) return;
    const a = g.samples[0];
    const b = g.samples[g.samples.length - 1];
    const v = a && b && b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;
    const h = p.offsetHeight;
    const half = detents ? Math.round(h * 0.45) : 0;
    const projected = g.dy + v * 140;
    const shut = detents
      ? projected > h * 0.72 ||
        (base.current > 0 && g.dy > half + 24 && v > 0.5)
      : g.dy > h * 0.3 || (g.dy > 24 && v > 0.5);
    if (shut) {
      p.style.transform = `translateY(${g.dy}px)`;
      animateOut(g.dy);
      p.style.transform = '';
      s.style.opacity = '';
      if (pushed.current && history.state?.sheet === id) {
        pushed.current = false;
        history.back();
      }
      cb.current();
      return;
    }
    const to =
      detents && Math.abs(projected - half) < Math.abs(projected) ? half : 0;
    p.animate(
      [
        { transform: `translateY(${g.dy}px)` },
        { transform: `translateY(${to}px)` },
      ],
      {
        duration: 320,
        easing: DRAWER,
      },
    );
    s.animate([{ opacity: s.style.opacity || 1 }, { opacity: 1 }], {
      duration: 320,
    });
    base.current = to;
    p.style.transform = to ? `translateY(${to}px)` : '';
    s.style.opacity = '';
    lockBody();
  }

  const width = {
    sm: 'tab:max-w-100',
    md: 'tab:max-w-120',
    lg: 'tab:max-w-160',
  }[size];
  const bg = tone === 'milk' ? 'bg-milk' : 'bg-card';

  return (
    <dialog
      ref={dlg}
      className="sheet"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        requestClose();
      }}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest('dialog') !== e.currentTarget)
          return;
        if (e.key !== 'Tab' || !panel.current) return;
        const items = [
          ...panel.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex="0"]',
          ),
        ].filter((el) => el.offsetParent !== null && !el.closest('[inert]'));
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        const at = document.activeElement;
        if (e.shiftKey && (at === first || at === panel.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && at === last) {
          e.preventDefault();
          first.focus();
        }
      }}
    >
      <div
        ref={scrim}
        className="fixed inset-0 bg-(--scrim)"
        onClick={() => {
          if (performance.now() - openedAt.current > 350) requestClose();
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0 flex items-end justify-center tab:items-center tab:p-6"
        style={{
          top: 'var(--visible-top, 0px)',
          bottom: 'auto',
          height: 'var(--visible-height, 100dvh)',
        }}
      >
        <div
          ref={panel}
          tabIndex={-1}
          className={`pointer-events-auto relative flex max-h-[calc(var(--visible-height,100dvh)*0.86)] ${detents ? 'h-[calc(var(--visible-height,100dvh)*0.86)] tab:h-auto' : ''} min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-t-[30px] ${bg} shadow-[0_-10px_40px_rgba(14,21,40,0.18)] land:max-h-[calc(var(--visible-height,100dvh)*0.94)] tab:max-h-[min(760px,calc(var(--visible-height,100dvh)*0.88))] tab:rounded-[28px] ${width} tab:shadow-[0_20px_60px_rgba(14,21,40,0.24)]`}
        >
          <div
            className="flex-none cursor-grab touch-none select-none"
            onPointerDown={(e) => down(e, false)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <div className="flex justify-center pt-2.5 pb-1.5 tab:hidden">
              <span className="h-[5px] w-10 rounded-full bg-(--line-strong)" />
            </div>
            {header && (
              <div className="px-5 pb-1 tab:px-7 tab:pt-6">{header}</div>
            )}
          </div>
          <div
            ref={body}
            className="scroller min-h-0 flex-1 px-5 pt-2 pb-4 tab:px-7"
            onPointerDown={(e) => down(e, true)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            {children}
          </div>
          {footer ? (
            <div className="flex-none px-5 pt-2 pb-[calc(16px+var(--sab))] tab:px-7 tab:pb-7">
              {footer}
            </div>
          ) : (
            <div className="h-[calc(12px+var(--sab))] flex-none tab:h-3" />
          )}
        </div>
      </div>
    </dialog>
  );
}
