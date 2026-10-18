import { useMemo, useState } from 'react';
import { useLayout } from '../app/layout.ts';
import Icon from '../components/Icon.tsx';
import { Pill } from '../components/PillLook.tsx';
import Pip from '../components/Pip.tsx';
import { SceneIcon } from '../components/Scene.tsx';
import { Card, H2, IconButton } from '../components/ui.tsx';
import { Ring, useWeek } from '../components/WeekRings.tsx';
import { useData } from '../lib/db.ts';
import { medicineDose } from '../lib/dose-format.ts';
import { useNow } from '../lib/hooks.ts';
import { useContentMotion } from '../lib/motion.ts';
import { back, navigate } from '../lib/route.ts';
import { dosesOn, latestLog } from '../lib/schedule.ts';
import { routinesStore } from '../lib/settings.ts';
import { useStore } from '../lib/store.ts';
import {
  addDays,
  dayKey,
  dueDate,
  fmtDay,
  fmtTime,
  nowKey,
} from '../lib/time.ts';
import { useTitle } from '../lib/title.ts';
import { medById, slotsOn } from '../lib/today.ts';

export default function History({ selected }: { selected?: string }) {
  const [offset, setOffset] = useState(0);
  const days = useContentMotion(offset);
  const week = useWeek(offset);
  const { panel } = useLayout();
  const { meds } = useData();
  useTitle('History · Tend');
  const first = week[0]?.day ?? dayKey();
  const last = week[6]?.day ?? dayKey();
  const range = `${fmtDay(first, { day: 'numeric', month: 'short' })} to ${fmtDay(last, { day: 'numeric', month: 'short' })}`;
  const pick = selected ?? (panel ? undefined : undefined);
  return (
    <div className="scroller min-w-0 flex-1">
      <div className="mx-auto grid w-full max-w-200 content-start gap-5 px-4 pt-[calc(12px+var(--sat))] pb-8 tab:px-8 tab:pt-[calc(28px+var(--sat))]">
        <h1 className="px-1 font-extrabold text-[clamp(28px,4vw,40px)] leading-tight tracking-[-0.02em]">
          History
        </h1>
        <Card className="grid gap-4">
          <div className="flex items-center gap-2">
            <IconButton
              icon="back"
              label="Earlier week"
              onClick={() => setOffset(offset - 1)}
              tone="plain"
            />
            <h2
              className="num flex-1 text-center font-bold text-[17px]"
              aria-live="polite"
            >
              {offset === 0 ? 'This week' : range}
            </h2>
            <IconButton
              icon="next"
              label="Later week"
              onClick={() => setOffset(Math.min(0, offset + 1))}
              tone="plain"
              className={offset === 0 ? 'invisible' : ''}
            />
          </div>
          <div ref={days} className="grid grid-cols-7 gap-1.5">
            {week.map((d) => (
              <button
                key={d.day}
                type="button"
                disabled={d.future}
                aria-current={d.day === pick ? 'date' : undefined}
                aria-label={`${fmtDay(d.day, { weekday: 'long', day: 'numeric', month: 'long' })}${d.future ? '' : `, ${d.done} of ${d.total} logged`}`}
                onClick={() =>
                  navigate(`/day/${d.day}`, { replace: Boolean(selected) })
                }
                className={`press grid min-h-11 min-w-0 justify-items-center gap-1.5 rounded-2xl px-0.5 py-2 disabled:cursor-default ${d.day === pick ? 'bg-pip-wash' : ''}`}
              >
                <span
                  className={`text-[13px] ${d.today ? 'font-bold' : 'font-semibold text-soft'}`}
                  aria-hidden="true"
                >
                  {fmtDay(d.day, { weekday: 'short' })}
                </span>
                <Ring {...d} size={44} stroke={4.5} />
                <span className="num text-[13px] text-soft" aria-hidden="true">
                  {fmtDay(d.day, { day: 'numeric' })}
                </span>
              </button>
            ))}
          </div>
          <p className="text-center text-[14px] text-soft">
            Rings fill as doses are logged. Tap a day for times.
          </p>
        </Card>
        {meds.length > 0 && <PerMedicine />}
      </div>
    </div>
  );
}

