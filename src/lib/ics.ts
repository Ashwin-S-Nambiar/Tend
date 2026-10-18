import { doseLine } from './dose-format.ts';
import { groupsOn } from './schedule.ts';
import { addDays, dayKey } from './time.ts';
import type { Medicine, Routine } from './types.ts';

const esc = (s: string) =>
  s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
const stamp = (due: string) => `${due.replace(/[-:]/g, '')}00`;

export function buildIcs(meds: Medicine[], routines: Routine[], days = 30) {
  const today = dayKey();
  const now = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tend//Medicines//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Tend',
  ];
  for (let i = 0; i < days; i++) {
    for (const g of groupsOn(meds, routines, addDays(today, i))) {
      const list = g.doses
        .map((d) => meds.find((m) => m.id === d.medId))
        .filter((m): m is Medicine => Boolean(m));
      const end = new Date(`${g.key}:00`);
      end.setMinutes(end.getMinutes() + 15);
      const endKey = `${dayKey(end)}T${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${g.key}-${list.map((m) => m.id).join('-')}@tend.ashwin.co.in`,
        `DTSTAMP:${now}`,
        `DTSTART:${stamp(g.key)}`,
        `DTEND:${stamp(endKey)}`,
        `SUMMARY:${esc(`${g.label} medicines`)}`,
        `DESCRIPTION:${esc(list.map((m) => `${m.name}, ${doseLine(m)}`).join('\n'))}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${esc(list.map((m) => m.name).join(', '))}`,
        'TRIGGER:PT0M',
        'END:VALARM',
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
