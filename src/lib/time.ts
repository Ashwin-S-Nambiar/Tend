const pad = (n: number) => String(n).padStart(2, '0');

let zone: string | undefined;

export const deviceZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

export function setZone(next?: string) {
  zone = next && next !== deviceZone() ? next : undefined;
}

export const activeZone = () => zone ?? deviceZone();

const fmts = new Map<string, Intl.DateTimeFormat>();

function wall(d: Date, z: string) {
  let f = fmts.get(z);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: z,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    fmts.set(z, f);
  }
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(d))
    if (x.type !== 'literal') p[x.type] = Number(x.value);
  return {
    y: p.year ?? 1970,
    m: p.month ?? 1,
    d: p.day ?? 1,
    h: (p.hour ?? 0) % 24,
    mi: p.minute ?? 0,
    s: p.second ?? 0,
  };
}

function offset(t: number, z: string) {
  const w = wall(new Date(t), z);
  return (
    Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(t / 1000) * 1000
  );
}

export function zonedInstant(
  y: number,
  m: number,
  d: number,
  h: number,
  mi: number,
  z: string,
) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - offset(guess, z);
  const second = guess - offset(first, z);
  return new Date(second);
}

function calKey(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function dayKey(d = new Date()) {
  if (!zone) return calKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const w = wall(d, zone);
  return calKey(w.y, w.m, w.d);
}

export function parseDay(key: string) {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number) {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return calKey(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function dayDiff(from: string, to: string) {
  const [a = 0, b = 0, c = 0] = from.split('-').map(Number);
  const [x = 0, y = 0, z = 0] = to.split('-').map(Number);
  return Math.round((Date.UTC(x, y - 1, z) - Date.UTC(a, b - 1, c)) / 864e5);
}

export function weekday(key: string) {
  return parseDay(key).getDay();
}

export function isWeekend(key: string) {
  const w = weekday(key);
  return w === 0 || w === 6;
}

export function toMin(hhmm: string) {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMin(min: number) {
  const m = Math.max(0, Math.min(1439, Math.round(min)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function dueKey(day: string, hhmm: string) {
  return `${day}T${hhmm}`;
}

export function dueParts(due: string) {
  const [day = '', time = '00:00'] = due.split('T');
  return { day, time };
}

export function dueDate(due: string) {
  const { day, time } = dueParts(due);
  const [y = 1970, mo = 1, d = 1] = day.split('-').map(Number);
  const [h = 0, mi = 0] = time.split(':').map(Number);
  if (zone) return zonedInstant(y, mo, d, h, mi, zone);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

export function nowKey(d = new Date()) {
  if (!zone)
    return dueKey(dayKey(d), `${pad(d.getHours())}:${pad(d.getMinutes())}`);
  const w = wall(d, zone);
  return dueKey(calKey(w.y, w.m, w.d), `${pad(w.h)}:${pad(w.mi)}`);
}

const wallFmt = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
});
const hereFmt = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

export function fmtTime(at: string | Date) {
  if (typeof at !== 'string') {
    if (!zone) return hereFmt.format(at);
    const w = wall(at, zone);
    return wallFmt.format(new Date(Date.UTC(1970, 0, 1, w.h, w.mi)));
  }
  const time = at.includes('T') ? dueParts(at).time : at;
  const [h = 0, m = 0] = time.split(':').map(Number);
  return wallFmt.format(new Date(Date.UTC(1970, 0, 1, h, m)));
}

export function fmtHere(due: string) {
  return hereFmt.format(dueDate(due));
}

export function fmtDay(key: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, opts).format(parseDay(key));
}

export function relDay(key: string, today = dayKey()) {
  const d = dayDiff(today, key);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  if (d > 1 && d < 7) return fmtDay(key, { weekday: 'long' });
  return fmtDay(key, { day: 'numeric', month: 'short' });
}

export function zoneName(z: string) {
  const city = z.split('/').pop()?.replace(/_/g, ' ') ?? z;
  return city;
}

export function zoneGap(a: string, b: string, at = new Date()) {
  return Math.round((offset(at.getTime(), a) - offset(at.getTime(), b)) / 6e4);
}
