const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(key: string) {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number) {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
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
  const d = parseDay(day);
  const [h = 0, m = 0] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function nowKey(d = new Date()) {
  return dueKey(dayKey(d), `${pad(d.getHours())}:${pad(d.getMinutes())}`);
}

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

export function fmtTime(at: string | Date) {
  if (typeof at !== 'string') return timeFmt.format(at);
  return timeFmt.format(
    at.includes('T') ? dueDate(at) : dueDate(`1970-01-01T${at}`),
  );
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
