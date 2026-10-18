import { useState } from 'react';
import { useLayout } from '../app/layout.ts';
import Icon from '../components/Icon.tsx';
import { Pill } from '../components/PillLook.tsx';
import Pip from '../components/Pip.tsx';
import { H2, IconButton } from '../components/ui.tsx';
import { useData } from '../lib/db.ts';
import { doseLine, shortSchedule } from '../lib/dose-format.ts';
import { navigate } from '../lib/route.ts';
import { courseDay, stockInfo } from '../lib/schedule.ts';
import { routinesStore } from '../lib/settings.ts';
import { useStore } from '../lib/store.ts';
import { dayKey } from '../lib/time.ts';
import { useTitle } from '../lib/title.ts';
import type { Medicine } from '../lib/types.ts';

export default function Medicines({ selected }: { selected?: string }) {
  const { meds, ready } = useData();
  const { mode } = useLayout();
  const [showArchived, setShowArchived] = useState(false);
  useTitle('Medicines · Tend');
  const active = meds.filter((m) => !m.archived);
  const archived = meds.filter((m) => m.archived);
  if (!ready) return <div className="flex-1" />;
  return (
    <div className="scroller min-w-0 flex-1">
      <div className="mx-auto grid w-full max-w-200 content-start gap-5 px-4 pt-[calc(12px+var(--sat))] pb-8 tab:px-8 tab:pt-[calc(28px+var(--sat))]">
        <header className="flex min-h-11 items-center gap-3 px-1">
          <h1 className="min-w-0 flex-1 font-extrabold text-[clamp(28px,4vw,40px)] leading-tight tracking-[-0.02em]">
            Medicines
          </h1>
          {mode === 'phone' && active.length > 0 && (
            <IconButton
              icon="plus"
              label="Add medicine"
              keyHint="N"
              onClick={() => navigate('/medicine/new')}
            />
          )}
        </header>
        {active.length === 0 ? (
          <div className="grid justify-items-center gap-3 rounded-[28px] bg-pip-wash px-6 py-10 text-center">
            <Pip mood="idle" className="size-28" track poke />
            <h2 className="font-extrabold text-[22px]">No medicines yet</h2>
            <p className="max-w-[30ch] text-soft">
              Add one and it shows up on Today at the right time.
            </p>
            <button
              type="button"
              className="btn btn-primary press mt-1 px-6"
              onClick={() => navigate('/medicine/new')}
            >
              Add a medicine
            </button>
          </div>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {active.map((m) => (
              <li key={m.id}>
                <MedCard med={m} selected={m.id === selected} />
              </li>
            ))}
          </ul>
        )}
        {archived.length > 0 && (
          <section className="grid gap-2">
            <button
              type="button"
              aria-expanded={showArchived}
              onClick={() => setShowArchived(!showArchived)}
              className="press flex min-h-11 items-center gap-2 px-1 text-left"
            >
              <H2 className="px-0!">Archived · {archived.length}</H2>
              <Icon
                name="next"
                size={18}
                className={`text-soft transition-transform duration-200 ${showArchived ? 'rotate-90' : ''}`}
              />
            </button>
            {showArchived && (
              <ul className="fade-in m-0 grid list-none gap-2 p-0">
                {archived.map((m) => (
                  <li key={m.id}>
                    <MedCard med={m} selected={m.id === selected} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function MedCard({ med, selected }: { med: Medicine; selected?: boolean }) {
  const routines = useStore(routinesStore);
  const today = dayKey();
  const info = stockInfo(med, routines, today);
  const c = courseDay(med, today);
  return (
    <a
      href={`/medicine/${med.id}`}
      aria-current={selected ? 'page' : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        navigate(`/medicine/${med.id}`, {
          replace:
            selected === false && location.pathname.startsWith('/medicine/'),
        });
      }}
      className={`press surface flex min-h-18 items-center gap-3 rounded-[22px] p-3 pr-4 text-ink no-underline shadow-(--shadow) ${
        selected ? 'shadow-[inset_0_0_0_2px_var(--pip)]' : ''
      } ${med.archived ? 'opacity-70' : ''}`}
    >
      <span className="grid size-12 flex-none place-items-center rounded-[15px] bg-milk">
        <Pill look={med.look} form={med.form} size={28} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block wrap-anywhere font-bold font-display text-[17px]">
          {med.name}
        </b>
        <span className="num block wrap-anywhere text-[14px] text-soft">
          {doseLine(med, false)}
        </span>
        <span className="num mt-0.5 block wrap-anywhere text-[13px] text-soft">
          {shortSchedule(med.schedule)}
          {c?.total ? ` · day ${c.n} of ${c.total}` : ''}
        </span>
      </span>
      {info && (
        <span
          className={`num flex-none text-right text-[14px] ${info.low ? 'font-bold text-ink' : 'text-soft'}`}
        >
          {info.count} left
          {info.low && (
            <span className="block font-semibold text-[12px] text-soft">
              refill soon
            </span>
          )}
        </span>
      )}
      <Icon name="next" size={20} className="flex-none text-soft" />
    </a>
  );
}
