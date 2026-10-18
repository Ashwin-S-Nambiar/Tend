import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { themeColor } from '../app/theme.ts';
import Icon from '../components/Icon.tsx';
import MedRow from '../components/MedRow.tsx';
import Pip, { type Mood } from '../components/Pip.tsx';
import { useData } from '../lib/db.ts';
import { scheduleText } from '../lib/dose-format.ts';
import { haptic } from '../lib/haptics.ts';
import { enablePush, isIOS, pushStore } from '../lib/push.ts';
import { navigate } from '../lib/route.ts';
import { onboardedStore } from '../lib/settings.ts';
import { sfx } from '../lib/sound.ts';
import { useStore } from '../lib/store.ts';
import { useTitle } from '../lib/title.ts';
import MedicineEdit from './MedicineEdit.tsx';

const STEPS: { next: string; back: string; mood: Mood }[] = [
  { next: "Let's set up", back: "I've used it before", mood: 'hello' },
  { next: 'Continue', back: 'Back', mood: 'adding' },
  { next: 'Allow reminders', back: 'Not now', mood: 'nudge' },
];

const standalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export default function Welcome() {
  const [step, setStep] = useState(0);
  const { meds } = useData();
  const [editor, setEditor] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState(
    () => 'Notification' in window && Notification.permission === 'granted',
  );
  const [attempted, setAttempted] = useState(false);
  const push = useStore(pushStore);
  const remindersOn = push === 'on' && !busy;
  const unavailable = push === 'denied' || push === 'unsupported';
  const pip = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement[]>([]);
  useTitle('Welcome · Tend');

  useEffect(() => {
    themeColor('light');
    const meta = document.querySelectorAll('meta[name="theme-color"]');
    for (const m of meta) m.setAttribute('content', '#ffc845');
  }, []);

  const last = useRef<DOMRect | null>(null);

  useLayoutEffect(() => {
    const el = pip.current;
    if (!el) return;
    const now = el.getBoundingClientRect();
    const was = last.current;
    last.current = now;
    if (
      !was ||
      !now.width ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const dx = was.left + was.width / 2 - (now.left + now.width / 2);
    const dy = was.top + was.height / 2 - (now.top + now.height / 2);
    const k = was.width / now.width;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(k - 1) < 0.01) return;
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${k})` },
        { transform: 'none' },
      ],
      { duration: 520, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
    );
  });

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      last.current = pip.current?.getBoundingClientRect() ?? null;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    heading.current[step]?.focus({ preventScroll: true });
  }, [step]);

  function finish() {
    onboardedStore.set(true);
    navigate('/', { replace: true });
  }

  function go(n: number) {
    haptic.tick();
    sfx.whoosh();
    setStep(n);
  }

  async function next() {
    if (step === 0) go(1);
    else if (step === 1) go(2);
    else if (step === 2) {
      if (busy) return;
      if (remindersOn || unavailable) {
        finish();
        return;
      }
      if (isIOS() && !standalone()) {
        setGuide(true);
        return;
      }
      setBusy(true);
      setAttempted(true);
      try {
        await enablePush(() => setAllowed(true));
      } finally {
        setBusy(false);
      }
    }
  }

  function prev() {
    if (step === 0) finish();
    else if (step === 2) finish();
    else go(step - 1);
  }

  const s = STEPS[step] ?? STEPS[0];
  const label =
    step === 2
      ? busy
        ? 'Setting up reminders…'
        : remindersOn || unavailable
          ? "Let's go"
          : attempted
            ? 'Try again'
            : allowed
              ? 'Finish reminder setup'
              : 'Allow reminders'
      : step === 1 && !meds.length
        ? 'Skip for now'
        : (s?.next ?? '');

  return (
    <div
      className="welcome fixed inset-0 flex flex-col overflow-hidden bg-[#ffc845] pr-(--sar) pl-(--sal) text-[#1d2430] land:flex-row"
      data-step={step}
    >
      <div
        ref={stage}
        className="welcome-stage relative grid min-h-24 flex-[1_1_0] place-items-center pt-[calc(12px+var(--sat))] pb-2 land:flex-[0_0_38%] land:pb-[var(--sab)]"
      >
        <div ref={pip} className="welcome-pip pointer-events-none">
          <Pip
            mood={guide ? 'idle' : (s?.mood ?? 'hello')}
            className="size-full"
            track={step === 1}
          />
        </div>
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-130 flex-[0_1_auto] flex-col land:flex-1 land:justify-center land:pt-(--sat)">
        <div className="welcome-steps relative min-h-0 shrink overflow-y-auto overscroll-contain px-5.5">
          {[0, 1, 2].map((i) => (
            <section
              key={i}
              className="welcome-step grid content-end gap-3 pt-1 pb-2"
              data-pos={i === step ? 'here' : i < step ? 'prev' : 'next'}
              aria-hidden={i !== step}
              inert={i !== step}
            >
              <h1
                ref={(el) => {
                  if (el) heading.current[i] = el;
                }}
                tabIndex={-1}
                className="font-extrabold text-[clamp(30px,8vw,40px)] leading-[1.02] tracking-[-0.02em] outline-none"
              >
                {
                  [
                    'Hi, I’m Pip.',
                    'What do you take?',
                    remindersOn
                      ? 'You’re all set.'
                      : 'Can I tap you on the shoulder?',
                  ][i]
                }
              </h1>
              {i === 0 && (
                <p className="text-[17px] opacity-90">
                  I'll help you tend to your medicines, on time. Everything
                  stays on this phone.
                </p>
              )}
              {i === 1 && (
                <>
                  <p className="text-[16px] opacity-90">
                    Choose the medicine type, set its schedule, then review it.
                    You can add as many medicines as you need.
                  </p>
                  <div className="grid gap-2">
                    {meds.map((med) => (
                      <div
                        key={med.id}
                        className="rounded-[20px] bg-white/80 p-2 text-[#1d2430]"
                      >
                        <MedRow
                          med={med}
                          onClick={() => setEditor(med.id)}
                          trailing={<Icon name="edit" size={18} />}
                        />
                        <p className="px-2.5 pb-1 text-[13px]">
                          {scheduleText(med.schedule)}
                        </p>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn press bg-white/85 text-[#1d2430]"
                      onClick={() => setEditor('new')}
                    >
                      <Icon name="plus" size={20} />
                      {meds.length ? 'Add another medicine' : 'Add a medicine'}
                    </button>
                  </div>
                  {!meds.length && (
                    <p className="text-[14px] opacity-90">
                      Tablets, insulin, creams, patches and more. Each gets just
                      the details it needs.
                    </p>
                  )}
                </>
              )}
              {i === 2 && !guide && (
                <div className="grid gap-3" role="status" aria-live="polite">
                  {(allowed || remindersOn) && (
                    <div className="flex items-center gap-2 rounded-[16px] bg-white/65 px-3 py-2.5 font-bold">
                      <span className="grid size-8 place-items-center rounded-full bg-[#0e8576] text-white">
                        <Icon name="check" size={20} />
                      </span>
                      {remindersOn
                        ? 'Reminders are on'
                        : 'Notifications allowed'}
                    </div>
                  )}
                  <p className="text-[17px] opacity-90">
                    {busy
                      ? 'Finishing reminder setup. This can take a moment.'
                      : remindersOn
                        ? 'I’ll remind you at each scheduled time. Your medicines are ready on Today.'
                        : push === 'denied'
                          ? 'Notifications are blocked in your browser settings. You can enable reminders later in You.'
                          : push === 'unsupported'
                            ? 'This browser doesn’t support reminders. You can still use Tend and log your doses.'
                            : attempted
                              ? 'Reminder setup didn’t finish. Try again, or continue and set up reminders later in You.'
                              : "I'll send reminders at each scheduled time, with Taken and Snooze right on it."}
                    {!attempted && isIOS() && !standalone()
                      ? ' On iPhone, add me to your home screen first and I’ll show you how.'
                      : ''}
                  </p>
                </div>
              )}
              {i === 2 && guide && (
                <ol className="m-0 grid list-none gap-2 p-0 text-[16px]">
                  {[
                    ['share', 'Tap Share in Safari’s toolbar'],
                    ['plus', 'Choose Add to Home Screen'],
                    [
                      'bell',
                      'Open Tend from your home screen and allow reminders',
                    ],
                  ].map(([icon, text], n) => (
                    <li
                      key={text}
                      className="flex items-center gap-3 rounded-[16px] bg-white/60 p-3 font-semibold"
                    >
                      <span className="grid size-9 flex-none place-items-center rounded-[11px] bg-white">
                        <Icon name={icon as 'share'} size={20} />
                      </span>
                      <span>
                        {n + 1}. {text}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
        <div className="grid flex-none gap-2.5 px-5.5 pt-3 pb-[calc(20px+var(--sab))] land:pb-[calc(12px+var(--sab))]">
          <div className="flex justify-center gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <i
                key={i}
                className="step-dot"
                data-on={i === step || undefined}
              />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            Step {step + 1} of 3
          </p>
          {guide ? (
            <button
              type="button"
              className="btn press bg-[#0e8576] text-white"
              onClick={finish}
            >
              Got it
            </button>
          ) : (
            <button
              type="button"
              className="btn press bg-[#0e8576] text-white"
              onClick={next}
              disabled={busy}
              aria-busy={busy}
            >
              {label}
            </button>
          )}
          {!(step === 2 && remindersOn) && (
            <button
              type="button"
              className="press min-h-11 font-bold font-display text-[15px] opacity-90"
              onClick={prev}
            >
              {guide
                ? 'Later'
                : step === 2 && (attempted || remindersOn)
                  ? remindersOn
                    ? 'Go to Today'
                    : 'Set up later'
                  : (s?.back ?? '')}
            </button>
          )}
        </div>
      </div>
      {editor && (
        <MedicineEdit
          id={editor === 'new' ? undefined : editor}
          onDone={() => setEditor(null)}
        />
      )}
    </div>
  );
}
