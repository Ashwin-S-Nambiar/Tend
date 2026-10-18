const PATHS = {
  today: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </>
  ),
  meds: (
    <rect
      x="8"
      y="3"
      width="8"
      height="18"
      rx="4"
      transform="rotate(-30 12 12)"
    />
  ),
  history: <path d="M5 19v-7M10 19V6M15 19v-5M20 19V9" />,
  routines: (
    <>
      <circle cx="12" cy="13" r="3.5" />
      <path d="M12 4v2M4.5 13h2M17.5 13h2M6.7 7.7l1.4 1.4M17.3 7.7l-1.4 1.4M4 19h16" />
    </>
  ),
  you: (
    <>
      <circle cx="12" cy="9" r="4" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  more: (
    <>
      <circle cx="6" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="18" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  next: <path d="m9 5 7 7-7 7" />,
  snooze: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5V13l2 1.5M5 4.5 3 6.5M19 4.5l2 2" />
    </>
  ),
  skip: <path d="M6 12h12" />,
  bell: (
    <>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  share: (
    <>
      <path d="M12 15V4M8 8l4-4 4 4" />
      <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M8 11l4 4 4-4" />
      <path d="M5 19h14" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4M8 8l4-4 4 4" />
      <path d="M5 19h14" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="3.5" />
      <path d="M8 3.5v4M16 3.5v4M4 10.5h16" />
    </>
  ),
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1 1M17.4 17.4l1 1M5.6 18.4l1-1M17.4 6.6l1-1" />
    </>
  ),
  sound: (
    <>
      <path d="M5 10v4h3l4 3.5v-11L8 10z" />
      <path d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" />
    </>
  ),
  mute: (
    <>
      <path d="M5 10v4h3l4 3.5v-11L8 10z" />
      <path d="m16 10 4 4M20 10l-4 4" />
    </>
  ),
  edit: <path d="M5 19l1-4L15.5 5.5a2 2 0 0 1 3 3L9 18zM13.5 7.5l3 3" />,
  archive: (
    <>
      <rect x="4" y="5" width="16" height="4" rx="1.5" />
      <path d="M5.5 9v8.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9M10 13h4" />
    </>
  ),
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />,
  refill: (
    <>
      <path d="M19 12a7 7 0 1 1-2.1-5" />
      <path d="M19 4.5V8h-3.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="3" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.5 2.5 3.5 5 3.5 8s-1 5.5-3.5 8c-2.5-2.5-3.5-5-3.5-8s1-5.5 3.5-8Z" />
    </>
  ),
  offline: (
    <>
      <path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 9 4.5 4.5 0 0 0 7 18Z" />
      <path d="M4 4l16 16" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="3" />
      <path d="M5 15V7a2 2 0 0 1 2-2h8" />
    </>
  ),
  card: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="3.5" />
      <path d="M7.5 10h5M7.5 14h9" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4h3" />
    </>
  ),
  keyboard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  size = 24,
  className = '',
  stroke = 2,
}: {
  name: IconName;
  size?: number;
  className?: string;
  stroke?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
