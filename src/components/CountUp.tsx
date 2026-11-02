// A number that counts to its new value when a poll changes it ("18" → "19", "50%" → "53%"). Never on mount:
// a remount (a new window, filter or source) shows the value at once. Other values switch at once too.
import { useEffect, useRef, useState } from 'react';

const NUMERIC = /^(\d+)(%?)$/;
const DURATION_MS = 600;

export function CountUp({ value }: { value: string }) {
  const [shown, setShown] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    const from = NUMERIC.exec(previous.current);
    const to = NUMERIC.exec(value);
    previous.current = value;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!from || !to || from[2] !== to[2] || from[1] === to[1] || still) {
      setShown(value);
      return;
    }
    const a = Number(from[1]);
    const b = Number(to[1]);
    const suffix = to[2] ?? '';
    const t0 = performance.now();
    let frame = requestAnimationFrame(function step(t) {
      const k = Math.min(1, (t - t0) / DURATION_MS);
      setShown(`${Math.round(a + (b - a) * (1 - (1 - k) ** 3))}${suffix}`);
      if (k < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);
  // The final value for assistive tech; the counting digits are decoration.
  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{value}</span>
    </>
  );
}
