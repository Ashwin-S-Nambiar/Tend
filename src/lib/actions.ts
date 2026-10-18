import { adjustStock, data, putLogs } from './db.ts';
import { haptic } from './haptics.ts';
import { refreshNow } from './hooks.ts';
import { replan } from './push.ts';
import type { Dose, Group } from './schedule.ts';
import { sfx } from './sound.ts';
import { dueDate, fmtTime, nowKey } from './time.ts';
import { toast } from './toast.ts';
import type { DoseLog, Medicine } from './types.ts';

function medsFor(doses: Dose[]) {
  const { meds } = data();
  return doses
    .map((d) => meds.find((m) => m.id === d.medId))
    .filter((m): m is Medicine => Boolean(m));
}

function names(meds: Medicine[]) {
  if (meds.length === 1) return meds[0]?.name ?? '';
  if (meds.length === 2) return `${meds[0]?.name} and ${meds[1]?.name}`;
  return `${meds.length} medicines`;
}

function after(undo: (() => void)[]) {
  refreshNow();
  replan();
  return () => {
    for (const u of [...undo].reverse()) u();
    refreshNow();
    replan();
  };
}

export function take(doses: Dose[], label: string, at = nowKey()) {
  const prev = data().logs;
  const fresh = doses.filter(
    (d) =>
      prev.find((l) => l.medId === d.medId && l.due === d.due)?.status !==
      'taken',
  );
  if (!fresh.length) return;
  const logs: DoseLog[] = fresh.map((d) => ({
    medId: d.medId,
    due: d.due,
    status: 'taken',
    at,
  }));
  const meds = medsFor(fresh);
  const undo = after([
    putLogs(logs),
    adjustStock(meds.map((m) => ({ id: m.id, by: -m.amount }))),
  ]);
  sfx.taken();
  haptic.success();
  toast(`${label} taken at ${fmtTime(at)}`, undo);
}

export function skip(doses: Dose[], label: string) {
  const logs: DoseLog[] = doses.map((d) => ({
    medId: d.medId,
    due: d.due,
    status: 'skipped',
    at: nowKey(),
  }));
  const prev = data().logs;
  const wasTaken = doses.filter(
    (d) =>
      prev.find((l) => l.medId === d.medId && l.due === d.due)?.status ===
      'taken',
  );
  const undo = after([
    putLogs(logs),
    adjustStock(medsFor(wasTaken).map((m) => ({ id: m.id, by: m.amount }))),
  ]);
  sfx.skip();
  haptic.tick();
  toast(
    doses.length === 1
      ? `${names(medsFor(doses))} skipped`
      : `${label} skipped`,
    undo,
  );
}

export function snooze(group: Group, minutes: number) {
  const base = Math.max(Date.now(), dueDate(group.key).getTime());
  const until = nowKey(new Date(base + minutes * 6e4));
  const prev = data().logs;
  const open = group.doses.filter((d) => {
    const s = prev.find((l) => l.medId === d.medId && l.due === d.due)?.status;
    return s !== 'taken' && s !== 'skipped';
  });
  const logs: DoseLog[] = open.map((d) => ({
    medId: d.medId,
    due: d.due,
    status: 'snoozed',
    snoozeUntil: until,
  }));
  const undo = after([putLogs(logs)]);
  sfx.snooze();
  haptic.tick();
  toast(`${group.label} moved to ${fmtTime(until)}`, undo);
}

export function unlog(dose: Dose) {
  const prev = data().logs.find(
    (l) => l.medId === dose.medId && l.due === dose.due,
  );
  if (!prev) return;
  const med = medsFor([dose])[0];
  const undo = after([
    putLogs([
      {
        medId: dose.medId,
        due: dose.due,
        status: 'snoozed',
        snoozeUntil: dose.due,
      },
    ]),
    prev.status === 'taken' && med
      ? adjustStock([{ id: med.id, by: med.amount }])
      : () => {},
  ]);
  toast(`${med?.name ?? 'Dose'} cleared`, undo);
}

export function takePrn(med: Medicine) {
  const at = nowKey();
  const undo = after([
    putLogs([{ medId: med.id, due: at, status: 'taken', at }]),
    adjustStock([{ id: med.id, by: -med.amount }]),
  ]);
  sfx.taken();
  haptic.success();
  toast(`${med.name} taken at ${fmtTime(at)}`, undo);
}
