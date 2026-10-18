import { useId, useMemo, useState } from 'react';
import {
  DateField,
  DateTimeField,
  TimeField,
} from '../components/DateTimeField.tsx';
import Icon from '../components/Icon.tsx';
import { PILL_COLORS, Pill } from '../components/PillLook.tsx';
import Pip from '../components/Pip.tsx';
import Sheet from '../components/Sheet.tsx';
import { Chips, Field, Segmented, Stepper, Switch } from '../components/ui.tsx';
import { putMed, useData } from '../lib/db.ts';
import {
  FORM_NAME,
  fmtAmount,
  fmtDose,
  scheduleText,
} from '../lib/dose-format.ts';
import { haptic } from '../lib/haptics.ts';
import {
  blank,
  type Draft,
  fromMed,
  fromParsed,
  insulinDraft,
  lookFor,
  problem,
  toMed,
} from '../lib/medicine-draft.ts';
import { replan } from '../lib/push.ts';
import { back } from '../lib/route.ts';
import { anchorMin, ROUTINE_NAME, ROUTINE_ORDER } from '../lib/schedule.ts';
import { routinesStore } from '../lib/settings.ts';
import { echo, type Parsed, parse, understood } from '../lib/shorthand.ts';
import { sfx } from '../lib/sound.ts';
import { useStore } from '../lib/store.ts';
import { dayKey, fmtTime, fromMin } from '../lib/time.ts';
import { useTitle } from '../lib/title.ts';
import { toast } from '../lib/toast.ts';
import type { Form, Unit } from '../lib/types.ts';

const UNITS: Unit[] = ['mg', 'mcg', 'g', 'ml', 'IU', 'units'];
const FORMS: Form[] = [
  'tablet',
  'capsule',
  'liquid',
  'drops',
  'puff',
  'injection',
  'patch',
  'cream',
];
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

export default function MedicineEdit({
  id,
  onDone,
}: {
  id?: string;
  onDone?: () => void;
}) {
  const { meds, ready } = useData();
  const prev = id ? meds.find((m) => m.id === id) : undefined;
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tried, setTried] = useState(false);
  const formId = useId();
  const d = draft ?? (prev ? fromMed(prev) : blank());
  const set = (patch: Partial<Draft>) => setDraft({ ...d, ...patch });
  const issue = problem(d);
  useTitle(prev ? `Edit ${prev.name} · Tend` : 'Add medicine · Tend');

  if (!ready) return null;

  function save() {
    setTried(true);
    if (issue) {
      haptic.warn();
      return;
    }
    const med = toMed(d, prev);
    const undo = putMed(med);
    replan();
    sfx.taken();
    haptic.success();
    toast(prev ? `${med.name} saved` : `${med.name} added`, () => {
      undo();
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
        <div className="flex items-center gap-3 pt-1 pb-2">
          <Pip mood="adding" className="size-14 flex-none" track />
          <h2 className="min-w-0 flex-1 wrap-anywhere font-extrabold text-[24px]">
            {prev ? `Edit ${prev.name}` : 'Add a medicine'}
          </h2>
        </div>
      }
      footer={
        <div className="grid gap-2">
          {tried && issue && (
            <p
              role="alert"
              className="text-center font-semibold text-[15px] text-[#b4402f] dark:text-[#ff9a8a]"
            >
              {issue}
            </p>
          )}
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <button
              type="button"
              className="btn btn-soft press"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              className="btn btn-primary press"
            >
              {prev ? 'Save' : 'Add medicine'}
            </button>
          </div>
        </div>
      }
    >
      <form
        id={formId}
        className="grid gap-6 pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        noValidate
      >
        {!prev && (
          <div className="grid gap-2 rounded-[22px] bg-milk p-3.5">
            <p className="font-bold">Setting up insulin?</p>
            <p className="text-[14px] text-soft">
              Choose a starting point, then enter your prescribed doses.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-soft btn-sm press"
                onClick={() => setDraft(insulinDraft(d))}
              >
                Meal-time insulin
              </button>
              <button
                type="button"
                className="btn btn-soft btn-sm press"
                onClick={() => setDraft(insulinDraft(d, true))}
              >
                Bedtime insulin
              </button>
            </div>
          </div>
        )}
        {!prev && <Shorthand onApply={(p) => setDraft(fromParsed(d, p))} />}
        <MedForm d={d} set={set} names={meds.map((m) => m.name)} />
      </form>
    </Sheet>
  );
}

