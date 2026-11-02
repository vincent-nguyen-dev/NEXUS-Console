// The Runs tile's sparkline: runs per bucket across the window, by when each run was created (the same rule as
// the window), on the server's clock. Bars, never a line, so a handful of runs doesn't read as a trend.
import type { WindowKey } from './filters';
import { parseInstant } from './time';
import type { Run } from './types';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
/** All runs never draw more bars than this: the buckets widen to whole days. */
export const MAX_BARS = 60;

export interface Bars {
  /** One count per bucket, oldest first; empty buckets are 0. */
  counts: number[];
  /** "hour", "day", or "3 days" for a wide All. */
  unit: string;
  /** The runs counted (always every run passed in). */
  n: number;
}

/** Null below 2 runs: one bar says nothing a count doesn't. */
export function perDay(runs: Run[], win: WindowKey, serverNowMs: number): Bars | null {
  if (runs.length < 2) return null;
  const created = runs.map((r) => parseInstant(r.created_at));
  const size = win === '24h' ? HOUR : DAY;
  const floor = (ms: number) => Math.floor(ms / size) * size;
  const spanStart: Record<WindowKey, number> = {
    '24h': serverNowMs - DAY, '7d': serverNowMs - 7 * DAY, '30d': serverNowMs - 30 * DAY, all: Math.min(...created),
  };
  const first = floor(Math.min(spanStart[win], ...created));
  const last = floor(Math.max(serverNowMs, ...created));
  const buckets = (last - first) / size + 1;
  const per = Math.ceil(buckets / MAX_BARS);
  const counts = new Array<number>(Math.ceil(buckets / per)).fill(0);
  for (const ms of created) {
    const i = Math.floor((floor(ms) - first) / size / per);
    counts[i] = (counts[i] ?? 0) + 1;
  }
  let unit = win === '24h' ? 'hour' : 'day';
  if (per > 1) unit = `${per} days`;
  return { counts, unit, n: runs.length };
}
