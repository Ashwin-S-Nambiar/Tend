import { doseLine } from '../lib/dose-format.ts';
import type { DoseState } from '../lib/schedule.ts';
import type { Medicine } from '../lib/types.ts';
import Icon from './Icon.tsx';
import { PillChip } from './PillLook.tsx';

export default function MedRow({
  med,
  state,
  extra,
  tone = 'card',
  withFood = true,
  index = 0,
  onClick,
  trailing,
}: {
  med: Medicine;
  state?: DoseState;
  extra?: string;
  tone?: 'card' | 'milk';
  withFood?: boolean;
  index?: number;
  onClick?: () => void;
  trailing?: React.ReactNode;
}) {
  const done = state === 'taken' || state === 'skipped';
  const body = (
    <>
      <PillChip look={med.look} className={tone === 'milk' ? 'bg-card!' : ''} />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate font-bold text-[16px] leading-tight transition-colors duration-200 ${done ? 'text-soft' : ''}`}
        >
          {med.name}
        </span>
        <span className="num block text-[14px] text-soft leading-snug">
          {doseLine(med, withFood)}
          {extra ? ` · ${extra}` : ''}
        </span>
      </span>
      {trailing}
      {state && (
        <span
          className="dose-mark grid size-7 flex-none place-items-center rounded-full"
          data-state={state}
          style={{ transitionDelay: `${index * 60}ms` }}
          aria-hidden="true"
        >
          <Icon
            name={state === 'skipped' ? 'skip' : 'check'}
            size={16}
            stroke={2.6}
          />
        </span>
      )}
      {state && (
        <span className="sr-only">
          {state === 'taken'
            ? 'taken'
            : state === 'skipped'
              ? 'skipped'
              : state === 'snoozed'
                ? 'snoozed'
                : 'not yet'}
        </span>
      )}
    </>
  );
  const cls = `flex min-h-14 w-full items-center gap-3 rounded-[16px] px-2.5 py-2 text-left ${tone === 'milk' ? 'bg-milk' : 'bg-card'}`;
  if (onClick)
    return (
      <button type="button" className={`press ${cls}`} onClick={onClick}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}
