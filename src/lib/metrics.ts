// Every number NEXUS shows, with its n and the reason when there isn't enough data.
// Definitions: docs/plan.md, "Decisions of 2026-10-23". Failures are counted by `failed` events,
// never by attempts > 1: a worker's lease can expire and retry a job without a failure.
import { secondsBetween } from './time';
import type { JobStatus, Run, RunEvent, StepKind, Workflow } from './types';
import { immediateSteps, resultOf } from './workflow';

/** Demo thresholds (the UI labels them as such). */
export const MIN_RATE_DENOMINATOR = 5;
export const MIN_P95_RUNS = 20;
/**
 * Below this many runs a 95th percentile is the slowest or second-slowest run (nearest rank: n = 20 → position 19,
 * n = 39 → 38), so the tile says it's a small sample (checkpoint B, ChatGPT 12).
 */
export const SMALL_P95_RUNS = 40;

/** Kept distinct on purpose: each one tells the visitor something different. */
export type GuardReason = 'too_few_runs' | 'too_few_finished_jobs' | 'too_few_failures';

export interface Ratio {
  numerator: number;
  denominator: number;
  /** numerator ÷ denominator, or null below the minimum denominator. */
  value: number | null;
  minimum: number;
  reason: GuardReason | null;
}

export interface Percentile {
  /** Seconds, or null below the minimum n. */
  value: number | null;
  n: number;
  minimum: number;
  reason: 'too_few_runs' | null;
  /** Runs left out because they aren't complete. */
  excluded: { inFlight: number; dead: number };
}

export interface JobFacts {
  kind: StepKind;
  status: JobStatus | null;
  /** succeeded or dead */
  finished: boolean;
  /** `failed` events */
  failures: number;
  succeededAttempt: number | null;
  succeededEvents: number;
  result: string | null;
  /** detail of the `dead` event, e.g. `lease_expired` */
  deadDetail: string | null;
}

const eventsOf = (run: Run, kind: StepKind): RunEvent[] => run.events.filter((e) => e.kind === kind);

export function jobFacts(run: Run, kind: StepKind): JobFacts {
  const step = run.steps.find((s) => s.kind === kind);
  const events = eventsOf(run, kind);
  const successes = events.filter((e) => e.event === 'succeeded');
  const dead = events.find((e) => e.event === 'dead');
  const status = step?.status ?? null;
  return {
    kind,
    status,
    finished: status === 'succeeded' || status === 'dead',
    failures: events.filter((e) => e.event === 'failed').length,
    succeededAttempt: successes[0]?.attempt ?? null,
    succeededEvents: successes.length,
    result: step?.result ?? null,
    deadDetail: dead?.detail ?? null,
  };
}

function ratio(numerator: number, denominator: number, reason: GuardReason): Ratio {
  const enough = denominator >= MIN_RATE_DENOMINATOR;
  return {
    numerator,
    denominator,
    value: enough ? numerator / denominator : null,
    minimum: MIN_RATE_DENOMINATOR,
    reason: enough ? null : reason,
  };
}

function jobsOf(runs: Run[], kinds: readonly StepKind[]): JobFacts[] {
  return runs.flatMap((r) => kinds.map((k) => jobFacts(r, k)));
}

/**
 * Finished jobs that succeeded on attempt 1 ÷ finished jobs. The UI asks for the measured jobs
 * (workflow.ts): an always-simulated job would flatter a real one's rate.
 */
export function firstAttemptSuccess(runs: Run[], kinds: readonly StepKind[]): Ratio {
  const finished = jobsOf(runs, kinds).filter((j) => j.finished);
  const first = finished.filter((j) => j.status === 'succeeded' && j.succeededAttempt === 1);
  return ratio(first.length, finished.length, 'too_few_finished_jobs');
}

/** Finished jobs with ≥ 1 failure that succeeded ÷ finished jobs with ≥ 1 failure (dead ones included). */
export function recovered(runs: Run[], kinds: readonly StepKind[]): Ratio {
  const failedOnce = jobsOf(runs, kinds).filter((j) => j.finished && j.failures > 0);
  const ok = failedOnce.filter((j) => j.status === 'succeeded');
  return ratio(ok.length, failedOnce.length, 'too_few_failures');
}

