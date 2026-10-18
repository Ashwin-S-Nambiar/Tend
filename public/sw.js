const SHELL = 'tend-shell-v2';
const CORE = ['/', '/icon.svg', '/fonts/gabarito-latin.woff2', '/fonts/rethink-sans-latin.woff2', '/badge.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      Promise.race([fetch(e.request), timeout(3000)])
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/') || /\.(png|svg)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL).then((c) => c.put(e.request, copy));
            }
            return res;
          }),
      ),
    );
  }
});

function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tend', 2);
    req.onupgradeneeded = (ev) => {
      const d = req.result;
      if (ev.oldVersion < 1) {
        d.createObjectStore('meds', { keyPath: 'id' });
        d.createObjectStore('logs', { keyPath: ['medId', 'due'] }).createIndex('due', 'due');
      }
      if (ev.oldVersion < 2) d.createObjectStore('plan', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

function get(d, store, key) {
  return new Promise((resolve) => {
    const req = d.transaction(store).objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
  });
}

function local(date, zone) {
  const p = (n) => String(n).padStart(2, '0');
  if (!zone) return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
  const v = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(date))
    v[x.type] = Number(x.value);
  return `${v.year}-${p(v.month)}-${p(v.day)}T${p(v.hour % 24)}:${p(v.minute)}`;
}

async function openDoses(entry) {
  const d = await db();
  const out = [];
  for (const dose of entry.doses) {
    const log = await get(d, 'logs', [dose.medId, dose.due]);
    if (!log || (log.status === 'snoozed' && (!log.snoozeUntil || log.snoozeUntil <= local(new Date(), entry.zone)))) out.push(dose);
  }
  return out;
}

self.addEventListener('push', (e) => {
  let msg = {};
  try {
    msg = e.data ? e.data.json() : {};
  } catch {}
  e.waitUntil(
    (async () => {
      const d = await db();
      const entry = msg.key ? await get(d, 'plan', msg.key) : undefined;
      if (!entry) {
        await self.registration.showNotification('Tend', {
          body: 'Time for your medicines',
          tag: `dose:${msg.key ?? 'now'}`,
          icon: '/icon-192.png',
          badge: '/badge.png',
          data: { url: msg.key ? `/dose/${msg.key}` : '/dose/next', key: msg.key, device: msg.device, api: msg.api },
        });
        return;
      }
      const open = await openDoses(entry);
      if (!open.length) return;
      await self.registration.showNotification(entry.title, {
        body: msg.last ? `${entry.body} Open Tend to keep reminders coming.` : entry.body,
        tag: `dose:${entry.key}`,
        renotify: Boolean(msg.follow),
        requireInteraction: true,
        icon: '/icon-192.png',
        badge: '/badge.png',
        vibrate: [10, 40, 14],
        timestamp: Date.now(),
        actions: [
          { action: 'taken', title: 'Taken' },
          { action: 'snooze', title: 'In 10 min' },
        ],
        data: { url: `/dose/${entry.key}`, key: entry.key, device: msg.device, api: msg.api },
      });
      for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'due', key: entry.key });
    })(),
  );
});

function put(d, store, values) {
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    for (const v of values) s.put(v);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function logAll(key, status) {
  const d = await db();
  const entry = await get(d, 'plan', key);
  if (!entry) return;
  const open = await openDoses(entry);
  const now = new Date();
  if (status === 'taken') {
    await put(
      d,
      'logs',
      open.map((x) => ({ medId: x.medId, due: x.due, status: 'taken', amount: x.amount, at: local(now, entry.zone) })),
    );
    const meds = [];
    for (const x of open) {
      const m = await get(d, 'meds', x.medId);
      if (m?.stock) meds.push({ ...m, stock: { ...m.stock, count: Math.max(0, m.stock.count - x.amount) } });
    }
    if (meds.length) await put(d, 'meds', meds);
  } else {
    const until = local(new Date(now.getTime() + 10 * 60000), entry.zone);
    await put(
      d,
      'logs',
      open.map((x) => ({ medId: x.medId, due: x.due, status: 'snoozed', snoozeUntil: until })),
    );
  }
}

async function tell(path, data) {
  if (!data?.api || !data.device) return;
  try {
    await fetch(`${data.api}${path}/${data.device}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: data.key }),
    });
  } catch {}
}

self.addEventListener('notificationclick', (e) => {
  const n = e.notification;
  const data = n.data || {};
  n.close();
  e.waitUntil(
    (async () => {
      if (e.action === 'taken' || e.action === 'snooze') {
        await logAll(data.key, e.action === 'taken' ? 'taken' : 'snoozed');
        await tell(e.action === 'taken' ? '/mark' : '/snooze', data);
        for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'logged' });
        return;
      }
      const url = data.url || '/';
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const win = wins[0];
      if (win) {
        await win.focus();
        win.postMessage({ type: 'navigate', url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
