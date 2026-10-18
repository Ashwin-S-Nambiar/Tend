import { useMemo, useState } from 'react';
import ActionSheet from '../components/ActionSheet.tsx';
import Icon from '../components/Icon.tsx';
import { Pill } from '../components/PillLook.tsx';
import Pip from '../components/Pip.tsx';
import { Card, IconButton } from '../components/ui.tsx';
import { deleteMed, putMed, useData } from '../lib/db.ts';
import {
  anchorText,
  doseLine,
  medicineDose,
  scheduleText,
} from '../lib/dose-format.ts';
import { replan } from '../lib/push.ts';
import { back, navigate } from '../lib/route.ts';
import { courseDay, dosesOn, latestLog, stockInfo } from '../lib/schedule.ts';
import { routinesStore } from '../lib/settings.ts';
import { useStore } from '../lib/store.ts';
import { addDays, dayKey, fmtTime, nowKey, relDay } from '../lib/time.ts';
import { useTitle } from '../lib/title.ts';
import { toast } from '../lib/toast.ts';
import type { Medicine } from '../lib/types.ts';
import { RefillButton } from './Today.tsx';

export default function MedicineDetail({
  id,
  inPanel,
}: {
  id?: string;
  inPanel?: boolean;
}) {
  const { meds, ready } = useData();
  const med = id ? meds.find((m) => m.id === id) : undefined;
  if (!ready) return null;
  if (!med) {
    if (inPanel)
      return (
        <div className="grid justify-items-center gap-2 px-4 pt-20 text-center">
          <Pip mood="idle" className="size-24" track />
          <p className="max-w-[24ch] text-soft">
            Pick a medicine to see its schedule, stock and history.
          </p>
        </div>
      );
    return <Gone />;
  }
  return <Detail med={med} inPanel={inPanel} />;
}

function Gone() {
  useTitle('Not found · Tend');
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <Pip mood="lost" className="size-32" />
      <h1 className="font-extrabold text-[26px]">That medicine isn't here</h1>
      <button
        type="button"
        className="btn btn-primary press px-6"
        onClick={() => navigate('/medicines', { replace: true })}
      >
        All medicines
      </button>
    </div>
  );
}

function useAdherence(med: Medicine) {
  const { logs } = useData();
  const routines = useStore(routinesStore);
  return useMemo(() => {
    const today = dayKey();
    const nk = nowKey();
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
    let total = 0;
    let taken = 0;
    const strip = days.map((day) => {
      const doses = dosesOn([med], routines, day).filter((d) => d.due <= nk);
      const t = doses.filter(
        (d) => latestLog(logs, med.id, d.due)?.status === 'taken',
      ).length;
      total += doses.length;
      taken += t;
      return { day, doses: doses.length, taken: t };
    });
    const recent = logs
      .filter((l) => l.medId === med.id && l.status !== 'snoozed')
      .sort((a, b) => (b.at ?? b.due).localeCompare(a.at ?? a.due))
      .slice(0, 6);
    return {
      strip,
      pct: total ? Math.round((taken / total) * 100) : null,
      recent,
    };
  }, [med, logs, routines]);
}

