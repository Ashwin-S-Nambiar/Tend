import { useRef, useState } from 'react';
import { setTheme } from '../app/theme.ts';
import Icon, { type IconName } from '../components/Icon.tsx';
import { Pill } from '../components/PillLook.tsx';
import Pip from '../components/Pip.tsx';
import Sheet from '../components/Sheet.tsx';
import { TravelSettings } from '../components/Travel.tsx';
import { Card, H2, Segmented, Switch } from '../components/ui.tsx';
import { exportBackup, importBackup } from '../lib/backup.ts';
import { useData } from '../lib/db.ts';
import { doseLine, scheduleText } from '../lib/dose-format.ts';
import { buildIcs, download } from '../lib/ics.ts';
import {
  disablePush,
  enablePush,
  isIOS,
  pushReady,
  pushStore,
  replan,
} from '../lib/push.ts';
import { navigate } from '../lib/route.ts';
import { hideNamesStore, routinesStore, themeStore } from '../lib/settings.ts';
import { soundStore } from '../lib/sound.ts';
import { useStore } from '../lib/store.ts';
import { dayKey, fmtDay } from '../lib/time.ts';
import { useTitle } from '../lib/title.ts';
import { toast } from '../lib/toast.ts';

function Row({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex min-h-14 w-full items-center gap-3 rounded-[18px] px-1 text-left"
    >
      <span className="grid size-10 flex-none place-items-center rounded-[13px] bg-milk">
        <Icon name={icon} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[16px]">{label}</span>
        {hint && (
          <span className="block text-[14px] text-soft leading-snug">
            {hint}
          </span>
        )}
      </span>
      <Icon name="next" size={18} className="text-soft" />
    </button>
  );
}

export default function You() {
  const theme = useStore(themeStore);
  const sound = useStore(soundStore);
  const hide = useStore(hideNamesStore);
  const push = useStore(pushStore);
  const { meds } = useData();
  const [card, setCard] = useState(false);
  const [keys, setKeys] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  useTitle('Settings · Tend');

  const reminderHint: Record<string, string> = {
    on: 'One reminder per routine, and a follow-up 30 min later if nothing is logged.',
    off: 'Get a tap on the shoulder at each routine.',
    denied:
      'Notifications are blocked for this site. Allow them in your browser settings.',
    install:
      'On iPhone, add Tend to your home screen first. Share, then Add to Home Screen.',
    unsupported:
      'This browser cannot show reminders. Try Chrome, or add Tend to your home screen.',
    gone: 'Reminders are off on this device.',
    error: pushReady
      ? "Couldn't reach the reminder server. Try again."
      : 'The reminder server is not set up yet.',
  };

  return (
    <div className="scroller min-w-0 flex-1">
      <div className="mx-auto grid w-full max-w-160 content-start gap-5 px-4 pt-[calc(12px+var(--sat))] pb-10 tab:px-8 tab:pt-[calc(28px+var(--sat))]">
        <h1 className="px-1 font-extrabold text-[clamp(28px,4vw,40px)] leading-tight tracking-[-0.02em]">
          You
        </h1>

        <Card className="grid gap-3">
          <div className="flex items-center gap-3">
            <Pip
              mood={push === 'on' ? 'done' : 'nudge'}
              className="size-14 flex-none"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-[17px]">
                {push === 'on' ? 'Reminders are on' : 'Reminders'}
              </h2>
              <p className="text-[14px] text-soft leading-snug">
                {reminderHint[push]}
              </p>
            </div>
          </div>
          {push === 'on' ? (
            <button
              type="button"
              className="btn btn-soft press"
              onClick={() => disablePush()}
            >
              Turn off on this device
            </button>
          ) : push === 'install' && isIOS() ? null : (
            <button
              type="button"
              className="btn btn-primary press"
              disabled={push === 'denied' || push === 'unsupported'}
              onClick={async () => {
                if (await enablePush()) toast('Reminders are on');
              }}
            >
              <Icon name="bell" size={20} />
              Turn on reminders
            </button>
          )}
          <Switch
            on={!hide}
            onChange={(v) => {
              hideNamesStore.set(!v);
              replan();
            }}
            label="Show names on the lock screen"
            hint={
              hide
                ? 'Reminders say "Time for your 8:00 medicines"'
                : 'Reminders name each medicine'
            }
            icon="lock"
          />
        </Card>

        <section className="grid gap-2">
          <H2>Your day</H2>
          <Card className="grid gap-1">
            <Row
              icon="routines"
              label="Routines"
              hint="When you wake, eat and sleep"
              onClick={() => navigate('/routines')}
            />
            <TravelSettings />
          </Card>
        </section>

        <section className="grid gap-2">
          <H2>Look and sound</H2>
          <Card className="grid gap-3">
            <div ref={themeRef} className="grid gap-2">
              <span className="label">Theme</span>
              <Segmented
                label="Theme"
                value={theme}
                onChange={(t) =>
                  setTheme(
                    t,
                    themeRef.current?.querySelector<HTMLElement>(
                      `[aria-checked="true"]`,
                    ),
                  )
                }
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Night' },
                ]}
              />
            </div>
            <Switch
              on={sound}
              onChange={(v) => soundStore.set(v)}
              label="Sounds"
              hint="Soft chimes when you log a dose"
              icon={sound ? 'sound' : 'mute'}
            />
          </Card>
        </section>

        <section className="grid gap-2">
          <H2>Share and keep</H2>
          <Card className="grid gap-1">
            <Row
              icon="card"
              label="My medicines card"
              hint="A list to show your doctor"
              onClick={() => setCard(true)}
            />
            <Row
              icon="calendar"
              label="Add to calendar"
              hint="The next 30 days as calendar alerts, for when you can't install"
              onClick={() => {
                download(
                  'tend.ics',
                  buildIcs(
                    meds.filter((m) => !m.archived),
                    routinesStore.get(),
                  ),
                  'text/calendar',
                );
                toast('Calendar file saved');
              }}
            />
            <Row
              icon="download"
              label="Back up"
              hint="Save everything to a file"
              onClick={() => {
                download(
                  `tend-${dayKey()}.json`,
                  exportBackup(),
                  'application/json',
                );
                toast('Backup saved');
              }}
            />
            <Row
              icon="upload"
              label="Restore"
              hint="Load a backup file"
              onClick={() => file.current?.click()}
            />
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  const undo = await importBackup(f);
                  toast('Backup restored', () => {
                    undo();
                  });
                } catch {
                  toast("That file isn't a Tend backup");
                }
              }}
            />
          </Card>
        </section>

        <section className="grid gap-2">
          <H2>About</H2>
          <Card className="grid gap-1">
            <Row
              icon="keyboard"
              label="Keyboard shortcuts"
              onClick={() => setKeys(true)}
            />
            <div className="px-1 pt-2 pb-1 text-[14px] text-soft leading-relaxed">
              <p>
                Everything stays on this device. Reminders send only a time and
                an anonymous id to the server, never a medicine.
              </p>
              <p className="mt-2">
                Tend is not medical advice and doesn't check interactions. Ask
                your doctor or pharmacist.
              </p>
              <p className="mt-2">
                Gabarito and Rethink Sans, both under the SIL Open Font License.
                Made by{' '}
                <a
                  className="text-pip-ink underline underline-offset-3"
                  href="https://ashwin.co.in"
                  target="_blank"
                  rel="noopener"
                >
                  Ashwin
                </a>
                .
              </p>
            </div>
          </Card>
        </section>
      </div>
      <DoctorCard open={card} onClose={() => setCard(false)} />
      <Shortcuts open={keys} onClose={() => setKeys(false)} />
    </div>
  );
}

