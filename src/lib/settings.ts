import { DEFAULT_ROUTINES } from './schedule.ts';
import { createStore } from './store.ts';
import type { Routine } from './types.ts';

export type Theme = 'system' | 'light' | 'dark';

export const routinesStore = createStore<Routine[]>(
  'tend:routines',
  DEFAULT_ROUTINES,
);
export const themeStore = createStore<Theme>('tend:theme', 'system');
export const hideNamesStore = createStore('tend:hide-names', false);
export const onboardedStore = createStore('tend:onboarded', false);
export const deviceStore = createStore('tend:device', '');

export function deviceId() {
  let id = deviceStore.get();
  if (!id) {
    id = crypto.randomUUID();
    deviceStore.set(id);
  }
  return id;
}
