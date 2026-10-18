import { isInsulin, type MedicineType } from './medicine-fields.ts';
import { ROUTINE_ORDER } from './schedule.ts';
import type { Parsed } from './shorthand.ts';
import { dayKey, nowKey } from './time.ts';
import type {
  Anchor,
  Food,
  Form,
  Medicine,
  RoutineId,
  Schedule,
  Shape,
  Unit,
} from './types.ts';

type Kind = Schedule['kind'];

export type Draft = {
  name: string;
  strength: string;
  unit: Unit;
  form: Form;
  amount: number;
  food: Food | 'none';
  shape: Shape;
  colors: string[];
  kind: Kind;
  routines: RoutineId[];
  times: { id: number; t: string }[];
  before: boolean;
  beforeMin: number;
  doseUnit: 'default' | 'units' | 'ml' | 'mg' | 'mcg';
  insulin: boolean;
  strengthLabel: string;
  instructions: string;
  site: string;
  variable: boolean;
  amounts: Record<string, string>;
  offsets: Partial<Record<RoutineId, number>>;
  days: number[];
  everyDays: number;
  on: number;
  off: number;
  once: string;
  gap: number;
  limitGap: boolean;
  limitMax: boolean;
  max: number;
  course: boolean;
  courseDays: number;
  start: string;
  stock: boolean;
  count: number;
  refill: number;
  pack: number;
  notes: string;
};

export function blank(): Draft {
  const today = dayKey();
  return {
    name: '',
    strength: '',
    unit: 'mg',
    form: 'tablet',
    amount: 1,
    food: 'none',
    shape: 'round',
    colors: ['#ffffff'],
    kind: 'daily',
    routines: ['breakfast'],
    times: [],
    before: false,
    beforeMin: 30,
    doseUnit: 'default',
    insulin: false,
    strengthLabel: '',
    instructions: '',
    site: '',
    variable: false,
    amounts: {},
    offsets: {},
    days: [new Date().getDay()],
    everyDays: 2,
    on: 21,
    off: 7,
    once: `${today}T09:00`,
    gap: 0,
    limitGap: false,
    limitMax: false,
    max: 0,
    course: false,
    courseDays: 5,
    start: today,
    stock: false,
    count: 30,
    refill: 7,
    pack: 10,
    notes: '',
  };
}

export function lookFor(form: Form): Pick<Draft, 'shape' | 'colors'> {
  if (form === 'capsule')
    return { shape: 'cap', colors: ['#e9a23b', '#f6d57a'] };
  if (form === 'tablet') return { shape: 'round', colors: ['#ffffff'] };
  if (form === 'liquid') return { shape: 'oval', colors: ['#f08a6c'] };
  return { shape: 'oval', colors: ['#8fc6e8'] };
}

export function fromParsed(d: Draft, p: Parsed): Draft {
  const type =
    p.form === 'injection' && p.doseUnit === 'units' ? 'insulin' : p.form;
  const next = { ...(type ? selectMedicineType(d, type) : d) };
  if (p.name) next.name = p.name;
  if (p.strength) {
    next.strengthLabel = '';
    next.strength = String(p.strength.value);
    next.unit = p.strength.unit;
  }
  if (p.amount) next.amount = p.amount;
  if (p.amounts) {
    next.amounts = Object.fromEntries(
      Object.entries(p.amounts).map(([key, amount]) => [key, String(amount)]),
    );
    next.variable = new Set(Object.values(p.amounts)).size > 1;
  }
  if (p.doseUnit) next.doseUnit = p.doseUnit;
  if (p.form === 'injection' && p.doseUnit === 'units') next.insulin = true;
  if (p.form === 'injection' && p.food === 'before') next.beforeMin = 15;
  if (p.everyDays) next.everyDays = p.everyDays;
  if (p.food) {
    next.food = p.food;
    next.before = p.food === 'before';
  }
  if (p.slots?.length) {
    next.routines = p.slots;
    next.times = [];
    next.kind = p.weekly ? 'weekdays' : p.everyDays ? 'interval' : 'daily';
  }
  if (p.prn) next.kind = 'prn';
  if (p.stat) {
    next.kind = 'once';
    next.once = nowKey();
  }
  if (p.days) {
    next.course = true;
    next.courseDays = p.days;
  }
  return next;
}