export function Shorthand({ onApply }: { onApply: (p: Parsed) => void }) {
  const id = useId();
  const [text, setText] = useState('');
  const p = useMemo(() => parse(text), [text]);
  const ok = understood(p);
  const words = echo(p);
  return (
    <div className="grid gap-2 rounded-[22px] bg-pip-wash p-3.5">
      <label
        htmlFor={id}
        className="font-bold font-display text-[15px] text-pip-ink"
      >
        Type it like the prescription
      </label>
      <input
        id={id}
        className="field bg-card!"
        placeholder="Metformin 500mg 1-0-1 PC"
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const next = parse(v);
          if (understood(next)) onApply(next);
        }}
        autoComplete="off"
        autoCapitalize="words"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (ok) onApply(p);
            (
              document.getElementById(`${id}-name`) ??
              document.querySelector<HTMLInputElement>('[name="med-name"]')
            )?.focus();
          }
        }}
      />
      <output
        htmlFor={id}
        aria-live="polite"
        className="min-h-6 text-[15px] leading-snug"
      >
        {text && words.length > 1 ? (
          <span className={ok ? 'font-semibold text-ink' : 'text-soft'}>
            {words.join(' · ')}
            {ok ? '' : '. Add a pattern like 1-0-1 or BD.'}
          </span>
        ) : (
          <span className="text-soft">
            Try Metformin 500mg 1-0-1 PC, or Inj Apidra 14-8-6 units AC. Review
            the details below.
          </span>
        )}
      </output>
    </div>
  );
}

