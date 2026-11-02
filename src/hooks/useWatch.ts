// The watch for the visitor's own enquiry: when it started (server clock), kept in this tab's sessionStorage
// so a reload keeps it. Never in the URL, so a shared link doesn't start one.
import { useCallback, useState } from 'react';
import type { PrefStorage } from '../lib/prefs';
import { clearWatch, readWatch, saveWatch } from '../lib/watch';

function tabStorage(): PrefStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export interface Watch {
  sinceMs: number | null;
  start: (serverNowMs: number) => void;
  stop: () => void;
}

export function useWatch(): Watch {
  const [sinceMs, setSince] = useState(() => readWatch(tabStorage()));
  const start = useCallback((ms: number) => {
    saveWatch(tabStorage(), ms);
    setSince(ms);
  }, []);
  const stop = useCallback(() => {
    clearWatch(tabStorage());
    setSince(null);
  }, []);
  return { sinceMs, start, stop };
}