export function fromMed(m: Medicine): Draft {
  const d = blank();
  const s = m.schedule;
  const at: Anchor[] = 'at' in s ? s.at : [];
  return {
    ...d,
    name: m.name,
    strength: m.strength ? String(m.strength.value) : '',
    unit: m.strength?.unit ?? 'mg',
    doseUnit: m.doseUnit ?? 'default',
    insulin: isInsulin(m),
    strengthLabel: m.strengthLabel ?? '',
    instructions: m.instructions ?? '',
    site: m.site ?? '',
    variable: at.some((a) => a.amount !== undefined),
    amounts: Object.fromEntries(
      at.map((a, i) => [
        'routine' in a ? a.routine : `time-${i}`,
        String(a.amount ?? m.amount),
      ]),
    ),
    offsets: Object.fromEntries(
      at.flatMap((a) => ('routine' in a ? [[a.routine, a.offsetMin]] : [])),
    ),
    beforeMin: Math.abs(
      at.flatMap((a) =>
        'routine' in a &&
        a.offsetMin < 0 &&
        a.routine !== 'wake' &&
        a.routine !== 'bed'
          ? [a.offsetMin]
          : [],
      )[0] ?? 30,
    ),
    form: m.form,
    amount: m.amount,
    food: m.food ?? 'none',
    shape: m.look.shape,
    colors: m.look.colors,
    kind: s.kind,
    routines: at.flatMap((a) => ('routine' in a ? [a.routine] : [])),
    times: at.flatMap((a, i) => ('time' in a ? [{ id: i, t: a.time }] : [])),
    before: at.some((a) => 'routine' in a && a.offsetMin < 0),
    days: s.kind === 'weekdays' ? s.days : d.days,
    everyDays: s.kind === 'interval' ? s.everyDays : d.everyDays,
    on: s.kind === 'cycle' ? s.on : d.on,
    off: s.kind === 'cycle' ? s.off : d.off,
    once: s.kind === 'once' ? s.when : d.once,
    gap: s.kind === 'prn' ? (s.minGapH ?? 0) : d.gap,
    limitGap: s.kind === 'prn' && s.minGapH !== undefined,
    limitMax: s.kind === 'prn' && s.maxPerDay !== undefined,
    max: s.kind === 'prn' ? (s.maxPerDay ?? 0) : d.max,
    start: 'start' in s ? s.start : (m.course?.start ?? d.start),
    course: Boolean(m.course),
    courseDays: m.course?.days ?? d.courseDays,
    stock: Boolean(m.stock),
    count: m.stock?.count ?? d.count,
    refill: m.stock?.refillAtDays ?? d.refill,
    pack: m.stock?.pack ?? d.pack,
    notes: m.notes ?? '',
  };
}

function anchors(d: Draft): Anchor[] {
  const off = d.before ? -d.beforeMin : 0;
  return [
    ...ROUTINE_ORDER.filter((r) => d.routines.includes(r)).map((r) => ({
      routine: r,
      offsetMin: d.offsets[r] ?? (r === 'wake' || r === 'bed' ? 0 : off),
      ...(d.variable ? { amount: Number(d.amounts[r]) } : {}),
    })),
    ...d.times.map((x) => ({
      time: x.t,
      ...(d.variable ? { amount: Number(d.amounts[`time-${x.id}`]) } : {}),
    })),
  ];
}

export function insulinDraft(d: Draft, bedtime = false): Draft {
  return {
    ...d,
    form: 'injection',
    insulin: true,
    doseUnit: 'units',
    strength: '',
    strengthLabel: '',
    ...lookFor('injection'),
    kind: 'daily',
    routines: bedtime ? ['bed'] : ['breakfast', 'lunch', 'dinner'],
    times: [],
    food: bedtime ? 'none' : 'before',
    before: !bedtime,
    beforeMin: 15,
    variable: !bedtime,
    amounts: {},
    offsets: {},
    amount: bedtime ? 0 : d.amount,
  };
}

