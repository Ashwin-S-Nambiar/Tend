import { useEffect } from 'react';
import { useMedia } from '../lib/hooks.ts';
import { type Theme, themeStore } from '../lib/settings.ts';
import { useStore } from '../lib/store.ts';

const COLORS = { light: '#faf7f3', dark: '#0e1528', night: '#182544' };

export function themeColor(c: keyof typeof COLORS) {
  for (const m of document.querySelectorAll('meta[name="theme-color"]'))
    m.setAttribute('content', COLORS[c]);
}

export function useTheme() {
  const theme = useStore(themeStore);
  const system = useMedia('(prefers-color-scheme: dark)');
  const dark = theme === 'dark' || (theme === 'system' && system);
  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.classList.add('themed');
    if (dark) root.dataset.dark = '';
    else delete root.dataset.dark;
    themeColor(dark ? 'dark' : 'light');
    const t = setTimeout(() => root.classList.remove('themed'), 400);
    return () => clearTimeout(t);
  }, [dark]);
  return dark;
}

export function setTheme(next: Theme, from?: HTMLElement | null) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || still || !from) {
    themeStore.set(next);
    return;
  }
  const r = from.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const end = Math.hypot(
    Math.max(x, innerWidth - x),
    Math.max(y, innerHeight - y),
  );
  const root = document.documentElement;
  root.dataset.dir = 'theme';
  const vt = document.startViewTransition(() => {
    themeStore.set(next);
    const dark =
      next === 'dark' ||
      (next === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) root.dataset.dark = '';
    else delete root.dataset.dark;
  });
  vt.ready
    .then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${end}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 480,
          easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    .catch(() => {});
  vt.finished.finally(() => {
    if (root.dataset.dir === 'theme') delete root.dataset.dir;
  });
}
