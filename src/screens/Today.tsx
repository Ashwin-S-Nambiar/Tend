import { useEffect, useState } from 'react';
import { useLayout } from '../app/layout.ts';
import { themeColor, useTheme } from '../app/theme.ts';
import ActionSheet from '../components/ActionSheet.tsx';
import DayRing from '../components/DayRing.tsx';
import Icon from '../components/Icon.tsx';
import MedRow from '../components/MedRow.tsx';
import { Pill } from '../components/PillLook.tsx';
import Pip, { type Mood } from '../components/Pip.tsx';
import { SceneArt, SceneIcon } from '../components/Scene.tsx';
import SwipeRow from '../components/SwipeRow.tsx';
import TimeSheet from '../components/TimeSheet.tsx';
import {
  hereSuffix,
  TravelCard,
  TravelChip,
  useTravel,
} from '../components/Travel.tsx';
import { Card, H2, IconButton } from '../components/ui.tsx';
import WeekRings from '../components/WeekRings.tsx';
import { skip, snooze, take, takePrn } from '../lib/actions.ts';
import { adjustStock, useData } from '../lib/db.ts';
import { shortSchedule } from '../lib/dose-format.ts';
import { useLongPress } from '../lib/press.ts';
import { navigate } from '../lib/route.ts';
import { courseDay, doseState } from '../lib/schedule.ts';
import {
  dueDate,
  dueParts,
  fmtDay,
  fmtTime,
  nowKey,
  relDay,
} from '../lib/time.ts';
import { useTitle } from '../lib/title.ts';
import { toast } from '../lib/toast.ts';
import { medById, type Slot, useToday } from '../lib/today.ts';
import type { Medicine } from '../lib/types.ts';

