import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  addDays,
  dayKey,
  dueDate,
  nowKey,
  setZone,
  zonedInstant,
  zoneGap,
} from '../src/lib/time.ts';

afterEach(() => setZone(undefined));

test('wall times in a zone become the right instant', () => {
  assert.equal(
    zonedInstant(2026, 10, 17, 8, 0, 'Asia/Kolkata').toISOString(),
    '2026-10-17T02:30:00.000Z',
  );
  assert.equal(
    zonedInstant(2026, 10, 17, 8, 0, 'Europe/London').toISOString(),
    '2026-10-17T07:00:00.000Z',
  );
  assert.equal(
    zonedInstant(2026, 12, 17, 8, 0, 'Europe/London').toISOString(),
    '2026-12-17T08:00:00.000Z',
  );
  assert.equal(
    zonedInstant(2026, 10, 17, 8, 0, 'America/New_York').toISOString(),
    '2026-10-17T12:00:00.000Z',
  );
});

test('home time keeps 8:00 in India while travelling', () => {
  setZone('Asia/Kolkata');
  assert.equal(
    dueDate('2026-10-17T08:00').toISOString(),
    '2026-10-17T02:30:00.000Z',
  );
  const londonMorning = new Date('2026-10-17T07:00:00Z');
  assert.equal(nowKey(londonMorning), '2026-10-17T12:30');
  assert.equal(dayKey(new Date('2026-10-17T20:00:00Z')), '2026-10-18');
});

test('home days roll over at home midnight', () => {
  setZone('America/Los_Angeles');
  assert.equal(dayKey(new Date('2026-10-18T05:00:00Z')), '2026-10-17');
  assert.equal(nowKey(new Date('2026-10-18T05:00:00Z')), '2026-10-17T22:00');
});

test('calendar maths ignores zones', () => {
  setZone('Pacific/Auckland');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2027-03-01', -1), '2027-02-28');
});

test('the gap between two zones', () => {
  const at = new Date('2026-10-17T12:00:00Z');
  assert.equal(zoneGap('Asia/Kolkata', 'Europe/London', at), 270);
});

test('a home time in the spring-forward gap still lands', () => {
  const t = zonedInstant(2027, 3, 14, 2, 30, 'America/New_York');
  assert.ok(Number.isFinite(t.getTime()));
});

test('next up reads naturally after a time', async () => {
  const { relDayAfterTime } = await import('../src/lib/time.ts');
  assert.equal(relDayAfterTime('2026-10-19', '2026-10-19'), '');
  assert.equal(relDayAfterTime('2026-10-20', '2026-10-19'), ' tomorrow');
  assert.match(relDayAfterTime('2026-10-30', '2026-10-19'), /^ on /);
});
