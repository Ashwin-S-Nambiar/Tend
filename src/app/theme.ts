import { useEffect } from 'react';
import { flushSync } from 'react-dom';
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

let changing: ViewTransition | null = null;
let themeVersion = 0;
export function setTheme(next: Theme, _from?: HTMLElement | null) {
  const root = document.documentElement;
  const version = ++themeVersion;
  const apply = () => {
    if (version !== themeVersion) return;
    flushSync(() => themeStore.set(next));
    const dark =
      next === 'dark' ||
      (next === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    root.style.colorScheme = dark ? 'dark' : 'light';
    if (dark) root.dataset.dark = '';
    else delete root.dataset.dark;
  };
  if (
    !document.startViewTransition ||
    matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.querySelector('dialog[open]') ||
    root.dataset.motion ||
    changing
  ) {
    changing?.skipTransition();
    apply();
    return;
  }
  root.dataset.dir = 'theme';
  const vt = document.startViewTransition(apply);
  changing = vt;
  vt.ready.catch(() => {});
  vt.updateCallbackDone.catch(() => {});
  vt.finished
    .catch(() => {})
    .then(() => {
      if (changing !== vt) return;
      changing = null;
      delete root.dataset.dir;
    });
}