function greeting(h: number) {
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function takeLabel(n: number) {
  if (n === 1) return 'Take';
  if (n === 2) return 'Take both';
  return `Take all ${n}`;
}

export default function Today() {
  const t = useToday();
  const { logs } = useData();
  const { mode, panel, wide } = useLayout();
  const dark = useTheme();
  const [hold, setHold] = useState<Slot | null>(null);
  const [flash, setFlash] = useState(false);
  useTitle('Tend · Your medicines, on time');

  const focus = hold ?? t.focus;
  const night = t.night && !hold;

  useEffect(() => {
    if (!night) return;
    themeColor('night');
    return () => themeColor(dark ? 'dark' : 'light');
  }, [night, dark]);

  function onTake(slot: Slot, at?: string) {
    setHold(slot);
    setFlash(true);
    take(slot.doses, slot.label, at);
    setTimeout(() => setHold(null), 450);
    setTimeout(() => setFlash(false), 2600);
  }

  const ringMood: Mood = flash
    ? 'taken'
    : night
      ? 'sleep'
      : t.focus?.state === 'due'
        ? 'due'
        : t.allDone
          ? 'done'
          : t.low.length
            ? 'low'
            : 'idle';

  if (!t.ready) return <div className="flex-1" />;

  if (t.empty) return <Empty />;

  if (night)
    return (
      <Night
        next={t.next}
        meds={t.meds}
        done={t.progress.done}
        total={t.progress.total}
      />
    );

  const header = (
    <header className="flex items-center gap-3 px-1 pt-2">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[14px] text-soft">
          {fmtDay(t.today, { weekday: 'long', day: 'numeric', month: 'short' })}
        </p>
        <h1 className="mt-0.5 font-extrabold text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.02em]">
          {greeting(t.now.getHours())}
        </h1>
        <TravelChip />
      </div>
      {mode === 'tab' && (
        <div className="w-70">
          <WeekRings size={30} />
        </div>
      )}
      {mode === 'phone' && (
        <IconButton
          icon="plus"
          label="Add medicine"
          keyHint="N"
          onClick={() => navigate('/medicine/new')}
        />
      )}
      <DayRing
        done={t.progress.done}
        total={t.progress.total}
        mood={ringMood}
        size={wide ? 64 : 56}
      />
    </header>
  );

  const card = focus ? (
    <DueCard
      key={focus.key}
      slot={focus}
      meds={t.meds}
      onTake={onTake}
      compact={mode === 'land'}
      big={wide}
    />
  ) : (
    <AllDoneCard next={t.next} meds={t.meds} />
  );

  const laterList = t.later.length > 0 && (
    <section className="grid gap-2" aria-labelledby="later">
      <H2>
        <span id="later">Later today</span>
      </H2>
      <div
        className={`grid gap-2 ${wide ? 'grid-cols-[repeat(auto-fill,minmax(250px,1fr))]' : ''}`}
      >
        {t.later.map((s) => (
          <SlotRow key={s.key} slot={s} meds={t.meds} />
        ))}
      </div>
    </section>
  );

  const prn = t.prn.length > 0 && (
    <section className="grid gap-2" aria-labelledby="prn">
      <H2>
        <span id="prn">When needed</span>
      </H2>
      <div className={`grid gap-2 ${wide ? 'grid-cols-2' : ''}`}>
        {t.prn.map(({ med, state }) => (
          <MedRow
            key={med.id}
            med={med}
            withFood={false}
            extra={
              state?.full
                ? `${state.todayCount} today, that's the most`
                : state?.nextAt
                  ? `next from ${fmtTime(state.nextAt)}`
                  : state?.todayCount
                    ? `${state.todayCount} today`
                    : undefined
            }
            trailing={
              <button
                type="button"
                className="btn btn-soft btn-sm press"
                disabled={!state?.canTake}
                onClick={() => takePrn(med)}
                aria-label={`Take ${med.name} now`}
              >
                Take
              </button>
            }
          />
        ))}
      </div>
    </section>
  );

  const past = t.past.length > 0 && (
    <section className="grid gap-2" aria-labelledby="earlier">
      <H2>
        <span id="earlier">Earlier today</span>
      </H2>
      <div className={`grid gap-2 ${wide ? 'grid-cols-2' : ''}`}>
        {t.past.map((s) => (
          <SlotRow key={s.key} slot={s} meds={t.meds} />
        ))}
      </div>
    </section>
  );

  const chips = !panel && (t.low.length > 0 || t.courses.length > 0) && (
    <section
      className={`grid gap-2 ${mode === 'tab' ? 'grid-cols-2' : ''}`}
      aria-label="Stock and courses"
    >
      {t.low.map(({ med, info }) => (
        <LowRow
          key={med.id}
          med={med}
          days={info?.days ?? 0}
          count={info?.count ?? 0}
        />
      ))}
      {t.courses.map(({ med, day }) => (
        <button
          key={med.id}
          type="button"
          onClick={() => navigate(`/medicine/${med.id}`)}
          className="press surface flex min-h-16 items-center gap-3 rounded-[20px] p-3 text-left shadow-(--shadow)"
        >
          <span className="grid size-11 place-items-center rounded-[14px] bg-sun-wash">
            <Pill look={med.look} form={med.form} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block font-bold font-display text-[16px]">
              {med.name}
            </b>
            <span className="num text-[14px] text-soft">
              Day {day?.n} of {day?.total}
            </span>
          </span>
          <Icon name="next" size={20} className="text-soft" />
        </button>
      ))}
    </section>
  );

  const meds = (mode === 'lap' || mode === 'desk' || mode === 'tab') && (
    <section className="grid gap-2" aria-labelledby="yours">
      <H2>
        <span id="yours">Your medicines</span>
      </H2>
      <div
        className={`grid gap-3 ${mode === 'tab' ? 'grid-cols-2' : 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))]'}`}
      >
        {t.meds.map((m) => (
          <MedTile
            key={m.id}
            med={m}
            info={t.stock.find((s) => s.med.id === m.id)?.info ?? null}
            day={t.today}
          />
        ))}
      </div>
    </section>
  );

  if (mode === 'land') {
    return (
      <div className="flex min-w-0 flex-1 gap-3 p-3 pr-[max(12px,var(--sar))]">
        <div className="flex w-[46%] min-w-0 flex-none flex-col">{card}</div>
        <div className="scroller grid min-w-0 flex-1 content-start gap-4 pb-[calc(12px+var(--sab))]">
          {focus && (
            <div className="grid gap-1.5">
              {focus.doses.map((d, i) => {
                const med = medById(t.meds, d.medId);
                return med ? (
                  <MedRow
                    key={d.medId}
                    med={med}
                    index={i}
                    state={doseState(logs, d, nowKey())}
                    onClick={() => navigate(`/dose/${focus.key}`)}
                  />
                ) : null;
              })}
            </div>
          )}
          {laterList}
          {prn}
          {chips}
          {past}
        </div>
      </div>
    );
  }

  return (
    <div className="scroller min-w-0 flex-1">
      <div
        className={`mx-auto grid w-full content-start gap-5 px-4 pt-[calc(8px+var(--sat))] pb-8 tab:px-8 tab:pt-[calc(24px+var(--sat))] ${
          mode === 'desk' ? 'max-w-240' : 'max-w-200'
        }`}
      >
        {header}
        <TravelCard />
        {card}
        {laterList}
        {prn}
        {chips}
        {past}
        {meds}
      </div>
    </div>
  );
}

function DueCard({
  slot,
  meds,
  onTake,
  compact,
  big,
}: {
  slot: Slot;
  meds: Medicine[];
  onTake: (s: Slot, at?: string) => void;
  compact?: boolean;
  big?: boolean;
}) {
  const { logs } = useData();
  const [more, setMore] = useState(false);
  const [late, setLate] = useState(false);
  const nk = nowKey();
  const time = fmtTime(slot.key);
  const open = slot.doses.filter((d) => {
    const s = doseState(logs, d, nk);
    return s === 'open' || s === 'snoozed';
  });
  const due = slot.state === 'due';
  const overdue = due && Date.now() - dueDate(slot.key).getTime() > 30 * 6e4;
  const n = slot.doses.length;
  const first = medById(meds, slot.doses[0]?.medId ?? '');
  const title = due
    ? n === 1
      ? `Time for ${first?.name ?? 'your medicine'}`
      : `Time for ${plural(n, 'medicine')}`
    : n === 1
      ? (first?.name ?? '1 medicine')
      : plural(n, 'medicine');
  const { keeping } = useTravel();
  const meta =
    slot.state === 'snoozed' && slot.until
      ? `${slot.label} · snoozed to ${fmtTime(slot.until)}`
      : `${slot.label} · ${due ? 'due' : 'at'} ${time}${hereSuffix(slot.key, keeping)}`;
  const allTaken = open.length === 0;
  const press = useLongPress(() => setLate(true));
  const nightCard = slot.scene === 'night';
  const pipMood: Mood = allTaken
    ? 'taken'
    : overdue
      ? 'nudge'
      : due
        ? 'due'
        : 'idle';

  return (
    <article
      className={`fade-in relative isolate grid content-between gap-4 overflow-hidden rounded-[28px] p-4 ${
        compact ? 'h-full' : big ? 'min-h-[min(320px,40dvh)] p-6' : 'min-h-60'
      }`}
      data-scene-dark={nightCard ? '' : undefined}
      aria-labelledby={`card-${slot.key}`}
    >
      <SceneArt scene={slot.scene} />
      <div className="relative flex items-start gap-3">
        <div className="grid min-w-0 flex-1 gap-0.5 pt-1">
          <p className="font-bold font-display text-[14px] opacity-80">
            {meta}
          </p>
          <h2
            id={`card-${slot.key}`}
            className={`font-extrabold leading-[1.08] ${big ? 'text-[30px]' : 'text-[24px]'}`}
          >
            {title}
          </h2>
        </div>
        <Pip
          mood={pipMood}
          className={`-mt-1 -mr-1 flex-none ${big ? 'mr-4 size-32' : compact ? 'size-20' : 'size-22'}`}
          poke
        />
      </div>
      <div className="relative grid gap-3">
        {!compact && (
          <div className={`relative grid gap-1.5 ${big ? 'grid-cols-2' : ''}`}>
            {slot.doses.map((d, i) => {
              const med = medById(meds, d.medId);
              if (!med) return null;
              const c = courseDay(med, slot.day);
              const st = doseState(logs, d, nk);
              return (
                <SwipeRow
                  key={d.medId}
                  label={`Skip ${med.name}`}
                  disabled={st === 'taken' || st === 'skipped'}
                  onCommit={() => skip([d], slot.label)}
                >
                  <MedRow
                    med={med}
                    index={i}
                    state={st}
                    extra={c?.total ? `day ${c.n} of ${c.total}` : undefined}
                    onClick={() => navigate(`/dose/${slot.key}`)}
                  />
                </SwipeRow>
              );
            })}
          </div>
        )}
        <div className={`relative flex gap-2 ${big ? 'flex-wrap' : ''}`}>
          <button
            type="button"
            className={`btn press min-w-0 flex-1 ${due ? 'btn-primary' : 'btn-ghost'} ${big ? 'max-w-70' : ''}`}
            disabled={allTaken}
            data-key="T"
            {...press.handlers}
            onClick={() => onTake(slot)}
            aria-describedby={`hint-${slot.key}`}
          >
            {allTaken
              ? `Taken at ${fmtTime(nk)}`
              : due
                ? takeLabel(open.length)
                : 'Take early'}
            {big && !allTaken && <kbd className="kbd">T</kbd>}
          </button>
          <span id={`hint-${slot.key}`} className="sr-only">
            Long-press for taken at another time
          </span>
          {big ? (
            <>
              <button
                type="button"
                className="btn btn-ghost press"
                onClick={() => snooze(slot, 10)}
                disabled={allTaken}
              >
                <Icon name="snooze" size={20} />
                Snooze
                <kbd className="kbd">Z</kbd>
              </button>
              <button
                type="button"
                className="btn btn-ghost press"
                onClick={() => skip(open, slot.label)}
                disabled={allTaken}
              >
                Skip
                <kbd className="kbd">S</kbd>
              </button>
              <button
                type="button"
                className="btn btn-ghost press px-0! w-13"
                aria-label="More options"
                data-tip="More options"
                onClick={() => setMore(true)}
              >
                <Icon name="more" />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-ghost press w-13 px-0!"
              aria-label="More options"
              onClick={() => setMore(true)}
            >
              <Icon name="more" />
            </button>
          )}
        </div>
      </div>
      <ActionSheet
        open={more}
        onClose={() => setMore(false)}
        title={`${slot.label} · ${time}`}
        actions={[
          {
            label: 'Snooze 10 min',
            icon: 'snooze',
            onSelect: () => snooze(slot, 10),
            hint: 'Z',
          },
          {
            label: 'Snooze 30 min',
            icon: 'snooze',
            onSelect: () => snooze(slot, 30),
          },
          {
            label: 'Taken at another time',
            icon: 'clock',
            onSelect: () => setLate(true),
          },
          {
            label: open.length > 1 ? 'Skip all' : 'Skip',
            icon: 'skip',
            onSelect: () => skip(open, slot.label),
            hint: 'S',
          },
          {
            label: 'Choose medicines',
            icon: 'check',
            onSelect: () => navigate(`/dose/${slot.key}`),
          },
        ]}
      />
      <TimeSheet
        open={late}
        onClose={() => setLate(false)}
        defaultTime={dueParts(slot.key).time}
        title={`When did you take ${n === 1 ? 'it' : 'them'}?`}
        onSave={(time) => onTake(slot, `${slot.day}T${time}`)}
      />
    </article>
  );
}

function AllDoneCard({
  next,
  meds,
}: {
  next: ReturnType<typeof useToday>['next'];
  meds: Medicine[];
}) {
  const first = next ? medById(meds, next.doses[0]?.medId ?? '') : undefined;
  return (
    <article className="relative isolate grid min-h-50 content-end gap-1 overflow-hidden rounded-[28px] p-5">
      <SceneArt scene="evening" />
      <Pip mood="done" className="absolute top-4 right-4 size-26" poke />
      <div className="relative pr-26">
        <h2 className="font-extrabold text-[24px] leading-tight">
          All done for now
        </h2>
        {next && (
          <p className="mt-1 text-[16px] text-soft">
            Next up: {first?.name}
            {next.doses.length > 1 ? ` and ${next.doses.length - 1} more` : ''}{' '}
            at {fmtTime(next.key)}
            {relDay(next.day) === 'today' ? '' : ` ${relDay(next.day)}`}.
          </p>
        )}
      </div>
    </article>
  );
}

function SlotRow({ slot, meds }: { slot: Slot; meds: Medicine[] }) {
  const list = slot.doses
    .map((d) => medById(meds, d.medId)?.name)
    .filter(Boolean) as string[];
  const status =
    slot.state === 'done'
      ? 'Logged'
      : slot.state === 'unlogged'
        ? 'Not logged'
        : slot.state === 'snoozed' && slot.until
          ? `Snoozed to ${fmtTime(slot.until)}`
          : null;
  return (
    <button
      type="button"
      onClick={() => navigate(`/dose/${slot.key}`)}
      className="press surface flex min-h-17 items-center gap-3 rounded-[20px] p-2.5 pr-4 text-left shadow-(--shadow)"
    >
      <span
        className="grid size-12 flex-none place-items-center rounded-[15px]"
        style={{
          background:
            slot.scene === 'night'
              ? 'var(--night)'
              : `var(--${{ morning: 'sun', afternoon: 'noon', evening: 'dusk' }[slot.scene]}-wash)`,
        }}
      >
        <SceneIcon scene={slot.scene} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block font-bold font-display text-[16px]">{slot.label}</b>
        <span className="block wrap-anywhere text-[14px] text-soft">
          {status ?? list.join(', ')}
        </span>
      </span>
      {slot.state === 'done' ? (
        <span className="grid size-7 place-items-center rounded-full bg-pip-wash text-pip-ink">
          <Icon name="check" size={16} stroke={2.6} />
        </span>
      ) : (
        <time
          className="num font-bold font-display text-[15px]"
          dateTime={slot.key}
        >
          {fmtTime(slot.key)}
        </time>
      )}
    </button>
  );
}

function LowRow({
  med,
  days,
  count,
}: {
  med: Medicine;
  days: number;
  count: number;
}) {
  return (
    <div className="surface flex min-h-16 items-center gap-3 rounded-[20px] p-2.5 pr-3 shadow-(--shadow)">
      <span className="grid size-12 flex-none place-items-center rounded-[15px] bg-noon-wash">
        <Pip mood="low" className="size-10" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block font-bold font-display text-[16px]">
          {med.name} running low
        </b>
        <span className="num text-[14px] text-soft">
          {plural(count, 'left', 'left')}, about {plural(days, 'day')}
        </span>
      </span>
      <RefillButton med={med} />
    </div>
  );
}

export function RefillButton({ med }: { med: Medicine }) {
  return (
    <button
      type="button"
      className="btn btn-soft btn-sm press"
      onClick={() => {
        const by = med.stock?.pack ?? 10;
        const undo = adjustStock([{ id: med.id, by }]);
        toast(`Added ${by} ${med.name}`, undo);
      }}
    >
      Refilled
    </button>
  );
}

function MedTile({
  med,
  info,
  day,
}: {
  med: Medicine;
  info: { count: number; days: number | null; low: boolean } | null;
  day: string;
}) {
  const c = courseDay(med, day);
  const fill =
    info && med.stock
      ? Math.min(1, info.count / Math.max(med.stock.pack * 3, info.count, 1))
      : 0;
  return (
    <button
      type="button"
      onClick={() => navigate(`/medicine/${med.id}`)}
      className="press surface grid content-start gap-1 rounded-[20px] p-4 text-left shadow-(--shadow)"
    >
      <span className="grid size-10 place-items-center rounded-[13px] bg-milk">
        <Pill look={med.look} form={med.form} />
      </span>
      <b className="mt-1.5 wrap-anywhere font-bold font-display text-[16px]">
        {med.name}
      </b>
      <span className="wrap-anywhere text-[14px] text-soft">
        {c?.total ? `Day ${c.n} of ${c.total}` : shortSchedule(med.schedule)}
      </span>
      {info && (
        <>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-(--line)">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${fill * 100}%`,
                background: info.low ? 'var(--noon)' : 'var(--pip)',
              }}
            />
          </span>
          <span className="num text-[13px] text-soft">
            {info.count} left{info.low ? ' · refill soon' : ''}
          </span>
        </>
      )}
    </button>
  );
}

