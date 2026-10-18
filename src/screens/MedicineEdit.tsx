import {
  type ReactNode,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DateField,
  DateTimeField,
  TimeField,
} from '../components/DateTimeField.tsx';
import Icon from '../components/Icon.tsx';
import { PILL_COLORS, Pill } from '../components/PillLook.tsx';
import Sheet from '../components/Sheet.tsx';
import { Chips, Field, Segmented, Stepper, Switch } from '../components/ui.tsx';
import { putMed, useData } from '../lib/db.ts';
import {
  anchorText,
  doseLine,
  fmtStrength,
  medicineDose,
  scheduleText,
} from '../lib/dose-format.ts';
import { haptic } from '../lib/haptics.ts';
import {
  blank,
  type Draft,
  detailsProblem,
  fromMed,
  fromParsed,
  problem,
  selectMedicineType,
  toMed,
} from '../lib/medicine-draft.ts';
import {
  FORM_FIELDS,
  hasFoodTiming,
  MEDICINE_TYPES,
} from '../lib/medicine-fields.ts';
import { enter } from '../lib/motion.ts';
import { replan } from '../lib/push.ts';
import { back } from '../lib/route.ts';
import {
  DEFAULT_ROUTINES,
  ROUTINE_NAME,
  ROUTINE_ORDER,
} from '../lib/schedule.ts';
import { routinesStore } from '../lib/settings.ts';
import { echo, type Parsed, parse, understood } from '../lib/shorthand.ts';
import { sfx } from '../lib/sound.ts';
import { useStore } from '../lib/store.ts';
import { fmtTime, fromMin, toMin } from '../lib/time.ts';
import { useTitle } from '../lib/title.ts';
import { toast } from '../lib/toast.ts';
import type { Anchor, Medicine, Routine, RoutineId } from '../lib/types.ts';

