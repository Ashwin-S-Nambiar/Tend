import assert from 'node:assert/strict';
import { test } from 'node:test';
import { navigationMotion, screenOf } from '../src/lib/navigation.ts';

test('tabs remain peers regardless of their order or browser Back direction', () => {
  assert.equal(navigationMotion({ name: 'today' }, { name: 'you' }), 'tab');
  assert.equal(
    navigationMotion({ name: 'you' }, { name: 'today' }, { direction: 'back' }),
    'tab',
  );
});

test('details push forward and parent pages return back within their tab', () => {
  assert.equal(
    navigationMotion({ name: 'medicines' }, { name: 'medicine', id: 'apidra' }),
    'forward',
  );
  assert.equal(
    navigationMotion({ name: 'medicine', id: 'apidra' }, { name: 'medicines' }),
    'back',
  );
  assert.equal(
    navigationMotion({ name: 'you' }, { name: 'routines' }),
    'forward',
  );
  assert.equal(navigationMotion({ name: 'routines' }, { name: 'you' }), 'back');
  assert.equal(screenOf({ name: 'routines' }), 'you');
});

test('desktop detail changes animate the context pane and keep the main list still', () => {
  assert.equal(
    navigationMotion(
      { name: 'medicines' },
      { name: 'medicine', id: 'apidra' },
      { split: true },
    ),
    'context',
  );
  assert.equal(
    navigationMotion(
      { name: 'medicine', id: 'apidra' },
      { name: 'medicine', id: 'lantus' },
      { split: true },
    ),
    'context',
  );
  assert.equal(
    navigationMotion(
      { name: 'history' },
      { name: 'day', date: '2026-10-18' },
      { split: true },
    ),
    'context',
  );
});

test('modal routes let the sheet own its entrance and exit', () => {
  assert.equal(navigationMotion({ name: 'today' }, { name: 'new' }), 'none');
  assert.equal(
    navigationMotion(
      { name: 'edit', id: 'apidra' },
      { name: 'medicine', id: 'apidra' },
    ),
    'none',
  );
  assert.equal(
    navigationMotion({ name: 'today' }, { name: 'dose', due: 'next' }),
    'none',
  );
  assert.equal(
    navigationMotion(
      { name: 'today' },
      { name: 'dose', due: 'next' },
      { split: true },
    ),
    'context',
  );
});
