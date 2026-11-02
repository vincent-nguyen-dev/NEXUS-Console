// The landing page's one request to Northstar: it fills the status chip and wakes Render while the
// visitor reads, so the console is ready when they open it. At most one retry, and never a poll.
import { useEffect, useState } from 'react';
import { withTimeout } from '../lib/abort';
import { ApiError, fetchRuns } from '../lib/api';
import { LANDING_RETRY_MS, LANDING_WINDOW, shouldRetry, type LandingFeed } from '../lib/landing';
import { FETCH_TIMEOUT_MS, sinceFor } from '../lib/pollPolicy';

export function useLandingFeed(): LandingFeed {
  const [feed, setFeed] = useState<LandingFeed>(() => ({ kind: 'loading', startedAt: Date.now() }));

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    const ask = (retriesDone: number) => {
      fetchRuns({ since: sinceFor(LANDING_WINDOW, Date.now(), 0), signal: withTimeout(controller.signal, FETCH_TIMEOUT_MS) })
        .then((page) => setFeed({ kind: 'ok', page, receivedAt: Date.now() }))
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          // A timeout is no answer at all, the same as a network failure.
          const kind = e instanceof ApiError ? e.kind : 'network';
          if (kind === 'refused') {
            setFeed({ kind: 'preview' });
          } else if (shouldRetry(kind, retriesDone)) {
            setFeed({ kind: 'retrying' });
            timer = window.setTimeout(() => ask(retriesDone + 1), LANDING_RETRY_MS);
          } else {
            setFeed({ kind: 'failed' });
          }
        });
    };
    ask(0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  return feed;
}