export function toMed(d: Draft, prev?: Medicine): Medicine {
  const at = anchors(d);
  const schedule: Schedule =
    d.kind === 'daily'
      ? { kind: 'daily', at }
      : d.kind === 'weekdays'
        ? { kind: 'weekdays', days: d.days, at }
        : d.kind === 'interval'
          ? { kind: 'interval', everyDays: d.everyDays, start: d.start, at }
          : d.kind === 'cycle'
            ? { kind: 'cycle', on: d.on, off: d.off, start: d.start, at }
            : d.kind === 'once'
              ? { kind: 'once', when: d.once }
              : {
                  kind: 'prn',
                  ...(d.limitGap ? { minGapH: d.gap } : {}),
                  ...(d.limitMax ? { maxPerDay: d.max } : {}),
                };
  const value = Number(d.strength);
  return {
    id: prev?.id ?? crypto.randomUUID().slice(0, 8),
    created: prev?.created ?? nowKey(),
    name: d.name.trim(),
    strength: d.strength && value > 0 ? { value, unit: d.unit } : undefined,
    form: d.form,
    amount:
      d.variable && d.kind !== 'once' && d.kind !== 'prn' && at.length
        ? (at[0]?.amount ?? d.amount)
        : d.amount,
    doseUnit: d.doseUnit === 'default' ? undefined : d.doseUnit,
    insulin: d.form === 'injection' ? d.insulin : undefined,
    strengthLabel: d.strengthLabel.trim() || undefined,
    instructions: d.instructions.trim() || undefined,
    site: d.site.trim() || undefined,
    food: d.food === 'none' ? undefined : d.food,
    look: { shape: d.shape, colors: d.colors.slice(0, 2) },
    schedule,
    course:
      d.course && d.kind !== 'prn' && d.kind !== 'once'
        ? { start: d.start, days: d.courseDays }
        : undefined,
    stock: d.stock
      ? { count: d.count, refillAtDays: d.refill, pack: d.pack }
      : undefined,
    notes: d.notes.trim() || undefined,
    archived: prev?.archived,
  };
}

export function selectMedicineType(d: Draft, type: MedicineType): Draft {
  const form = type === 'insulin' ? 'injection' : type;
  if (form === d.form && (type === 'insulin') === d.insulin) return d;
  const next: Draft = {
    ...d,
    form,
    insulin: type === 'insulin',
    ...lookFor(form),
    strength: '',
    strengthLabel: '',
    instructions: '',
    site: '',
    amount: form === 'injection' ? 0 : 1,
    doseUnit: form === 'liquid' || form === 'injection' ? 'ml' : 'default',
    food: 'none',
    before: false,
    offsets: {},
    variable: false,
    amounts: {},
    stock: false,
  };
  if (type === 'insulin') return insulinDraft(next);
  return next;
}

export function detailsProblem(d: Draft) {
  if (!d.name.trim()) return 'Give it a name';
  if (
    !d.insulin &&
    d.form !== 'cream' &&
    (!Number.isFinite(d.amount) || d.amount <= 0)
  )
    return 'Enter a dose greater than zero';
  if (
    ['capsule', 'drops', 'puff', 'patch'].includes(d.form) &&
    !Number.isInteger(d.amount)
  )
    return 'Use a whole number for this medicine';
  return null;
}

export function problem(d: Draft) {
  const detailsIssue = detailsProblem(d);
  if (detailsIssue) return detailsIssue;
  if (
    ['daily', 'weekdays', 'interval', 'cycle'].includes(d.kind) &&
    anchors(d).length === 0
  )
    return 'Pick at least one time';
  if (d.kind === 'weekdays' && d.days.length === 0)
    return 'Pick at least one day';
  const at = anchors(d);
  if (
    d.variable &&
    ['daily', 'weekdays', 'interval', 'cycle'].includes(d.kind)
  ) {
    if (at.some((a) => !Number.isFinite(a.amount) || (a.amount ?? 0) <= 0))
      return 'Enter a dose greater than zero for each reminder';
  } else if (!Number.isFinite(d.amount) || d.amount <= 0)
    return 'Enter a dose greater than zero';
  if (d.kind === 'prn') {
    if (d.limitGap && (!Number.isFinite(d.gap) || d.gap <= 0))
      return 'Enter the prescribed minimum gap';
    if (d.limitMax && (!Number.isInteger(d.max) || d.max <= 0))
      return 'Enter the prescribed daily limit';
  }
  if (
    d.stock &&
    (!Number.isFinite(d.count) ||
      d.count < 0 ||
      !Number.isFinite(d.pack) ||
      d.pack <= 0)
  )
    return 'Enter a valid remaining supply and refill amount';
  if (
    d.variable &&
    ['capsule', 'drops', 'puff', 'patch'].includes(d.form) &&
    at.some((a) => !Number.isInteger(a.amount))
  )
    return 'Use a whole number for each reminder';
  const times = d.times.map((x) => x.t);
  if (new Set(times).size !== times.length)
    return 'Each clock time must be different';
  return null;
}
