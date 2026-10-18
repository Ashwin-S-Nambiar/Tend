import type { Route, Screen } from './route.ts';

export type NavigationMotion =
  | 'tab'
  | 'forward'
  | 'back'
  | 'context'
  | 'fade'
  | 'none';

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

export function navigationMotion(
  from: Route,
  to: Route,
  options: { split?: boolean; direction?: 'forward' | 'back' } = {},
): NavigationMotion {
  const split = () => Boolean(options.split);
  const direction = options.direction;
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
