import assert from 'node:assert/strict';
import { test } from 'node:test';
import { doseLine, medicineDose } from '../src/lib/dose-format.ts';
import {
  blank,
  fromMed,
  fromParsed,
  insulinDraft,
  problem,
  selectMedicineType,
  toMed,
} from '../src/lib/medicine-draft.ts';
import {
  DEFAULT_ROUTINES,
  dosesOn,
  groupsOn,
  perDay,
  plan,
  prnState,
} from '../src/lib/schedule.ts';
import { echo, parse } from '../src/lib/shorthand.ts';

function apidra() {
  const d = insulinDraft(blank());
  d.name = 'Apidra';
  d.amounts = { breakfast: '14', lunch: '8', dinner: '6' };
  const med = toMed(d);
  med.created = '2026-10-01T00:00';
  return med;
}

test('meal-time insulin requires a prescribed amount at every selected meal', () => {
  const d = insulinDraft(blank());
  d.name = 'Apidra';
  assert.match(problem(d) ?? '', /each reminder/);
  d.amounts = { breakfast: '14', lunch: '8', dinner: '6' };
  assert.equal(problem(d), null);
  d.amounts.lunch = '0';
  assert.match(problem(d) ?? '', /each reminder/);
});

test('Apidra repeats daily with 14, 8 and 6 units fifteen minutes before meals', () => {
  const med = apidra();
  for (const day of ['2026-10-18', '2026-10-19']) {
    assert.deepEqual(
      dosesOn([med], DEFAULT_ROUTINES, day).map((d) => [d.due, d.amount]),
      [
        [`${day}T07:45`, 14],
        [`${day}T13:15`, 8],
        [`${day}T20:15`, 6],
      ],
    );
  }
  assert.equal(medicineDose(med, 8), '8 units');
  assert.equal(doseLine(med, false, 6), '6 units');
  assert.equal(perDay(med, DEFAULT_ROUTINES, '2026-10-18'), 28);
});

test('Lantus is a separate daily bedtime dose without a meal offset', () => {
  const d = insulinDraft(blank(), true);
  d.name = 'Lantus';
  assert.match(problem(d) ?? '', /greater than zero/);
  d.amount = 24;
  assert.equal(problem(d), null);
  const med = { ...toMed(d), created: '2026-10-01T00:00' };
  assert.deepEqual(
    dosesOn([med], DEFAULT_ROUTINES, '2026-10-18').map((d) => [
      d.due,
      d.amount,
    ]),
    [['2026-10-18T22:30', 24]],
  );
  assert.equal(doseLine(med), '24 units');
});

test('dose amounts and offsets survive editing, including custom clock reminders', () => {
  const med = apidra();
  if ('at' in med.schedule) med.schedule.at.push({ time: '23:00', amount: 2 });
  assert.deepEqual(toMed(fromMed(med), med), med);
});

test('prescription patterns preserve differing doses and explicit insulin units', () => {
  const p = parse('Inj Apidra 14-8-6 units AC');
  assert.equal(p.name, 'Apidra');
  assert.deepEqual(p.amounts, { breakfast: 14, lunch: 8, dinner: 6 });
  assert.equal(p.doseUnit, 'units');
  assert.ok(
    echo(p).includes('14 units morning, 8 units afternoon, 6 units night'),
  );
  const d = fromParsed(blank(), p);
  assert.equal(d.beforeMin, 15);
  assert.equal(problem(d), null);
  const lantus = fromParsed(blank(), parse('Inj Lantus 24 units HS'));
  assert.equal(lantus.amount, 24);
  assert.equal(lantus.doseUnit, 'units');
  assert.deepEqual(lantus.routines, ['bed']);
  assert.equal(toMed(lantus).strength, undefined);
});

test('before-meal and with-meal doses receive distinct reminder times', () => {
  const med = apidra();
  const food = {
    ...med,
    id: 'with-food',
    schedule: {
      kind: 'daily' as const,
      at: [{ routine: 'breakfast' as const, offsetMin: 0 }],
    },
  };
  const groups = groupsOn([med, food], DEFAULT_ROUTINES, '2026-10-18');
  assert.deepEqual(
    groups.slice(0, 2).map((g) => [g.key, g.doses.length]),
    [
      ['2026-10-18T07:45', 1],
      ['2026-10-18T08:00', 1],
    ],
  );
  assert.deepEqual(
    plan([med, food], DEFAULT_ROUTINES, [], new Date(2026, 9, 18, 7), 1)
      .slice(0, 2)
      .map((p) => p.key),
    ['2026-10-18T07:45', '2026-10-18T08:00'],
  );
});

