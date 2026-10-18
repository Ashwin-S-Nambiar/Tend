import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { enter, reducedMotion } from './motion.ts';

export type Screen = 'today' | 'medicines' | 'history' | 'you';

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
  if (p === '/meal-times' || p === '/routines') return { name: 'routines' };
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
      return 'you';
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
  you: '/you',
};

export const SCREEN_ORDER: Screen[] = ['today', 'medicines', 'history', 'you'];

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

type Motion = 'tab' | 'forward' | 'back' | 'context' | 'fade' | 'none';
let pending: (() => void) | null = null;
const scrolls = new Map<string, number[]>();
const split = () => matchMedia('(min-width: 1024px)').matches;

function regionKey(path: string) {
  const route = parse(path);
  if (['new', 'edit'].includes(route.name)) return '/medicines';
  if (route.name === 'dose') return '/';
  if (split() && route.name === 'medicine') return '/medicines';
  if (split() && route.name === 'day') return '/history';
  return path;
}

function remember(path: string) {
  scrolls.set(
    regionKey(path),
    [...document.querySelectorAll<HTMLElement>('#main .scroller')].map(
      (el) => el.scrollTop,
    ),
  );
}

function restore(path: string) {
  const positions = scrolls.get(regionKey(path));
  document.querySelectorAll<HTMLElement>('#main .scroller').forEach((el, i) => {
    el.scrollTop = positions?.[i] ?? 0;
  });
}

function transition(update: () => void, motion: Motion) {
  const interrupted = active !== null;
  active?.skipTransition();
  pending?.();
  const root = document.documentElement;
  if (root.dataset.dir === 'theme') delete root.dataset.dir;
  const run = () => {
    if (pending === run) pending = null;
    else return;
    flushSync(update);
    restore(location.pathname);
    if (!document.querySelector('dialog[open]'))
      document.getElementById('main')?.focus({ preventScroll: true });
  };
  pending = run;
  if (
    !document.startViewTransition ||
    motion === 'none' ||
    document.hidden ||
    interrupted
  ) {
    run();
    if (motion !== 'none' && !document.hidden) {
      const region = document.querySelector<HTMLElement>(
        motion === 'context' ? '[data-context-panel]' : '#main',
      );
      if (region)
        enter(region, motion === 'forward' ? 1 : motion === 'back' ? -1 : 0);
    }
    return;
  }
  root.dataset.motion = reducedMotion() ? 'fade' : motion;
  const vt = document.startViewTransition(run);
  active = vt;
  vt.ready.catch(() => {});
  vt.updateCallbackDone.catch(() => {});
  vt.finished
    .catch(() => {})
    .then(() => {
      if (active !== vt) return;
      active = null;
      delete root.dataset.motion;
    });
}

function motionFor(
  from: Route,
  to: Route,
  direction?: 'forward' | 'back',
): Motion {
  const modal = (r: Route) =>
    r.name === 'new' || r.name === 'edit' || (r.name === 'dose' && !split());
  if (modal(from) || modal(to)) return 'none';
  if (from.name === 'welcome' || to.name === 'welcome') return 'fade';
  if (screenOf(from) !== screenOf(to)) return 'tab';
  if (
    split() &&
    ['medicine', 'day', 'dose'].some(
      (name) => from.name === name || to.name === name,
    )
  )
    return 'context';
  if (from.name === to.name) return 'fade';
  if (direction) return direction;
  const level = (r: Route) =>
    ['medicine', 'day', 'routines'].includes(r.name) ? 1 : 0;
  return level(to) < level(from)
    ? 'back'
    : level(to) > level(from)
      ? 'forward'
      : 'fade';
}

addEventListener('popstate', (event) => {
  pending = null;
  const from = cached;
  remember(seen);
  const nextDepth = Number(history.state?.depth ?? 0);
  const dir = nextDepth < depth ? 'back' : 'forward';
  depth = nextDepth;
  const to = parse(location.pathname);
  const same = JSON.stringify(from) === JSON.stringify(to);
  transition(
    notify,
    same ||
      (event as PopStateEvent & { hasUAVisualTransition?: boolean })
        .hasUAVisualTransition
      ? 'none'
      : motionFor(from, to, dir),
  );
});

export function navigate(
  path: string,
  opts: { replace?: boolean; dir?: 'forward' | 'back' } = {},
) {
  pending?.();
  const to = parse(new URL(path, location.href).pathname);
  const from = read();
  if (path === location.pathname && !opts.replace) return;
  remember(location.pathname);
  const go = () => {
    if (opts.replace)
      history.replaceState({ ...history.state, depth }, '', path);
    else {
      if (to.name === 'new' && from.name !== 'medicines') {
        depth += 1;
        history.pushState({ depth }, '', '/medicines');
      }
      depth += 1;
      history.pushState({ depth }, '', path);
    }
    notify();
  };
  transition(go, motionFor(from, to, opts.dir));
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
