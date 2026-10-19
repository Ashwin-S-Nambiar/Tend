import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backupName, toBackup } from '../src/backup.ts';

test('the backup matches the web app format the Android app restores', () => {
  const meds = [{ id: 'a1', name: 'Apidra' }];
  const logs = [{ medId: 'a1', due: '2026-10-19T07:45', status: 'taken' }];
  const routines = [{ id: 'breakfast', weekday: '08:00' }];
  const b = toBackup(meds, logs, routines, new Date('2026-10-19T03:00:00Z'));
  assert.deepEqual(b, {
    app: 'tend',
    version: 1,
    exported: '2026-10-19T03:00:00.000Z',
    routines,
    meds,
    logs,
  });
});

test('the file is named for the local day', () => {
  assert.equal(
    backupName(new Date(2026, 0, 5, 23, 30)),
    'tend-2026-01-05.json',
  );
});