function Empty() {
  return (
    <div className="scroller flex min-w-0 flex-1 flex-col items-center justify-center gap-4 px-6 pb-10 text-center">
      <Pip mood="hello" className="size-40" poke track />
      <h1 className="font-extrabold text-[28px]">Nothing to tend yet</h1>
      <p className="max-w-[30ch] text-[17px] text-soft">
        Add what you take and when, and Pip will keep the day in order.
      </p>
      <button
        type="button"
        className="btn btn-primary press mt-2 px-6"
        onClick={() => navigate('/medicine/new')}
      >
        <Icon name="plus" size={20} />
        Add a medicine
      </button>
    </div>
  );
}

function Night({
  next,
  meds,
  done,
  total,
}: {
  next: ReturnType<typeof useToday>['next'];
  meds: Medicine[];
  done: number;
  total: number;
}) {
  const first = next ? medById(meds, next.doses[0]?.medId ?? '') : undefined;
  return (
    <div
      className="night fade-in relative isolate flex min-w-0 flex-1 overflow-hidden"
      data-scene-dark=""
    >
      <SceneArt scene="night" />
      <div className="relative z-10 mx-auto flex w-full max-w-120 flex-col items-center justify-end gap-3 px-6 pb-[calc(40px+var(--sab))] text-center text-ink tab:justify-center">
        <Pip
          mood="sleep"
          className="size-44 text-[var(--star)]"
          label="Pip asleep"
          poke
        />
        <h1 className="font-extrabold text-[32px] leading-tight">
          All done for today
        </h1>
        <p className="num max-w-[30ch] text-[17px] text-soft">
          {done} of {total} logged.
          {next && first
            ? ` Next up: ${first.name}${next.doses.length > 1 ? ` and ${next.doses.length - 1} more` : ''} at ${fmtTime(next.key)} ${relDay(next.day)}.`
            : ''}{' '}
          Sleep well.
        </p>
        <button
          type="button"
          className="btn btn-ghost press mt-2"
          onClick={() => navigate('/dose/next')}
        >
          See tomorrow
        </button>
      </div>
    </div>
  );
}

