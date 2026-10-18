import { useSyncExternalStore } from 'react';

export type Store<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (fn: () => void) => () => void;
};

export function createStore<T>(key: string | null, initial: T): Store<T> {
  let value = initial;
  if (key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) value = JSON.parse(raw) as T;
    } catch {}
  }
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      if (key) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch {}
      }
      for (const l of listeners) l();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export function useStore<T>(store: Store<T>) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
