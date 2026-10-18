import { refreshNow } from './hooks.ts';
import { replan } from './push.ts';
import { travelStore } from './settings.ts';
import { deviceZone, setZone } from './time.ts';

function apply() {
  const t = travelStore.get();
  setZone(t.mode === 'home' ? t.home : undefined);
}

try {
  if (localStorage.getItem('tend:travel') === null)
    travelStore.set(travelStore.get());
} catch {}

apply();

travelStore.subscribe(() => {
  apply();
  refreshNow();
  replan();
});

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    apply();
    refreshNow();
  });
}

export function setTravel(
  mode: 'local' | 'home',
  home = travelStore.get().home,
) {
  travelStore.set({ ...travelStore.get(), mode, home });
}

export function settleHere() {
  const here = deviceZone();
  travelStore.set({ mode: 'local', home: here, seen: here });
}

export function dismissTravel() {
  travelStore.set({ ...travelStore.get(), seen: deviceZone() });
}

export function travelling() {
  const t = travelStore.get();
  const here = deviceZone();
  return { ...t, here, away: here !== t.home };
}
