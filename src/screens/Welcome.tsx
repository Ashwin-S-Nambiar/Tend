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
          {[0, 1, 2, 3].map((i) => (
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
        <div className="grid flex-none gap-2.5 px-5.5 pt-3 pb-[calc(20px+var(--sab))] land:pb-[calc(12px+var(--sab))]">
          <div className="flex justify-center gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <i
                key={i}
                className="step-dot"
                data-on={i === step || undefined}
              />
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
    </div>
  );
}
