import assert from 'node:assert/strict';
import { test } from 'node:test';
import { echo, parse, understood } from '../src/lib/shorthand.ts';

test('pattern, strength and food', () => {
  const p = parse('Metformin 500mg 1-0-1 PC');
  assert.equal(p.name, 'Metformin');
  assert.deepEqual(p.strength, { value: 500, unit: 'mg' });
  assert.deepEqual(p.slots, ['breakfast', 'dinner']);
  assert.equal(p.amount, 1);
  assert.equal(p.food, 'after');
  assert.deepEqual(echo(p), [
    'Metformin',
    '500 mg',
    '1 morning, 1 night',
    'after food',
  ]);
  assert.ok(understood(p));
});

test('forms are read and dropped from the name', () => {
  const p = parse('Cap Omez 20mg 1-0-0 AC');
  assert.equal(p.name, 'Omez');
  assert.equal(p.form, 'capsule');
  assert.deepEqual(p.slots, ['breakfast']);
  assert.equal(p.food, 'before');
});

test('syrups take ml as the amount', () => {
  const p = parse('Syp Calpol 5ml TDS x 3 days');
  assert.equal(p.form, 'liquid');
  assert.equal(p.amount, 5);
  assert.equal(p.strength, undefined);
  assert.deepEqual(p.slots, ['breakfast', 'lunch', 'dinner']);
  assert.equal(p.days, 3);
});

test('when needed', () => {
  const p = parse('Tab Dolo 650mg SOS');
  assert.equal(p.name, 'Dolo');
  assert.ok(p.prn);
  assert.deepEqual(echo(p), ['Dolo', '650 mg', 'only when needed']);
});

test('leading-dot strengths and bedtime', () => {
  const p = parse('Tab Clonazepam .5mg HS');
  assert.deepEqual(p.strength, { value: 0.5, unit: 'mg' });
  assert.deepEqual(p.slots, ['bed']);
  assert.equal(echo(p)[1], '0.5 mg');
});

test('units are spelled out', () => {
  const p = parse('Insulin 10 u 1-0-1');
  assert.deepEqual(p.strength, { value: 10, unit: 'units' });
  assert.equal(parse('Vitamin D3 60000 IU weekly').strength?.unit, 'IU');
});

test('four-part pattern and halves', () => {
  const p = parse('Tab Thyronorm ½-0-0-1');
  assert.deepEqual(p.slots, ['breakfast', 'bed']);
  assert.equal(p.amount, 0.5);
});

test('durations in weeks', () => {
  assert.equal(parse('Amoxicillin 500mg 1-1-1 for 2 weeks').days, 14);
});

test('a name alone is not understood', () => {
  assert.equal(understood(parse('Metformin')), false);
});

test('names with digits survive', () => {
  assert.equal(parse('Vitamin D3 60000 IU weekly').name, 'Vitamin D3');
});
