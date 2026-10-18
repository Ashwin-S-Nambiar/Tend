import { useEffect, useId, useState } from 'react';
import { TimePicker } from './DateTimeField.tsx';
import Sheet from './Sheet.tsx';

export default function TimeSheet({
  open,
  onClose,
  onSave,
  defaultTime,
  title,
  hint,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (hhmm: string) => void;
  defaultTime: string;
  title: string;
  hint?: string;
}) {
  const id = useId();
  const [time, setTime] = useState(defaultTime);
  useEffect(() => {
    if (open) setTime(defaultTime);
  }, [open, defaultTime]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={title}
      size="sm"
      header={<h2 className="pt-1 pb-1 font-extrabold text-[22px]">{title}</h2>}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn btn-soft press"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" form={id} className="btn btn-primary press">
            Save
          </button>
        </div>
      }
    >
      <form
        id={id}
        className="grid gap-2 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSave(time);
          onClose();
        }}
      >
        {open && (
          <TimePicker key={defaultTime} value={time} onChange={setTime} />
        )}
        {hint && <p className="text-[14px] text-soft">{hint}</p>}
      </form>
    </Sheet>
  );
}
