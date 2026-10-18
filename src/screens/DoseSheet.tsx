import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.tsx';
import MedRow from '../components/MedRow.tsx';
import Pip from '../components/Pip.tsx';
import Sheet from '../components/Sheet.tsx';
import TimeSheet from '../components/TimeSheet.tsx';
import { skip, snooze, take, unlog } from '../lib/actions.ts';
import { useData } from '../lib/db.ts';
import { FOOD_TEXT } from '../lib/dose-format.ts';
import { useNow } from '../lib/hooks.ts';
import { useLongPress } from '../lib/press.ts';
import { back } from '../lib/route.ts';
import { courseDay, doseState, nextGroup } from '../lib/schedule.ts';
import { routinesStore } from '../lib/settings.ts';
import { useStore } from '../lib/store.ts';
import { dueDate, dueParts, fmtTime, nowKey, relDay } from '../lib/time.ts';
import { useTitle } from '../lib/title.ts';
import { medById, type Slot, slotsOn } from '../lib/today.ts';

function useSlot(due: string) {
  const { meds, logs } = useData();
  const routines = useStore(routinesStore);
  const now = useNow();
  return useMemo(() => {
    const active = meds.filter((m) => !m.archived);
    if (due === 'next') {
      const today = slotsOn(
        active,
        routines,
        logs,
        nowKey(now).slice(0, 10),
        now,
      );
      const hit =
        today.find((s) => s.state === 'due') ??
        today.find((s) => s.state === 'snoozed');
      if (hit) return hit;
      const g = nextGroup(active, routines, logs, now);
      return g
        ? slotsOn(active, routines, logs, g.day, now).find(
            (s) => s.key === g.key,
          )
        : undefined;
    }
    const day = dueParts(due).day;
    const slots = slotsOn(active, routines, logs, day, now);
    return (
      slots.find((s) => s.key === due) ??
      slots.find((s) => s.doses.some((d) => d.due === due))
    );
  }, [due, meds, logs, routines, now]);
}

function usePick() {
  const [off, setOff] = useState<Set<string>>(() => new Set());
  return {
    off,
    toggle: (id: string) =>
      setOff((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
  };
}

export default function DoseSheet({ due }: { due: string }) {
  const slot = useSlot(due);
  const { ready } = useData();
  const [open, setOpen] = useState(true);
  const pick = usePick();
  useTitle(slot ? `${slot.label} dose · Tend` : 'Dose · Tend');
  if (!ready) return null;
  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      onClosed={() => back('/')}
      pushHistory={false}
      label={slot ? `${slot.label} dose` : 'Dose not found'}
      header={slot ? <Head slot={slot} /> : undefined}
      footer={
        slot ? (
          <Foot slot={slot} off={pick.off} close={() => setOpen(false)} />
        ) : undefined
      }
    >
      {slot ? (
        <Body slot={slot} pick={pick} />
      ) : (
        <Missing close={() => setOpen(false)} />
      )}
    </Sheet>
  );
}

const close = () => back('/');

export function DosePanel({ due }: { due: string }) {
  const slot = useSlot(due);
  const { ready } = useData();
  const pick = usePick();
  const panel = useRef<HTMLElement>(null);
  useTitle(slot ? `${slot.label} dose · Tend` : 'Dose · Tend');
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]'))
        close();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  if (!ready) return null;
  return (
    <section
      ref={panel}
      tabIndex={-1}
      aria-label={slot ? `${slot.label} dose` : 'Dose not found'}
      className="surface fade-in relative grid gap-3 rounded-[24px] p-5 shadow-(--shadow)"
    >
      <button
        type="button"
        aria-label="Close"
        data-tip="Close"
        data-key="Esc"
        onClick={close}
        className="press absolute top-3 right-3 grid size-11 place-items-center rounded-[14px] text-soft hover-fine:bg-milk"
      >
        <Icon name="close" size={20} />
      </button>
      {slot ? (
        <>
          <Head slot={slot} />
          <Body slot={slot} pick={pick} />
          <Foot slot={slot} off={pick.off} close={close} />
        </>
      ) : (
        <Missing close={close} />
      )}
    </section>
  );
}

function Head({ slot }: { slot: Slot }) {
  const { meds } = useData();
  const n = slot.doses.length;
  const first = medById(meds, slot.doses[0]?.medId ?? '');
  const overdue =
    slot.state === 'due' && Date.now() - dueDate(slot.key).getTime() > 30 * 6e4;
  const when = relDay(slot.day);
  return (
    <div className="flex items-center gap-3 pt-1 pb-2">
      <Pip
        mood={
          slot.state === 'done'
            ? 'taken'
            : overdue
              ? 'nudge'
              : slot.state === 'due'
                ? 'due'
                : 'idle'
        }
        className="size-19 flex-none"
        poke
      />
      <div className="min-w-0">
        <p className="font-bold font-display text-[14px] text-pip-ink">
          {slot.label} · {slot.state === 'upcoming' ? 'at' : 'due'}{' '}
          {fmtTime(slot.key)}
          {when === 'today' ? '' : `, ${when}`}
        </p>
        <h2 className="font-extrabold text-[26px] leading-[1.08]">
          {slot.state === 'done'
            ? 'All logged'
            : n === 1
              ? `Time for ${first?.name ?? 'your medicine'}`
              : `Time for ${n} medicines`}
        </h2>
      </div>
    </div>
  );
}

