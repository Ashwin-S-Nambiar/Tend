import { useMemo } from 'react';
import { useData } from './db.ts';
import { useNow } from './hooks.ts';
import {
  courseDay,
  doseState,
  type Group,
  type GroupState,
  groupState,
  groupsOn,
  nextGroup,
  prnState,
  snoozedUntil,
  stockInfo,
} from './schedule.ts';
import { routinesStore } from './settings.ts';
import { useStore } from './store.ts';
import { addDays, dayKey, nowKey } from './time.ts';
import type { DoseLog, Medicine, Routine } from './types.ts';

export type Slot = Group & { state: GroupState; until?: string };

export function slotsOn(
  meds: Medicine[],
  routines: Routine[],
  logs: DoseLog[],
  day: string,
  now: Date,
) {
  const groups = groupsOn(meds, routines, day);
  const nk = nowKey(now);
  return groups.map((g, i): Slot => {
    const next = groups[i + 1];
    return {
      ...g,
      state: groupState(g, logs, now, next),
      until: snoozedUntil(g, logs, nk),
    };
  });
}

export function progress(slots: Slot[], logs: DoseLog[], now: Date) {
  const nk = nowKey(now);
  let total = 0;
  let done = 0;
  for (const s of slots)
    for (const d of s.doses) {
      total += 1;
      const st = doseState(logs, d, nk);
      if (st === 'taken' || st === 'skipped') done += 1;
    }
  return { total, done };
}

export function useToday() {
  const { meds, logs, ready } = useData();
  const routines = useStore(routinesStore);
  const now = useNow();
  return useMemo(() => {
    const today = dayKey(now);
    const active = meds.filter((m) => !m.archived);
    const slots = slotsOn(active, routines, logs, today, now);
    const focus =
      slots.find((s) => s.state === 'due') ??
      slots.find((s) => s.state === 'snoozed') ??
      slots.find((s) => s.state === 'upcoming');
    const later = slots.filter(
      (s) => s !== focus && (s.state === 'upcoming' || s.state === 'snoozed'),
    );
    const past = slots.filter(
      (s) => s !== focus && (s.state === 'done' || s.state === 'unlogged'),
    );
    const prn = active
      .filter((m) => m.schedule.kind === 'prn')
      .map((m) => ({ med: m, state: prnState(m, logs, now) }));
    const stock = active
      .map((m) => ({ med: m, info: stockInfo(m, routines, today) }))
      .filter((x) => x.info);
    const low = stock.filter((x) => x.info?.low);
    const courses = active
      .map((m) => ({ med: m, day: courseDay(m, today) }))
      .filter((x) => x.day?.total);
    const p = progress(slots, logs, now);
    const bedSlot = [...slots].reverse().find((s) => s.scene === 'night');
    const allDone =
      slots.length > 0 &&
      slots.every((s) => s.state === 'done' || s.state === 'unlogged');
    const night =
      allDone &&
      (bedSlot ? bedSlot.state === 'done' : nowKey(now).slice(11) >= '21:00');
    const tomorrow = nextGroup(active, routines, logs, now);
    return {
      ready,
      now,
      today,
      meds: active,
      slots,
      focus,
      later,
      past,
      prn,
      stock,
      low,
      courses,
      progress: p,
      night,
      allDone,
      next: tomorrow,
      empty: active.length === 0,
      isTomorrow: tomorrow ? tomorrow.day === addDays(today, 1) : false,
    };
  }, [meds, logs, routines, now, ready]);
}

export function medById(meds: Medicine[], id: string) {
  return meds.find((m) => m.id === id);
}
