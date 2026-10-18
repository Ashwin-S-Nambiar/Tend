import type { Medicine } from '../lib/types.ts';

export const PILL_COLORS = [
  '#ffffff',
  '#f6d57a',
  '#e9a23b',
  '#f2c230',
  '#f08a6c',
  '#b3263a',
  '#f4b6c2',
  '#8fc6e8',
  '#3c6fb6',
  '#9bd3a6',
  '#6b4a3a',
  '#2a2f3a',
];

const edge = (c: string) =>
  c.toLowerCase() === '#ffffff'
    ? 'inset 0 0 0 1.5px rgba(29,36,48,.18)'
    : undefined;

export function Pill({
  look,
  size = 24,
}: {
  look: Medicine['look'];
  size?: number;
}) {
  const [a = '#ffffff', b] = look.colors;
  const bg = b ? `linear-gradient(90deg, ${a} 50%, ${b} 50%)` : a;
  const shadow = [edge(a), b ? edge(b) : undefined].find(Boolean);
  if (look.shape === 'round')
    return (
      <span
        className="relative block rounded-full"
        style={{
          width: size * 0.75,
          height: size * 0.75,
          background: bg,
          boxShadow: shadow,
          transform: 'rotate(-32deg)',
        }}
      >
        <span className="absolute inset-x-[22%] top-1/2 h-[1.5px] -translate-y-1/2 rounded-full bg-[rgba(29,36,48,.2)]" />
      </span>
    );
  return (
    <span
      className="block"
      style={{
        width: size,
        height: look.shape === 'cap' ? size * 0.46 : size * 0.56,
        borderRadius: look.shape === 'cap' ? size : '50%',
        background: bg,
        boxShadow: shadow,
        transform: 'rotate(-32deg)',
      }}
    />
  );
}

export function PillChip({
  look,
  className = '',
}: {
  look: Medicine['look'];
  className?: string;
}) {
  return (
    <span
      className={`grid size-10 flex-none place-items-center rounded-[13px] bg-milk ${className}`}
      aria-hidden="true"
    >
      <Pill look={look} />
    </span>
  );
}
