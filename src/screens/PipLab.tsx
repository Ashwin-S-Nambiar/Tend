import { useState } from 'react';
import Pip, { BODY, type Mood } from '../components/Pip.tsx';
import { SceneArt } from '../components/Scene.tsx';
import type { Scene } from '../lib/types.ts';

const MOODS = Object.keys(BODY) as Mood[];
const SCENES: Scene[] = ['morning', 'afternoon', 'evening', 'night'];

export default function PipLab() {
  const [mood, setMood] = useState<Mood>('hello');
  return (
    <div className="scroller h-dvh">
      <div className="mx-auto grid max-w-260 gap-6 p-6">
        <h1 className="font-extrabold text-[32px]">Pip, every mood</h1>
        <div className="grid gap-4 tab:grid-cols-[1.3fr_1fr]">
          <div className="relative grid min-h-90 place-items-center overflow-hidden rounded-[30px]">
            <SceneArt scene="morning" />
            <Pip mood={mood} className="relative size-72" poke track />
          </div>
          <div className="flex flex-wrap content-start gap-2">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={m === mood}
                onClick={() => setMood(m)}
                className={`press min-h-11 rounded-[14px] px-4 font-semibold ${m === mood ? 'bg-ink text-milk' : 'surface'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 tab:grid-cols-6">
          {MOODS.map((m) => (
            <div
              key={m}
              className="surface grid justify-items-center gap-1 rounded-[18px] p-3 text-[13px] text-soft"
            >
              <Pip mood={m} className="size-20" />
              {m}
            </div>
          ))}
        </div>
        <div className="grid gap-3 tab:grid-cols-4">
          {SCENES.map((s) => (
            <div
              key={s}
              className="relative h-48 overflow-hidden rounded-[24px]"
              data-scene-dark={s === 'night' ? '' : undefined}
            >
              <SceneArt scene={s} />
              <Pip
                mood={s === 'night' ? 'sleep' : 'due'}
                className="absolute top-3 right-3 size-24 text-(--star)"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
