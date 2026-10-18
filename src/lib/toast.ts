import { createStore } from './store.ts';

export type Toast = { id: number; text: string; undo?: () => void };

export const toastStore = createStore<Toast | null>(null, null);
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

export function toast(
  text: string,
  undo?: () => void,
  ms = undo ? 5000 : 2800,
) {
  clearTimeout(timer);
  seq += 1;
  const id = seq;
  toastStore.set({ id, text, undo });
  timer = setTimeout(() => {
    if (toastStore.get()?.id === id) toastStore.set(null);
  }, ms);
}

export function dismiss() {
  clearTimeout(timer);
  toastStore.set(null);
}
