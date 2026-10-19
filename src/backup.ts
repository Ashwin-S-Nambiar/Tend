export type Backup = {
  app: 'tend';
  version: 1;
  exported: string;
  routines: unknown[];
  meds: unknown[];
  logs: unknown[];
};

export function toBackup(
  meds: unknown[],
  logs: unknown[],
  routines: unknown[],
  now = new Date(),
): Backup {
  return {
    app: 'tend',
    version: 1,
    exported: now.toISOString(),
    routines,
    meds,
    logs,
  };
}

export function backupName(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `tend-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

function all(db: IDBDatabase, store: string) {
  return new Promise<unknown[]>((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openExisting() {
  return new Promise<IDBDatabase | null>((resolve) => {
    let fresh = false;
    const req = indexedDB.open('tend');
    req.onupgradeneeded = () => {
      fresh = true;
      req.transaction?.abort();
    };
    req.onsuccess = () => {
      if (fresh) {
        req.result.close();
        resolve(null);
      } else resolve(req.result);
    };
    req.onerror = () => resolve(null);
  });
}

export async function readLegacy(): Promise<Backup | null> {
  try {
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      if (!dbs.some((d) => d.name === 'tend')) return null;
    }
    const db = await openExisting();
    if (!db) return null;
    try {
      if (!db.objectStoreNames.contains('meds')) return null;
      const [meds, logs] = await Promise.all([
        all(db, 'meds'),
        all(db, 'logs'),
      ]);
      if (!meds.length && !logs.length) return null;
      let routines: unknown[] = [];
      try {
        routines = JSON.parse(localStorage.getItem('tend:routines') ?? '[]');
      } catch {}
      return toBackup(meds, logs, Array.isArray(routines) ? routines : []);
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export function save(b: Backup) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = backupName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
