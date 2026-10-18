import { useEffect } from 'react';
import { skip, snooze, take } from '../lib/actions.ts';
import { data } from '../lib/db.ts';
import {
  navigate,
  type Route,
  SCREEN_ORDER,
  SCREEN_PATH,
} from '../lib/route.ts';
import { routinesStore } from '../lib/settings.ts';
import { dayKey } from '../lib/time.ts';
import { toastStore } from '../lib/toast.ts';
import { slotsOn } from '../lib/today.ts';

function typing(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return Boolean(
    el?.closest('input, textarea, select, [contenteditable="true"]'),
  );
}

function focusSlot() {
  const { meds, logs } = data();
  const now = new Date();
  const slots = slotsOn(
    meds.filter((m) => !m.archived),
    routinesStore.get(),
    logs,
    dayKey(now),
    now,
  );
  return slots.find((s) => s.state === 'due');
}

export function useShortcuts(route: Route) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === 'z' &&
        !typing(e.target)
      ) {
        const t = toastStore.get();
        if (t?.undo) {
          e.preventDefault();
          t.undo();
          toastStore.set(null);
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (document.querySelector('dialog[open]')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) {
        const s = SCREEN_ORDER[n - 1];
        if (s) navigate(SCREEN_PATH[s]);
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'n') {
        e.preventDefault();
        navigate('/medicine/new');
        return;
      }
      if (route.name !== 'today') return;
      const slot = focusSlot();
      if (!slot) return;
      if (k === 't') take(slot.doses, slot.label);
      else if (k === 'z') snooze(slot, 10);
      else if (k === 's') skip(slot.doses, slot.label);
      else if (k === 'enter' && e.target === document.body)
        navigate(`/dose/${slot.key}`);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [route]);
}
