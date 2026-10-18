import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  courseDay,
  DEFAULT_ROUTINES,
  dosesOn,
  groupState,
  groupsOn,
  plan,
  prnState,
  stockInfo,
} from '../src/lib/schedule.ts';
import type { Medicine } from '../src/lib/types.ts';

const base: Pick<Medicine, 'form' | 'amount' | 'look' | 'created'> = {
  form: 'tablet',
  amount: 1,
  look: { shape: 'round', colors: ['#fff'] },
  created: '2026-10-01T00:00',
};

const metformin: Medicine = {
  ...base,
  id: 'm',
  name: 'Metformin',
  schedule: {
    kind: 'daily',
    at: [
      { routine: 'breakfast', offsetMin: 0 },
      { routine: 'dinner', offsetMin: 0 },
    ],
  },
  stock: { count: 14, refillAtDays: 7, pack: 15 },
};

const d3: Medicine = {
  ...base,
  id: 'd',
  name: 'Vitamin D3',
  schedule: {
    kind: 'weekdays',
    days: [6],
    at: [{ routine: 'breakfast', offsetMin: 0 }],
  },
};

const amox: Medicine = {
  ...base,
  id: 'a',
  name: 'Amoxicillin',
  schedule: { kind: 'daily', at: [{ routine: 'bed', offsetMin: 0 }] },
  course: { start: '2026-10-15', days: 5 },
};

test('routines expand into due times', () => {
  const doses = dosesOn([metformin], DEFAULT_ROUTINES, '2026-10-17');
  assert.deepEqual(
    doses.map((d) => d.due),
    ['2026-10-17T08:00', '2026-10-17T20:30'],
  );
});

test('weekend routine times apply on weekends', () => {
  const routines = DEFAULT_ROUTINES.map((r) =>
    r.id === 'breakfast' ? { ...r, weekend: '09:30' } : r,
  );
  assert.equal(
    dosesOn([metformin], routines, '2026-10-17')[0]?.due,
    '2026-10-17T09:30',
  );
  assert.equal(
    dosesOn([metformin], routines, '2026-10-19')[0]?.due,
    '2026-10-19T08:00',
  );
});

test('offsets move with the routine', () => {
  const m: Medicine = {
    ...metformin,
    schedule: { kind: 'daily', at: [{ routine: 'breakfast', offsetMin: -30 }] },
  };
  assert.equal(
    dosesOn([m], DEFAULT_ROUTINES, '2026-10-17')[0]?.due,
    '2026-10-17T07:30',
  );
});

test('doses on one routine share a group', () => {
  const groups = groupsOn(
    [metformin, d3, amox],
    DEFAULT_ROUTINES,
    '2026-10-17',
  );
  assert.deepEqual(
    groups.map((g) => [g.label, g.doses.length]),
    [
      ['Morning', 2],
      ['Evening', 1],
      ['Bedtime', 1],
    ],
  );
});

test('courses end on their own', () => {
  assert.equal(dosesOn([amox], DEFAULT_ROUTINES, '2026-10-19').length, 1);
  assert.equal(dosesOn([amox], DEFAULT_ROUTINES, '2026-10-20').length, 0);
  assert.deepEqual(courseDay(amox, '2026-10-17'), {
    n: 3,
    total: 5,
    end: '2026-10-19',
  });
});

test('cycles and intervals', () => {
  const cycle: Medicine = {
    ...metformin,
    schedule: {
      kind: 'cycle',
      on: 21,
      off: 7,
      start: '2026-10-01',
      at: [{ time: '09:00' }],
    },
  };
  assert.equal(dosesOn([cycle], DEFAULT_ROUTINES, '2026-10-21').length, 1);
  assert.equal(dosesOn([cycle], DEFAULT_ROUTINES, '2026-10-22').length, 0);
  assert.equal(dosesOn([cycle], DEFAULT_ROUTINES, '2026-10-29').length, 1);
  const every3: Medicine = {
    ...metformin,
    schedule: {
      kind: 'interval',
      everyDays: 3,
      start: '2026-10-01',
      at: [{ time: '09:00' }],
    },
  };
  assert.equal(dosesOn([every3], DEFAULT_ROUTINES, '2026-10-04').length, 1);
  assert.equal(dosesOn([every3], DEFAULT_ROUTINES, '2026-10-05').length, 0);
});