function Detail({ med, inPanel }: { med: Medicine; inPanel?: boolean }) {
  const routines = useStore(routinesStore);
  const [menu, setMenu] = useState(false);
  const today = dayKey();
  const info = stockInfo(med, routines, today);
  const c = courseDay(med, today);
  const a = useAdherence(med);
  useTitle(`${med.name} · Tend`);

  function archive() {
    const undo = putMed({ ...med, archived: !med.archived });
    replan();
    toast(med.archived ? `${med.name} is back` : `${med.name} archived`, () => {
      undo();
      replan();
    });
  }

  function remove() {
    const undo = deleteMed(med.id);
    replan();
    toast(`${med.name} deleted`, () => {
      undo();
      replan();
    });
    navigate('/medicines', { replace: true, dir: 'back' });
  }

  return (
    <div className={inPanel ? 'grid gap-3' : 'scroller min-w-0 flex-1'}>
      <div
        className={
          inPanel
            ? 'grid gap-3'
            : 'mx-auto grid w-full max-w-160 content-start gap-4 px-4 pt-[calc(8px+var(--sat))] pb-8'
        }
      >
        {!inPanel && (
          <div className="flex items-center justify-between">
            <IconButton
              icon="back"
              label="Back to medicines"
              onClick={() => back('/medicines')}
              tone="plain"
            />
            <IconButton
              icon="more"
              label="More options"
              onClick={() => setMenu(true)}
              tone="plain"
            />
          </div>
        )}
        <Card className="grid justify-items-start gap-3 p-5">
          <div className="flex w-full items-start gap-4">
            <span
              className="grid size-20 flex-none place-items-center rounded-3xl bg-milk"
              aria-hidden="true"
            >
              <Pill look={med.look} form={med.form} size={50} />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <h1 className="font-extrabold text-[28px] leading-tight">
                {med.name}
              </h1>
              <p className="num text-soft">{doseLine(med)}</p>
            </div>
            {inPanel && (
              <IconButton
                icon="more"
                label="More options"
                onClick={() => setMenu(true)}
                tone="plain"
              />
            )}
          </div>
          <p className="font-semibold text-[16px]">
            {scheduleText(med.schedule)}
          </p>
          {'at' in med.schedule &&
            med.schedule.at.some((a) => a.amount !== undefined) && (
              <ul className="m-0 grid list-none gap-2 p-0">
                {med.schedule.at.map((a) => (
                  <li
                    key={anchorText(a)}
                    className="flex items-center justify-between gap-3 rounded-[14px] bg-milk px-3 py-2 text-[14px]"
                  >
                    <span>{anchorText(a)}</span>
                    <strong className="num whitespace-nowrap">
                      {medicineDose(med, a.amount ?? med.amount)}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          {c?.total && (
            <p className="num text-soft">
              Course: day {Math.max(1, Math.min(c.n, c.total))} of {c.total}
              {c.end ? `, ends ${relDay(c.end)}` : ''}
            </p>
          )}
          {med.archived && (
            <p className="font-semibold text-soft">
              Archived. It won't remind you.
            </p>
          )}
          <button
            type="button"
            className="btn btn-soft press mt-1"
            onClick={() => navigate(`/medicine/${med.id}/edit`)}
          >
            <Icon name="edit" size={20} />
            Edit
          </button>
        </Card>
        {info && (
          <Card className="grid gap-3">
            <div className="flex items-center gap-3">
              {info.low && <Pip mood="low" className="size-12 flex-none" />}
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-[17px]">{info.count} left</h2>
                <p className="num text-[15px] text-soft">
                  {info.days === null
                    ? 'Only when needed'
                    : `About ${info.days} days at this pace`}
                  {info.low ? '. Time to refill.' : ''}
                </p>
              </div>
              <RefillButton med={med} />
            </div>
          </Card>
        )}
        <Card className="grid gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-bold text-[17px]">Last two weeks</h2>
            {a.pct !== null && (
              <span className="num text-[15px] text-soft">{a.pct}% taken</span>
            )}
          </div>
          <div className="grid grid-cols-14 gap-1" aria-hidden="true">
            {a.strip.map((d) => (
              <span
                key={d.day}
                className="h-8 rounded-md"
                style={{
                  background: d.doses
                    ? `color-mix(in srgb, var(--pip) ${Math.round((d.taken / d.doses) * 100)}%, var(--line))`
                    : 'transparent',
                  boxShadow: d.doses
                    ? undefined
                    : 'inset 0 0 0 1.5px var(--line)',
                }}
              />
            ))}
          </div>
          {a.recent.length > 0 && (
            <ul className="m-0 grid list-none gap-1 p-0 text-[15px]">
              {a.recent.map((l) => (
                <li key={l.due} className="num flex justify-between gap-3">
                  <span className="text-soft">
                    {relDay(l.due.slice(0, 10)).replace(/^./, (x) =>
                      x.toUpperCase(),
                    )}
                    , {fmtTime(l.due)}
                  </span>
                  <span>
                    {l.status === 'taken'
                      ? `${medicineDose(med, l.amount ?? med.amount)} · Taken ${l.at ? fmtTime(l.at) : ''}`
                      : 'Skipped'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {med.notes && (
          <Card>
            <h2 className="mb-1 font-bold text-[17px]">Notes</h2>
            <p className="whitespace-pre-wrap text-soft">{med.notes}</p>
          </Card>
        )}
      </div>
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={med.name}
        actions={[
          {
            label: 'Edit',
            icon: 'edit',
            onSelect: () => navigate(`/medicine/${med.id}/edit`),
          },
          {
            label: med.archived ? 'Bring back' : 'Archive',
            icon: 'archive',
            onSelect: archive,
          },
          { label: 'Delete', icon: 'trash', onSelect: remove, danger: true },
        ]}
      />
    </div>
  );
}