/**
 * Seconds from the run's start until the last of its immediate jobs succeeded, or null unless all
 * of them did. Scheduled jobs (e.g. a deletion days later) aren't counted.
 */
export function completionSeconds(run: Run, wf: Workflow): number | null {
  const ends: string[] = [];
  for (const kind of immediateSteps(wf)) {
    if (jobFacts(run, kind).status !== 'succeeded') return null;
    for (const e of eventsOf(run, kind)) if (e.event === 'succeeded') ends.push(e.at);
  }
  return Math.max(...ends.map((at) => secondsBetween(run.created_at, at)));
}

/**
 * Nearest-rank percentile: the value at rank ceil(p·n / 100) of the ascending values (1-based).
 * Integer math, because 0.95 * n in floating point can land just above a whole number.
 */
export function nearestRank(values: number[], p: number): number | undefined {
  if (!Number.isInteger(p) || p < 1 || p > 100) throw new RangeError('p must be a whole number 1–100');
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.floor((p * sorted.length + 99) / 100);
  return sorted[rank - 1];
}

export function completionP95(runs: Run[], wf: Workflow): Percentile {
  const values: number[] = [];
  const excluded = { inFlight: 0, dead: 0 };
  for (const run of runs) {
    const s = completionSeconds(run, wf);
    if (s !== null) values.push(s);
    else if (immediateSteps(wf).some((k) => jobFacts(run, k).status === 'dead')) excluded.dead++;
    else excluded.inFlight++;
  }
  const enough = values.length >= MIN_P95_RUNS;
  return {
    value: enough ? (nearestRank(values, 95) ?? null) : null,
    n: values.length,
    minimum: MIN_P95_RUNS,
    reason: enough ? null : 'too_few_runs',
    excluded,
  };
}

export interface RetryWait {
  /** The attempt that failed. */
  attempt: number;
  scheduledAt: string;
  /** From the retry_scheduled event: the configured backoff. */
  plannedS: number;
  /** From the failure to the next attempt's start; null while still waiting. */
  actualS: number | null;
}

export function retryWaits(run: Run, kind: StepKind): RetryWait[] {
  const events = eventsOf(run, kind);
  return events
    .filter((e) => e.event === 'retry_scheduled')
    .map((e) => {
      const next = events.find((n) => n.event === 'started' && n.attempt === e.attempt + 1);
      return {
        attempt: e.attempt,
        scheduledAt: e.at,
        plannedS: Number(e.detail),
        actualS: next ? secondsBetween(e.at, next.at) : null,
      };
    });
}

/**
 * Whether a delivery really happened, by what the description says the result means: only a
 * `delivered` result reached someone; `simulated` and `skipped` results sent nothing.
 */
export type DeliveryVerdict = 'sent_once' | 'duplicate' | 'simulated' | 'skipped' | 'pending' | 'not_sent' | 'unknown';

export interface Delivery {
  verdict: DeliveryVerdict;
  succeededEvents: number;
  result: string | null;
}

export function deliveryOf(run: Run, kind: StepKind, wf: Workflow): Delivery {
  const f = jobFacts(run, kind);
  const of = (verdict: DeliveryVerdict): Delivery => ({ verdict, succeededEvents: f.succeededEvents, result: f.result });
  if (f.succeededEvents > 1) return of('duplicate');
  if (f.status === 'dead') return of('not_sent');
  if (f.status !== 'succeeded') return of('pending');
  const outcome = resultOf(wf, kind, f.result).outcome;
  if (outcome === 'delivered') return of('sent_once');
  if (outcome === 'simulated') return of('simulated');
  if (outcome === 'skipped') return of('skipped');
  return of('unknown');
}

/** How many runs have a job done, given up, or still scheduled (for a job due later). */
export function scheduledStatus(runs: Run[], kind: StepKind): { scheduled: number; done: number; failed: number } {
  const out = { scheduled: 0, done: 0, failed: 0 };
  for (const run of runs) {
    const status = run.steps.find((s) => s.kind === kind)?.status;
    if (status === 'succeeded') out.done++;
    else if (status === 'dead') out.failed++;
    else out.scheduled++;
  }
  return out;
}
