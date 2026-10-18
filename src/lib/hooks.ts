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
    const keyboard = (
      navigator as Navigator & {
        virtualKeyboard?: EventTarget & {
          overlaysContent: boolean;
          boundingRect: DOMRectReadOnly;
        };
      }
    ).virtualKeyboard;
    let frame = 0;
    let overlay = false;
    const previousOverlay = keyboard?.overlaysContent;

    // Keep Chrome's document canvas full-height while Android animates its IME.
    // CSS keyboard insets move the app above it without resizing the browser surface.
    if (keyboard && matchMedia('(pointer: coarse)').matches) {
      try {
        keyboard.overlaysContent = true;
        overlay = keyboard.overlaysContent;
      } catch {
        // Other browsers keep their visual-viewport behavior.
      }
    }
    if (overlay) root.dataset.keyboardOverlay = '';

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
      const bottom =
        overlay && keyboard?.boundingRect.height
          ? Math.min(bounds.bottom, keyboard.boundingRect.top)
          : bounds.bottom;
      if (rect.bottom > bottom - 12)
        scroller.scrollTop += rect.bottom - bottom + 12;
      else if (rect.top < bounds.top + 12)
        scroller.scrollTop += rect.top - bounds.top - 12;
    }

    function queueReveal() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(revealField);
    }

    function update() {
      // On browsers without keyboard overlay support, only the visible app area
      // follows visualViewport; the document background stays at its full size.
      if (!overlay && vv && vv.scale === 1) {
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
      queueReveal();
    }

    if (overlay) {
      for (const property of ['--visible-height', '--visible-top', '--kb'])
        root.style.removeProperty(property);
      keyboard?.addEventListener('geometrychange', update);
    } else {
      vv?.addEventListener('resize', update);
      vv?.addEventListener('scroll', update);
    }
    document.addEventListener('focusin', queueReveal);
    update();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('focusin', queueReveal);
      keyboard?.removeEventListener('geometrychange', update);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      delete root.dataset.keyboardOverlay;
      for (const property of ['--visible-height', '--visible-top', '--kb'])
        root.style.removeProperty(property);
      if (overlay && keyboard && previousOverlay !== undefined)
        keyboard.overlaysContent = previousOverlay;
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