function Body({
  slot,
  pick,
}: {
  slot: Slot;
  pick: { off: Set<string>; toggle: (id: string) => void };
}) {
  const { meds, logs } = useData();
  const nk = nowKey();
  const on = (id: string) => !pick.off.has(id);
  return (
    <div className="grid gap-1.5 pb-1">
      {slot.doses.map((d, i) => {
        const med = medById(meds, d.medId);
        if (!med) return null;
        const state = doseState(logs, d, nk);
        const logged = state === 'taken' || state === 'skipped';
        const c = courseDay(med, slot.day);
        const log = logs.find((l) => l.medId === d.medId && l.due === d.due);
        return (
          <div key={d.medId} className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <MedRow
                med={med}
                amount={log?.amount ?? d.amount}
                tone="milk"
                withFood={false}
                index={i}
                state={logged ? state : undefined}
                extra={
                  logged && log?.at && state === 'taken'
                    ? `taken ${fmtTime(log.at)}`
                    : [
                        med.food ? FOOD_TEXT[med.food] : '',
                        c?.total ? `day ${c.n} of ${c.total}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ') || undefined
                }
              />
            </div>
            {logged ? (
              <button
                type="button"
                className="btn btn-soft btn-sm press"
                onClick={() => unlog(d)}
                aria-label={`Clear ${med.name}`}
              >
                Clear
              </button>
            ) : (
              <button
                type="button"
                role="checkbox"
                aria-checked={on(d.medId)}
                aria-label={`Include ${med.name}`}
                onClick={() => pick.toggle(d.medId)}
                className="press grid size-14 flex-none place-items-center rounded-[16px] bg-milk"
              >
                <span
                  className={`grid size-7 place-items-center rounded-[9px] transition-colors duration-150 ${on(d.medId) ? 'bg-pip-deep text-on-pip' : 'shadow-[inset_0_0_0_2px_var(--line-strong)]'}`}
                >
                  {on(d.medId) && <Icon name="check" size={18} stroke={2.6} />}
                </span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Foot({
  slot,
  off,
  close,
}: {
  slot: Slot;
  off: Set<string>;
  close: () => void;
}) {
  const { logs } = useData();
  const [late, setLate] = useState(false);
  const nk = nowKey();
  const open = slot.doses.filter((d) => {
    const s = doseState(logs, d, nk);
    return s === 'open' || s === 'snoozed';
  });
  const chosen = open.filter((d) => !off.has(d.medId));
  const label =
    chosen.length === open.length
      ? open.length === 1
        ? 'Taken'
        : open.length === 2
          ? 'Taken, both'
          : `Taken, all ${open.length}`
      : `Taken, ${chosen.length} of ${open.length}`;
  const press = useLongPress(() => setLate(true));
  const done = (fn: () => void) => {
    fn();
    close();
  };
  if (!open.length)
    return (
      <button
        type="button"
        className="btn btn-soft press w-full"
        onClick={close}
      >
        Done
      </button>
    );
  return (
    <div className="grid gap-2">
      <button
        type="button"
        className={`btn press w-full ${slot.state === 'upcoming' ? 'btn-ghost bg-milk!' : 'btn-primary'}`}
        disabled={!chosen.length}
        {...press.handlers}
        onClick={() => done(() => take(chosen, slot.label))}
        aria-describedby="dose-late-hint"
      >
        {slot.state === 'upcoming'
          ? label.replace('Taken', 'Take early')
          : label}
      </button>
      <span id="dose-late-hint" className="sr-only">
        Long-press for taken at another time
      </span>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          className="btn btn-soft btn-sm press min-h-12"
          onClick={() => done(() => snooze(slot, 10))}
        >
          Snooze 10 min
        </button>
        <button
          type="button"
          className="btn btn-soft btn-sm press min-h-12"
          onClick={() => setLate(true)}
        >
          Other time
        </button>
        <button
          type="button"
          className="btn btn-soft btn-sm press min-h-12"
          disabled={!chosen.length}
          onClick={() => done(() => skip(chosen, slot.label))}
        >
          Skip
        </button>
      </div>
      <TimeSheet
        open={late}
        onClose={() => setLate(false)}
        defaultTime={dueParts(slot.key).time}
        title="When did you take them?"
        onSave={(time) =>
          done(() => take(chosen, slot.label, `${slot.day}T${time}`))
        }
      />
    </div>
  );
}

function Missing({ close }: { close: () => void }) {
  return (
    <div className="grid justify-items-center gap-2 py-6 text-center">
      <Pip mood="lost" className="size-28" />
      <h2 className="font-extrabold text-[24px]">This dose moved</h2>
      <p className="max-w-[30ch] text-soft">
        It isn't on your schedule any more. Today has the latest.
      </p>
      <button
        type="button"
        className="btn btn-primary press mt-3 px-6"
        onClick={close}
      >
        Back to today
      </button>
    </div>
  );
}