export function MedForm({
  d,
  set,
  names,
  lean,
}: {
  d: Draft;
  set: (p: Partial<Draft>) => void;
  names: string[];
  lean?: boolean;
}) {
  const id = useId();
  const unique = [...new Set(names)];
  const routines = useStore(routinesStore);
  const scheduled = d.kind !== 'prn' && d.kind !== 'once';
  return (
    <>
      <div className="grid gap-5 tab:grid-cols-[1fr_auto] tab:items-start">
        <div className="grid gap-5">
          <Field label="Name" htmlFor={`${id}-name`}>
            <input
              id={`${id}-name`}
              name="med-name"
              className="field"
              value={d.name}
              onChange={(e) => set({ name: e.target.value })}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              list={`${id}-names`}
              placeholder="Metformin"
              required
            />
            <datalist id={`${id}-names`}>
              {unique.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>
          <Field label="Strength (optional)" htmlFor={`${id}-str`}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={`${id}-str`}
                className="field num w-32 flex-none"
                inputMode="decimal"
                enterKeyHint="next"
                value={d.strength}
                onChange={(e) =>
                  set({ strength: e.target.value.replace(/[^\d.]/g, '') })
                }
                placeholder="500"
                autoComplete="off"
              />
              <Segmented
                label="Unit"
                wrap
                value={d.unit}
                onChange={(unit) => set({ unit })}
                options={UNITS.map((u) => ({ value: u, label: u }))}
              />
            </div>
          </Field>
        </div>
        <div
          className="hidden size-36 place-items-center rounded-[28px] bg-milk tab:grid"
          aria-hidden="true"
        >
          <Pill
            form={d.form}
            look={{ shape: d.shape, colors: d.colors }}
            size={88}
          />
        </div>
      </div>

      <Field label="Form">
        <Segmented
          label="Form"
          wrap
          value={d.form}
          onChange={(form) => set({ form, ...lookFor(form) })}
          options={FORMS.map((f) => ({ value: f, label: FORM_NAME[f] }))}
        />
      </Field>

      <div className="grid gap-5 tab:grid-cols-2">
        <Field
          label={d.variable && scheduled ? 'Dose measured in' : 'Each dose'}
        >
          <div className="flex flex-wrap items-center gap-2">
            {(!d.variable || !scheduled) && (
              <input
                aria-label="Amount per dose"
                className="field num w-28"
                inputMode="decimal"
                value={d.amount || ''}
                onChange={(e) =>
                  set({ amount: Number(e.target.value.replace(/[^\d.]/g, '')) })
                }
                placeholder="Dose"
              />
            )}
            <Segmented
              label="Dose measured in"
              wrap
              value={d.doseUnit}
              onChange={(doseUnit) => set({ doseUnit })}
              options={[
                { value: 'default', label: FORM_NAME[d.form] },
                { value: 'units', label: 'Units' },
                { value: 'ml', label: 'ml' },
              ]}
            />
          </div>
          <span className="text-[14px] text-soft">
            {d.variable && scheduled
              ? 'Set each reminder’s dose below.'
              : d.doseUnit === 'default'
                ? fmtDose(d.form, d.amount)
                : `${fmtAmount(d.amount)} ${d.doseUnit}`}
          </span>
        </Field>
        <Field label="Food">
          <Segmented
            label="Food"
            wrap
            value={d.food}
            onChange={(food) =>
              set({ food, before: food === 'before', offsets: {} })
            }
            options={[
              { value: 'none', label: 'Any' },
              { value: 'before', label: 'Before' },
              { value: 'with', label: 'With' },
              { value: 'after', label: 'After' },
              { value: 'empty', label: 'Empty stomach' },
            ]}
          />
        </Field>
      </div>

      <Field label="How often">
        <Segmented
          label="How often"
          wrap
          value={d.kind}
          onChange={(kind) => set({ kind })}
          options={[
            { value: 'daily', label: 'Every day' },
            { value: 'weekdays', label: 'Some days' },
            { value: 'interval', label: 'Every few days' },
            { value: 'cycle', label: 'On and off' },
            { value: 'once', label: 'Once' },
            { value: 'prn', label: 'When needed' },
          ]}
        />
      </Field>

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
        <Field label="Every">
          <Stepper
            label="Every how many days"
            value={d.everyDays}
            onChange={(everyDays) => set({ everyDays })}
            min={2}
            max={60}
            format={(n) => `${n} days`}
          />
        </Field>
      )}
      {d.kind === 'cycle' && (
        <div className="grid gap-5 tab:grid-cols-2">
          <Field label="Days on">
            <Stepper
              label="Days on"
              value={d.on}
              onChange={(on) => set({ on })}
              min={1}
              max={90}
            />
          </Field>
          <Field label="Days off">
            <Stepper
              label="Days off"
              value={d.off}
              onChange={(off) => set({ off })}
              min={1}
              max={90}
            />
          </Field>
        </div>
      )}
      {(d.kind === 'interval' || d.kind === 'cycle') && (
        <Field label="Starting" htmlFor={`${id}-start`}>
          <DateField
            id={`${id}-start`}
            label="Schedule starting date"
            value={d.start}
            onChange={(start) => set({ start })}
          />
        </Field>
      )}
      {d.kind === 'once' && (
        <Field label="When" htmlFor={`${id}-once`}>
          <DateTimeField
            label="One-time dose"
            value={d.once}
            onChange={(once) => set({ once })}
          />
        </Field>
      )}
      {d.kind === 'prn' && (
        <div className="grid gap-5 tab:grid-cols-2">
          <Field label="At least">
            <Stepper
              label="Hours between doses"
              value={d.gap}
              onChange={(gap) => set({ gap })}
              min={1}
              max={48}
              format={(n) => `${n} h apart`}
            />
          </Field>
          <Field label="Up to">
            <Stepper
              label="Most doses a day"
              value={d.max}
              onChange={(max) => set({ max })}
              min={1}
              max={12}
              format={(n) => `${n} a day`}
            />
          </Field>
        </div>
      )}

      {scheduled && (
        <Field
          label="At"
          hint={
            d.routines.length || d.times.length
              ? scheduleText(toMed(d).schedule)
              : 'Doses follow your routines, so moving breakfast moves them too.'
          }
        >
          <Chips
            label="Routines"
            values={d.routines}
            onChange={(routines) => set({ routines })}
            options={ROUTINE_ORDER.map((r) => ({
              value: r,
              label: ROUTINE_NAME[r],
            }))}
          />
          <div className="flex flex-wrap items-center gap-2">
            {d.times.map(({ id: key, t }, i) => (
              <span
                key={key}
                className="flex items-center gap-1 rounded-[14px] bg-milk p-1 pl-1"
              >
                <TimeField
                  label={`Clock time ${i + 1}`}
                  className="min-h-11 w-36 bg-card!"
                  value={t}
                  onChange={(t) =>
                    set({
                      times: d.times.map((x, j) => (j === i ? { ...x, t } : x)),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label="Remove time"
                  className="press grid size-10 place-items-center rounded-[10px] text-soft"
                  onClick={() =>
                    set({ times: d.times.filter((_, j) => j !== i) })
                  }
                >
                  <Icon name="close" size={18} />
                </button>
              </span>
            ))}
            <button
              type="button"
              className="btn btn-soft btn-sm press"
              onClick={() =>
                set({
                  times: [...d.times, { id: Date.now(), t: '09:00' }],
                })
              }
            >
              <Icon name="clock" size={18} />
              Add a clock time
            </button>
          </div>
          {d.food === 'before' &&
            d.routines.some((r) => r !== 'wake' && r !== 'bed') && (
              <div className="grid gap-2 rounded-[18px] bg-milk p-3">
                <span className="label">Before meals</span>
                <Stepper
                  label="Minutes before meals"
                  value={d.beforeMin}
                  onChange={(beforeMin) => set({ beforeMin, offsets: {} })}
                  min={0}
                  max={120}
                  step={5}
                  format={(n) => `${n} min before`}
                />
                <span className="text-[14px] text-soft">
                  Use the timing on your prescription. Insulin timing depends on
                  the type you take.
                </span>
              </div>
            )}
          <Switch
            on={d.variable}
            onChange={(variable) =>
              set({
                variable,
                amounts: Object.fromEntries([
                  ...d.routines.map((r) => [
                    r,
                    d.amounts[r] ?? String(d.amount),
                  ]),
                  ...d.times.map((x) => [
                    `time-${x.id}`,
                    d.amounts[`time-${x.id}`] ?? String(d.amount),
                  ]),
                ]),
              })
            }
            label="Different dose at each reminder"
            hint="For example, 14 units at breakfast, 8 at lunch and 6 at dinner"
          />
          {d.variable && (
            <div className="grid gap-2">
              {[
                ...ROUTINE_ORDER.filter((r) => d.routines.includes(r)).map(
                  (r) => ({
                    key: r,
                    label: ROUTINE_NAME[r],
                    time: fromMin(
                      anchorMin(
                        {
                          routine: r,
                          offsetMin:
                            d.offsets[r] ??
                            (d.before && r !== 'wake' && r !== 'bed'
                              ? -d.beforeMin
                              : 0),
                        },
                        routines,
                        dayKey(),
                      ),
                    ),
                  }),
                ),
                ...d.times.map((x) => ({
                  key: `time-${x.id}`,
                  label: 'Clock time',
                  time: x.t,
                })),
              ].map((slot) => (
                <div
                  key={slot.key}
                  className="flex items-center gap-3 rounded-[18px] bg-milk p-3"
                >
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`${id}-${slot.key}`}
                      className="block font-bold"
                    >
                      {slot.label}
                    </label>
                    <span className="num text-[14px] text-soft">
                      {fmtTime(slot.time)}
                    </span>
                  </div>
                  <input
                    id={`${id}-${slot.key}`}
                    aria-label={`${slot.label} dose`}
                    className="field num w-22 bg-card! text-center"
                    inputMode="decimal"
                    placeholder="Dose"
                    value={d.amounts[slot.key] ?? ''}
                    onChange={(e) =>
                      set({
                        amounts: {
                          ...d.amounts,
                          [slot.key]: e.target.value.replace(/[^\d.]/g, ''),
                        },
                      })
                    }
                  />
                  <span className="text-[14px] text-soft">
                    {d.doseUnit === 'default'
                      ? FORM_NAME[d.form].toLowerCase()
                      : d.doseUnit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Field>
      )}

      {!lean && (
        <>
          {scheduled && (
            <div className="grid gap-3">
              <Switch
                on={d.course}
                onChange={(course) => set({ course })}
                label="For a set time"
                hint={
                  d.course
                    ? `Ends on its own after ${d.courseDays} days`
                    : 'Like a course of antibiotics'
                }
                icon="calendar"
              />
              {d.course && (
                <div className="flex flex-wrap items-end gap-4 pl-13">
                  <Field label="For">
                    <Stepper
                      label="Course length in days"
                      value={d.courseDays}
                      onChange={(courseDays) => set({ courseDays })}
                      min={1}
                      max={365}
                      format={(n) => `${n} days`}
                    />
                  </Field>
                  <Field label="Starting" htmlFor={`${id}-cstart`}>
                    <DateField
                      id={`${id}-cstart`}
                      label="Course starting date"
                      className="w-48"
                      value={d.start}
                      onChange={(start) => set({ start })}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3">
            <Switch
              on={d.stock}
              onChange={(stock) => set({ stock })}
              label="Count what's left"
              hint={
                d.stock
                  ? `A reminder when ${d.refill} days are left`
                  : 'Get a nudge before you run out'
              }
              icon="refill"
            />
            {d.stock && (
              <div className="grid gap-4 pl-13 tab:grid-cols-3">
                <Field label="Left now">
                  <Stepper
                    label="Left now"
                    value={d.count}
                    onChange={(count) => set({ count })}
                    max={999}
                  />
                </Field>
                <Field label="Remind at">
                  <Stepper
                    label="Refill reminder, days left"
                    value={d.refill}
                    onChange={(refill) => set({ refill })}
                    min={1}
                    max={60}
                    format={(n) => `${n} days`}
                  />
                </Field>
                <Field label="A strip holds">
                  <Stepper
                    label="Strip size"
                    value={d.pack}
                    onChange={(pack) => set({ pack })}
                    min={1}
                    max={200}
                  />
                </Field>
              </div>
            )}
          </div>

          <Field
            label={
              d.form === 'tablet' || d.form === 'capsule'
                ? 'Looks like'
                : 'Colour'
            }
          >
            <div className="flex flex-wrap items-center gap-4">
              <span
                className="grid size-16 place-items-center rounded-[20px] bg-milk tab:hidden"
                aria-hidden="true"
              >
                <Pill
                  form={d.form}
                  look={{ shape: d.shape, colors: d.colors }}
                  size={40}
                />
              </span>
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
            </div>
            <ColorPick
              colors={d.colors}
              onChange={(colors) =>
                set({
                  colors: d.form === 'capsule' ? colors : colors.slice(0, 1),
                })
              }
              two={d.form === 'capsule'}
            />
          </Field>

          <Field label="Notes" htmlFor={`${id}-notes`}>
            <textarea
              id={`${id}-notes`}
              className="field min-h-24 resize-none py-3"
              value={d.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Prescribed by, what it's for"
              autoCapitalize="sentences"
              enterKeyHint="done"
            />
          </Field>
        </>
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
