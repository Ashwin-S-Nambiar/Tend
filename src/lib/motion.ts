import { useLayoutEffect, useRef } from 'react';

export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const reducedMotion = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches;

// A critically damped spring. Retargeting preserves the current position and velocity.
export function spring(
  render: (value: number) => void,
  initial = 0,
  response = 0.32,
) {
  let value = initial;
  let velocity = 0;
  let frame = 0;
  let target = initial;
  let precision = 0.1;
  let last = 0;
  let complete: (() => void) | undefined;
  const omega = (2 * Math.PI) / response;
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    complete = undefined;
  }
  function tick(now: number) {
    const dt = Math.min((now - last) / 1000, 0.064);
    last = now;
    const x = value - target;
    const c = velocity + omega * x;
    const decay = Math.exp(-omega * dt);
    value = target + (x + c * dt) * decay;
    velocity = (velocity - omega * c * dt) * decay;
    if (
      reducedMotion() ||
      (Math.abs(value - target) < precision &&
        (precision >= 1 || Math.abs(velocity) < 1))
    ) {
      value = target;
      velocity = 0;
      frame = 0;
      render(value);
      const done = complete;
      complete = undefined;
      done?.();
    } else {
      render(value);
      frame = requestAnimationFrame(tick);
    }
  }
  return {
    get value() {
      return value;
    },
    get velocity() {
      return velocity;
    },
    stop,
    set(next: number, speed = 0) {
      stop();
      value = target = next;
      velocity = speed;
      render(value);
    },
    to(
      next: number,
      options: {
        velocity?: number;
        precision?: number;
        onComplete?: () => void;
      } = {},
    ) {
      target = next;
      precision = options.precision ?? 0.1;
      velocity = options.velocity ?? velocity;
      complete = options.onComplete;
      if (reducedMotion()) {
        stop();
        value = target;
        velocity = 0;
        render(value);
        options.onComplete?.();
        return;
      }
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    },
  };
}

export type Spring = ReturnType<typeof spring>;

export function presentation(el: HTMLElement) {
  const style = getComputedStyle(el);
  const transform = new DOMMatrixReadOnly(
    style.transform === 'none' ? undefined : style.transform,
  );
  return {
    x: transform.m41,
    y: transform.m42,
    opacity: Number(style.opacity),
    transform: style.transform,
  };
}

export function cancelAnimations(el: HTMLElement) {
  for (const animation of el.getAnimations()) animation.cancel();
}

export function project(velocity: number) {
  // Exponential momentum projection; velocity is in pixels per second.
  return ((velocity / 1000) * 0.99) / (1 - 0.99);
}

export function rubberband(distance: number, dimension: number) {
  return (
    (distance * dimension * 0.55) / (dimension + 0.55 * Math.abs(distance))
  );
}

export function enter(el: HTMLElement, direction: -1 | 0 | 1 = 0) {
  cancelAnimations(el);
  return el.animate(
    reducedMotion()
      ? [{ opacity: 0.75 }, { opacity: 1 }]
      : [
          { opacity: 0.65, transform: `translateX(${direction * 16}px)` },
          { opacity: 1, transform: 'translateX(0)' },
        ],
    { duration: reducedMotion() ? 100 : 220, easing: EASE },
  );
}

// Animate a changed content region, keeping its surrounding controls stationary.
export function useContentMotion(key: string | number) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(key);
  useLayoutEffect(() => {
    if (previous.current !== key && ref.current)
      enter(ref.current, key > previous.current ? 1 : -1);
    previous.current = key;
  }, [key]);
  return ref;
}