test('a group is due, then not logged after its window', () => {
  const [morning, evening] = groupsOn(
    [metformin],
    DEFAULT_ROUTINES,
    '2026-10-17',
  );
  assert.ok(morning && evening);
  assert.equal(
    groupState(morning, [], new Date(2026, 9, 17, 7, 59), evening),
    'upcoming',
  );
  assert.equal(
    groupState(morning, [], new Date(2026, 9, 17, 8, 5), evening),
    'due',
  );
  assert.equal(
    groupState(morning, [], new Date(2026, 9, 17, 10, 1), evening),
    'unlogged',
  );
  const logs = [
    {
      medId: 'm',
      due: morning.key,
      status: 'taken' as const,
      at: '2026-10-17T08:02',
    },
  ];
  assert.equal(
    groupState(morning, logs, new Date(2026, 9, 17, 8, 5), evening),
    'done',
  );
});

test('snoozed groups come back', () => {
  const [morning] = groupsOn([metformin], DEFAULT_ROUTINES, '2026-10-17');
  assert.ok(morning);
  const logs = [
    {
      medId: 'm',
      due: morning.key,
      status: 'snoozed' as const,
      snoozeUntil: '2026-10-17T08:15',
    },
  ];
  assert.equal(
    groupState(morning, logs, new Date(2026, 9, 17, 8, 10)),
    'snoozed',
  );
  assert.equal(groupState(morning, logs, new Date(2026, 9, 17, 8, 16)), 'due');
});

test('when needed respects the gap and the daily maximum', () => {
  const prn: Medicine = {
    ...base,
    id: 'p',
    name: 'Paracetamol',
    schedule: { kind: 'prn', minGapH: 6, maxPerDay: 2 },
  };
  const now = new Date(2026, 9, 17, 12, 0);
  assert.equal(prnState(prn, [], now)?.canTake, true);
  const one = [
    {
      medId: 'p',
      due: '2026-10-17T09:00',
      status: 'taken' as const,
      at: '2026-10-17T09:00',
    },
  ];
  assert.equal(prnState(prn, one, now)?.nextAt, '2026-10-17T15:00');
  const two = [
    ...one,
    {
      medId: 'p',
      due: '2026-10-17T15:00',
      status: 'taken' as const,
      at: '2026-10-17T15:00',
    },
  ];
  assert.equal(prnState(prn, two, new Date(2026, 9, 17, 22, 0))?.full, true);
});

test('stock runs low at its refill point', () => {
  const s = stockInfo(metformin, DEFAULT_ROUTINES, '2026-10-17');
  assert.equal(s?.days, 7);
  assert.equal(s?.low, true);
});

test('the plan skips what is logged and keeps what is ahead', () => {
  const now = new Date(2026, 9, 17, 9, 0);
  const items = plan([metformin], DEFAULT_ROUTINES, [], now, 2);
  assert.deepEqual(
    items.map((i) => i.key),
    ['2026-10-17T20:30', '2026-10-18T08:00', '2026-10-18T20:30'],
  );
});

test('across the spring-forward gap the day still has its doses', () => {
  const m: Medicine = {
    ...metformin,
    schedule: { kind: 'daily', at: [{ time: '02:30' }, { time: '09:00' }] },
  };
  assert.equal(dosesOn([m], DEFAULT_ROUTINES, '2027-03-28').length, 2);
});

test('a medicine added just after its routine still shows that dose', () => {
  const m: Medicine = { ...metformin, created: '2026-10-17T08:02' };
  assert.equal(
    dosesOn([m], DEFAULT_ROUTINES, '2026-10-17')[0]?.due,
    '2026-10-17T08:00',
  );
  const late: Medicine = { ...metformin, created: '2026-10-17T12:30' };
  assert.equal(
    dosesOn([late], DEFAULT_ROUTINES, '2026-10-17')[0]?.due,
    '2026-10-17T20:30',
  );
});

test('home time plans reminders at home instants while away', async () => {
  const { setZone } = await import('../src/lib/time.ts');
  setZone('Asia/Kolkata');
  try {
    const londonMorning = new Date('2026-10-17T06:00:00Z');
    const items = plan([metformin], DEFAULT_ROUTINES, [], londonMorning, 1);
    assert.equal(
      new Date(items[0]?.at ?? 0).toISOString(),
      '2026-10-17T15:00:00.000Z',
    );
    assert.equal(items[0]?.key, '2026-10-17T20:30');
  } finally {
    setZone(undefined);
  }
});
