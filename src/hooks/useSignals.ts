// Which tracks get a one-off highlight: events new since the previous page of the same window.
// A new window, mode or the first page resets the comparison, so nothing lights up on load.
import { useState } from 'react';
import { newSignals } from '../lib/map';
import type { RunsPage } from '../lib/types';

export interface Signals {
  keys: Set<string>;
  /** Changes with every new set, so the highlight replays. */
  id: number;
}

const NONE: Signals = { keys: new Set(), id: 0 };

export function useSignals(page: RunsPage | null, scope: string): Signals {
  const [seen, setSeen] = useState<{ page: RunsPage | null; scope: string; signals: Signals }>({ page, scope, signals: NONE });
  if (seen.page !== page || seen.scope !== scope) {
    // Derived during render (React's "previous props" pattern), not in an effect.
    const keys = seen.scope === scope && page !== null ? newSignals(seen.page, page) : new Set<string>();
    const signals = keys.size > 0 ? { keys, id: seen.signals.id + 1 } : { keys, id: seen.signals.id };
    setSeen({ page, scope, signals });
    return signals;
  }
  return seen.signals;
}
