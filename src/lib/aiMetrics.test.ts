import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/ai-page.json';
import { aiBuckets, callsInWindow, cost, errorRate, formatUsd, outcomeCounts, peakBucket, responseTimes, tokenTotals } from './aiMetrics';
import { parseAiPage } from './api';
import { parseInstant } from './time';
import type { AiCall, AiDescription } from './types';

// Northstar's AI feed as frozen on 31 Oct 2026, 08:53 UTC: 25 calls from 23 to 30 Oct, all answered.
const PAGE = parseAiPage(fixture.page);
const NOW = parseInstant(PAGE.now);
const AI = PAGE.ai;

// A made-up second system, to show nothing here knows Northstar's codes or models.
const OTHER: AiDescription = {
  version: 1, call: { one: 'summary', many: 'summaries' }, timeout_s: 20, retention_days: 30,
  outcomes: [{ code: 'done', label: 'summarised', answered: true }, { code: 'refused', label: 'refused', answered: false }, { code: 'late', label: 'too slow', answered: false }],
  models: [{ name: 'model-a', usd_per_m_in: 1, usd_per_m_out: 2, priced_on: '2026-10-01', source: 'a price list' }],
};
const call = (patch: Partial<AiCall>): AiCall => ({ at: '2026-10-30T10:00:00+00:00', model: 'model-a', tokens_in: 100, tokens_out: 10, latency_ms: 1000, outcome: 'done', ...patch });

describe('the frozen feed of 31 Oct (hand-checked)', () => {
  const in30 = callsInWindow(PAGE.calls, '30d', NOW);

  it('counts 25 calls in 30 days, 8 in 7 days, 1 in 24 hours', () => {
    expect(in30).toHaveLength(25);
    expect(callsInWindow(PAGE.calls, '7d', NOW)).toHaveLength(8); // from 24 Oct 08:53: most of that day's 16 came earlier
    expect(callsInWindow(PAGE.calls, '24h', NOW)).toHaveLength(1);
    expect(callsInWindow(PAGE.calls, 'all', NOW)).toHaveLength(25);
  });

  it('times the 25 answered calls: median 2,099 ms (position 13), 95th percentile 4,154 ms (position 24)', () => {
    expect(responseTimes(in30, AI)).toEqual({ n: 25, median: 2099, p95: 4154, medianRank: 13, p95Rank: 24, small: true });
  });

  it('gives 7 days a median (position 4 of 8: 2,975 ms) but no 95th percentile, and 24 hours neither', () => {
    expect(responseTimes(callsInWindow(PAGE.calls, '7d', NOW), AI)).toMatchObject({ n: 8, median: 2975, p95: null, medianRank: 4 });
    expect(responseTimes(callsInWindow(PAGE.calls, '24h', NOW), AI)).toMatchObject({ n: 1, median: null, p95: null });
  });

  it('adds the tokens: 37,335 in, 2,128 out', () => {
    expect(tokenTotals(in30)).toEqual({ in: 37335, out: 2128, without: 0 });
  });

  it('estimates the cost from the feed\'s prices: $0.0056 + $0.0013 = $0.0069', () => {
    const c = cost(in30, AI);
    expect(c.unpriced).toEqual([]);
    expect(c.lines).toHaveLength(1);
    expect(c.lines[0]?.usdIn).toBeCloseTo(0.00560025, 10); // 37,335 × $0.15 / 1M
    expect(c.lines[0]?.usdOut).toBeCloseTo(0.0012768, 10); // 2,128 × $0.60 / 1M
    expect(c.usd).toBeCloseTo(0.00687705, 10);
    expect([formatUsd(c.lines[0]?.usdIn ?? 0), formatUsd(c.lines[0]?.usdOut ?? 0), formatUsd(c.usd)]).toEqual(['$0.0056', '$0.0013', '$0.0069']);
  });

  it('counts every outcome the description names, and no errors', () => {
    expect(outcomeCounts(in30, AI).map((o) => [o.label, o.n])).toEqual([['answered', 25], ['AI service error', 0], ['timed out', 0]]);
    expect(errorRate(in30, AI)).toEqual({ numerator: 0, denominator: 25, enough: true });
  });

  it('draws 31 days for 30 d (the partial first day included), with 16 on 24 Oct as the peak', () => {
    const { buckets, unit } = aiBuckets(in30, '30d', NOW);
    expect(unit).toBe('day');
    expect(buckets).toHaveLength(31);
    expect(buckets.reduce((s, b) => s + b.calls, 0)).toBe(25);
    const peak = peakBucket(buckets);
    expect(peak && new Date(peak.startMs).toISOString().slice(0, 10)).toBe('2026-10-24');
    expect(peak?.calls).toBe(16);
    expect(buckets.filter((b) => b.calls === 1)).toHaveLength(6); // 23 Oct and 26–30 Oct
  });
});

describe('any system, by its description', () => {
  it('times only the outcomes the description says answered', () => {
    const calls = [...Array.from({ length: 5 }, (_, i) => call({ latency_ms: 1000 + i })), call({ outcome: 'late', latency_ms: 20000, tokens_in: null, tokens_out: null })];
    expect(responseTimes(calls, OTHER)).toMatchObject({ n: 5, median: 1002 });
    expect(errorRate(calls, OTHER)).toEqual({ numerator: 1, denominator: 6, enough: true });
    expect(tokenTotals(calls)).toEqual({ in: 500, out: 50, without: 1 });
  });

  it('withholds a rate below 5 calls and a median below 5 answered calls', () => {
    const calls = Array.from({ length: 4 }, () => call({}));
    expect(errorRate(calls, OTHER).enough).toBe(false);
    expect(responseTimes(calls, OTHER).median).toBeNull();
  });

  it('leaves a model without a price out of the estimate, and counts it', () => {
    const c = cost([call({}), call({ model: 'model-b' }), call({ model: 'model-b' })], OTHER);
    expect(c.unpriced).toEqual([{ model: 'model-b', calls: 2 }]);
    expect(c.usd).toBeCloseTo((100 * 1 + 10 * 2) / 1_000_000, 12);
  });

  it('marks the 95th percentile as a small sample below 40 answered calls', () => {
    expect(responseTimes(Array.from({ length: 39 }, () => call({})), OTHER)).toMatchObject({ p95: 1000, small: true });
    expect(responseTimes(Array.from({ length: 40 }, () => call({})), OTHER).small).toBe(false);
  });

  it('has no peak when every day with calls is equal', () => {
    const { buckets } = aiBuckets([call({ at: '2026-10-29T10:00:00+00:00' }), call({})], '7d', parseInstant('2026-10-31T00:00:00+00:00'));
    expect(peakBucket(buckets)).toBeNull();
    expect(peakBucket(aiBuckets([], '7d', parseInstant('2026-10-31T00:00:00+00:00')).buckets)).toBeNull();
  });
});

describe('formatUsd', () => {
  it('keeps four decimals under a cent, two above, and never rounds a small cost up', () => {
    expect(formatUsd(0)).toBe('$0');
    expect(formatUsd(0.00004)).toBe('under $0.0001');
    expect(formatUsd(0.00687705)).toBe('$0.0069');
    expect(formatUsd(0.0099)).toBe('$0.0099');
    expect(formatUsd(1.234)).toBe('$1.23');
    expect(() => formatUsd(-1)).toThrow();
  });
});
