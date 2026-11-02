// The AI usage view's words (phase 6.1b, board G1): the headline, each card's value and note, and its "How it's
// counted", built from the AI feed's description and aiMetrics.ts. DOM-free and tested, like kpis.ts. The noun comes
// from the feed ("chat"), so no sentence here names Northstar's assistant or its model.
import { AI_MAX_LIMIT } from './api';
import {
  MIN_MEDIAN_CALLS, aiBuckets, cost, errorRate, formatUsd, outcomeCounts, peakBucket, responseTimes, tokenTotals,
  type Bucket, type OutcomeCount, type ResponseTimes,
} from './aiMetrics';
import type { WindowKey } from './filters';
import { formatDuration, formatPercent, formatUtcDay, formatUtcMinute } from './format';
import { PERIOD } from './headline';
import type { HowCounted } from './kpis';
import { MIN_P95_RUNS, MIN_RATE_DENOMINATOR } from './metrics';
import type { AiCall, AiDescription, ModelPrice } from './types';

const n0 = (n: number) => n.toLocaleString('en-US');
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const seconds = (ms: number) => formatDuration(ms / 1000);
const noun = (ai: AiDescription, n: number) => (n === 1 ? ai.call.one : ai.call.many);

/** "$0.15", "$0.075": at least two decimals, never rounded. */
const perMillion = (usd: number) => `$${usd < 0.01 || !Number.isInteger(usd * 100) ? String(usd) : usd.toFixed(2)}`;

export interface AiScope {
  win: WindowKey;
  /** The answer's `now` (server time). */
  asOf: string;
  /** True when the feed cut this window at its limit: counts become lower bounds, rates and estimates are withheld. */
  partial: boolean;
}

export interface AiCard {
  label: string;
  value: string;
  /** False for a placeholder ("No median yet"), shown smaller and muted. */
  hasValue: boolean;
  note: string;
  how: HowCounted;
}

export interface AiView {
  headline: string;
  /** Under the header: where the rows come from and what a row is. */
  sourceLine: string;
  /** Set when the window is cut off or reaches past the retention. */
  windowNote: string | null;
  chats: AiCard & { buckets: Bucket[]; unit: string; peak: Bucket | null; peakText: string | null };
  times: AiCard & { stats: ResponseTimes; answeredMs: number[] };
  tokens: AiCard & { costValue: string | null; costNote: string; formula: string[] };
  outcomes: AiCard & { rows: OutcomeCount[] };
}

function source(scope: AiScope): string {
  const calls = scope.win === 'all' ? 'all its AI rows' : `AI rows from ${PERIOD[scope.win]}`;
  return `Source: Northstar's ops feed, ${calls}, as of ${formatUtcMinute(scope.asOf)}.`;
}