const STEPS = ['Medicine', 'Schedule', 'Review'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const WEEK_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function reminderTimes(anchor: Anchor, routines: Routine[]) {
  if ('time' in anchor) return fmtTime(anchor.time);
  const routine = routines.find((r) => r.id === anchor.routine);
  if (!routine) return '';
  const time = (value: string) =>
    fmtTime(fromMin((toMin(value) + anchor.offsetMin + 1440) % 1440));
  return routine.weekend && routine.weekend !== routine.weekday
    ? `${time(routine.weekday)} weekdays · ${time(routine.weekend)} weekends`
    : time(routine.weekday);
}

export default function MedicineEdit({
  id,
  onDone,
}: {
  id?: string;
  onDone?: () => void;
}) {
  const { meds, ready } = useData();
  const savedRoutines = useStore(routinesStore);
  const [timeEdits, setTimeEdits] = useState<
    Partial<Record<RoutineId, string>>
  >({});
  const prev = id ? meds.find((m) => m.id === id) : undefined;
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const formId = useId();
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const d = draft ?? (prev ? fromMed(prev) : blank());
  const routines = DEFAULT_ROUTINES.map((fallback) => ({
    ...(savedRoutines.find((r) => r.id === fallback.id) ?? fallback),
    ...(d.kind !== 'once' &&
    d.kind !== 'prn' &&
    d.routines.includes(fallback.id) &&
    timeEdits[fallback.id]
      ? { weekday: timeEdits[fallback.id] }
      : {}),
  }));
  const changedTimes = routines.filter(
    (r) =>
      r.weekday !==
      (
        savedRoutines.find((s) => s.id === r.id) ??
        DEFAULT_ROUTINES.find((s) => s.id === r.id)
      )?.weekday,
  );
  const set = (patch: Partial<Draft>) => setDraft({ ...d, ...patch });
  const issue = step === 0 ? detailsProblem(d) : problem(d);
  useTitle(prev ? `Edit ${prev.name} · Tend` : 'Add medicine · Tend');
  useLayoutEffect(() => {
    if (!STEPS[step]) return;
    if (previousStep.current !== step && form.current)
      enter(form.current, step > previousStep.current ? 1 : -1);
    previousStep.current = step;
    heading.current?.focus({ preventScroll: true });
    form.current?.closest('.scroller')?.scrollTo({ top: 0 });
  }, [step]);
  if (!ready) return null;

  function next() {
    setTried(true);
    if (issue) {
      haptic.warn();
      return;
    }
    if (step < 2) {
      setTried(false);
      setStep(step + 1);
      haptic.tick();
      return;
    }
    const med = toMed(d, prev);
    if (changedTimes.length) routinesStore.set(routines);
    const undo = putMed(med);
    replan();
    sfx.taken();
    haptic.success();
    toast(prev ? `${med.name} saved` : `${med.name} added`, () => {
      undo();
      if (changedTimes.length) {
        routinesStore.set((current) =>
          current.map((r) => {
            const changed = changedTimes.find((s) => s.id === r.id);
            const before =
              savedRoutines.find((s) => s.id === r.id) ??
              DEFAULT_ROUTINES.find((s) => s.id === r.id);
            return changed && before && r.weekday === changed.weekday
              ? { ...r, weekday: before.weekday }
              : r;
          }),
        );
      }
      replan();
    });
    setOpen(false);
  }

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      onClosed={() =>
        onDone ? onDone() : back(prev ? `/medicine/${prev.id}` : '/medicines')
      }
      pushHistory={false}
      size="lg"
      label={prev ? `Edit ${prev.name}` : 'Add a medicine'}
      header={
        <div className="grid gap-4 pt-1 pb-2">
          <div className="flex items-center gap-3">
            <span
              className="grid size-12 flex-none place-items-center rounded-2xl bg-pip-wash"
              aria-hidden="true"
            >
              <Pill
                form={d.form}
                look={{ shape: d.shape, colors: d.colors }}
                size={30}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-soft">
                {prev ? `Edit ${prev.name}` : 'Add a medicine'}
              </p>
              <h2
                ref={heading}
                tabIndex={-1}
                className="font-extrabold text-[24px] leading-tight outline-none"
              >
                {
                  [
                    'What do you take?',
                    'When do you use it?',
                    'Does this look right?',
                  ][step]
                }
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close medicine editor"
              className="press grid size-11 flex-none place-items-center rounded-[14px] bg-milk text-soft"
              onClick={() => setOpen(false)}
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          <ol
            className="m-0 flex list-none gap-2 p-0"
            aria-label="Medicine setup steps"
          >
            {STEPS.map((name, i) => (
              <li
                key={name}
                aria-current={i === step ? 'step' : undefined}
                className={`flex min-w-0 flex-1 items-center gap-1.5 border-b-[3px] pb-2 font-semibold text-[13px] ${i <= step ? 'border-pip text-pip-ink' : 'border-line text-soft'}`}
              >
                <span aria-hidden="true">
                  {i < step ? <Icon name="check" size={14} /> : `${i + 1}.`}
                </span>
                {name}
              </li>
            ))}
          </ol>
        </div>
      }
      footer={
        <div className="grid gap-2">
          {tried && issue && (
            <p
              role="alert"
              className="text-center font-semibold text-[14px] text-[#b4402f] dark:text-[#ff9a8a]"
            >
              {issue}
            </p>
          )}
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <button
              type="button"
              className="btn btn-soft press"
              onClick={() => {
                if (step) {
                  setStep(step - 1);
                  setTried(false);
                } else setOpen(false);
              }}
            >
              {step ? 'Back' : 'Cancel'}
            </button>
            <button
              type="submit"
              form={formId}
              className="btn btn-primary press"
            >
              {step === 2
                ? prev
                  ? 'Save changes'
                  : 'Add medicine'
                : step === 1
                  ? 'Review'
                  : 'Schedule'}
              {step < 2 && <Icon name="next" size={18} />}
            </button>
          </div>
        </div>
      }
    >
      <form
        ref={form}
        id={formId}
        className="grid gap-5 pt-1 pb-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        {step === 0 && (
          <MedicineFields
            d={d}
            set={set}
            names={meds.map((m) => m.name)}
            parsed={(p) => setDraft(fromParsed(d, p))}
            shorthand={!prev}
          />
        )}
        {step === 1 && (
          <ScheduleFields
            d={d}
            set={set}
            routines={routines}
            setTime={(id, time) =>
              setTimeEdits((prev) => ({ ...prev, [id]: time }))
            }
          />
        )}
        {step === 2 && (
          <ReviewFields
            d={d}
            set={set}
            routines={routines}
            changedTimes={changedTimes}
            otherMeds={meds.filter((m) => m.id !== id && !m.archived)}
            edit={(n) => {
              setStep(n);
              setTried(false);
            }}
          />
        )}
      </form>
    </Sheet>
  );
}

function Optional({
  title,
  hint,
  children,
  open = false,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details
      className="group rounded-[20px] bg-milk px-3.5"
      open={open || undefined}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-[15px]">{title}</span>
          {hint && <span className="block text-[13px] text-soft">{hint}</span>}
        </span>
        <Icon name="plus" size={18} />
      </summary>
      <div className="grid gap-4 pt-1 pb-4">{children}</div>
    </details>
  );
}