function PerMedicine() {
  const { meds, logs } = useData();
  const routines = useStore(routinesStore);
  const rows = useMemo(() => {
    const today = dayKey();
    const nk = nowKey();
    return meds
      .filter((m) => !m.archived && m.schedule.kind !== 'prn')
      .map((m) => {
        let total = 0;
        let taken = 0;
        for (let i = 0; i < 30; i++) {
          for (const d of dosesOn([m], routines, addDays(today, -i))) {
            if (d.due > nk) continue;
            total += 1;
            if (latestLog(logs, m.id, d.due)?.status === 'taken') taken += 1;
          }
        }
        return {
          med: m,
          total,
          pct: total ? Math.round((taken / total) * 100) : null,
        };
      });
  }, [meds, logs, routines]);
  return (
    <section className="grid gap-2" aria-labelledby="per-med">
      <H2>
        <span id="per-med">Last 30 days</span>
      </H2>
      <Card className="grid gap-3">
        {rows.map(({ med, pct, total }) => (
          <div
            key={med.id}
            className="grid grid-cols-[40px_1fr_auto] items-center gap-3"
          >
            <span className="grid size-10 place-items-center rounded-[13px] bg-milk">
              <Pill look={med.look} form={med.form} />
            </span>
            <div className="min-w-0">
              <b className="block wrap-anywhere font-semibold">{med.name}</b>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full rounded-full bg-pip"
                  style={{ width: `${pct ?? 0}%` }}
                />
              </span>
            </div>
            <span className="num w-20 text-right text-[14px] text-soft">
              {pct === null ? 'Nothing yet' : `${pct}% of ${total}`}
            </span>
          </div>
        ))}
      </Card>
    </section>
  );
}

export function DayPanel({ date, page }: { date?: string; page?: boolean }) {
  const { meds, logs } = useData();
  const routines = useStore(routinesStore);
  const now = useNow();
  const day = date ?? dayKey(now);
  const slots = useMemo(
    () =>
      slotsOn(
        meds,
        routines,
        logs,
        day,
        day === dayKey(now) ? now : dueDate(`${day}T23:59`),
      ),
    [meds, routines, logs, day, now],
  );
  const title = fmtDay(day, { weekday: 'long', day: 'numeric', month: 'long' });
  useTitle(page ? `${title} · Tend` : document.title);
  const prn = logs.filter(
    (l) =>
      l.due.startsWith(day) && medById(meds, l.medId)?.schedule.kind === 'prn',
  );
  const body = (
    <div className="grid gap-3">
      {slots.length === 0 && prn.length === 0 && (
        <div className="grid justify-items-center gap-2 py-8 text-center">
          <Pip mood="idle" className="size-20" />
          <p className="text-soft">Nothing was scheduled.</p>
        </div>
      )}
      {slots.map((s) => (
        <Card key={s.key} className="grid gap-2">
          <div className="flex items-center gap-2">
            <SceneIcon scene={s.scene} size={22} />
            <h3 className="flex-1 font-bold text-[16px]">{s.label}</h3>
            <span className="num text-[14px] text-soft">{fmtTime(s.key)}</span>
          </div>
          {s.doses.map((d) => {
            const med = medById(meds, d.medId);
            const l = latestLog(logs, d.medId, d.due);
            const status =
              l?.status === 'taken'
                ? `Taken ${l.at ? fmtTime(l.at) : ''}`
                : l?.status === 'skipped'
                  ? 'Skipped'
                  : s.state === 'upcoming' || s.state === 'due'
                    ? 'Not yet'
                    : 'Not logged';
            return (
              <div
                key={d.medId}
                className="flex items-center gap-3 text-[15px]"
              >
                {med && <Pill look={med.look} form={med.form} size={20} />}
                <span className="min-w-0 flex-1 wrap-anywhere">
                  {med?.name ?? 'Removed medicine'}
                  {med && (
                    <span className="num block text-[13px] text-soft">
                      {medicineDose(med, l?.amount ?? d.amount ?? med.amount)}
                    </span>
                  )}
                </span>
                <span
                  className={`num ${l?.status === 'taken' ? 'font-semibold text-pip-ink' : 'text-soft'}`}
                >
                  {status}
                </span>
              </div>
            );
          })}
        </Card>
      ))}
      {prn.length > 0 && (
        <Card className="grid gap-2">
          <h3 className="font-bold text-[16px]">When needed</h3>
          {prn.map((l) => (
            <div key={l.due} className="num flex justify-between text-[15px]">
              <span>{medById(meds, l.medId)?.name}</span>
              <span className="text-soft">{fmtTime(l.due)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
  if (!page)
    return (
      <div className="grid gap-3">
        <h2 className="px-1 font-bold text-[18px]">{title}</h2>
        {body}
      </div>
    );
  return (
    <div className="scroller min-w-0 flex-1">
      <div className="mx-auto grid w-full max-w-160 content-start gap-4 px-4 pt-[calc(8px+var(--sat))] pb-8">
        <div className="flex items-center gap-1">
          <IconButton
            icon="back"
            label="Back to history"
            onClick={() => back('/history')}
            tone="plain"
          />
          <h1 className="font-extrabold text-[24px]">{title}</h1>
        </div>
        {body}
        <button
          type="button"
          className="btn btn-soft press"
          onClick={() =>
            navigate(`/day/${addDays(day, -1)}`, { replace: true, dir: 'back' })
          }
        >
          <Icon name="back" size={18} />
          {fmtDay(addDays(day, -1), { weekday: 'long' })}
        </button>
      </div>
    </div>
  );
}