export function aiView(calls: AiCall[], ai: AiDescription, scope: AiScope): AiView {
  const n = calls.length;
  const more = scope.partial ? '+' : '';
  const period = scope.win === 'all' ? `the last ${ai.retention_days} days` : PERIOD[scope.win];
  const outcomes = outcomeCounts(calls, ai);
  const answered = outcomes.filter((o) => o.answered).reduce((s, o) => s + o.n, 0);
  const failed = n - answered;
  const err = errorRate(calls, ai);
  const times = responseTimes(calls, ai);
  const tokens = tokenTotals(calls);
  const est = cost(calls, ai);
  const { buckets, unit } = aiBuckets(calls, scope.win, Date.parse(scope.asOf));
  const peak = peakBucket(buckets);
  const withheld = 'Withheld: this window is cut off at the feed\'s limit.';

  let headline = `No ${ai.call.many} in ${period}.`;
  if (n > 0 && failed === 0) headline = `In ${period}, the model answered ${n === 1 ? `the one ${ai.call.one}` : `all ${n0(n)}${more} ${ai.call.many}`}.`;
  if (n > 0 && failed > 0) headline = `In ${period}, the model answered ${n0(answered)} of ${n0(n)}${more} ${ai.call.many}; ${n0(failed)} failed.`;

  const windowNote = scope.partial
    ? `Northstar returned only the newest ${n0(AI_MAX_LIMIT)} ${ai.call.many}, and this window has more. The counts are lower bounds; rates, times and the estimate are withheld. Choose a shorter window.`
    : scope.win === 'all' ? `All goes back ${ai.retention_days} days: Northstar keeps no older ${ai.call.many}.` : null;

  // ----- chats -----
  const chats: AiView['chats'] = {
    label: capital(ai.call.many),
    value: `${n0(n)}${more}`,
    hasValue: true,
    note: `n = ${n0(n)}${more} · ${period}`,
    buckets, unit, peak,
    peakText: peak === null ? null : `${peak.calls} on ${formatUtcDay(new Date(peak.startMs).toISOString()).replace(/ \d{4}$/, '')}`,
    how: {
      rule: `Every ${ai.call.one} the model was asked to answer, by when it was asked.`,
      working: `${n0(n)}${more} = ${n0(answered)} answered + ${n0(failed)} not answered`,
      notes: [
        `A request turned away before the model was called (busy, over a limit, or switched off) isn't recorded, so it isn't counted.`,
        `Bars are per ${unit}, on Northstar's clock; an empty ${unit} is a gap, not a zero line.`,
      ],
      source: source(scope),
    },
  };

  // ----- response time -----
  const enoughMedian = times.median !== null && !scope.partial;
  const enoughP95 = times.p95 !== null && !scope.partial;
  let timesValue = 'No median yet';
  if (enoughMedian) timesValue = `${seconds(times.median ?? 0)} median`;
  if (enoughMedian && enoughP95) timesValue = `${seconds(times.median ?? 0)} median · ${seconds(times.p95 ?? 0)} 95th percentile`;
  const timeNote = [
    `over ${n0(times.n)} answered ${noun(ai, times.n)}`,
    enoughP95 && times.small ? 'a small sample: the slowest one or two set the 95th' : null,
    !enoughP95 && enoughMedian ? `a 95th percentile needs ${MIN_P95_RUNS} (${n0(times.n)} so far)` : null,
    !enoughMedian && !scope.partial ? `a median needs ${MIN_MEDIAN_CALLS}` : null,
  ].filter((x) => x !== null).join(' · ');
  const answeredMs = calls.filter((c) => outcomes.some((o) => o.answered && o.code === c.outcome)).map((c) => c.latency_ms).sort((a, b) => a - b);
  const timesCard: AiView['times'] = {
    label: 'Response time',
    value: scope.partial ? 'Withheld' : timesValue,
    hasValue: !scope.partial && enoughMedian,
    note: scope.partial ? withheld : timeNote,
    stats: times, answeredMs,
    how: {
      rule: `For answered ${ai.call.many} only: the model's time from the question to the answer. Median and 95th percentile by nearest rank, the value at position ⌈p × n⌉ when the times are sorted.`,
      working: enoughP95
        ? `n = ${times.n} → median at position ${times.medianRank} → ${seconds(times.median ?? 0)}; 95th at position ${times.p95Rank} → ${seconds(times.p95 ?? 0)}`
        : enoughMedian ? `n = ${times.n} → median at position ${times.medianRank} → ${seconds(times.median ?? 0)}` : `${times.n} of the ${MIN_MEDIAN_CALLS} answered ${ai.call.many} a median needs.`,
      notes: [
        `A ${ai.call.one} that wasn't answered is timed until it failed (a timeout at ${ai.timeout_s} s), so it's left out.`,
        `A median needs ${MIN_MEDIAN_CALLS} answered ${ai.call.many} and a 95th percentile ${MIN_P95_RUNS} (demo thresholds): fewer would swing with every new one.`,
      ],
      source: source(scope),
    },
  };

  // ----- tokens and cost -----
  const withTokens = n - tokens.without;
  const perCall = withTokens === 0 ? null : `about ${n0(Math.round(tokens.in / withTokens))} in and ${n0(Math.round(tokens.out / withTokens))} out per ${ai.call.one}`;
  const formula: string[] = [];
  for (const l of est.lines) {
    formula.push(`${n0(l.tokensIn)} in × ${perMillion(l.price.usd_per_m_in)} per 1M + ${n0(l.tokensOut)} out × ${perMillion(l.price.usd_per_m_out)} per 1M = ${formatUsd(l.usdIn)} + ${formatUsd(l.usdOut)} = ${formatUsd(l.usdIn + l.usdOut)}`);
  }
  const priced = (p: ModelPrice) => (p.priced_on === null ? `${p.name} (${p.source})` : `${p.name}, priced ${formatUtcDay(`${p.priced_on}T00:00:00Z`)} (${p.source})`);
  if (est.lines.length > 0) formula.push(`Prices from the feed: ${est.lines.map((l) => priced(l.price)).join('; ')}.`);
  for (const u of est.unpriced) formula.push(`No price in the feed for ${n0(u.calls)} ${noun(ai, u.calls)} (model ${u.model}): counted in ${ai.call.many} and tokens, left out of the estimate.`);
  const tokensCard: AiView['tokens'] = {
    label: 'Tokens and cost',
    value: `${n0(tokens.in + tokens.out)}${more} tokens`,
    hasValue: true,
    note: [`${n0(tokens.in)} in · ${n0(tokens.out)} out`, perCall].filter((x) => x !== null).join(' · '),
    costValue: scope.partial || est.lines.length === 0 ? null : formatUsd(est.usd),
    costNote: scope.partial ? 'withheld' : est.lines.length === 0 ? 'no prices in the feed' : 'at most: assumes no cached tokens',
    formula: scope.partial ? [] : formula,
    how: {
      rule: 'Tokens are what the model was sent (the prompt and the question) and what it sent back. The estimate multiplies each model\'s tokens by its list price per 1M tokens, as the feed states it.',
      working: scope.partial ? withheld : (formula[0] ?? 'No priced calls in this window.'),
      notes: [
        'List prices, without any discount for cached input: the rows don\'t say which tokens were cached, so the estimate is an upper bound.',
        `${capital(ai.call.many)} that weren't answered carry no token counts.`,
      ],
      source: source(scope),
    },
  };

  // ----- outcomes -----
  const outcomesCard: AiView['outcomes'] = {
    label: 'Outcomes',
    value: `${n0(failed)}${failed === 0 ? '' : more} ${failed === 1 ? 'error' : 'errors'}`,
    hasValue: true,
    note: scope.partial ? withheld : err.enough ? `error rate ${formatPercent(err.numerator, err.denominator)} · ${n0(err.numerator)} of ${n0(err.denominator)} ${ai.call.many}` : `a rate needs ${MIN_RATE_DENOMINATOR} ${ai.call.many} (demo threshold)`,
    rows: outcomes,
    how: {
      rule: `Every outcome the feed describes, with its count. The error rate is the ${ai.call.many} that weren't answered ÷ all ${ai.call.many}.`,
      working: err.enough && !scope.partial ? `${n0(err.numerator)} ÷ ${n0(err.denominator)} = ${formatPercent(err.numerator, err.denominator)}` : `${n0(n)} of the ${MIN_RATE_DENOMINATOR} ${ai.call.many} a rate needs.`,
      notes: [
        `A ${ai.call.one} still waiting after ${ai.timeout_s} s counts as not answered.`,
        `A rate needs ${MIN_RATE_DENOMINATOR} ${ai.call.many} (demo threshold): from fewer, one more would swing it by 20 points.`,
      ],
      source: source(scope),
    },
  };

  return {
    headline,
    sourceLine: `Northstar's ops feed, AI rows · a row is one question the model was asked to answer · kept ${ai.retention_days} days`,
    windowNote,
    chats, times: timesCard, tokens: tokensCard, outcomes: outcomesCard,
  };
}
