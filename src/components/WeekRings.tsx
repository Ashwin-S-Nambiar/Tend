import { useMemo } from 'react';
import { useData } from '../lib/db.ts';
import { useNow } from '../lib/hooks.ts';
import { navigate } from '../lib/route.ts';
import { routinesStore } from '../lib/settings.ts';
import { useStore } from '../lib/store.ts';
import { addDays, dayKey, dueDate, fmtDay, weekday } from '../lib/time.ts';
import { progress, slotsOn } from '../lib/today.ts';

export function useWeek(offset = 0) {
  const { meds, logs } = useData();
  const routines = useStore(routinesStore);
  const now = useNow();
  return useMemo(() => {
    const today = dayKey(now);
    const monday = addDays(today, -((weekday(today) + 6) % 7) + offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(monday, i);
      const future = day > today;
      const slots = future
        ? []
        : slotsOn(
            meds,
            routines,
            logs,
            day,
            day === today ? now : dueDate(`${day}T23:59`),
          );
      const p = progress(slots, logs, now);
      return { day, future, today: day === today, ...p };
    });
  }, [meds, logs, routines, now, offset]);
}

export function Ring({
  done,
  total,
  size = 40,
  today,
  future,
  stroke = 4,
}: {
  done: number;
  total: number;
  size?: number;
  today?: boolean;
  future?: boolean;
  stroke?: number;
}) {
  const r = 20 - stroke / 2;
  const c = 2 * Math.PI * r;
  const f = total ? done / total : 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className="-rotate-90"
      aria-hidden="true"
    >
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={today ? 'var(--ink)' : 'var(--line)'}
        strokeOpacity={today && f < 1 ? 0.35 : 1}
        strokeWidth={stroke}
        strokeDasharray={future ? '2 4' : undefined}
      />
      {f > 0 && (
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="var(--pip)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          style={{ transition: 'stroke-dashoffset 600ms var(--ease-out)' }}
        />
      )}
    </svg>
  );
}

export default function WeekRings({
  size = 36,
  labels = true,
}: {
  size?: number;
  labels?: boolean;
}) {
  const week = useWeek();
  return (
    <div className="grid grid-cols-7 gap-1">
      {week.map((d) => {
        const name = fmtDay(d.day, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
        const text = d.future
          ? `${name}, ahead`
          : d.total
            ? `${name}, ${d.done} of ${d.total} logged`
            : `${name}, nothing scheduled`;
        return (
          <button
            key={d.day}
            type="button"
            aria-label={text}
            aria-current={d.today ? 'date' : undefined}
            disabled={d.future}
            onClick={() => navigate(`/day/${d.day}`)}
            className="press grid min-h-11 justify-items-center gap-1 rounded-xl py-1 disabled:cursor-default"
          >
            <Ring {...d} size={size} />
            {labels && (
              <span
                className={`text-[12px] ${d.today ? 'font-bold text-ink' : 'font-semibold text-soft'}`}
                aria-hidden="true"
              >
                {fmtDay(d.day, { weekday: 'narrow' })}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
