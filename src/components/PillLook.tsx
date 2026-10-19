import type { Form, Medicine } from '../lib/types.ts';

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

const PART = '#cfc8bd';

function FormArt({
  form,
  color,
  size,
}: {
  form: Form;
  color: string;
  size: number;
}) {
  const white = color.toLowerCase() === '#ffffff';
  const body = {
    fill: color,
    stroke: white ? 'rgba(29,36,48,.22)' : undefined,
    strokeWidth: white ? 1.2 : undefined,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="block"
    >
      {form === 'liquid' && (
        <>
          <rect x="12" y="2.5" width="8" height="5" rx="1.5" fill={PART} />
          <rect x="13" y="7" width="6" height="3.5" fill={PART} opacity=".7" />
          <rect x="8" y="10" width="16" height="19.5" rx="4" {...body} />
          <rect
            x="8.6"
            y="16"
            width="14.8"
            height="7"
            fill="#fff"
            opacity=".8"
          />
        </>
      )}
      {form === 'drops' && (
        <>
          <path d="M14.2 2.5h3.6l1.2 6.5h-6z" fill={PART} />
          <rect x="11" y="9" width="10" height="4" rx="1.2" fill={PART} />
          <rect x="9" y="13" width="14" height="16.5" rx="4" {...body} />
          <rect
            x="9.6"
            y="18"
            width="12.8"
            height="5.5"
            fill="#fff"
            opacity=".8"
          />
        </>
      )}
      {form === 'puff' && (
        <>
          <rect x="11" y="2.5" width="8" height="10.5" rx="2.5" fill={PART} />
          <rect x="8.5" y="11" width="13" height="18.5" rx="3.5" {...body} />
          <rect x="17" y="22" width="10.5" height="7.5" rx="2.5" {...body} />
        </>
      )}
      {form === 'injection' && (
        <g transform="rotate(32 16 16)">
          <rect x="12.5" y="2" width="7" height="21" rx="3.2" {...body} />
          <rect
            x="14.2"
            y="7.5"
            width="3.6"
            height="7"
            rx="1.2"
            fill="#fff"
            opacity=".85"
          />
          <rect x="13.5" y="23" width="5" height="3.5" rx="1" fill={PART} />
          <path
            d="M16 26.5v4"
            stroke="#9aa0a8"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </g>
      )}
      {form === 'patch' && (
        <g transform="rotate(-12 16 16)">
          <rect x="4.5" y="4.5" width="23" height="23" rx="6.5" {...body} />
          <rect
            x="10"
            y="10"
            width="12"
            height="12"
            rx="3.2"
            fill="#fff"
            opacity=".65"
          />
        </g>
      )}
      {form === 'cream' && (
        <g transform="rotate(-24 16 16)">
          <rect x="9" y="2.5" width="14" height="3.5" rx="1" fill={PART} />
          <path d="M9.5 6h13l-2.6 17.5h-7.8z" {...body} />
          <rect x="12" y="23.5" width="8" height="6" rx="1.8" fill={PART} />
        </g>
      )}
    </svg>
  );
}

export const SHAPED: Form[] = ['tablet', 'capsule'];

export function Pill({
  look,
  size = 24,
  form,
}: {
  look: Medicine['look'];
  size?: number;
  form?: Form;
}) {
  if (form && !SHAPED.includes(form))
    return (
      <FormArt
        form={form}
        color={look.colors[0] ?? '#8fc6e8'}
        size={size * 1.15}
      />
    );
  const [a = '#ffffff', b] = look.colors;
  const bg = b ? `linear-gradient(90deg, ${a} 50%, ${b} 50%)` : a;
  const shadow = [edge(a), b ? edge(b) : undefined].find(Boolean);
  const shape = form === 'capsule' ? 'cap' : look.shape;
  if (shape === 'round')
    return (
      <span
        className="block rounded-full"
        style={{
          width: size * 0.75,
          height: size * 0.75,
          background: bg,
          boxShadow: shadow,
          transform: 'rotate(-32deg)',
        }}
      />
    );
  return (
    <span
      className="block"
      style={{
        width: size,
        height: shape === 'cap' ? size * 0.46 : size * 0.56,
        borderRadius: shape === 'cap' ? size : '50%',
        background: bg,
        boxShadow: shadow,
        transform: 'rotate(-32deg)',
      }}
    />
  );
}

export function PillChip({
  look,
  form,
  className = '',
}: {
  look: Medicine['look'];
  form?: Form;
  className?: string;
}) {
  return (
    <span
      className={`grid size-10 flex-none place-items-center rounded-[13px] bg-milk ${className}`}
      aria-hidden="true"
    >
      <Pill look={look} form={form} />
    </span>
  );
}
