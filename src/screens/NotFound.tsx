import Pip from '../components/Pip.tsx';
import { navigate } from '../lib/route.ts';
import { useTitle } from '../lib/title.ts';

export default function NotFound() {
  useTitle('Not found · Tend');
  return (
    <div className="relative isolate flex min-w-0 flex-1 flex-col items-center justify-center gap-2.5 overflow-hidden bg-dusk-wash px-6 pb-[calc(24px+var(--sab))] text-center">
      <Pip
        mood="lost"
        className="size-40"
        label="Pip looking around, lost"
        poke
      />
      <p
        className="font-black font-display text-[96px] text-dusk leading-[0.9] tracking-[-0.04em]"
        aria-hidden="true"
      >
        404
      </p>
      <h1 className="font-extrabold text-[28px] leading-tight">
        Pip looked everywhere
      </h1>
      <p className="max-w-[28ch] text-[17px] text-soft">
        This page isn't on your schedule.
      </p>
      <a
        href="/"
        className="btn btn-primary press mt-3 px-6 no-underline"
        onClick={(e) => {
          e.preventDefault();
          navigate('/', { replace: true, dir: 'back' });
        }}
      >
        Back to today
      </a>
    </div>
  );
}
