import { useSyncExternalStore } from 'react';
import type { DoseLog, Medicine } from './types.ts';

export const DB_NAME = 'tend';

type State = { ready: boolean; meds: Medicine[]; logs: DoseLog[] };

let state: State = { ready: false, meds: [], logs: [] };
const listeners = new Set<() => void>();
let dbp: Promise<IDBDatabase> | null = null;

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function open() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (e.oldVersion < 1) {
        db.createObjectStore('meds', { keyPath: 'id' });
        const logs = db.createObjectStore('logs', {
          keyPath: ['medId', 'due'],
        });
        logs.createIndex('due', 'due');
      }
      if (e.oldVersion < 2) db.createObjectStore('plan', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => {
        req.result.close();
        dbp = null;
      };
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function all<T>(db: IDBDatabase, store: string) {
  return new Promise<T[]>((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function write(
  store: 'meds' | 'logs' | 'plan',
  fn: (s: IDBObjectStore) => void,
) {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      fn(tx.objectStore(store));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

export async function load() {
  try {
    const db = await open();
    const [meds, logs] = await Promise.all([
      all<Medicine>(db, 'meds'),
      all<DoseLog>(db, 'logs'),
    ]);
    emit({ ready: true, meds: sortMeds(meds), logs });
  } catch {
    emit({ ready: true });
  }
}

function sortMeds(meds: Medicine[]) {
  return [...meds].sort((a, b) => a.created.localeCompare(b.created));
}

export function useData() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export const data = () => state;

export function putMed(med: Medicine) {
  const prev = state.meds.find((m) => m.id === med.id);
  emit({
    meds: sortMeds([...state.meds.filter((m) => m.id !== med.id), med]),
  });
  write('meds', (s) => s.put(med));
  return () => (prev ? putMed(prev) : deleteMed(med.id));
}

export function deleteMed(id: string) {
  const prev = state.meds.find((m) => m.id === id);
  const prevLogs = state.logs.filter((l) => l.medId === id);
  emit({
    meds: state.meds.filter((m) => m.id !== id),
    logs: state.logs.filter((l) => l.medId !== id),
  });
  write('meds', (s) => s.delete(id));
  write('logs', (s) => {
    for (const l of prevLogs) s.delete([l.medId, l.due]);
  });
  return () => {
    if (prev) putMed(prev);
    putLogs(prevLogs);
  };
}

const same = (a: DoseLog, b: { medId: string; due: string }) =>
  a.medId === b.medId && a.due === b.due;

export function putLogs(logs: DoseLog[]) {
  const prev = logs.map((l) => state.logs.find((x) => same(x, l)));
  emit({
    logs: [...state.logs.filter((x) => !logs.some((l) => same(x, l))), ...logs],
  });
  write('logs', (s) => {
    for (const l of logs) s.put(l);
  });
  return () => {
    const restore = prev.filter((p): p is DoseLog => Boolean(p));
    const drop = logs.filter((_, i) => !prev[i]);
    emit({
      logs: [
        ...state.logs.filter((x) => !logs.some((l) => same(x, l))),
        ...restore,
      ],
    });
    write('logs', (s) => {
      for (const l of drop) s.delete([l.medId, l.due]);
      for (const l of restore) s.put(l);
    });
  };
}

export function adjustStock(changes: { id: string; by: number }[]) {
  const undo: (() => void)[] = [];
  for (const c of changes) {
    const med = state.meds.find((m) => m.id === c.id);
    if (!med?.stock) continue;
    undo.push(
      putMed({
        ...med,
        stock: { ...med.stock, count: Math.max(0, med.stock.count + c.by) },
      }),
    );
  }
  return () => {
    for (const u of undo.reverse()) u();
  };
}

export async function replaceAll(meds: Medicine[], logs: DoseLog[]) {
  emit({ meds: sortMeds(meds), logs });
  await write('meds', (s) => {
    s.clear();
    for (const m of meds) s.put(m);
  });
  await write('logs', (s) => {
    s.clear();
    for (const l of logs) s.put(l);
  });
}

export function newId() {
  return crypto.randomUUID().slice(0, 8);
}

export type PlanEntry = {
  key: string;
  title: string;
  body: string;
  doses: { medId: string; due: string; amount: number }[];
  zone: string;
};

export function writePlan(entries: PlanEntry[]) {
  return write('plan', (s) => {
    s.clear();
    for (const e of entries) s.put(e);
  });
}
