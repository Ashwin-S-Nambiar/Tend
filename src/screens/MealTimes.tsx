import { useId } from 'react';
import { TimeField } from '../components/DateTimeField.tsx';
import { SceneIcon } from '../components/Scene.tsx';
import { Card, IconButton, Switch } from '../components/ui.tsx';
import { useData } from '../lib/db.ts';
import { navigate } from '../lib/route.ts';
import {
  DEFAULT_ROUTINES,
  ROUTINE_NAME,
  ROUTINE_ORDER,
  ROUTINE_SCENE,
} from '../lib/schedule.ts';
import { routinesStore } from '../lib/settings.ts';
import { useStore } from '../lib/store.ts';
import { useTitle } from '../lib/title.ts';
import { toast } from '../lib/toast.ts';
import type { Routine, RoutineId } from '../lib/types.ts';

function useRoutineEditor() {
  const routines = useStore(routinesStore);
  const get = (id: RoutineId) =>
    routines.find((r) => r.id === id) ??
    DEFAULT_ROUTINES.find((r) => r.id === id) ?? { id, weekday: '08:00' };
  const set = (id: RoutineId, patch: Partial<Routine>) => {
    routinesStore.set(
      ROUTINE_ORDER.map((r) => (r === id ? { ...get(r), ...patch } : get(r))),
    );
  };
  const weekend = routines.some((r) => r.weekend);
  return { routines, get, set, weekend };
}

function RoutineRows({ field = 'weekday' }: { field?: 'weekday' | 'weekend' }) {
  const { get, set } = useRoutineEditor();
  const { meds } = useData();
  const id = useId();
  return (
    <div className="grid gap-1.5">
      {ROUTINE_ORDER.map((r) => {
        const routine = get(r);
        const value =
          field === 'weekend'
            ? (routine.weekend ?? routine.weekday)
            : routine.weekday;
        const count = meds.filter(
          (m) =>
            !m.archived &&
            'at' in m.schedule &&
            m.schedule.at.some((a) => 'routine' in a && a.routine === r),
        ).length;
        return (
          <label
            key={r}
            htmlFor={`${id}-${r}`}
            className="flex min-h-15 items-center gap-3 rounded-[16px] bg-milk py-2 pr-2 pl-3"
          >
            <SceneIcon scene={ROUTINE_SCENE[r]} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-[16px]">
                {ROUTINE_NAME[r]}
              </span>
              {count > 0 && (
                <span className="block text-[13px] text-soft">
                  {count} {count === 1 ? 'medicine' : 'medicines'}
                </span>
              )}
            </span>
            <TimeField
              id={`${id}-${r}`}
              label={`${ROUTINE_NAME[r]} time`}
              className="min-h-11 w-38 flex-none bg-card! px-3 font-bold font-display text-[16px]"
              value={value}
              onChange={(value) => {
                set(
                  r,
                  field === 'weekend' ? { weekend: value } : { weekday: value },
                );
                if (count) toast(`${ROUTINE_NAME[r]} doses moved with it`);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}

export default function MealTimes() {
  const { weekend, routines } = useRoutineEditor();
  useTitle('Meal & sleep times · Tend');
  return (
    <div className="scroller min-w-0 flex-1">
      <div className="mx-auto grid w-full max-w-160 content-start gap-5 px-4 pt-[calc(12px+var(--sat))] pb-8 tab:px-8 tab:pt-[calc(28px+var(--sat))]">
        <header className="grid gap-1 px-1">
          <div className="-ml-2 flex items-center gap-1 text-soft">
            <IconButton
              icon="back"
              label="Back to You"
              onClick={() => navigate('/you', { dir: 'back' })}
            />
            <span className="font-semibold text-[14px]">You</span>
          </div>
          <h1 className="font-extrabold text-[clamp(28px,4vw,40px)] leading-tight tracking-[-0.02em]">
            Meal & sleep times
          </h1>
          <p className="text-soft">
            These times are shared by medicines linked to meals, waking or
            bedtime. Fixed clock reminders stay at their own times.
          </p>
        </header>
        <Card className="grid gap-3">
          <h2 className="font-bold text-[17px]">
            {weekend ? 'Weekdays' : 'Every day'}
          </h2>
          <RoutineRows />
        </Card>
        <Card className="grid gap-3">
          <Switch
            on={weekend}
            onChange={(on) =>
              routinesStore.set(
                routines.map((r) =>
                  on
                    ? { ...r, weekend: r.weekend ?? r.weekday }
                    : { id: r.id, weekday: r.weekday },
                ),
              )
            }
            label="Different on weekends"
            hint="Saturday and Sunday get their own times"
            icon="calendar"
          />
          {weekend && <RoutineRows field="weekend" />}
        </Card>
      </div>
    </div>
  );
}