function Amount({
  d,
  set,
  label,
}: {
  d: Draft;
  set: (p: Partial<Draft>) => void;
  label?: string;
}) {
  const id = useId();
  const fields = FORM_FIELDS[d.form];
  return (
    <Field
      label={label ?? (d.insulin ? 'Units per dose' : fields.amountLabel)}
      htmlFor={id}
    >
      <div className="flex items-center gap-3">
        <input
          id={id}
          aria-label={
            label ?? (d.insulin ? 'Units per dose' : fields.amountLabel)
          }
          className="field num min-w-0 flex-1"
          inputMode={
            ['drops', 'puff', 'capsule', 'patch'].includes(d.form)
              ? 'numeric'
              : 'decimal'
          }
          autoComplete="off"
          placeholder="Enter prescribed amount"
          value={d.amount || ''}
          onChange={(e) =>
            set({ amount: Number(e.target.value.replace(/[^\d.]/g, '')) })
          }
        />
        <span className="min-w-12 text-[15px] text-soft">
          {d.doseUnit === 'default' ? fields.noun : d.doseUnit}
        </span>
      </div>
    </Field>
  );
}

function MedicineFields({
  d,
  set,
  names,
  parsed,
  shorthand,
}: {
  d: Draft;
  set: (p: Partial<Draft>) => void;
  names: string[];
  parsed: (p: Parsed) => void;
  shorthand: boolean;
}) {
  const id = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const query = d.name.trim().toLocaleLowerCase();
  const suggestions = query
    ? [...new Set(names)]
        .filter((name) => {
          const candidate = name.toLocaleLowerCase();
          return candidate.includes(query) && candidate !== query;
        })
        .slice(0, 4)
    : [];
  const fields = FORM_FIELDS[d.form];
  const type = d.insulin ? 'insulin' : d.form;
  return (
    <>
      <Field label="Medicine name" htmlFor={`${id}-name`}>
        <input
          ref={nameInput}
          id={`${id}-name`}
          name="med-name"
          className="field"
          value={d.name}
          onChange={(e) => set({ name: e.target.value })}
          autoComplete="off"
          autoCapitalize="words"
          placeholder="Name on the label"
          enterKeyHint="next"
        />
        {suggestions.length > 0 && (
          <div>
            <p className="mb-1 text-[13px] text-soft">Previously added</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="press min-h-11 max-w-full rounded-xl bg-pip-wash px-3 text-left font-semibold text-[14px] text-pip-ink wrap-anywhere"
                  aria-label={`Use medicine name ${name}`}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => {
                    set({ name });
                    nameInput.current?.focus({ preventScroll: true });
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </Field>
      <Field label="Medicine type">
        <div
          className="grid grid-cols-3 gap-2"
          role="group"
          aria-label="Medicine type"
        >
          {MEDICINE_TYPES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={type === item.value}
              className={`press grid min-h-18 justify-items-center gap-1 rounded-2xl px-1 py-2.5 font-semibold text-[13px] ${type === item.value ? 'bg-pip-wash text-pip-ink shadow-[inset_0_0_0_2px_var(--pip)]' : 'bg-milk text-ink'}`}
              onClick={() => set(selectMedicineType(d, item.value))}
            >
              <Pill
                form={item.form}
                look={{
                  shape: item.form === 'capsule' ? 'cap' : 'round',
                  colors: [
                    type === item.value ? '#17a58f' : '#8fc6e8',
                    '#f6d57a',
                  ],
                }}
                size={26}
              />
              {item.label}
            </button>
          ))}
        </div>
      </Field>
      {d.insulin ? (
        <p className="rounded-2xl bg-pip-wash px-3.5 py-3 text-[14px] text-pip-ink">
          Next, choose meal times or set times and enter your prescribed units
          for each dose.
        </p>
      ) : d.form === 'cream' ? (
        <Field label={fields.amountLabel} htmlFor={`${id}-instructions`}>
          <input
            id={`${id}-instructions`}
            className="field"
            placeholder="Thin layer, or prescribed fingertip units"
            value={d.instructions}
            onChange={(e) => set({ instructions: e.target.value })}
          />
        </Field>
      ) : (
        <Amount d={d} set={set} />
      )}
      {d.form === 'injection' && !d.insulin && (
        <Field label="Dose unit">
          <Segmented
            label="Injection dose unit"
            value={d.doseUnit}
            onChange={(doseUnit) => set({ doseUnit })}
            wrap
            options={[
              { value: 'default', label: 'Injections' },
              { value: 'ml', label: 'ml' },
              { value: 'mg', label: 'mg' },
              { value: 'mcg', label: 'mcg' },
              { value: 'units', label: 'Units' },
            ]}
          />
        </Field>
      )}
      {fields.siteLabel && (
        <Field label={fields.siteLabel} htmlFor={`${id}-site`}>
          <input
            id={`${id}-site`}
            className="field"
            placeholder={fields.siteExample}
            value={d.site}
            onChange={(e) => set({ site: e.target.value })}
          />
        </Field>
      )}
      <Optional
        title={d.insulin ? 'Concentration & notes' : 'Strength & notes'}
        hint="Optional · copy the details on your label"
        open={Boolean(d.strength || d.strengthLabel || d.notes)}
      >
        <Field
          label={d.insulin ? 'Concentration (optional)' : 'Strength (optional)'}
          htmlFor={`${id}-strength`}
        >
          <input
            id={`${id}-strength`}
            className="field bg-card!"
            value={
              d.strengthLabel ||
              (d.strength
                ? fmtStrength({ value: Number(d.strength), unit: d.unit })
                : '')
            }
            onChange={(e) =>
              set({ strengthLabel: e.target.value, strength: '' })
            }
            placeholder={d.insulin ? '100 units / ml' : fields.strengthExample}
          />
          <span className="text-[13px] text-soft">
            For identifying the medicine. This does not change your dose.
          </span>
        </Field>
        <Field label="Notes (optional)" htmlFor={`${id}-notes`}>
          <textarea
            id={`${id}-notes`}
            className="field min-h-20 resize-none bg-card! py-3"
            value={d.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Any instructions you want to remember"
          />
        </Field>
      </Optional>
      {shorthand && (
        <Optional
          title="Use prescription shorthand"
          hint="Optional · fill the fields from a pattern"
        >
          <Shorthand onApply={parsed} />
        </Optional>
      )}
    </>
  );
}

export function Shorthand({ onApply }: { onApply: (p: Parsed) => void }) {
  const id = useId();
  const [text, setText] = useState('');
  const p = useMemo(() => parse(text), [text]);
  const ok = understood(p);
  const words = echo(p);
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="label">
        Prescription shorthand
      </label>
      <input
        id={id}
        className="field bg-card!"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Metformin 500mg 1-0-1 PC"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (ok) onApply(p);
          }
        }}
      />
      <output htmlFor={id} className="text-[13px] text-soft">
        {text ? words.join(' · ') : 'Also supports Inj Apidra 14-8-6 units AC.'}
      </output>
      <button
        type="button"
        className="btn btn-soft btn-sm press justify-self-start"
        disabled={!ok}
        onClick={() => onApply(p)}
      >
        Use these details
      </button>
    </div>
  );
}

