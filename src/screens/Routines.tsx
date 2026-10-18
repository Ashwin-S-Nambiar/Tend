import { useId } from 'react';
import { SceneIcon } from '../components/Scene.tsx';
import { Card, Switch } from '../components/ui.tsx';
import { useData } from '../lib/db.ts';
import { replan } from '../lib/push.ts';
import { ROUTINE_NAME, ROUTINE_ORDER, ROUTINE_SCENE } from '../lib/schedule.ts';
import { routinesStore } from '../lib/settings.ts';
import { useStore } from '../lib/store.ts';
import { useTitle } from '../lib/title.ts';
import { toast } from '../lib/toast.ts';
import type { Routine, RoutineId } from '../lib/types.ts';

export function useRoutineEditor() {
  const routines = useStore(routinesStore);
  const get = (id: RoutineId) =>
    routines.find((r) => r.id === id) ?? { id, weekday: '08:00' };
  const set = (id: RoutineId, patch: Partial<Routine>) => {
    routinesStore.set(
      ROUTINE_ORDER.map((r) => (r === id ? { ...get(r), ...patch } : get(r))),
    );
    replan();
  };
  const weekend = routines.some((r) => r.weekend);
  return { routines, get, set, weekend };
}

export function RoutineRows({
  field = 'weekday',
  tone = 'milk',
}: {
  field?: 'weekday' | 'weekend';
  tone?: 'milk' | 'glass';
}) {
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
            className={`flex items-center gap-3 rounded-[16px] pr-2 pl-3 ${tone === 'glass' ? 'min-h-13 bg-white/70 py-1' : 'min-h-15 bg-milk py-2'}`}
          >
            <SceneIcon scene={ROUTINE_SCENE[r]} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-[16px]">
                {ROUTINE_NAME[r]}
              </span>
              {tone === 'milk' && count > 0 && (
                <span className="block text-[13px] text-soft">
                  {count} {count === 1 ? 'medicine' : 'medicines'}
                </span>
              )}
            </span>
            <input
              id={`${id}-${r}`}
              type="time"
              className="field num min-h-11 w-38 flex-none bg-card! px-3 font-bold font-display text-[16px]"
              value={value}
              onChange={(e) => {
                if (!e.target.value) return;
                set(
                  r,
                  field === 'weekend'
                    ? { weekend: e.target.value }
                    : { weekday: e.target.value },
                );
              }}
              onBlur={() => {
                if (tone === 'milk' && count)
                  toast(`${ROUTINE_NAME[r]} doses moved with it`);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}

export default function Routines() {
  const { weekend, routines } = useRoutineEditor();
  useTitle('Routines · Tend');
  return (
    <div className="scroller min-w-0 flex-1">
      <div className="mx-auto grid w-full max-w-160 content-start gap-5 px-4 pt-[calc(12px+var(--sat))] pb-8 tab:px-8 tab:pt-[calc(28px+var(--sat))]">
        <header className="grid gap-1 px-1">
          <h1 className="font-extrabold text-[clamp(28px,4vw,40px)] leading-tight tracking-[-0.02em]">
            Routines
          </h1>
          <p className="text-soft">
            Medicines follow these. Move breakfast and every breakfast dose
            moves too.
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
