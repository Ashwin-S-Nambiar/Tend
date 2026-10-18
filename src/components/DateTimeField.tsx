import { useId, useRef, useState } from 'react';
import { useContentMotion } from '../lib/motion.ts';
import { addDays, dayKey, fmtDay, fmtTime, parseDay } from '../lib/time.ts';
import Icon from './Icon.tsx';
import Sheet from './Sheet.tsx';
import { Segmented } from './ui.tsx';

const pad = (n: number) => String(n).padStart(2, '0');

export function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const hour = Number(value.slice(0, 2));
  const minute = Number(value.slice(3, 5));
  const [h, setH] = useState(String(hour % 12 || 12));
  const [m, setM] = useState(pad(minute));
  function change(hours: string, minutes: string, pm = hour >= 12) {
    const hh = Number(hours);
    const mm = Number(minutes);
    if (hours && minutes && hh >= 1 && hh <= 12 && mm >= 0 && mm <= 59)
      onChange(`${pad((hh % 12) + (pm ? 12 : 0))}:${pad(mm)}`);
  }
  return (
    <div className="grid gap-4 py-2" data-nodrag>
      <div className="flex items-end justify-center gap-2">
        <label className="grid min-w-0 flex-1 gap-2" htmlFor={`${id}-h`}>
          <span className="label text-center">Hour</span>
          <input
            id={`${id}-h`}
            aria-label="Hour"
            type="text"
            inputMode="numeric"
            pattern="(?:[1-9]|0[1-9]|1[0-2])"
            required
            maxLength={2}
            className="field num min-h-22 text-center font-display text-[42px]!"
            value={h}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              setH(v);
              change(v, m);
            }}
          />
        </label>
        <span
          className="pb-3 font-display text-[40px] text-soft"
          aria-hidden="true"
        >
          :
        </span>
        <label className="grid min-w-0 flex-1 gap-2" htmlFor={`${id}-m`}>
          <span className="label text-center">Minute</span>
          <input
            id={`${id}-m`}
            aria-label="Minute"
            type="text"
            inputMode="numeric"
            pattern="[0-5]?[0-9]"
            required
            maxLength={2}
            className="field num min-h-22 text-center font-display text-[42px]!"
            value={m}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              setM(v);
              change(h, v);
            }}
          />
        </label>
      </div>
      <div className="flex justify-center">
        <Segmented
          label="AM or PM"
          value={hour >= 12 ? 'pm' : 'am'}
          onChange={(v) => change(h, m, v === 'pm')}
          options={[
            { value: 'am', label: 'AM' },
            { value: 'pm', label: 'PM' },
          ]}
        />
      </div>
      <div
        className="flex flex-wrap justify-center gap-2"
        role="group"
        aria-label="Quick minutes"
      >
        {[0, 15, 30, 45].map((n) => (
          <button
            type="button"
            key={n}
            className={`press min-h-11 min-w-12 rounded-xl px-3 font-bold ${minute === n ? 'bg-pip-wash text-pip-ink' : 'bg-milk'}`}
            onClick={() => {
              setM(pad(n));
              change(h, pad(n));
            }}
          >
            :{pad(n)}
          </button>
        ))}
      </div>
    </div>
  );
}

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
};

export function TimeField({
  id,
  value,
  onChange,
  label,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const controls = useRef<HTMLDivElement>(null);
  function save() {
    const inputs = [...(controls.current?.querySelectorAll('input') ?? [])];
    if (inputs.some((input) => !input.reportValidity())) return;
    onChange(draft);
    setOpen(false);
  }
  return (
    <>
      <button
        id={id}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        className={`field num press flex items-center justify-between gap-2 text-left ${className}`}
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
      >
        <span>{fmtTime(value)}</span>
        <Icon name="clock" size={18} />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        label={label}
        size="sm"
        header={<h2 className="py-1 font-extrabold text-[22px]">{label}</h2>}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-soft press"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="btn btn-primary press"
            >
              Set time
            </button>
          </div>
        }
      >
        <div
          ref={controls}
          role="group"
          aria-label="Time values"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              save();
            }
          }}
        >
          {open && <TimePicker value={draft} onChange={setDraft} />}
        </div>
      </Sheet>
    </>
  );
}

