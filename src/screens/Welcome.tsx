import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { themeColor } from '../app/theme.ts';
import Icon from '../components/Icon.tsx';
import Pip, { type Mood } from '../components/Pip.tsx';
import { putMed } from '../lib/db.ts';
import { haptic } from '../lib/haptics.ts';
import { enablePush, isIOS } from '../lib/push.ts';
import { navigate } from '../lib/route.ts';
import { onboardedStore } from '../lib/settings.ts';
import type { Parsed } from '../lib/shorthand.ts';
import { sfx } from '../lib/sound.ts';
import { useTitle } from '../lib/title.ts';
import {
  blank,
  fromParsed,
  problem,
  Shorthand,
  toMed,
} from './MedicineEdit.tsx';
import { RoutineRows } from './Routines.tsx';

const STEPS: { next: string; back: string; mood: Mood }[] = [
  { next: "Let's set up", back: "I've used it before", mood: 'hello' },
  { next: 'Looks right', back: 'Back', mood: 'idle' },
  { next: 'Add it', back: 'Back', mood: 'adding' },
  { next: 'Allow reminders', back: 'Not now', mood: 'nudge' },
];

const POSE = [
  { x: 0, y: 30, s: 1.25 },
  { x: -0.3, y: 0, s: 0.62 },
  { x: 0.3, y: 0, s: 0.62 },
  { x: 0, y: 30, s: 1 },
];

const standalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export default function Welcome() {
  const [step, setStep] = useState(0);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [guide, setGuide] = useState(false);
  const pip = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement[]>([]);
  useTitle('Welcome · Tend');

  useEffect(() => {
    themeColor('light');
    const meta = document.querySelectorAll('meta[name="theme-color"]');
    for (const m of meta) m.setAttribute('content', '#ffc845');
  }, []);

  useLayoutEffect(() => {
    const el = pip.current;
    const box = stage.current;
    if (!el || !box) return;
    const p = POSE[step] ?? POSE[0];
    if (!p) return;
    const w = box.clientWidth;
    el.style.transform = `translate(${p.x * w}px, ${p.y}px) scale(${p.s})`;
  }, [step]);

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
      if (parsed) {
        const d = fromParsed(blank(), parsed);
        if (!problem(d)) {
          const med = toMed(d);
          putMed(med);
        }
      }
      go(3);
    } else if (step === 3) {
      if (isIOS() && !standalone()) {
        setGuide(true);
        return;
      }
      await enablePush();
      finish();
    }
  }

  function prev() {
    if (step === 0) finish();
    else if (step === 3) finish();
    else go(step - 1);
  }

  const s = STEPS[step] ?? STEPS[0];
  const label = step === 2 && !parsed ? 'Skip for now' : (s?.next ?? '');

  return (
    <div
      className="welcome fixed inset-0 flex flex-col overflow-hidden bg-[#ffc845] text-[#1d2430]"
      data-step={step}
    >
      <div
        className="relative mx-auto flex min-h-0 w-full max-w-130 flex-1 flex-col px-5.5 pt-[calc(16px+var(--sat))]"
        ref={stage}
      >
        <div
          ref={pip}
          className="welcome-pip pointer-events-none absolute top-[calc(12px+var(--sat))] left-1/2 z-10 -ml-20 size-40 origin-top"
        >
          <Pip
            mood={guide ? 'idle' : (s?.mood ?? 'hello')}
            className="size-full"
            track={step === 1}
          />
        </div>
        <div className="relative min-h-0 flex-1">
          {[0, 1, 2, 3].map((i) => (
            <section
              key={i}
              className="welcome-step absolute inset-0 grid content-end gap-3 overflow-y-auto pt-48 pb-2"
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
                    'When does your day happen?',
                    'What do you take?',
                    'Can I tap you on the shoulder?',
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
                  <RoutineRows tone="glass" />
                  <p className="text-[16px] opacity-90">
                    Medicines follow these. Move breakfast and every morning
                    dose moves too.
                  </p>
                </>
              )}
              {i === 2 && (
                <>
                  <div className="welcome-field">
                    <Shorthand onApply={(p) => setParsed(p)} />
                  </div>
                  <p className="text-[16px] opacity-90">
                    Or add it step by step later. You can add the rest any time.
                  </p>
                </>
              )}
              {i === 3 && !guide && (
                <p className="text-[17px] opacity-90">
                  I'll send one reminder per routine, with Taken and Snooze
                  right on it.
                  {isIOS() && !standalone()
                    ? ' On iPhone, add me to your home screen first and I’ll show you how.'
                    : ''}
                </p>
              )}
              {i === 3 && guide && (
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
      </div>
      <div className="mx-auto grid w-full max-w-130 flex-none gap-2.5 px-5.5 pt-3 pb-[calc(20px+var(--sab))]">
        <div className="flex justify-center gap-1" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className="step-dot" data-on={i === step || undefined} />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          Step {step + 1} of 4
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
          >
            {label}
          </button>
        )}
        <button
          type="button"
          className="press min-h-11 font-bold font-display text-[15px] opacity-90"
          onClick={prev}
        >
          {guide ? 'Later' : (s?.back ?? '')}
        </button>
      </div>
    </div>
  );
}
