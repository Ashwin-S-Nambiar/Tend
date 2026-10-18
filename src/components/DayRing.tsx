import Pip, { type Mood } from './Pip.tsx';

export default function DayRing({
  done,
  total,
  mood,
  size = 56,
}: {
  done: number;
  total: number;
  mood: Mood;
  size?: number;
}) {
  const r = 25;
  const c = 2 * Math.PI * r;
  const f = total ? done / total : 0;
  const label = total
    ? `${done} of ${total} doses logged today`
    : 'Nothing scheduled today';
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 56 56"
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth="4"
        />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="var(--pip)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          style={{
            transition: 'stroke-dashoffset 600ms var(--ease-out)',
            opacity: f ? 1 : 0,
          }}
        />
      </svg>
      <Pip
        mood={mood}
        label={label}
        className="absolute inset-[12.5%] size-[75%]"
        track
      />
    </div>
  );
}
