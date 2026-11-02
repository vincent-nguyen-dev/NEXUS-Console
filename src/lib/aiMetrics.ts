// The AI usage view's numbers (phase 6.1), from the AI feed and its description. DOM-free. NEXUS knows no model and
// no outcome by name: which outcome answered, every label and every price come from the description (`AiDescription`).
// Response times count answered calls only: a failed call's time is the time until it failed (a timeout's is the
// timeout), not a response.
import { timeBuckets } from './buckets';
import type { WindowKey } from './filters';
import { MIN_P95_RUNS, MIN_RATE_DENOMINATOR, SMALL_P95_RUNS, nearestRank } from './metrics';
import { windowStartMs } from './pollPolicy';
import { parseInstant } from './time';
import type { AiCall, AiDescription, ModelPrice } from './types';

const MILLION = 1_000_000;

/** A median needs this many answered calls, a 95th percentile MIN_P95_RUNS (demo thresholds, as on the console). */
export const MIN_MEDIAN_CALLS = MIN_RATE_DENOMINATOR;

/** Calls at or after the window's start on the server's clock (the rule `since` applies on the server). */
export function callsInWindow(calls: AiCall[], win: WindowKey, serverNowMs: number): AiCall[] {
  const start = windowStartMs(win, serverNowMs);
  return start === null ? calls : calls.filter((c) => parseInstant(c.at) >= start);
}

export interface OutcomeCount { code: string; label: string; answered: boolean; n: number }

/** Calls per outcome, in the description's order (outcomes with no calls included, at 0). */
export function outcomeCounts(calls: AiCall[], ai: AiDescription): OutcomeCount[] {
  return ai.outcomes.map((o) => ({ ...o, n: calls.filter((c) => c.outcome === o.code).length }));
}

const answeredCodes = (ai: AiDescription) => new Set(ai.outcomes.filter((o) => o.answered).map((o) => o.code));

/** Calls that weren't answered ÷ all calls; `rate` only once there are MIN_RATE_DENOMINATOR calls. */
export function errorRate(calls: AiCall[], ai: AiDescription): { numerator: number; denominator: number; enough: boolean } {
  const ok = answeredCodes(ai);
  const numerator = calls.filter((c) => !ok.has(c.outcome)).length;
  return { numerator, denominator: calls.length, enough: calls.length >= MIN_RATE_DENOMINATOR };
}

export interface ResponseTimes {
  /** Answered calls timed. */
  n: number;
  /** Milliseconds, or null below the minimum. */
  median: number | null;
  p95: number | null;
  /** Nearest-rank positions, for "position 13 of 25". */
  medianRank: number;
  p95Rank: number;
  /** True while n < SMALL_P95_RUNS: the slowest one or two set the 95th percentile. */
  small: boolean;
}

const rankOf = (p: number, n: number) => Math.floor((p * n + 99) / 100);

export function responseTimes(calls: AiCall[], ai: AiDescription): ResponseTimes {
  const ok = answeredCodes(ai);
  const ms = calls.filter((c) => ok.has(c.outcome)).map((c) => c.latency_ms);
  const n = ms.length;
  return {
    n,
    median: n >= MIN_MEDIAN_CALLS ? (nearestRank(ms, 50) ?? null) : null,
    p95: n >= MIN_P95_RUNS ? (nearestRank(ms, 95) ?? null) : null,
    medianRank: rankOf(50, n),
    p95Rank: rankOf(95, n),
    small: n < SMALL_P95_RUNS,
  };
}

export interface Tokens { in: number; out: number; /** Calls that carry no token counts (failed ones). */ without: number }

export function tokenTotals(calls: AiCall[]): Tokens {
  let tin = 0, tout = 0, without = 0;
  for (const c of calls) {
    if (c.tokens_in === null || c.tokens_out === null) without += 1;
    tin += c.tokens_in ?? 0;
    tout += c.tokens_out ?? 0;
  }
  return { in: tin, out: tout, without };
}

export interface CostLine { price: ModelPrice; calls: number; tokensIn: number; tokensOut: number; usdIn: number; usdOut: number }
export interface Unpriced { model: string; calls: number }
export interface Cost {
  /** The estimate in US dollars over priced calls: list prices, no cached-token discount (an upper bound). */
  usd: number;
  lines: CostLine[];
  /** Models the description doesn't price: counted in calls and tokens, left out of `usd`. */
  unpriced: Unpriced[];
}

export function cost(calls: AiCall[], ai: AiDescription): Cost {
  const prices = new Map(ai.models.map((m) => [m.name, m]));
  const lines = new Map<string, CostLine>();
  const unpriced = new Map<string, number>();
  for (const c of calls) {
    const price = prices.get(c.model);
    if (price === undefined) {
      unpriced.set(c.model, (unpriced.get(c.model) ?? 0) + 1);
      continue;
    }
    const line = lines.get(c.model) ?? { price, calls: 0, tokensIn: 0, tokensOut: 0, usdIn: 0, usdOut: 0 };
    line.calls += 1;
    line.tokensIn += c.tokens_in ?? 0;
    line.tokensOut += c.tokens_out ?? 0;
    lines.set(c.model, line);
  }
  const done = [...lines.values()].map((l) => ({
    ...l, usdIn: (l.tokensIn * l.price.usd_per_m_in) / MILLION, usdOut: (l.tokensOut * l.price.usd_per_m_out) / MILLION,
  }));
  return {
    usd: done.reduce((s, l) => s + l.usdIn + l.usdOut, 0),
    lines: done,
    unpriced: [...unpriced.entries()].map(([model, n]) => ({ model, calls: n })),
  };
}

/** Dollars as the view shows them: under a cent with four decimals ("$0.0069"), never rounded up to "$0.01". */
export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd < 0) throw new RangeError(`not an amount: ${usd}`);
  if (usd === 0) return '$0';
  if (usd < 0.0001) return 'under $0.0001';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export interface Bucket { startMs: number; calls: number; tokensIn: number; tokensOut: number }

/**
 * Calls per bucket across the window, oldest first, by when each call was made, on the server's clock: hours for
 * 24 h, days otherwise (All widens to keep at most MAX_BARS bars). Empty buckets are kept, at 0, so gaps show.
 */
export function aiBuckets(calls: AiCall[], win: WindowKey, serverNowMs: number): { buckets: Bucket[]; unit: string } {
  const times = calls.map((c) => parseInstant(c.at));
  const span = timeBuckets(times, win, serverNowMs);
  const buckets: Bucket[] = span.starts.map((startMs) => ({ startMs, calls: 0, tokensIn: 0, tokensOut: 0 }));
  calls.forEach((c, i) => {
    const b = buckets[span.indexOf(times[i] ?? 0)];
    if (!b) return;
    b.calls += 1;
    b.tokensIn += c.tokens_in ?? 0;
    b.tokensOut += c.tokens_out ?? 0;
  });
  return { buckets, unit: span.unit };
}

/** The busiest bucket, for the chart's callout; null without calls, or when every bucket is equal. */
export function peakBucket(buckets: Bucket[]): Bucket | null {
  const max = Math.max(0, ...buckets.map((b) => b.calls));
  const top = buckets.filter((b) => b.calls === max);
  return max === 0 || top.length === buckets.filter((b) => b.calls > 0).length ? null : (top[0] ?? null);
}
