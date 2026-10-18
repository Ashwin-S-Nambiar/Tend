const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function buzz(pattern: number | number[]) {
  if (still() || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {}
}

export const haptic = {
  tap: () => buzz(8),
  tick: () => buzz(4),
  success: () => buzz([10, 40, 14]),
  warn: () => buzz([24, 60, 24]),
};