test('meal doses follow weekend routines and keep their amounts', () => {
  const routines = DEFAULT_ROUTINES.map((r) => ({ ...r, weekend: '10:00' }));
  assert.equal(
    dosesOn([apidra()], routines, '2026-10-18')[0]?.due,
    '2026-10-18T09:45',
  );
  assert.equal(dosesOn([apidra()], routines, '2026-10-18')[0]?.amount, 14);
});

test('interval schedules retain per-reminder amounts on scheduled days only', () => {
  const d = fromMed(apidra());
  d.kind = 'interval';
  d.everyDays = 3;
  d.start = '2026-10-18';
  const med = { ...toMed(d), created: '2026-10-01T00:00' };
  assert.deepEqual(
    dosesOn([med], DEFAULT_ROUTINES, '2026-10-21').map((d) => d.amount),
    [14, 8, 6],
  );
  assert.equal(dosesOn([med], DEFAULT_ROUTINES, '2026-10-20').length, 0);
});

test('a before-meal reminder crosses midnight without being clamped', () => {
  const med = apidra();
  const routines = DEFAULT_ROUTINES.map((r) =>
    r.id === 'breakfast' ? { ...r, weekday: '00:05', weekend: undefined } : r,
  );
  const doses = dosesOn([med], routines, '2026-10-18');
  assert.ok(doses.some((d) => d.due === '2026-10-18T23:50' && d.amount === 14));
  assert.ok(!doses.some((d) => d.due.endsWith('T00:00')));
});

test('changing a variable schedule to a one-time dose uses its entered amount', () => {
  const d = fromMed(apidra());
  d.kind = 'once';
  d.amount = 24;
  assert.equal(toMed(d).amount, 24);
});

test('changing medicine type clears incompatible dose, food and stock settings', () => {
  const insulin = {
    ...fromMed(apidra()),
    stock: true,
    strengthLabel: '100 units / ml',
  };
  const cream = selectMedicineType(insulin, 'cream');
  assert.equal(cream.insulin, false);
  assert.equal(cream.food, 'none');
  assert.equal(cream.variable, false);
  assert.equal(cream.stock, false);
  assert.deepEqual(cream.amounts, {});
  assert.equal(cream.strengthLabel, '');
  const liquid = fromParsed(insulin, parse('Syp Calpol 5ml TDS'));
  assert.equal(liquid.doseUnit, 'ml');
  assert.equal(liquid.amount, 5);
  assert.equal(liquid.insulin, false);
});

test('application instructions and label strengths survive editing', () => {
  const cream = selectMedicineType(
    { ...blank(), name: 'Hydrocortisone' },
    'cream',
  );
  cream.instructions = 'Thin layer';
  cream.site = 'Affected arm';
  cream.strengthLabel = '1%';
  const med = toMed(cream);
  assert.equal(doseLine(med), '1% · Thin layer · Affected arm');
  assert.deepEqual(toMed(fromMed(med), med), med);
  const liquid = selectMedicineType(cream, 'liquid');
  liquid.amount = 5;
  liquid.strengthLabel = '250 mg / 5 ml';
  assert.equal(doseLine(toMed(liquid)), '250 mg / 5 ml · 5 ml');
});

test('when-needed medicines have no assumed limits and validate prescribed limits', () => {
  const d = selectMedicineType({ ...blank(), name: 'Inhaler' }, 'puff');
  d.kind = 'prn';
  d.amount = 2;
  const med = toMed(d);
  assert.deepEqual(med.schedule, { kind: 'prn' });
  assert.equal(prnState(med, [], new Date())?.canTake, true);
  d.limitGap = true;
  assert.match(problem(d) ?? '', /minimum gap/);
  d.gap = 4;
  d.limitMax = true;
  assert.match(problem(d) ?? '', /daily limit/);
  d.max = 3;
  assert.equal(problem(d), null);
  assert.deepEqual(toMed(d).schedule, {
    kind: 'prn',
    minGapH: 4,
    maxPerDay: 3,
  });
});
