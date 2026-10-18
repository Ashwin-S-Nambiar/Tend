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
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      // Android resizes the layout viewport; iOS only resizes the visual viewport.
      // Use the visible rectangle directly so sheets never count the keyboard twice.
      root.style.setProperty('--visible-height', `${Math.round(vv.height)}px`);
      root.style.setProperty('--visible-top', `${Math.round(vv.offsetTop)}px`);
      const inset = Math.max(
        0,
        Math.round(innerHeight - vv.height - vv.offsetTop),
      );
      root.style.setProperty('--kb', `${inset >= 80 ? inset : 0}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
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