function Calendar({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [month, setMonth] = useState(value.slice(0, 7));
  const grid = useContentMotion(month);
  const first = `${month}-01`;
  const start = parseDay(first);
  const count = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    0,
  ).getDate();
  const leading = (start.getDay() + 6) % 7;
  const today = dayKey();
  function move(n: number) {
    const date = new Date(start.getFullYear(), start.getMonth() + n, 1);
    setMonth(`${date.getFullYear()}-${pad(date.getMonth() + 1)}`);
  }
  function focusDay(day: string) {
    onChange(day);
    setMonth(day.slice(0, 7));
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(`[data-calendar-day="${day}"]`)
        ?.focus(),
    );
  }
  return (
    <div className="grid gap-3" data-nodrag>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          className="btn btn-soft press min-h-11 px-3"
          onClick={() => move(-1)}
        >
          <Icon name="back" size={18} />
        </button>
        <p className="font-bold font-display text-[18px]" aria-live="polite">
          {fmtDay(first, { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          aria-label="Next month"
          className="btn btn-soft press min-h-11 px-3"
          onClick={() => move(1)}
        >
          <Icon name="next" size={18} />
        </button>
      </div>
      <div
        ref={grid}
        className="grid grid-cols-7"
        role="group"
        aria-label="Choose a day"
      >
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span
            key={d}
            aria-hidden="true"
            className="py-2 text-center text-[13px] text-soft"
          >
            {d[0]}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) =>
          addDays(first, i - leading),
        ).map((day) => (
          <span key={day} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const day = `${month}-${pad(i + 1)}`;
          return (
            <button
              key={day}
              type="button"
              data-calendar-day={day}
              aria-label={fmtDay(day, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              aria-pressed={value === day}
              aria-current={today === day ? 'date' : undefined}
              className={`press num min-h-11 rounded-xl font-semibold ${value === day ? 'bg-pip-deep text-on-pip' : today === day ? 'bg-pip-wash text-pip-ink' : 'hover-fine:bg-milk'}`}
              onClick={() => onChange(day)}
              onKeyDown={(e) => {
                const offset = {
                  ArrowLeft: -1,
                  ArrowRight: 1,
                  ArrowUp: -7,
                  ArrowDown: 7,
                }[e.key];
                if (offset !== undefined) {
                  e.preventDefault();
                  focusDay(addDays(day, offset));
                }
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="btn btn-soft btn-sm press justify-self-start"
        onClick={() => focusDay(today)}
      >
        Today
      </button>
    </div>
  );
}

export function DateField({
  id,
  value,
  onChange,
  label,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <>
      <button
        id={id}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        className={`field num press flex items-center justify-between gap-2 text-left ${className}`}
        onClick={() => {
          setDraft(value || dayKey());
          setOpen(true);
        }}
      >
        <span>
          {value
            ? fmtDay(value, { day: 'numeric', month: 'short', year: 'numeric' })
            : 'Choose date'}
        </span>
        <Icon name="calendar" size={18} />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        label={label}
        size="sm"
        header={<h2 className="py-1 font-extrabold text-[22px]">{label}</h2>}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-soft press"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary press"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Set date
            </button>
          </div>
        }
      >
        {open && <Calendar value={draft} onChange={setDraft} />}
      </Sheet>
    </>
  );
}

export function DateTimeField({ value, onChange, label }: Props) {
  const [day = dayKey(), time = '09:00'] = value.split('T');
  return (
    <div className="grid gap-2 tab:grid-cols-2">
      <DateField
        label={`${label}: date`}
        value={day}
        onChange={(d) => onChange(`${d}T${time}`)}
      />
      <TimeField
        label={`${label}: time`}
        value={time}
        onChange={(t) => onChange(`${day}T${t}`)}
      />
    </div>
  );
}