function ScheduleFields({
  d,
  set,
  routines,
  setTime,
}: {
  d: Draft;
  set: (p: Partial<Draft>) => void;
  routines: Routine[];
  setTime: (id: RoutineId, time: string) => void;
}) {
  const id = useId();
  const scheduled = d.kind !== 'once' && d.kind !== 'prn';
  const mealPlan =
    d.insulin &&
    scheduled &&
    d.variable &&
    d.food === 'before' &&
    d.routines.every((r) => ['breakfast', 'lunch', 'dinner'].includes(r)) &&
    !d.times.length;
  const fields = FORM_FIELDS[d.form];
  const slots = [
    ...ROUTINE_ORDER.filter((r) => d.routines.includes(r)).map((r) => ({
      key: r,
      label: ROUTINE_NAME[r],
      routine: routines.find((item) => item.id === r),
      time: reminderTimes(
        {
          routine: r,
          offsetMin:
            d.offsets[r] ??
            (d.before && r !== 'wake' && r !== 'bed' ? -d.beforeMin : 0),
        },
        routines,
      ),
    })),
    ...d.times.map((x, i) => ({
      key: `time-${x.id}`,
      label: `Clock time ${i + 1}`,
      routine: undefined,
      time: fmtTime(x.t),
    })),
  ];
  return (
    <>
      {d.insulin && (
        <Field label="How do you schedule this insulin?">
          <Segmented
            label="Insulin schedule"
            value={mealPlan ? 'meals' : 'times'}
            onChange={(v) =>
              set({
                kind: 'daily',
                routines:
                  v === 'times' ? ['bed'] : ['breakfast', 'lunch', 'dinner'],
                times: [],
                food: v === 'times' ? 'none' : 'before',
                before: v === 'meals',
                variable: v === 'meals',
                amount: 0,
                amounts: {},
                offsets: {},
              })
            }
            options={[
              { value: 'meals', label: 'Meal times' },
              { value: 'times', label: 'Set times' },
            ]}
          />
          <p className="text-[13px] text-soft">
            Use the schedule you were prescribed. Set times can include bedtime
            or a clock time.
          </p>
        </Field>
      )}
      <Optional
        title={d.form === 'patch' ? 'Change the patch' : 'Repeat'}
        hint={
          {
            daily: 'Every day',
            weekdays: 'On selected days',
            interval: `Every ${d.everyDays} days`,
            prn: 'When needed',
            once: 'One time',
            cycle: `${d.on} days on, ${d.off} off`,
          }[d.kind]
        }
        open={d.kind !== 'daily'}
      >
        <Segmented
          label="How often"
          wrap
          value={d.kind}
          onChange={(kind) =>
            set({
              kind,
              ...(kind === 'once' || kind === 'prn' ? { variable: false } : {}),
            })
          }
          options={[
            { value: 'daily', label: 'Every day' },
            { value: 'weekdays', label: 'Some days' },
            { value: 'interval', label: 'Every few days' },
            { value: 'prn', label: 'When needed' },
            { value: 'once', label: 'Once' },
            { value: 'cycle', label: 'On and off' },
          ]}
        />
      </Optional>
      {d.kind === 'weekdays' && (
        <Field label="Which days">
          <Chips
            label="Which days"
            values={d.days}
            onChange={(days) => set({ days })}
            options={WEEK.map((w) => ({
              value: w,
              label: WEEK_SHORT[w] ?? '',
              aria: WEEK_LONG[w],
            }))}
          />
        </Field>
      )}
      {d.kind === 'interval' && (
        <Field
          label={
            d.form === 'patch' ? 'Time between changes' : 'Days between doses'
          }
        >
          <Stepper
            label="Every how many days"
            value={d.everyDays}
            onChange={(everyDays) => set({ everyDays })}
            min={2}
            max={365}
            format={(n) => `${n} days`}
          />
        </Field>
      )}
      {d.kind === 'cycle' && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-3">
          <Field label="Days on">
            <Stepper
              label="Days on"
              value={d.on}
              onChange={(on) => set({ on })}
              min={1}
              max={365}
            />
          </Field>
          <Field label="Days off">
            <Stepper
              label="Days off"
              value={d.off}
              onChange={(off) => set({ off })}
              min={1}
              max={365}
            />
          </Field>
        </div>
      )}
      {(d.kind === 'interval' || d.kind === 'cycle') && (
        <Field label="Starting date">
          <DateField
            label="Schedule starting date"
            value={d.start}
            onChange={(start) => set({ start })}
          />
        </Field>
      )}
      {d.kind === 'once' && (
        <Field label="When">
          <DateTimeField
            label="One-time dose"
            value={d.once}
            onChange={(once) => set({ once })}
          />
        </Field>
      )}
      {d.kind === 'prn' && (
        <>
          <p className="text-[14px] text-soft">
            No scheduled reminders. Log a dose whenever you use it.
          </p>
          <Optional
            title="Dose limits"
            hint="Optional · only if specified on your prescription"
            open={d.limitGap || d.limitMax}
          >
            <Switch
              on={d.limitGap}
              onChange={(limitGap) => set({ limitGap })}
              label="Minimum time between doses"
            />
            {d.limitGap && (
              <Field label="Minimum gap in hours">
                <input
                  aria-label="Hours between doses"
                  className="field num bg-card!"
                  inputMode="decimal"
                  placeholder="As prescribed"
                  value={d.gap || ''}
                  onChange={(e) =>
                    set({ gap: Number(e.target.value.replace(/[^\d.]/g, '')) })
                  }
                />
              </Field>
            )}
            <Switch
              on={d.limitMax}
              onChange={(limitMax) => set({ limitMax })}
              label="Maximum doses per day"
            />
            {d.limitMax && (
              <Field label="Daily dose limit">
                <input
                  aria-label="Most doses a day"
                  className="field num bg-card!"
                  inputMode="numeric"
                  placeholder="As prescribed"
                  value={d.max || ''}
                  onChange={(e) =>
                    set({ max: Number(e.target.value.replace(/[^\d]/g, '')) })
                  }
                />
              </Field>
            )}
          </Optional>
        </>
      )}
      {d.insulin && (!d.variable || !scheduled) && <Amount d={d} set={set} />}
      {scheduled && (
        <>
          <Field label={mealPlan ? 'Meals' : 'Reminder times'}>
            <Chips
              label="Meals and sleep"
              values={d.routines}
              onChange={(selected) => set({ routines: selected })}
              options={ROUTINE_ORDER.filter(
                (r) =>
                  !mealPlan || ['breakfast', 'lunch', 'dinner'].includes(r),
              ).map((r) => ({ value: r, label: ROUTINE_NAME[r] }))}
            />
          </Field>
          {!mealPlan && (
            <div className="grid gap-2">
              {d.times.map((x, i) => (
                <div key={x.id} className="flex items-center gap-2">
                  <TimeField
                    label={`Clock time ${i + 1}`}
                    value={x.t}
                    onChange={(t) =>
                      set({
                        times: d.times.map((item) =>
                          item.id === x.id ? { ...item, t } : item,
                        ),
                      })
                    }
                    className="flex-1"
                  />
                  <button
                    type="button"
                    aria-label={`Remove clock time ${i + 1}`}
                    className="press grid size-11 flex-none place-items-center rounded-[14px] bg-milk text-soft"
                    onClick={() =>
                      set({ times: d.times.filter((item) => item.id !== x.id) })
                    }
                  >
                    <Icon name="close" size={18} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-soft btn-sm press justify-self-start"
                onClick={() =>
                  set({ times: [...d.times, { id: Date.now(), t: '09:00' }] })
                }
              >
                <Icon name="clock" size={18} />
                Add a clock time
              </button>
            </div>
          )}
          {hasFoodTiming(d.form) && (
            <Optional
              title="Food timing"
              hint={
                d.food === 'none'
                  ? 'Optional · if specified on the label'
                  : `${d.food} food`
              }
              open={d.food !== 'none'}
            >
              <Segmented
                label="Food"
                value={d.food}
                onChange={(food) =>
                  set({ food, before: food === 'before', offsets: {} })
                }
                wrap
                options={[
                  { value: 'none', label: 'Any time' },
                  { value: 'before', label: 'Before' },
                  { value: 'with', label: 'With' },
                  { value: 'after', label: 'After' },
                  { value: 'empty', label: 'Empty stomach' },
                ]}
              />
            </Optional>
          )}
          {(mealPlan ||
            (d.before &&
              d.routines.some((r) => r !== 'wake' && r !== 'bed'))) && (
            <Field label="Reminder before meals">
              <Stepper
                label="Minutes before meals"
                value={d.beforeMin}
                onChange={(beforeMin) => set({ beforeMin, offsets: {} })}
                min={0}
                max={120}
                step={5}
                format={(n) => (n ? `${n} min before` : 'At the meal')}
              />
              <p className="text-[13px] text-soft">
                Use your prescribed timing; it varies by medicine.
              </p>
            </Field>
          )}
          {!mealPlan &&
            (slots.length > 1 || d.variable) &&
            d.form !== 'cream' && (
              <Switch
                on={d.variable}
                onChange={(variable) =>
                  set({
                    variable,
                    amounts: Object.fromEntries(
                      slots.map((slot) => [
                        slot.key,
                        d.amounts[slot.key] ?? String(d.amount || ''),
                      ]),
                    ),
                  })
                }
                label="Different amounts at each reminder"
              />
            )}
          {(d.routines.length > 0 || d.variable) && (
            <div className="grid gap-2">
              {d.routines.length > 0 && (
                <p className="text-[13px] text-soft">
                  Set when you eat or sleep; the reminder time appears below.
                  These times are shared across medicines. Changes apply when
                  you save.
                </p>
              )}
              {slots
                .filter((slot) => slot.routine || d.variable)
                .map((slot) => (
                  <div
                    key={slot.key}
                    className="grid gap-2 rounded-btn bg-milk p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="block font-bold">{slot.label}</span>
                        {slot.routine && (
                          <TimeField
                            label={`${slot.label} time`}
                            value={slot.routine.weekday}
                            onChange={(time) => {
                              if (slot.routine) setTime(slot.routine.id, time);
                            }}
                            className="mt-1 min-h-11 w-32 max-w-full bg-card! px-3 text-[14px]"
                          />
                        )}
                      </div>
                      {d.variable && (
                        <>
                          <input
                            id={`${id}-${slot.key}`}
                            aria-label={`${slot.label} dose`}
                            className="field num w-22 bg-card! text-center"
                            inputMode="decimal"
                            value={d.amounts[slot.key] ?? ''}
                            placeholder="Dose"
                            onChange={(e) =>
                              set({
                                amounts: {
                                  ...d.amounts,
                                  [slot.key]: e.target.value.replace(
                                    /[^\d.]/g,
                                    '',
                                  ),
                                },
                              })
                            }
                          />
                          <span className="text-[13px] text-soft">
                            {d.insulin
                              ? 'units'
                              : d.doseUnit === 'default'
                                ? fields.noun
                                : d.doseUnit}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="num wrap-anywhere text-[13px] text-soft">
                      {d.name || 'Reminder'}
                      {(!d.variable || d.amounts[slot.key]) &&
                        ` · ${medicineDose(
                          toMed(d),
                          d.variable ? Number(d.amounts[slot.key]) : d.amount,
                        )}`}{' '}
                      at {slot.time}
                    </p>
                  </div>
                ))}
            </div>
          )}
          <Optional
            title="Course length"
            hint={
              d.course
                ? `${d.courseDays} days`
                : 'Optional · for a treatment with an end date'
            }
            open={d.course}
          >
            <Switch
              on={d.course}
              onChange={(course) => set({ course })}
              label="End after a set number of days"
            />
            {d.course && (
              <>
                <Field label="Number of days">
                  <Stepper
                    label="Course length in days"
                    value={d.courseDays}
                    onChange={(courseDays) => set({ courseDays })}
                    min={1}
                    max={365}
                  />
                </Field>
                <Field label="Starting">
                  <DateField
                    label="Course starting date"
                    value={d.start}
                    onChange={(start) => set({ start })}
                  />
                </Field>
              </>
            )}
          </Optional>
        </>
      )}
    </>
  );
}

function ReviewFields({
  d,
  set,
  edit,
  routines,
  changedTimes,
  otherMeds,
}: {
  d: Draft;
  set: (p: Partial<Draft>) => void;
  edit: (step: number) => void;
  routines: Routine[];
  changedTimes: Routine[];
  otherMeds: Medicine[];
}) {
  const med = toMed(d);
  const fields = FORM_FIELDS[d.form];
  const stockUnit = d.insulin
    ? 'units'
    : d.form === 'injection'
      ? d.doseUnit === 'default'
        ? 'injections'
        : d.doseUnit
      : fields.stockUnit;
  return (
    <>
      <div className="grid gap-3 rounded-[22px] bg-milk p-4">
        <div className="flex items-start gap-3">
          <Pill form={d.form} look={med.look} size={40} />
          <div className="min-w-0 flex-1">
            <h3 className="wrap-anywhere font-bold text-[21px]">{med.name}</h3>
            <p className="text-[14px] text-soft">{doseLine(med)}</p>
          </div>
          <button
            type="button"
            aria-label="Edit medicine details"
            className="press grid size-11 flex-none place-items-center rounded-xl bg-card"
            onClick={() => edit(0)}
          >
            <Icon name="edit" size={18} />
          </button>
        </div>
      </div>
      <div className="grid gap-3 rounded-[22px] bg-pip-wash p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[16px]">
              {d.form === 'patch' ? 'Patch changes' : 'Schedule'}
            </h3>
            <p className="text-[14px]">{scheduleText(med.schedule)}</p>
          </div>
          <button
            type="button"
            aria-label="Edit medicine schedule"
            className="press grid size-11 flex-none place-items-center rounded-xl bg-card"
            onClick={() => edit(1)}
          >
            <Icon name="edit" size={18} />
          </button>
        </div>
        {'at' in med.schedule &&
          med.schedule.at.map((a) => (
            <div
              key={anchorText(a)}
              className="flex items-center justify-between gap-3 border-t border-line pt-2 text-[14px]"
            >
              <span>
                {anchorText(a)}
                <span className="num block text-[13px]">
                  {reminderTimes(a, routines)}
                </span>
              </span>
              <strong className="num text-right">
                {medicineDose(med, a.amount ?? med.amount)}
              </strong>
            </div>
          ))}
        {d.course && (
          <p className="text-[13px]">
            For {d.courseDays} days, starting {d.start}
          </p>
        )}
        {changedTimes.map((r) => {
          const count = otherMeds.filter(
            (m) =>
              'at' in m.schedule &&
              m.schedule.at.some((a) => 'routine' in a && a.routine === r.id),
          ).length;
          return (
            <p key={r.id} className="text-[13px]">
              Saving sets {ROUTINE_NAME[r.id].toLowerCase()} to{' '}
              {fmtTime(r.weekday)}
              {r.weekend ? ' on weekdays' : ''}.
              {count > 0 &&
                ` This also moves reminders for ${count} other ${count === 1 ? 'medicine' : 'medicines'}.`}
            </p>
          );
        })}
      </div>
      {(stockUnit || d.stock) && (
        <Optional
          title="Refill reminders"
          hint="Optional · count your remaining supply"
          open={d.stock}
        >
          <Switch
            on={d.stock}
            onChange={(stock) => set({ stock })}
            label="Track remaining supply"
            hint={`Count in ${stockUnit || 'doses'}`}
          />
          {d.stock && (
            <>
              <Field label={`Remaining ${stockUnit || 'doses'}`}>
                <input
                  aria-label="Remaining supply"
                  className="field num bg-card!"
                  inputMode="decimal"
                  value={d.count}
                  onChange={(e) =>
                    set({
                      count: Number(e.target.value.replace(/[^\d.]/g, '')),
                    })
                  }
                />
              </Field>
              <Field label="Remind when this many days remain">
                <Stepper
                  label="Refill reminder, days left"
                  value={d.refill}
                  onChange={(refill) => set({ refill })}
                  min={1}
                  max={60}
                  format={(n) => `${n} days`}
                />
              </Field>
              <Field label={`Refill amount (${stockUnit || 'doses'})`}>
                <input
                  aria-label="Refill amount"
                  className="field num bg-card!"
                  inputMode="decimal"
                  value={d.pack}
                  onChange={(e) =>
                    set({ pack: Number(e.target.value.replace(/[^\d.]/g, '')) })
                  }
                />
              </Field>
            </>
          )}
        </Optional>
      )}
      {(d.form === 'tablet' || d.form === 'capsule') && (
        <Optional title="Appearance" hint="Optional · recognise it at a glance">
          {d.form === 'tablet' && (
            <Segmented
              label="Shape"
              value={d.shape === 'cap' ? 'round' : d.shape}
              onChange={(shape) => set({ shape })}
              options={[
                { value: 'round', label: 'Round' },
                { value: 'oval', label: 'Oval' },
              ]}
            />
          )}
          <ColorPick
            colors={d.colors}
            two={d.form === 'capsule'}
            onChange={(colors) => set({ colors })}
          />
        </Optional>
      )}
      {med.notes && (
        <p className="whitespace-pre-wrap text-[14px] text-soft">{med.notes}</p>
      )}
    </>
  );
}
const COLOR_NAME: Record<string, string> = {
  '#ffffff': 'White',
  '#f6d57a': 'Cream yellow',
  '#e9a23b': 'Amber',
  '#f2c230': 'Yellow',
  '#f08a6c': 'Coral',
  '#b3263a': 'Red',
  '#f4b6c2': 'Pink',
  '#8fc6e8': 'Light blue',
  '#3c6fb6': 'Blue',
  '#9bd3a6': 'Green',
  '#6b4a3a': 'Brown',
  '#2a2f3a': 'Black',
};

function ColorPick({
  colors,
  onChange,
  two,
}: {
  colors: string[];
  onChange: (c: string[]) => void;
  two: boolean;
}) {
  const [half, setHalf] = useState(0);
  return (
    <div className="grid gap-2">
      {two && (
        <Segmented
          label="Which half"
          size="sm"
          value={String(half)}
          onChange={(v) => setHalf(Number(v))}
          options={[
            { value: '0', label: 'Left half' },
            { value: '1', label: 'Right half' },
          ]}
        />
      )}
      <div
        className="flex flex-wrap gap-1"
        role="radiogroup"
        aria-label={two ? `Colour, ${half ? 'right' : 'left'} half` : 'Colour'}
      >
        {PILL_COLORS.map((c) => {
          const i = two ? half : 0;
          const on = colors[i] === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={COLOR_NAME[c]}
              onClick={() => {
                haptic.tick();
                const next = two ? [colors[0] ?? c, colors[1] ?? c] : [c];
                next[i] = c;
                onChange(next);
              }}
              className="press grid size-11 place-items-center rounded-full"
            >
              <span
                className="size-8 rounded-full transition-shadow duration-150"
                style={{
                  background: c,
                  boxShadow: on
                    ? '0 0 0 2px var(--card), 0 0 0 4.5px var(--pip)'
                    : 'inset 0 0 0 1.5px var(--line-strong)',
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
