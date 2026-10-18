import { data, type PlanEntry, writePlan } from './db.ts';
import { doseLine, FOOD_TEXT } from './dose-format.ts';
import { groupsOn, plan } from './schedule.ts';
import { deviceId, hideNamesStore, routinesStore } from './settings.ts';
import { createStore } from './store.ts';
import { activeZone, addDays, dayKey, deviceZone, fmtTime } from './time.ts';
import { slotsOn } from './today.ts';
import type { Medicine } from './types.ts';

const ENDPOINT = import.meta.env.VITE_PUSH_URL as string | undefined;
const VAPID = import.meta.env.VITE_VAPID_PUBLIC as string | undefined;

export type PushState =
  | 'unsupported'
  | 'install'
  | 'off'
  | 'denied'
  | 'on'
  | 'gone'
  | 'error';

export const pushStore = createStore<PushState>(null, 'off');

const standalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function checkPush() {
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    pushStore.set(isIOS() && !standalone() ? 'install' : 'unsupported');
    return;
  }
  if (Notification.permission === 'denied') {
    pushStore.set('denied');
    return;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (pushStore.get() !== 'gone') pushStore.set(sub ? 'on' : 'off');
  } catch {
    pushStore.set('off');
  }
}

function key(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function within<T>(task: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Reminder setup timed out')),
      milliseconds,
    );
    task.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

export async function enablePush(onAllowed?: () => void) {
  if (
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    pushStore.set('unsupported');
    return false;
  }
  if (!ENDPOINT || !VAPID) {
    pushStore.set('error');
    return false;
  }
  try {
    const perm =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
    if (perm !== 'granted') {
      pushStore.set(perm === 'denied' ? 'denied' : 'off');
      return false;
    }
    onAllowed?.();
    const setup = async () => {
      const reg = await within(navigator.serviceWorker.ready, 8000);
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key(VAPID),
        }));
      if (!(await sync(sub))) throw new Error('Reminder sync failed');
    };
    await within(setup(), 12000);
    pushStore.set('on');
    replan();
    return true;
  } catch {
    pushStore.set('error');
    return false;
  }
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
    if (ENDPOINT)
      await fetch(`${ENDPOINT}/plan/${deviceId()}`, { method: 'DELETE' });
  } catch {}
  pushStore.set('off');
}

let timer: ReturnType<typeof setTimeout> | undefined;

export function replan() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    badge();
    writePlan(entries());
    if (pushStore.get() !== 'on') return;
    navigator.serviceWorker?.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await sync(sub);
    });
  }, 400);
}

async function sync(sub: PushSubscription) {
  if (!ENDPOINT) return false;
  const { meds, logs } = data();
  const now = new Date();
  const routines = routinesStore.get();
  const items = plan(
    meds.filter((m) => !m.archived),
    routines,
    logs,
    now,
    14,
  );
  const logged = slotsOn(meds, routines, logs, dayKey(now), now)
    .filter((s) => s.state === 'done')
    .map((s) => s.key);
  try {
    const res = await fetch(`${ENDPOINT}/plan/${deviceId()}`, {
      method: 'PUT',
      signal: AbortSignal.timeout(10000),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), items, logged }),
    });
    if (res.status === 410 || res.status === 404) pushStore.set('gone');
    return res.ok;
  } catch {
    return false;
  }
}

function badge() {
  const nav = navigator as Navigator & {
    setAppBadge?: (n: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (!nav.setAppBadge) return;
  const { meds, logs } = data();
  const now = new Date();
  const slots = slotsOn(meds, routinesStore.get(), logs, dayKey(now), now);
  const due = slots
    .filter((s) => s.state === 'due')
    .reduce((n, s) => n + s.doses.length, 0);
  (due ? nav.setAppBadge(due) : nav.clearAppBadge?.())?.catch(() => {});
}

export const pushReady = Boolean(ENDPOINT && VAPID);

function joinNames(xs: string[]) {
  if (xs.length < 2) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

function entries(): PlanEntry[] {
  const { meds } = data();
  const routines = routinesStore.get();
  const hide = hideNamesStore.get();
  const away = activeZone() !== deviceZone();
  const today = dayKey();
  const out: PlanEntry[] = [];
  for (let i = 0; i < 15; i++) {
    for (const g of groupsOn(
      meds.filter((m) => !m.archived),
      routines,
      addDays(today, i),
    )) {
      const list = g.doses
        .map((d) => {
          const m = meds.find((m) => m.id === d.medId);
          return m ? { ...m, amount: d.amount ?? m.amount } : undefined;
        })
        .filter((m): m is Medicine => Boolean(m));
      const foods = [...new Set(list.map((m) => m.food).filter(Boolean))];
      const food =
        foods.length === 1 && foods[0] ? `, ${FOOD_TEXT[foods[0]]}` : '';
      const named =
        list.length === 1 && list[0]
          ? `${list[0].name} ${doseLine(list[0], false, list[0].amount)}${food}.`
          : `${joinNames(list.map((m) => `${m.name} ${doseLine(m, false, m.amount)}`))}${food}.`;
      out.push({
        key: g.key,
        zone: activeZone(),
        title: hide ? 'Tend' : `${g.label} medicines`,
        body: hide
          ? `Time for your ${fmtTime(g.key)}${away ? ' home time' : ''} medicines`
          : named,
        doses: g.doses.map((d) => ({
          medId: d.medId,
          due: d.due,
          amount: list.find((m) => m.id === d.medId)?.amount ?? 1,
        })),
      });
    }
  }
  return out;
}

let watching = false;

export function watchPermission() {
  if (watching || !navigator.permissions?.query) return;
  watching = true;
  navigator.permissions
    .query({ name: 'notifications' })
    .then((status) => {
      status.onchange = () => {
        checkPush();
        if (status.state === 'granted') replan();
      };
    })
    .catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkPush();
  });
}

// Every saved change, including weekend toggles and backup restores, moves the plan.
routinesStore.subscribe(replan);
