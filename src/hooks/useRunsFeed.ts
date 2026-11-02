// Connects a Poller to the page: tab visibility, visitor input, the window and whether this feed is the one on screen.
// The console polls only the active view's feed (the runs feed, or the AI feed on the AI usage view).
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { withTimeout } from '../lib/abort';
import { fetchAi, fetchRuns } from '../lib/api';
import type { WindowKey } from '../lib/filters';
import { FETCH_TIMEOUT_MS, oldestRunMs } from '../lib/pollPolicy';
import { Poller, type FeedPage, type PollSnapshot } from '../lib/poller';
import { parseInstant } from '../lib/time';
import type { AiPage, RunsPage } from '../lib/types';

/** Input counts as activity at most this often (pointermove fires constantly). */
const ACTIVITY_THROTTLE_MS = 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

const visibleNow = () => document.visibilityState === 'visible';

export interface Feed<P extends FeedPage> {
  snapshot: PollSnapshot<P>;
  retry: () => void;
  resume: () => void;
}
export type RunsFeed = Feed<RunsPage>;

function useFeed<P extends FeedPage>(
  load: (since: string | null, signal: AbortSignal) => Promise<P>, oldestMs: (page: P) => number | null, win: WindowKey, enabled: boolean,
): Feed<P> {
  const [poller] = useState(() => new Poller<P>({
    load: (since, signal) => load(since, withTimeout(signal, FETCH_TIMEOUT_MS)),
    oldestMs,
    now: () => Date.now(),
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (handle) => window.clearTimeout(handle as number),
  }, win, visibleNow()));

  const snapshot = useSyncExternalStore(poller.subscribe, poller.getSnapshot);

  // Before paint, so a widened window never shows the narrower data for a frame.
  useLayoutEffect(() => {
    poller.setWindow(win);
  }, [poller, win]);

  useEffect(() => {
    if (!enabled) return;
    poller.setVisible(visibleNow());
    poller.start();

    const onVisibility = () => poller.setVisible(visibleNow());
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last < ACTIVITY_THROTTLE_MS) return;
      last = now;
      poller.noteActivity();
    };
    document.addEventListener('visibilitychange', onVisibility);
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onActivity, { capture: true, passive: true });
    return () => {
      poller.stop();
      document.removeEventListener('visibilitychange', onVisibility);
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, onActivity, { capture: true });
    };
  }, [poller, enabled]);

  return { snapshot, retry: () => poller.retryNow(), resume: () => poller.noteActivity(true) };
}

const loadRuns = (since: string | null, signal: AbortSignal) => fetchRuns({ since, signal });
const loadAi = (since: string | null, signal: AbortSignal) => fetchAi({ since, signal });
const oldestCallMs = (page: AiPage) => (page.calls.length === 0 ? null : Math.min(...page.calls.map((c) => parseInstant(c.at))));

/** `enabled` is false off live data or on another view: the poller stops and asks Northstar nothing. */
export const useRunsFeed = (win: WindowKey, enabled: boolean): RunsFeed => useFeed(loadRuns, oldestRunMs, win, enabled);
export const useAiFeed = (win: WindowKey, enabled: boolean): Feed<AiPage> => useFeed(loadAi, oldestCallMs, win, enabled);
