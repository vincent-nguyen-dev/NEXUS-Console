// Time buckets across a window, oldest first, on the server's clock: hours for 24 h, days otherwise, and All widens
// its days to keep at most MAX_BARS bars. Empty buckets are kept, so a chart shows gaps. Shared by the AI usage view's
// bars and the Retries view's failed tries per day.
import type { WindowKey } from './filters';
import { MAX_BARS } from './perDay';
import { windowStartMs } from './pollPolicy';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export interface TimeBuckets {
  /** Each bucket's start (ms), oldest first. */
  starts: number[];
  /** "hour", "day", or "3 days" for a wide All. */
  unit: string;
  /** The bucket a time falls in, or -1 outside the span. */
  indexOf: (ms: number) => number;
}

/** `times` are the moments to place (ms); All starts at the oldest of them. */
export function timeBuckets(times: number[], win: WindowKey, serverNowMs: number): TimeBuckets {
  const size = win === '24h' ? HOUR : DAY;
  const floor = (ms: number) => Math.floor(ms / size) * size;
  const start = windowStartMs(win, serverNowMs) ?? Math.min(serverNowMs, ...times);
  const first = floor(Math.min(start, ...times));
  const last = floor(serverNowMs);
  const per = Math.ceil(((last - first) / size + 1) / MAX_BARS);
  const width = size * per;
  const starts: number[] = [];
  for (let t = first; t <= last; t += width) starts.push(t);
  return {
    starts,
    unit: win === '24h' ? 'hour' : per > 1 ? `${per} days` : 'day',
    indexOf: (ms) => {
      const i = Math.floor((ms - first) / width);
      return i >= 0 && i < starts.length ? i : -1;
    },
  };
}
