import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(
  new URL('../public/sw.js', import.meta.url),
  'utf8',
);
const key = '2026-10-18T18:00';
const entry = {
  key,
  title: 'Evening medicines',
  body: 'Test medicine 1 tablet.',
  zone: 'Asia/Kolkata',
  doses: [{ medId: 'test', due: key, amount: 1 }],
};

type Options = Record<string, unknown>;
type WorkerEvent = {
  data?: { json: () => Options };
  action?: string;
  notification?: { data: Options; close: () => void };
  waitUntil: (task: Promise<unknown>) => void;
};

function worker({ plan = true, log }: { plan?: boolean; log?: Options } = {}) {
  const stores: Record<string, Map<string, Options>> = {
    plan: new Map(plan ? [[JSON.stringify(key), structuredClone(entry)]] : []),
    logs: new Map(log ? [[JSON.stringify(['test', key]), log]] : []),
    meds: new Map(),
  };
  const events = new Map<string, (event: WorkerEvent) => void>();
  const notifications: { title: string; options: Options }[] = [];
  const calls: { url: string; body: Options }[] = [];
  const database = {
    close() {},
    transaction(name: string) {
      const store = stores[name];
      if (!store) throw new Error(`Unknown store: ${name}`);
      const tx = {
        oncomplete: () => {},
        objectStore: () => ({
          get(id: unknown) {
            const request = {
              result: structuredClone(store.get(JSON.stringify(id))),
              onsuccess: () => {},
            };
            queueMicrotask(() => request.onsuccess());
            return request;
          },
          put(value: Options) {
            const id = name === 'logs' ? [value.medId, value.due] : value.id;
            store.set(JSON.stringify(id), structuredClone(value));
          },
        }),
      };
      queueMicrotask(() => tx.oncomplete());
      return tx;
    },
  };
  runInNewContext(source, {
    indexedDB: {
      open: () => {
        const request = { result: database, onsuccess: () => {} };
        queueMicrotask(() => request.onsuccess());
        return request;
      },
    },
    self: {
      addEventListener: (type: string, listener: (e: WorkerEvent) => void) =>
        events.set(type, listener),
      registration: {
        showNotification: async (title: string, options: Options) => {
          notifications.push({ title, options });
        },
      },
      clients: { matchAll: async () => [] },
    },
    fetch: async (url: string, options: { body: string }) => {
      calls.push({ url, body: JSON.parse(options.body) });
    },
  });
  function dispatch(type: string, event: Omit<WorkerEvent, 'waitUntil'>) {
    return new Promise((resolve, reject) => {
      const listener = events.get(type);
      assert.ok(listener);
      listener({ ...event, waitUntil: (task) => task.then(resolve, reject) });
    });
  }
  return {
    notifications,
    stores,
    calls,
    push: (message: Options = { key }) =>
      dispatch('push', { data: { json: () => message } }),
    click: (action: string) =>
      dispatch('notificationclick', {
        action,
        notification: {
          data: { key, api: 'https://reminders.example', device: 'device' },
          close() {},
        },
      }),
  };
}

test('a scheduled push displays an unlogged dose', {
  timeout: 1000,
}, async () => {
  const sw = worker();
  await sw.push();
  assert.equal(sw.notifications.length, 1);
  assert.equal(sw.notifications[0]?.title, entry.title);
  assert.equal(sw.notifications[0]?.options.body, entry.body);
});

test('a missing local plan still displays a generic reminder', {
  timeout: 1000,
}, async () => {
  const sw = worker({ plan: false });
  await sw.push();
  assert.equal(sw.notifications[0]?.title, 'Tend');
  assert.equal(sw.notifications[0]?.options.body, 'Time for your medicines');
});

test('taken and skipped doses suppress a follow-up', async () => {
  for (const status of ['taken', 'skipped']) {
    const sw = worker({ log: { medId: 'test', due: key, status } });
    await sw.push({ key, follow: 1 });
    assert.equal(sw.notifications.length, 0);
  }
});

test('snoozed doses stay quiet until their snooze expires', async () => {
  for (const [snoozeUntil, count] of [
    ['2999-01-01T00:00', 0],
    ['2000-01-01T00:00', 1],
  ] as const) {
    const sw = worker({
      log: { medId: 'test', due: key, status: 'snoozed', snoozeUntil },
    });
    await sw.push();
    assert.equal(sw.notifications.length, count);
  }
});

test('Taken logs an unlogged dose and cancels the server follow-up', {
  timeout: 1000,
}, async () => {
  const sw = worker();
  await sw.click('taken');
  const log = sw.stores.logs?.get(JSON.stringify(['test', key]));
  assert.equal(log?.status, 'taken');
  assert.equal(log?.amount, 1);
  assert.deepEqual(sw.calls, [
    { url: 'https://reminders.example/mark/device', body: { key } },
  ]);
});

test('Snooze logs an unlogged dose and requests another push', {
  timeout: 1000,
}, async () => {
  const sw = worker();
  await sw.click('snooze');
  const log = sw.stores.logs?.get(JSON.stringify(['test', key]));
  assert.equal(log?.status, 'snoozed');
  assert.equal(typeof log?.snoozeUntil, 'string');
  assert.deepEqual(sw.calls, [
    { url: 'https://reminders.example/snooze/device', body: { key } },
  ]);
});
