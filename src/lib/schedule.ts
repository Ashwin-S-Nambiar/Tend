import {
  addDays,
  dayDiff,
  dueDate,
  dueKey,
  dueParts,
  fromMin,
  isWeekend,
  nowKey,
  toMin,
  weekday,
} from './time.ts';
import type {
  Anchor,
  DoseLog,
  Medicine,
  Routine,
  RoutineId,
  Scene,
  Schedule,
} from './types.ts';

export const ROUTINE_ORDER: RoutineId[] = [
  'wake',
  'breakfast',
  'lunch',
  'dinner',
  'bed',
];

export const DEFAULT_ROUTINES: Routine[] = [
  { id: 'wake', weekday: '07:00' },
  { id: 'breakfast', weekday: '08:00' },
  { id: 'lunch', weekday: '13:30' },
  { id: 'dinner', weekday: '20:30' },
  { id: 'bed', weekday: '22:30' },
];

export const ROUTINE_NAME: Record<RoutineId, string> = {
  wake: 'Wake up',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  bed: 'Bedtime',
};

export const ROUTINE_SCENE: Record<RoutineId, Scene> = {
  wake: 'morning',
  breakfast: 'morning',
  lunch: 'afternoon',
  dinner: 'evening',
  bed: 'night',
};

export const SCENE_NAME: Record<Scene, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Bedtime',
};

export function sceneAt(min: number): Scene {
  if (min < 12 * 60) return 'morning';
  if (min < 17 * 60) return 'afternoon';
  if (min < 21 * 60) return 'evening';
  return 'night';
}

export function routineTime(routines: Routine[], id: RoutineId, day: string) {
  const r =
    routines.find((x) => x.id === id) ??
    DEFAULT_ROUTINES.find((x) => x.id === id);
  if (!r) return '08:00';
  return isWeekend(day) && r.weekend ? r.weekend : r.weekday;
}

export function anchorMin(anchor: Anchor, routines: Routine[], day: string) {
  if ('time' in anchor) return toMin(anchor.time);
  return toMin(routineTime(routines, anchor.routine, day)) + anchor.offsetMin;
}

export function courseEnd(course: NonNullable<Medicine['course']>) {
  if (course.end) return course.end;
  if (course.days) return addDays(course.start, course.days - 1);
  return undefined;
}

export function courseDay(med: Medicine, day: string) {
  if (!med.course) return null;
  const end = courseEnd(med.course);
  const n = dayDiff(med.course.start, day) + 1;
  const total = end ? dayDiff(med.course.start, end) + 1 : undefined;
  return { n, total, end };
}

export function activeOn(med: Medicine, day: string) {
  if (med.archived) return false;
  if (dayDiff(med.created.slice(0, 10), day) < 0) return false;
  if (med.course) {
    if (dayDiff(med.course.start, day) < 0) return false;
    const end = courseEnd(med.course);
    if (end && dayDiff(day, end) < 0) return false;
  }
  return true;
}

export function scheduledOn(schedule: Schedule, day: string) {
  switch (schedule.kind) {
    case 'daily':
      return true;
    case 'weekdays':
      return schedule.days.includes(weekday(day));
    case 'interval': {
      const d = dayDiff(schedule.start, day);
      return d >= 0 && d % Math.max(1, schedule.everyDays) === 0;
    }
    case 'cycle': {
      const d = dayDiff(schedule.start, day);
      const len = Math.max(1, schedule.on + schedule.off);
      return d >= 0 && d % len < schedule.on;
    }
    case 'once':
      return dueParts(schedule.when).day === day;
    case 'prn':
      return false;
  }
}

export type Dose = {
  medId: string;
  due: string;
  routine?: RoutineId;
  amount?: number;
};

