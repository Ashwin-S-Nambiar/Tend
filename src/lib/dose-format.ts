import { ROUTINE_NAME } from './schedule.ts';
import { fmtDay, fmtTime, toMin } from './time.ts';
import type { Anchor, Food, Form, Medicine, Schedule, Unit } from './types.ts';

const num = new Intl.NumberFormat('en', { maximumFractionDigits: 3 });

const FRACTIONS: Record<string, string> = {
  '0.25': '¼',
  '0.5': '½',
  '0.75': '¾',
};

export function fmtNum(n: number) {
  return num.format(n);
}

export function fmtAmount(n: number) {
  const whole = Math.floor(n);
  const frac = FRACTIONS[String(Math.round((n - whole) * 100) / 100)];
  if (frac) return whole ? `${whole}${frac}` : frac;
  return fmtNum(n);
}

export function fmtStrength(s: { value: number; unit: Unit }) {
  return `${fmtNum(s.value)} ${s.unit}`;
}

const NOUN: Record<Form, [string, string]> = {
  tablet: ['tablet', 'tablets'],
  capsule: ['capsule', 'capsules'],
  liquid: ['ml', 'ml'],
  drops: ['drop', 'drops'],
  puff: ['puff', 'puffs'],
  injection: ['injection', 'injections'],
  patch: ['patch', 'patches'],
  cream: ['application', 'applications'],
};

export const FORM_NAME: Record<Form, string> = {
  tablet: 'Tablet',
  capsule: 'Capsule',
  liquid: 'Liquid',
  drops: 'Drops',
  puff: 'Inhaler',
  injection: 'Injection',
  patch: 'Patch',
  cream: 'Cream',
};

export function fmtDose(form: Form, amount: number) {
  const [one, many] = NOUN[form];
  return `${fmtAmount(amount)} ${amount > 0 && amount <= 1 ? one : many}`;
}

export const FOOD_TEXT: Record<Food, string> = {
  before: 'before food',
  with: 'with food',
  after: 'after food',
  empty: 'on an empty stomach',
};

export function medicineDose(med: Medicine, amount = med.amount) {
  if (med.form === 'cream' && med.instructions) return med.instructions;
  return med.doseUnit
    ? `${fmtAmount(amount)} ${med.doseUnit}`
    : fmtDose(med.form, amount);
}

export function doseLine(med: Medicine, withFood = true, amount?: number) {
  const parts: string[] = [];
  if (med.strengthLabel) parts.push(med.strengthLabel);
  else if (med.strength) parts.push(fmtStrength(med.strength));
  const varies =
    'at' in med.schedule &&
    med.schedule.at.some(
      (a) => a.amount !== undefined && a.amount !== med.amount,
    );
  parts.push(
    amount === undefined && varies && 'at' in med.schedule
      ? `${med.schedule.at.map((a) => medicineDose(med, a.amount ?? med.amount)).join(' / ')}`
      : medicineDose(med, amount),
  );
  if (med.site) parts.push(med.site);
  if (withFood && med.food) parts.push(FOOD_TEXT[med.food]);
  return parts.join(' · ');
}

export function fmtOffset(min: number) {
  const m = Math.abs(min);
  if (m < 60) return `${m} min`;
  const h = m / 60;
  return Number.isInteger(h) ? `${h} h` : `${Math.floor(h)} h ${m % 60} min`;
}

export function anchorText(a: Anchor) {
  if ('time' in a) return `at ${fmtTime(a.time)}`;
  const name = ROUTINE_NAME[a.routine].toLowerCase();
  const where = a.routine === 'wake' ? 'waking up' : name;
  if (a.offsetMin === 0)
    return a.routine === 'wake' ? 'on waking' : `at ${name}`;
  return `${fmtOffset(a.offsetMin)} ${a.offsetMin < 0 ? 'before' : 'after'} ${where}`;
}

function list(xs: string[]) {
  if (xs.length < 2) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

const DAY = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
];

function sortAnchors(at: Anchor[]) {
  return [...at].sort((a, b) => key(a) - key(b));
}

function key(a: Anchor) {
  if ('time' in a) return toMin(a.time);
  const base = {
    wake: 420,
    breakfast: 480,
    lunch: 810,
    dinner: 1230,
    bed: 1350,
  }[a.routine];
  return base + a.offsetMin;
}

export function scheduleText(s: Schedule) {
  switch (s.kind) {
    case 'daily':
      return `Every day, ${list(sortAnchors(s.at).map(anchorText))}`;
    case 'weekdays': {
      const days = [...s.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      const named =
        days.length === 5 && !days.includes(0) && !days.includes(6)
          ? 'Weekdays'
          : list(days.map((d) => DAY[d] ?? ''));
      return `${named}, ${list(sortAnchors(s.at).map(anchorText))}`;
    }
    case 'interval':
      return `Every ${s.everyDays === 2 ? 'other day' : `${s.everyDays} days`}, ${list(sortAnchors(s.at).map(anchorText))}`;
    case 'cycle':
      return `${s.on} days on, ${s.off} off, ${list(sortAnchors(s.at).map(anchorText))}`;
    case 'once':
      return `Once, ${fmtDay(s.when.slice(0, 10), { day: 'numeric', month: 'short' })} at ${fmtTime(s.when)}`;
    case 'prn':
      return [
        'When needed',
        s.minGapH ? `${s.minGapH} h apart` : '',
        s.maxPerDay ? `up to ${s.maxPerDay} a day` : '',
      ]
        .filter(Boolean)
        .join(', ');
  }
}

export function shortSchedule(s: Schedule) {
  switch (s.kind) {
    case 'daily':
      return s.at.length === 1 ? 'Once a day' : `${s.at.length} times a day`;
    case 'weekdays':
      return s.days.length === 1
        ? (DAY[s.days[0] ?? 0] ?? '')
        : `${s.days.length} days a week`;
    case 'interval':
      return s.everyDays === 2
        ? 'Every other day'
        : `Every ${s.everyDays} days`;
    case 'cycle':
      return `${s.on} on, ${s.off} off`;
    case 'once':
      return 'Once';
    case 'prn':
      return 'When needed';
  }
}
