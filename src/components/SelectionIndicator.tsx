import { useLayoutEffect, useRef } from 'react';
import { type Spring, spring } from '../lib/motion.ts';

export default function SelectionIndicator({
  value,
  selector,
  className = '',
}: {
  value: string | null;
  selector: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const axes = useRef<{ x: Spring; y: Spring } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const position = { x: 0, y: 0 };
    const render = () => {
      el.style.transform = `translate3d(${position.x}px,${position.y}px,0)`;
    };
    axes.current = {
      x: spring((value) => {
        position.x = value;
        render();
      }),
      y: spring((value) => {
        position.y = value;
        render();
      }),
    };
    const align = (immediate: boolean) => {
      const target = parent.querySelector<HTMLElement>(selector);
      el.hidden = !target;
      if (!target || !axes.current) return;
      const bounds = parent.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;
      const x = rect.left - bounds.left + parent.scrollLeft;
      const y = rect.top - bounds.top + parent.scrollTop;
      if (immediate) {
        axes.current.x.set(x);
        axes.current.y.set(y);
      } else {
        axes.current.x.to(x);
        axes.current.y.to(y);
      }
    };
    align(true);
    const observer = new ResizeObserver(() => align(true));
    observer.observe(parent);
    const change = () => align(false);
    parent.addEventListener('selectionchange', change);
    return () => {
      observer.disconnect();
      parent.removeEventListener('selectionchange', change);
      axes.current?.x.stop();
      axes.current?.y.stop();
      axes.current = null;
    };
  }, [selector]);
  useLayoutEffect(() => {
    if (value !== undefined)
      ref.current?.parentElement?.dispatchEvent(new Event('selectionchange'));
  }, [value]);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={`selection-indicator left-0 top-0 ${className}`}
    />
  );
}
