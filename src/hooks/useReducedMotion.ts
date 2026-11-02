// Whether the visitor asked for reduced motion, kept current: turning the setting on or off applies at once, not on
// the next visit (step 7.1d, F11). The canvas and band loops listen to the same media query themselves.
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (change: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', change);
  return () => mq.removeEventListener('change', change);
};

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
