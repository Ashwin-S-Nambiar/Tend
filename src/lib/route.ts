import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

export type Screen = 'today' | 'medicines' | 'history' | 'routines' | 'you';

export type Route =
  | { name: 'welcome' }
  | { name: 'today' }
  | { name: 'dose'; due: string }
  | { name: 'medicines' }
  | { name: 'medicine'; id: string }
  | { name: 'new' }
  | { name: 'edit'; id: string }
  | { name: 'history' }
  | { name: 'day'; date: string }
  | { name: 'routines' }
  | { name: 'you' }
  | { name: 'pip' }
  | { name: 'missing' };

const listeners = new Set<() => void>();
let seen = '';
let cached: Route = { name: 'today' };

export function parse(path: string): Route {
  const p = path.replace(/\/+$/, '') || '/';
  if (p === '/' || p === '/today' || p === '/index.html')
    return { name: 'today' };
  if (p === '/welcome') return { name: 'welcome' };
  if (p === '/medicines') return { name: 'medicines' };
  if (p === '/medicine/new') return { name: 'new' };
  if (p === '/history') return { name: 'history' };
  if (p === '/routines') return { name: 'routines' };
  if (p === '/you') return { name: 'you' };
  if (p === '/pip' && import.meta.env.DEV) return { name: 'pip' };
  let m = p.match(/^\/dose\/(next|\d{4}-\d{2}-\d{2}T\d{2}:\d{2})$/);
  if (m?.[1]) return { name: 'dose', due: m[1] };
  m = p.match(/^\/medicine\/([\w-]{1,40})\/edit$/);
  if (m?.[1]) return { name: 'edit', id: m[1] };
  m = p.match(/^\/medicine\/([\w-]{1,40})$/);
  if (m?.[1]) return { name: 'medicine', id: m[1] };
  m = p.match(/^\/day\/(\d{4}-\d{2}-\d{2})$/);
  if (m?.[1]) return { name: 'day', date: m[1] };
  return { name: 'missing' };
}

export function screenOf(r: Route): Screen | null {
  switch (r.name) {
    case 'today':
    case 'dose':
      return 'today';
    case 'medicines':
    case 'medicine':
    case 'new':
    case 'edit':
      return 'medicines';
    case 'history':
    case 'day':
      return 'history';
    case 'routines':
      return 'routines';
    case 'you':
      return 'you';
    default:
      return null;
  }
}

export const SCREEN_PATH: Record<Screen, string> = {
  today: '/',
  medicines: '/medicines',
  history: '/history',
  routines: '/routines',
  you: '/you',
};

export const SCREEN_ORDER: Screen[] = [
  'today',
  'medicines',
  'history',
  'routines',
  'you',
];

function read() {
  if (location.pathname !== seen) {
    seen = location.pathname;
    cached = parse(seen);
  }
  return cached;
}

function notify() {
  for (const l of listeners) l();
}

let depth = Number(history.state?.depth ?? 0);
let active: ViewTransition | null = null;

function still() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function transition(update: () => void, dir: 'forward' | 'back' | 'none') {
  active?.skipTransition();
  if (!document.startViewTransition || dir === 'none' || document.hidden) {
    update();
    return;
  }
  document.documentElement.dataset.dir = still() ? 'fade' : dir;
  const vt = document.startViewTransition(() => flushSync(update));
  active = vt;
  vt.ready.catch(() => {});
  vt.updateCallbackDone.catch(() => {});
  vt.finished
    .catch(() => {})
    .then(() => {
      if (active === vt) active = null;
    });
}

function animates(from: Route, to: Route) {
  const a = screenOf(from);
  const b = screenOf(to);
  if (to.name === 'dose' || to.name === 'new' || to.name === 'edit')
    return false;
  if (from.name === 'dose' || from.name === 'new' || from.name === 'edit')
    return false;
  return a !== b || from.name !== to.name;
}

addEventListener('popstate', () => {
  const from = cached;
  const nextDepth = Number(history.state?.depth ?? 0);
  const dir = nextDepth < depth ? 'back' : 'forward';
  depth = nextDepth;
  const to = parse(location.pathname);
  transition(notify, animates(from, to) ? dir : 'none');
});

export function navigate(
  path: string,
  opts: { replace?: boolean; dir?: 'forward' | 'back' } = {},
) {
  const to = parse(new URL(path, location.href).pathname);
  const from = read();
  if (path === location.pathname && !opts.replace) return;
  const go = () => {
    if (opts.replace)
      history.replaceState({ ...history.state, depth }, '', path);
    else {
      depth += 1;
      history.pushState({ depth }, '', path);
    }
    notify();
  };
  const order = (r: Route) => SCREEN_ORDER.indexOf(screenOf(r) ?? 'today');
  const dir = opts.dir ?? (order(to) < order(from) ? 'back' : 'forward');
  transition(go, animates(from, to) ? dir : 'none');
}

export function back(fallback: string) {
  if (depth > 0) history.back();
  else navigate(fallback, { replace: true, dir: 'back' });
}

export function useRoute() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    read,
  );
}
