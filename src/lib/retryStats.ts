// The Retries view's numbers (phase 6.2, board G2), from the runs and the workflow's description. DOM-free. It adds
// what the map can't: how many tries each job needed, every wait against its plan (as lateness), what failed and
// when, and which retry paths the data hasn't exercised yet. Every try is read the way the map and a traced run read
// it (`attemptChain`), so "never reported back" means the same here.
import { timeBuckets } from './buckets';
import type { WindowKey } from './filters';
import { nearestRank, retryWaits } from './metrics';
import { parseInstant } from './time';
import { attemptChain } from './topology';
import type { Run, StepKind, Workflow } from './types';
import { errorOf, immediateSteps, stepLabel } from './workflow';

const specOf = (wf: Workflow, kind: StepKind) => wf.steps.find((s) => s.kind === kind);

// ----- tries per job -----

export interface JobTries {
  kind: StepKind;
  label: string;
  maxAttempts: number;
  /** succeededOn[i] = jobs that succeeded on try i + 1. */
  succeededOn: number[];
  gaveUp: number;
  /** Started and not finished yet. */
  running: number;
  /** Not started (scheduled for later, or queued). */
  notStarted: number;
  /** Jobs that needed more than one try (started try 2 or later). */
  retried: number;
}

/** One entry per job (the immediate jobs by default), over the runs given. */
export function triesPerJob(runs: Run[], wf: Workflow, kinds: StepKind[] = immediateSteps(wf)): JobTries[] {
  return kinds.map((kind) => {
    const max = specOf(wf, kind)?.max_attempts ?? 1;
    const out: JobTries = { kind, label: stepLabel(wf, kind), maxAttempts: max, succeededOn: new Array<number>(max).fill(0), gaveUp: 0, running: 0, notStarted: 0, retried: 0 };
    for (const run of runs) {
      const chain = attemptChain(run, kind);
      const last = chain.at(-1);
      if (last === undefined) {
        out.notStarted += 1;
        continue;
      }
      if (chain.some((a) => a.attempt >= 2)) out.retried += 1;
      if (last.outcome === 'succeeded') out.succeededOn[last.attempt - 1] = (out.succeededOn[last.attempt - 1] ?? 0) + 1;
      else if (last.outcome === 'dead') out.gaveUp += 1;
      else out.running += 1;
    }
    return out;
  });
}

// ----- waits against the plan -----

export interface Lateness { min: number; median: number; max: number }

export interface WaitStep {
  /** The try whose failure scheduled this wait. */
  after: number;
  /** The planned wait (seconds), from the description. */
  plannedS: number;
  /** Every measured wait (seconds), shortest first. */
  actual: number[];
  /** Waits planned but not over yet (the next try hasn't started). */
  waiting: number;
  /** Seconds after the plan, over the measured waits; null without any. */
  late: Lateness | null;
}

/** One entry per planned wait of a job (after try 1, 2, …), each with every wait the runs recorded for it. */
export function waitSteps(runs: Run[], wf: Workflow, kind: StepKind): WaitStep[] {
  const spec = specOf(wf, kind);
  if (spec === undefined) return [];
  const planned = spec.backoff_s.slice(0, Math.max(0, spec.max_attempts - 1));
  return planned.map((plannedS, i) => {
    const after = i + 1;
    const waits = runs.flatMap((r) => retryWaits(r, kind)).filter((w) => w.attempt === after);
    const actual = waits.flatMap((w) => (w.actualS === null ? [] : [w.actualS])).sort((a, b) => a - b);
    // Lateness against each wait's own plan (the event's detail), which is the policy that ran.
    const lates = waits.flatMap((w) => (w.actualS === null ? [] : [w.actualS - w.plannedS])).sort((a, b) => a - b);
    return {
      after, plannedS, actual,
      waiting: waits.length - actual.length,
      late: lates.length === 0 ? null : { min: lates[0] ?? 0, median: nearestRank(lates, 50) ?? 0, max: lates.at(-1) ?? 0 },
    };
  });
}

/** The jobs whose waits the view shows: those that retried at all, or the first immediate job when none did. */
export function retriedJobs(runs: Run[], wf: Workflow): StepKind[] {
  const kinds = immediateSteps(wf);
  const retried = kinds.filter((k) => runs.some((r) => retryWaits(r, k).length > 0));
  return retried.length > 0 ? retried : kinds.slice(0, 1);
}

// ----- what failed, and when -----

export interface Cause {
  code: string;
  label: string;
  /** From the description: a try that failed this way never reached the outside service. */
  sendsNothing: boolean;
  count: number;
}