export function dosesOn(meds: Medicine[], routines: Routine[], day: string) {
  const out: Dose[] = [];
  for (const med of meds) {
    if (med.archived || med.schedule.kind === 'prn') continue;
    if (med.schedule.kind === 'once') {
      if (activeOn(med, day) && scheduledOn(med.schedule, day))
        out.push({ medId: med.id, due: med.schedule.when, amount: med.amount });
      continue;
    }
    const seen = new Set<string>();
    const since = nowKey(
      new Date(dueDate(med.created.slice(0, 16)).getTime() - 2 * 36e5),
    );
    for (const shift of [-1, 0, 1]) {
      const source = addDays(day, shift);
      if (!activeOn(med, source) || !scheduledOn(med.schedule, source))
        continue;
      for (const anchor of med.schedule.at) {
        const min = anchorMin(anchor, routines, source);
        const date = addDays(source, Math.floor(min / 1440));
        if (date !== day) continue;
        const due = dueKey(date, fromMin(((min % 1440) + 1440) % 1440));
        if (seen.has(due) || due < since) continue;
        seen.add(due);
        out.push({
          medId: med.id,
          due,
          routine: 'routine' in anchor ? anchor.routine : undefined,
          amount: anchor.amount ?? med.amount,
        });
      }
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

export type Group = {
  key: string;
  day: string;
  routine?: RoutineId;
  scene: Scene;
  label: string;
  doses: Dose[];
};

export function groupsOn(meds: Medicine[], routines: Routine[], day: string) {
  const by = new Map<string, Group>();
  for (const dose of dosesOn(meds, routines, day)) {
    const time = dueParts(dose.due).time;
    const id = time;
    const g = by.get(id);
    if (g) {
      g.doses.push(dose);
      if (dose.due < g.key) g.key = dose.due;
      continue;
    }
    const scene = dose.routine
      ? ROUTINE_SCENE[dose.routine]
      : sceneAt(toMin(time));
    by.set(id, {
      key: dose.due,
      day,
      routine: dose.routine,
      scene,
      label: SCENE_NAME[scene],
      doses: [dose],
    });
  }
  const merged = new Map<string, Group>();
  for (const g of [...by.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    const same = merged.get(g.key);
    if (same) {
      same.doses.push(...g.doses);
      same.routine ??= g.routine;
    } else merged.set(g.key, g);
  }
  const groups = [...merged.values()];
  const counts = new Map<string, number>();
  for (const g of groups) counts.set(g.label, (counts.get(g.label) ?? 0) + 1);
  for (const g of groups) {
    if ((counts.get(g.label) ?? 0) > 1 && g.routine)
      g.label = ROUTINE_NAME[g.routine];
  }
  return groups;
}

export function latestLog(logs: DoseLog[], medId: string, due: string) {
  let hit: DoseLog | undefined;
  for (const l of logs) if (l.medId === medId && l.due === due) hit = l;
  return hit;
}

export type DoseState = 'taken' | 'skipped' | 'snoozed' | 'open';

export function doseState(logs: DoseLog[], dose: Dose, now: string) {
  const l = latestLog(logs, dose.medId, dose.due);
  if (!l) return 'open' as DoseState;
  if (l.status === 'snoozed') {
    return l.snoozeUntil && l.snoozeUntil > now
      ? ('snoozed' as DoseState)
      : 'open';
  }
  return l.status;
}

export type GroupState = 'upcoming' | 'due' | 'done' | 'unlogged' | 'snoozed';

export function windowEnd(group: Group, next?: Group) {
  const start = dueDate(group.key).getTime();
  const twoH = start + 2 * 36e5;
  const nextAt = next ? dueDate(next.key).getTime() : Number.POSITIVE_INFINITY;
  return Math.max(start + 45 * 6e4, Math.min(twoH, nextAt));
}

export function groupState(
  group: Group,
  logs: DoseLog[],
  now: Date,
  next?: Group,
): GroupState {
  const nk = nowKey(now);
  const states = group.doses.map((d) => doseState(logs, d, nk));
  if (states.every((s) => s === 'taken' || s === 'skipped')) return 'done';
  if (nk < group.key) return 'upcoming';
  if (states.some((s) => s === 'snoozed') && !states.some((s) => s === 'open'))
    return 'snoozed';
  if (now.getTime() >= windowEnd(group, next)) return 'unlogged';
  return 'due';
}

export function snoozedUntil(group: Group, logs: DoseLog[], now: string) {
  let until: string | undefined;
  for (const d of group.doses) {
    const l = latestLog(logs, d.medId, d.due);
    if (l?.status === 'snoozed' && l.snoozeUntil && l.snoozeUntil > now)
      if (!until || l.snoozeUntil > until) until = l.snoozeUntil;
  }
  return until;
}

export function prnState(med: Medicine, logs: DoseLog[], now: Date) {
  if (med.schedule.kind !== 'prn') return null;
  const nk = nowKey(now);
  const today = nk.slice(0, 10);
  const taken = logs
    .filter((l) => l.medId === med.id && l.status === 'taken')
    .map((l) => l.at ?? l.due)
    .sort();
  const todayCount = taken.filter((t) => t.startsWith(today)).length;
  const last = taken[taken.length - 1];
  let nextAt: string | undefined;
  if (last) {
    const t = new Date(
      dueDate(last.slice(0, 16)).getTime() + med.schedule.minGapH * 36e5,
    );
    const at = nowKey(t);
    if (at > nk) nextAt = at;
  }
  const full = todayCount >= med.schedule.maxPerDay;
  return { todayCount, last, nextAt, full, canTake: !nextAt && !full };
}

export function perDay(med: Medicine, routines: Routine[], from: string) {
  if (med.schedule.kind === 'prn') return 0;
  let n = 0;
  for (let i = 0; i < 28; i++) {
    const day = addDays(from, i);
    if (!scheduledOn(med.schedule, day)) continue;
    if (med.schedule.kind === 'once') n += med.amount;
    else {
      const amounts = new Map<number, number>();
      for (const a of med.schedule.at) {
        const min = anchorMin(a, routines, day);
        if (!amounts.has(min)) amounts.set(min, a.amount ?? med.amount);
      }
      n += [...amounts.values()].reduce((sum, amount) => sum + amount, 0);
    }
  }
  return n / 28;
}

export function stockInfo(med: Medicine, routines: Routine[], from: string) {
  if (!med.stock) return null;
  const rate = perDay(med, routines, from);
  const days = rate > 0 ? Math.floor(med.stock.count / rate) : null;
  const low = days !== null && days <= med.stock.refillAtDays;
  return { count: med.stock.count, days, low, rate };
}

export function nextGroup(
  meds: Medicine[],
  routines: Routine[],
  logs: DoseLog[],
  now: Date,
) {
  const nk = nowKey(now);
  const today = nk.slice(0, 10);
  for (let i = 0; i < 8; i++) {
    const day = addDays(today, i);
    for (const g of groupsOn(meds, routines, day)) {
      if (g.key <= nk) continue;
      const open = g.doses.some((d) => {
        const s = doseState(logs, d, nk);
        return s === 'open' || s === 'snoozed';
      });
      if (open) return g;
    }
  }
  return undefined;
}

export function plan(
  meds: Medicine[],
  routines: Routine[],
  logs: DoseLog[],
  now: Date,
  days = 7,
) {
  const nk = nowKey(now);
  const today = nk.slice(0, 10);
  const items: { key: string; at: number }[] = [];
  for (let i = 0; i < days; i++) {
    for (const g of groupsOn(meds, routines, addDays(today, i))) {
      const until = snoozedUntil(g, logs, nk);
      const due = until ?? g.key;
      if (due <= nk) continue;
      const open = g.doses.some((d) => {
        const s = doseState(logs, d, nk);
        return s === 'open' || s === 'snoozed';
      });
      if (open) items.push({ key: g.key, at: dueDate(due).getTime() });
    }
  }
  return items;
}
