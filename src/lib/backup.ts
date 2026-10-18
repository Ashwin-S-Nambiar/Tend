import { data, replaceAll } from './db.ts';
import { routinesStore } from './settings.ts';
import type { DoseLog, Medicine, Routine } from './types.ts';

type Backup = {
  app: 'tend';
  version: 1;
  exported: string;
  routines: Routine[];
  meds: Medicine[];
  logs: DoseLog[];
};

export function exportBackup() {
  const { meds, logs } = data();
  const b: Backup = {
    app: 'tend',
    version: 1,
    exported: new Date().toISOString(),
    routines: routinesStore.get(),
    meds,
    logs,
  };
  return JSON.stringify(b, null, 2);
}

export async function importBackup(file: File) {
  const b = JSON.parse(await file.text()) as Partial<Backup>;
  if (b.app !== 'tend' || !Array.isArray(b.meds) || !Array.isArray(b.logs))
    throw new Error('not a Tend backup');
  const prev = {
    meds: data().meds,
    logs: data().logs,
    routines: routinesStore.get(),
  };
  await replaceAll(b.meds, b.logs);
  if (Array.isArray(b.routines) && b.routines.length)
    routinesStore.set(b.routines);
  return async () => {
    await replaceAll(prev.meds, prev.logs);
    routinesStore.set(prev.routines);
  };
}