/** Recorded failures (`failed` events) by error code, most first. */
export function failureCauses(runs: Run[], wf: Workflow): Cause[] {
  const counts = new Map<string, number>();
  for (const e of runs.flatMap((r) => r.events)) {
    if (e.event !== 'failed') continue;
    const code = e.detail ?? '';
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count, ...errorOf(wf, code) }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

export interface FailBucket {
  startMs: number;
  /** Failed tries whose error sends nothing (hatched on the chart). */
  sentNothing: number;
  /** Every other failed try (solid). */
  other: number;
}

/** Failed tries per bucket across the window, by when each try failed, on the server's clock. */
export function failuresPerBucket(runs: Run[], wf: Workflow, win: WindowKey, serverNowMs: number): { buckets: FailBucket[]; unit: string } {
  const failed = runs.flatMap((r) => r.events.filter((e) => e.event === 'failed'));
  const times = failed.map((e) => parseInstant(e.at));
  const span = timeBuckets(times, win, serverNowMs);
  const buckets: FailBucket[] = span.starts.map((startMs) => ({ startMs, sentNothing: 0, other: 0 }));
  failed.forEach((e, i) => {
    const b = buckets[span.indexOf(times[i] ?? 0)];
    if (!b) return;
    if (errorOf(wf, e.detail).sendsNothing) b.sentNothing += 1;
    else b.other += 1;
  });
  return { buckets, unit: span.unit };
}

// ----- what the data hasn't exercised -----

export type PathId = 'wait' | 'last_try' | 'gave_up' | 'no_report' | 'may_have_sent';

export interface RetryPath {
  id: PathId;
  /** For `wait`: the try whose failure schedules it, and its planned seconds. For `last_try`: the try's number. */
  after?: number;
  plannedS?: number;
  tryNumber?: number;
  /** How many times the runs went down this path. */
  seen: number;
  /** The first time it happened: when, and in which job. */
  first: { at: string; kind: StepKind } | null;
}

interface Seen { at: string; kind: StepKind }
const firstOf = (seen: Seen[]): Seen | null => seen.reduce<Seen | null>((a, s) => (a === null || parseInstant(s.at) < parseInstant(a.at) ? s : a), null);

/**
 * The retry paths the description makes possible for the immediate jobs, each with whether the runs exercised it:
 * every planned wait, the last allowed try, a job giving up, a try that never reported back, and a failure from an
 * error that may have reached the outside service (not described as sending nothing).
 */
export function retryPaths(runs: Run[], wf: Workflow, kinds: StepKind[] = immediateSteps(wf)): RetryPath[] {
  const waitSeen = new Map<string, Seen[]>();
  const lastSeen = new Map<number, Seen[]>();
  const gave: Seen[] = [];
  const noReport: Seen[] = [];
  const mayHaveSent: Seen[] = [];
  for (const kind of kinds) {
    const spec = specOf(wf, kind);
    if (spec === undefined) continue;
    spec.backoff_s.slice(0, Math.max(0, spec.max_attempts - 1)).forEach((s, i) => {
      if (!waitSeen.has(`${i + 1}:${s}`)) waitSeen.set(`${i + 1}:${s}`, []);
    });
    if (!lastSeen.has(spec.max_attempts)) lastSeen.set(spec.max_attempts, []);
    for (const run of runs) {
      for (const w of retryWaits(run, kind)) waitSeen.get(`${w.attempt}:${spec.backoff_s[w.attempt - 1]}`)?.push({ at: w.scheduledAt, kind });
      for (const a of attemptChain(run, kind)) {
        if (a.attempt === spec.max_attempts) lastSeen.get(spec.max_attempts)?.push({ at: a.startedAt, kind });
        if (a.outcome === 'dead') gave.push({ at: a.endedAt ?? a.startedAt, kind });
        if (a.outcome === 'lease_expired' || (a.outcome === 'dead' && a.detail === 'lease_expired')) noReport.push({ at: a.startedAt, kind });
      }
      for (const e of run.events) {
        if (e.kind === kind && e.event === 'failed' && !errorOf(wf, e.detail).sendsNothing) mayHaveSent.push({ at: e.at, kind });
      }
    }
  }
  const paths: RetryPath[] = [];
  for (const [key, seen] of waitSeen) {
    const [after, plannedS] = key.split(':').map(Number);
    paths.push({ id: 'wait', after: after ?? 0, plannedS: plannedS ?? 0, seen: seen.length, first: firstOf(seen) });
  }
  paths.sort((a, b) => (a.after ?? 0) - (b.after ?? 0));
  for (const [tryNumber, seen] of lastSeen) paths.push({ id: 'last_try', tryNumber, seen: seen.length, first: firstOf(seen) });
  paths.push({ id: 'gave_up', seen: gave.length, first: firstOf(gave) });
  paths.push({ id: 'no_report', seen: noReport.length, first: firstOf(noReport) });
  paths.push({ id: 'may_have_sent', seen: mayHaveSent.length, first: firstOf(mayHaveSent) });
  return paths;
}