function DoctorCard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { meds } = useData();
  const active = meds.filter((m) => !m.archived);
  const date = fmtDay(dayKey(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const text = [
    `My medicines, ${date}`,
    '',
    ...active.map(
      (m) =>
        `• ${m.name}, ${doseLine(m)}. ${scheduleText(m.schedule)}.${m.notes ? ` ${m.notes}` : ''}`,
    ),
  ].join('\n');
  const canShare =
    typeof navigator.share === 'function' &&
    matchMedia('(pointer: coarse)').matches;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="My medicines card"
      detents
      size="lg"
      header={
        <h2 className="pt-1 pb-1 font-extrabold text-[24px]">My medicines</h2>
      }
      footer={
        <button
          type="button"
          className="btn btn-primary press w-full"
          onClick={async () => {
            if (canShare) {
              try {
                await navigator.share({ title: 'My medicines', text });
              } catch {}
              return;
            }
            try {
              await navigator.clipboard.writeText(text);
              toast('Copied the list');
            } catch {
              toast("Couldn't copy. Select the text instead.");
            }
          }}
        >
          <Icon name={canShare ? 'share' : 'copy'} size={20} />
          {canShare ? 'Share' : 'Copy the list'}
        </button>
      }
    >
      <p className="mb-3 text-soft">As of {date}</p>
      <ul className="m-0 grid list-none gap-2 p-0 select-text">
        {active.map((m) => (
          <li key={m.id} className="flex gap-3 rounded-[16px] bg-milk p-3">
            <span className="grid size-10 flex-none place-items-center rounded-[13px] bg-card">
              <Pill look={m.look} form={m.form} />
            </span>
            <div className="min-w-0">
              <b className="block font-bold">{m.name}</b>
              <span className="num block text-[15px]">{doseLine(m)}</span>
              <span className="block text-[15px] text-soft">
                {scheduleText(m.schedule)}
              </span>
            </div>
          </li>
        ))}
        {active.length === 0 && (
          <li className="text-soft">Nothing added yet.</li>
        )}
      </ul>
    </Sheet>
  );
}

const KEYS: [string, string][] = [
  ['T', 'Take what is due'],
  ['Z', 'Snooze 10 minutes'],
  ['S', 'Skip what is due'],
  ['Enter', 'Open the due dose'],
  ['N', 'Add a medicine'],
  ['1 to 5', 'Today, Medicines, History, Routines, You'],
  ['⌘ Z', 'Undo'],
  ['Esc', 'Close a sheet'],
];

function Shortcuts({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Keyboard shortcuts"
      size="sm"
      header={
        <h2 className="pt-1 pb-1 font-extrabold text-[22px]">
          Keyboard shortcuts
        </h2>
      }
    >
      <dl className="m-0 grid gap-2 pb-2">
        {KEYS.map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between gap-4 rounded-[14px] bg-milk px-3 py-2.5"
          >
            <dt className="text-[15px]">{v}</dt>
            <dd className="m-0">
              <kbd className="rounded-[7px] bg-card px-2 py-1 font-semibold text-[13px] shadow-(--shadow)">
                {k}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}
