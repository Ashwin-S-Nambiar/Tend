import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  anchorText,
  doseLine,
  fmtAmount,
  fmtDose,
  fmtNum,
  scheduleText,
} from '../src/lib/dose-format.ts';
import type { Medicine } from '../src/lib/types.ts';

test('no trailing zeros, always a leading zero', () => {
  assert.equal(fmtNum(1.0), '1');
  assert.equal(fmtNum(0.5), '0.5');
  assert.equal(fmtNum(60000), '60,000');
});

test('amounts read as fractions', () => {
  assert.equal(fmtAmount(0.5), '½');
  assert.equal(fmtAmount(1.5), '1½');
  assert.equal(fmtAmount(2), '2');
});

test('plural forms', () => {
  assert.equal(fmtDose('tablet', 1), '1 tablet');
  assert.equal(fmtDose('tablet', 2), '2 tablets');
  assert.equal(fmtDose('tablet', 0.5), '½ tablet');
  assert.equal(fmtDose('liquid', 5), '5 ml');
  assert.equal(fmtDose('puff', 2), '2 puffs');
});

test('a dose line', () => {
  const med = {
    id: 'x',
    name: 'Metformin',
    strength: { value: 500, unit: 'mg' },
    form: 'tablet',
    amount: 1,
    food: 'after',
    look: { shape: 'round', colors: ['#fff'] },
    schedule: { kind: 'daily', at: [] },
    created: '2026-10-01T00:00',
  } satisfies Medicine;
  assert.equal(doseLine(med), '500 mg · 1 tablet · after food');
});

test('anchors in plain words, never abbreviations', () => {
  assert.equal(
    anchorText({ routine: 'breakfast', offsetMin: -30 }),
    '30 min before breakfast',
  );
  assert.equal(anchorText({ routine: 'bed', offsetMin: 0 }), 'at bedtime');
  assert.equal(anchorText({ routine: 'wake', offsetMin: 0 }), 'on waking');
  const text = scheduleText({
    kind: 'daily',
    at: [
      { routine: 'dinner', offsetMin: 0 },
      { routine: 'breakfast', offsetMin: 0 },
    ],
  });
  assert.equal(text, 'Every day, at breakfast and at dinner');
  assert.doesNotMatch(text, /\b(OD|BD|QD|TDS)\b/);
});

test('weekday schedules', () => {
  assert.equal(
    scheduleText({
      kind: 'weekdays',
      days: [6],
      at: [{ routine: 'breakfast', offsetMin: 0 }],
    }),
    'Saturdays, at breakfast',
  );
});
