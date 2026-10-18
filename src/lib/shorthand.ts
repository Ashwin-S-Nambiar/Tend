import type { Food, Form, RoutineId, Unit } from './types.ts';

export type Parsed = {
  name: string;
  strength?: { value: number; unit: Unit };
  form?: Form;
  amount?: number;
  slots?: RoutineId[];
  prn?: boolean;
  stat?: boolean;
  weekly?: boolean;
  everyDays?: number;
  food?: Food;
  days?: number;
};

const FORMS: Record<string, Form> = {
  TAB: 'tablet',
  TABLET: 'tablet',
  CAP: 'capsule',
  CAPSULE: 'capsule',
  SYP: 'liquid',
  SYRUP: 'liquid',
  SUSP: 'liquid',
  INJ: 'injection',
  DROPS: 'drops',
  DROP: 'drops',
  OINT: 'cream',
  CREAM: 'cream',
  GEL: 'cream',
  PUFF: 'puff',
  PUFFS: 'puff',
  INHALER: 'puff',
  PATCH: 'patch',
};

const FREQ: Record<string, RoutineId[] | 'prn' | 'stat'> = {
  OD: ['breakfast'],
  QD: ['breakfast'],
  BD: ['breakfast', 'dinner'],
  BID: ['breakfast', 'dinner'],
  TDS: ['breakfast', 'lunch', 'dinner'],
  TID: ['breakfast', 'lunch', 'dinner'],
  QID: ['breakfast', 'lunch', 'dinner', 'bed'],
  HS: ['bed'],
  SOS: 'prn',
  PRN: 'prn',
  STAT: 'stat',
};

const THREE: RoutineId[] = ['breakfast', 'lunch', 'dinner'];
const FOUR: RoutineId[] = ['breakfast', 'lunch', 'dinner', 'bed'];

const UNIT = /(\d*\.?\d+)\s*(mg|mcg|µg|g|ml|iu|units?|u)\b/i;
const PATTERN =
  /(?:^|\s)([0-9½]+)\s*-\s*([0-9½]+)\s*-\s*([0-9½]+)(?:\s*-\s*([0-9½]+))?(?=\s|$)/;
const DURATION = /\b(?:x|for)\s*(\d+)\s*(days?|d|weeks?|wks?|w|months?|m)\b/i;

const amountOf = (s: string) =>
  s === '½' ? 0.5 : s.endsWith('½') ? Number(s.slice(0, -1)) + 0.5 : Number(s);

function unitOf(raw: string): Unit {
  const u = raw.toLowerCase();
  if (u === 'iu') return 'IU';
  if (u === 'u' || u === 'unit' || u === 'units') return 'units';
  if (u === 'µg') return 'mcg';
  return u as Unit;
}

function titleCase(s: string) {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w === w.toLowerCase() ? w[0]?.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function parse(line: string): Parsed {
  let rest = ` ${line.replace(/\s+/g, ' ').trim()} `;
  const out: Parsed = { name: '' };
  const take = (re: RegExp) => {
    const m = rest.match(re);
    if (m) rest = rest.replace(m[0], ' ');
    return m;
  };

  const pattern = take(PATTERN);
  if (pattern) {
    const parts = pattern
      .slice(1, 5)
      .filter((x): x is string => x !== undefined);
    const names = parts.length === 4 ? FOUR : THREE;
    const slots: RoutineId[] = [];
    let amount = 0;
    parts.forEach((p, i) => {
      const n = amountOf(p);
      const slot = names[i];
      if (n > 0 && slot) {
        slots.push(slot);
        if (!amount) amount = n;
      }
    });
    out.slots = slots;
    if (amount) out.amount = amount;
  }

  const dur = take(DURATION);
  if (dur?.[1] && dur[2]) {
    const n = Number(dur[1]);
    const u = dur[2].toLowerCase()[0];
    out.days = u === 'w' ? n * 7 : u === 'm' ? n * 30 : n;
  }

  const strength = take(UNIT);
  if (strength?.[1] && strength[2]) {
    out.strength = { value: Number(strength[1]), unit: unitOf(strength[2]) };
  }

  if (take(/\b(?:AC|before (?:food|meals?))\b\.?/i)) out.food = 'before';
  else if (take(/\b(?:PC|after (?:food|meals?))\b\.?/i)) out.food = 'after';
  else if (take(/\bwith (?:food|meals?)\b/i)) out.food = 'with';
  else if (take(/\b(?:empty stomach|on an empty stomach)\b/i))
    out.food = 'empty';

  if (take(/\b(?:weekly|once a week|every week)\b/i)) out.weekly = true;
  if (take(/\b(?:alternate days?|every other day|EOD)\b/i)) out.everyDays = 2;

  for (const word of rest.trim().split(' ')) {
    const k = word.toUpperCase().replace(/\.$/, '');
    const freq = FREQ[k];
    if (freq) {
      if (freq === 'prn') out.prn = true;
      else if (freq === 'stat') out.stat = true;
      else if (!out.slots) out.slots = freq;
      else if (k === 'HS' && !out.slots.includes('bed'))
        out.slots = [...out.slots, 'bed'];
      rest = rest.replace(` ${word} `, ' ');
      continue;
    }
    const form = FORMS[k];
    if (form && !out.form) {
      out.form = form;
      rest = rest.replace(` ${word} `, ' ');
    }
  }

  if (out.form === 'liquid' && out.strength?.unit === 'ml') {
    out.amount = out.strength.value;
    out.strength = undefined;
  }

  out.name = titleCase(rest.replace(/[,;]+/g, ' ').trim());
  return out;
}

const SLOT_WORD: Record<RoutineId, string> = {
  wake: 'on waking',
  breakfast: 'morning',
  lunch: 'afternoon',
  dinner: 'night',
  bed: 'bedtime',
};

export function echo(p: Parsed) {
  const out: string[] = [];
  if (p.name) out.push(p.name);
  if (p.strength)
    out.push(
      `${new Intl.NumberFormat('en').format(p.strength.value)} ${p.strength.unit}`,
    );
  const amount = p.amount ?? 1;
  const amt =
    amount === 0.5 ? 'half' : new Intl.NumberFormat('en').format(amount);
  if (p.slots?.length) {
    const words = p.slots.map((s) => SLOT_WORD[s]);
    if (p.slots.length === 4 && !p.slots.includes('bed')) words[2] = 'evening';
    out.push(
      words
        .map((w) => (p.form === 'liquid' ? `${amt} ml ${w}` : `${amt} ${w}`))
        .join(', '),
    );
  } else if (p.prn) out.push('only when needed');
  else if (p.stat) out.push('once, right away');
  if (p.weekly) out.push('once a week');
  if (p.everyDays === 2) out.push('every other day');
  if (p.food) {
    out.push(
      {
        before: 'before food',
        after: 'after food',
        with: 'with food',
        empty: 'on an empty stomach',
      }[p.food],
    );
  }
  if (p.days) out.push(`for ${p.days} days`);
  return out;
}

export function understood(p: Parsed) {
  return Boolean(p.name && (p.slots?.length || p.prn || p.stat));
}