export function TodayPanel() {
  const t = useToday();
  return (
    <div className="grid gap-3">
      <Card className="grid gap-3">
        <h2 className="font-bold text-[17px]">This week</h2>
        <WeekRings size={34} />
      </Card>
      {t.low.length > 0 && (
        <Card className="grid gap-3">
          <h2 className="font-bold text-[17px]">Running low</h2>
          {t.low.map(({ med, info }) => (
            <div key={med.id} className="flex items-center gap-3">
              <Pip mood="low" className="size-12 flex-none" />
              <span className="min-w-0 flex-1">
                <b className="block font-semibold">{med.name}</b>
                <span className="num text-[14px] text-soft">
                  {info?.count} left, about {plural(info?.days ?? 0, 'day')}
                </span>
              </span>
              <RefillButton med={med} />
            </div>
          ))}
        </Card>
      )}
      {t.courses.map(({ med, day }) => (
        <Card key={med.id} className="grid gap-1">
          <h2 className="font-bold text-[17px]">Course</h2>
          <p className="num text-soft">
            {med.name}, day {day?.n} of {day?.total}.{' '}
            {day?.end ? `Ends ${relDay(day.end)}.` : ''}
          </p>
        </Card>
      ))}
      {t.prn.length > 0 && (
        <Card className="grid gap-1">
          <h2 className="font-bold text-[17px]">When needed</h2>
          {t.prn.map(({ med, state }) => (
            <p key={med.id} className="text-soft">
              {med.name}:{' '}
              {state?.last
                ? `last at ${fmtTime(state.last.slice(0, 16))} ${relDay(state.last.slice(0, 10))}`
                : 'not taken yet'}
            </p>
          ))}
        </Card>
      )}
    </div>
  );
}
