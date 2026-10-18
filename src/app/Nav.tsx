import Icon, { type IconName } from '../components/Icon.tsx';
import Pip from '../components/Pip.tsx';
import { haptic } from '../lib/haptics.ts';
import { navigate, SCREEN_PATH, type Screen } from '../lib/route.ts';

const ITEMS: {
  id: Screen;
  label: string;
  icon: IconName;
  key: string;
  tabs?: boolean;
}[] = [
  { id: 'today', label: 'Today', icon: 'today', key: '1', tabs: true },
  { id: 'medicines', label: 'Medicines', icon: 'meds', key: '2', tabs: true },
  { id: 'history', label: 'History', icon: 'history', key: '3', tabs: true },
  { id: 'routines', label: 'Routines', icon: 'routines', key: '4' },
  { id: 'you', label: 'You', icon: 'you', key: '5', tabs: true },
];

function go(id: Screen, current: Screen | null) {
  if (id === current) return;
  haptic.tap();
  navigate(SCREEN_PATH[id]);
}

function link(id: Screen, current: Screen | null) {
  return {
    href: SCREEN_PATH[id],
    'aria-current': id === current ? ('page' as const) : undefined,
    onClick: (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      go(id, current);
    },
  };
}

export function TabBar({ current }: { current: Screen | null }) {
  const on = current === 'routines' ? 'you' : current;
  return (
    <nav
      aria-label="Main"
      className="surface grid flex-none grid-cols-4 px-2 pt-1.5 pb-[max(8px,var(--sab))] shadow-[0_-1px_0_var(--line)] tab:hidden land:hidden"
    >
      {ITEMS.filter((i) => i.tabs).map((i) => (
        <a
          key={i.id}
          {...link(i.id, on)}
          aria-current={i.id === on ? 'page' : undefined}
          className={`press control grid min-h-13 place-items-center content-center gap-1 rounded-[14px] font-semibold text-[12px] no-underline ${
            i.id === on ? 'text-pip-ink' : 'text-soft'
          }`}
        >
          <span
            className={`grid h-7 w-14 place-items-center rounded-full transition-colors duration-200 ${i.id === on ? 'bg-pip-wash' : ''}`}
          >
            <Icon name={i.icon} size={22} />
          </span>
          {i.label}
        </a>
      ))}
    </nav>
  );
}

export function Rail({
  current,
  slim,
}: {
  current: Screen | null;
  slim?: boolean;
}) {
  return (
    <nav
      aria-label="Main"
      className={`surface flex h-full flex-col items-center gap-1.5 overflow-y-auto shadow-[1px_0_0_var(--line)] ${slim ? 'w-[calc(68px+var(--sal))] py-3 pl-(--sal)' : 'w-24 py-6'}`}
    >
      {!slim && <Pip mood="idle" className="mb-3 size-12" track />}
      {ITEMS.map((i) => (
        <a
          key={i.id}
          {...link(i.id, current)}
          data-tip={slim ? i.label : undefined}
          data-key={i.key}
          className={`press control grid w-[calc(100%-16px)] place-items-center gap-1 rounded-[14px] font-semibold text-[12.5px] no-underline transition-colors duration-150 ${
            slim ? 'min-h-11' : 'min-h-16 py-2'
          } ${i.id === current ? 'bg-pip-wash text-pip-ink' : 'text-soft hover-fine:text-ink'}`}
        >
          <Icon name={i.icon} size={slim ? 22 : 24} />
          {slim ? <span className="sr-only">{i.label}</span> : i.label}
        </a>
      ))}
      <button
        type="button"
        aria-label="Add medicine"
        data-tip="Add medicine"
        data-key="N"
        onClick={() => navigate('/medicine/new')}
        className={`press mt-2 grid place-items-center rounded-[16px] bg-pip-deep text-on-pip ${slim ? 'size-11' : 'size-13'}`}
      >
        <Icon name="plus" size={24} />
      </button>
    </nav>
  );
}

export function Sidebar({ current }: { current: Screen | null }) {
  return (
    <nav
      aria-label="Main"
      className="surface flex h-full w-65 flex-col gap-6 px-4 py-6 shadow-[1px_0_0_var(--line)]"
    >
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          go('today', current);
        }}
        className="flex items-center gap-2 px-2 font-display font-extrabold text-[26px] text-ink no-underline"
      >
        <Pip mood="idle" className="size-11" track />
        Tend
      </a>
      <div className="grid gap-1">
        {ITEMS.map((i) => (
          <a
            key={i.id}
            {...link(i.id, current)}
            className={`press control flex min-h-12 items-center gap-3 rounded-[14px] px-3.5 font-semibold text-[16px] no-underline transition-colors duration-150 ${
              i.id === current
                ? 'bg-pip-wash text-pip-ink'
                : 'text-soft hover-fine:bg-milk hover-fine:text-ink'
            }`}
          >
            <Icon name={i.icon} size={22} />
            <span className="flex-1">{i.label}</span>
            <kbd className="kbd">{i.key}</kbd>
          </a>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary press mt-auto"
        onClick={() => navigate('/medicine/new')}
      >
        <Icon name="plus" size={20} />
        Add medicine
        <kbd className="kbd">N</kbd>
      </button>
    </nav>
  );
}
