import { type ReactNode, useRef } from 'react';
import Icon, { type IconName } from './Icon.tsx';
import Sheet from './Sheet.tsx';

export type Action = {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  danger?: boolean;
  hint?: string;
};

export default function ActionSheet({
  open,
  onClose,
  title,
  actions,
  header,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  actions: Action[];
  header?: ReactNode;
}) {
  const pending = useRef<(() => void) | null>(null);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      onClosed={() => {
        const run = pending.current;
        pending.current = null;
        run?.();
      }}
      label={title}
      size="sm"
      header={
        header ?? (
          <h2 className="pt-1 pb-2 font-extrabold text-[22px]">{title}</h2>
        )
      }
      footer={
        <button
          type="button"
          className="btn btn-soft press w-full"
          onClick={onClose}
        >
          Cancel
        </button>
      }
    >
      <div className="grid gap-1.5">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className={`press flex min-h-14 items-center gap-3 rounded-[16px] bg-milk px-4 text-left font-semibold text-[17px] hover-fine:bg-(--line) ${a.danger ? 'text-[#c43d2f] dark:text-[#ff8a7a]' : ''}`}
            onClick={() => {
              pending.current = a.onSelect;
              onClose();
            }}
          >
            {a.icon && <Icon name={a.icon} size={22} />}
            <span className="flex-1">{a.label}</span>
            {a.hint && <kbd className="kbd">{a.hint}</kbd>}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
