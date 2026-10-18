import { useEffect, useState, useSyncExternalStore } from 'react';

export function useMedia(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const list = matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

export const useStill = () => useMedia('(prefers-reduced-motion: reduce)');

let now = new Date();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function tick() {
  now = new Date();
  for (const l of listeners) l();
  clearTimeout(timer);
  timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
  tick();
}

export function refreshNow() {
  tick();
}

export function useNow() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => now,
    () => now,
  );
}

export function useKeyboardInset() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    let frame = 0;

    function revealField() {
      const field = document.activeElement;
      if (
        !(field instanceof HTMLElement) ||
        !field.matches('input, textarea, [contenteditable="true"]')
      )
        return;
      const scroller = field.closest<HTMLElement>('.scroller, .welcome-steps');
      if (!scroller) return;
      const bounds = scroller.getBoundingClientRect();
      const rect = field.getBoundingClientRect();
      const bottom = bounds.bottom;
      if (rect.bottom > bottom - 12)
        scroller.scrollTop += rect.bottom - bottom + 12;
      else if (rect.top < bounds.top + 12)
        scroller.scrollTop += rect.top - bounds.top - 12;
    }

    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Let Chrome animate the keyboard and keep the layout viewport intact.
        // Only the foreground sheet follows the visible rectangle.
        if (vv && vv.scale === 1) {
          root.style.setProperty(
            '--visible-height',
            `${Math.round(vv.height)}px`,
          );
          root.style.setProperty(
            '--visible-top',
            `${Math.round(vv.offsetTop)}px`,
          );
          const inset = Math.max(
            0,
            Math.round(innerHeight - vv.height - vv.offsetTop),
          );
          root.style.setProperty('--kb', `${inset >= 80 ? inset : 0}px`);
        }
        revealField();
      });
    }

    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('focusin', update);
      window.removeEventListener('resize', update);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      for (const property of ['--visible-height', '--visible-top', '--kb'])
        root.style.removeProperty(property);
    };
  }, []);
}

export function useDelayed(on: boolean, after = 200, hold = 450) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (on) {
      const t = setTimeout(() => setShown(true), after);
      return () => clearTimeout(t);
    }
    if (!shown) return;
    const t = setTimeout(() => setShown(false), hold);
    return () => clearTimeout(t);
  }, [on, after, hold, shown]);
  return shown;
}
