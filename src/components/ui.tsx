import { type ReactNode, useRef } from 'react';
import { haptic } from '../lib/haptics.ts';
import { sfx } from '../lib/sound.ts';
import Icon, { type IconName } from './Icon.tsx';
import SelectionIndicator from './SelectionIndicator.tsx';

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  wrap = false,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode; aria?: string }[];
  onChange: (v: T) => void;
  label: string;
  wrap?: boolean;
  size?: 'sm' | 'md';
}) {
  const ref = useRef<HTMLDivElement>(null);
  function key(e: React.KeyboardEvent, i: number) {
    let n = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown')
      n = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      n = (i - 1 + options.length) % options.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = options.length - 1;
    else return;
    e.preventDefault();
    const o = options[n];
    if (!o) return;
    onChange(o.value);
    ref.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [n]?.focus();
  }
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      className={`relative isolate flex min-w-0 max-w-full gap-1.5 ${wrap ? 'flex-wrap' : 'rounded-2xl bg-milk p-1'}`}
    >
      {!wrap && (
        <SelectionIndicator
          value={value}
          selector='button[aria-checked="true"]'
        />
      )}
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.aria}
            tabIndex={on ? 0 : -1}
            onKeyDown={(e) => key(e, i)}
            onClick={() => {
              if (!on) {
                haptic.tick();
                sfx.tick();
              }
              onChange(o.value);
            }}
            className={`press relative z-1 min-w-0 max-w-full ${wrap ? '' : 'flex-1'} ${size === 'sm' ? 'min-h-10 text-[14px]' : 'min-h-11 text-[15px]'} rounded-xl px-3 py-2 font-semibold leading-snug break-words transition-colors duration-150 ${
              on
                ? wrap
                  ? 'bg-ink text-milk'
                  : 'text-milk'
                : wrap
                  ? 'bg-milk text-ink hover-fine:shadow-[inset_0_0_0_2px_var(--line-strong)]'
                  : 'text-soft hover-fine:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chips<T extends string | number>({
  values,
  options,
  onChange,
  label,
}: {
  values: T[];
  options: { value: T; label: string; aria?: string }[];
  onChange: (v: T[]) => void;
  label: string;
}) {
  return (
    <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            aria-label={o.aria}
            onClick={() => {
              haptic.tick();
              onChange(
                on ? values.filter((v) => v !== o.value) : [...values, o.value],
              );
            }}
            className={`press min-h-11 min-w-11 rounded-xl px-3 font-semibold text-[15px] transition-colors duration-150 ${
              on
                ? 'bg-pip-wash text-pip-ink shadow-[inset_0_0_0_2px_var(--pip)]'
                : 'bg-milk text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </fieldset>
  );
}

export function Switch({
  on,
  onChange,
  label,
  hint,
  icon,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  icon?: IconName;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        haptic.tick();
        onChange(!on);
      }}
      className="press flex min-h-14 w-full items-center gap-3 rounded-btn px-1 text-left"
    >
      {icon && (
        <span className="grid size-10 flex-none place-items-center rounded-[13px] bg-milk text-ink">
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[16px]">{label}</span>
        {hint && (
          <span className="block text-[14px] text-soft leading-snug">
            {hint}
          </span>
        )}
      </span>
      <span
        className={`relative h-7.5 w-12 flex-none rounded-full transition-colors duration-200 ${on ? 'bg-pip-deep' : 'bg-(--line-strong)'}`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.75 left-0.75 size-6 rounded-full bg-white shadow-sm switch-thumb ${on ? 'translate-x-4.5' : ''}`}
        />
      </span>
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  label,
  format = (n: number) => String(n),
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label: string;
  format?: (n: number) => string;
}) {
  const set = (n: number) => {
    const v = Math.round(Math.min(max, Math.max(min, n)) * 100) / 100;
    if (v !== value) {
      haptic.tick();
      onChange(v);
    }
  };
  return (
    <div
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={format(value)}
      onKeyDown={(e) => {
        const big = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight')
          set(value + step * big);
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft')
          set(value - step * big);
        else if (e.key === 'Home') set(min);
        else if (e.key === 'End') set(max);
        else return;
        e.preventDefault();
      }}
      className="inline-flex min-w-0 items-center gap-1 rounded-2xl bg-milk p-1"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="press grid size-11 flex-none place-items-center rounded-xl bg-card text-ink disabled:opacity-40"
        disabled={value <= min}
        onClick={() => set(value - step)}
      >
        <Icon name="skip" size={20} />
      </button>
      <span className="num min-w-0 flex-1 px-1 text-center font-bold font-display text-[18px] break-words">
        {format(value)}
      </span>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="press grid size-11 flex-none place-items-center rounded-xl bg-card text-ink disabled:opacity-40"
        disabled={value >= max}
        onClick={() => set(value + step)}
      >
        <Icon name="plus" size={20} />
      </button>
    </div>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`surface rounded-3xl p-4 shadow-(--shadow) ${className}`}
    >
      {children}
    </section>
  );
}

export function H2({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`px-1 font-bold font-display text-[16px] text-soft ${className}`}
    >
      {children}
    </h2>
  );
}

export function Field({
  label,
  children,
  hint,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="grid gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
      ) : (
        <span className="label">{label}</span>
      )}
      {children}
      {hint && <span className="text-[14px] text-soft">{hint}</span>}
    </div>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  keyHint,
  className = '',
  tone = 'ghost',
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  keyHint?: string;
  className?: string;
  tone?: 'ghost' | 'primary' | 'plain';
}) {
  const bg =
    tone === 'primary'
      ? 'bg-pip-deep text-on-pip'
      : tone === 'plain'
        ? ''
        : 'surface text-ink shadow-(--shadow)';
  return (
    <button
      type="button"
      aria-label={label}
      data-tip={label}
      data-key={keyHint}
      onClick={onClick}
      className={`press grid size-11 flex-none place-items-center rounded-[14px] ${bg} ${className}`}
    >
      <Icon name={icon} size={22} />
    </button>
  );
}
