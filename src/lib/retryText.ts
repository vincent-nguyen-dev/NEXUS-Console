// The Retries view's words (phase 6.2b, board G2): the headline, each card's value and note, its "How it's counted",
// and the paths not exercised yet, built from the workflow's description and retryStats.ts. DOM-free and tested, like
// aiText.ts. Hatching means "sent nothing", from the description's `sends_nothing`: NEXUS can't tell a simulated error
// from a real one by name, only whether the try reached the outside service.
import type { WindowKey } from './filters';
import { formatDuration, formatPlanned, formatUtcDay } from './format';
import { PERIOD } from './headline';
import type { HowCounted } from './kpis';
import {
  failureCauses, failuresPerBucket, retriedJobs, retryPaths, triesPerJob, waitSteps,
  type Cause, type FailBucket, type JobTries, type RetryPath, type WaitStep,
} from './retryStats';
import type { DataSource } from './source';
import type { Run, Workflow } from './types';
import { stepLabel } from './workflow';

const n0 = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many: string) => `${n0(n)} ${n === 1 ? one : many}`;
const day = (iso: string) => formatUtcDay(iso).replace(/ \d{4}$/, '');
const late = (s: number) => `+${formatDuration(Math.max(0, s))}`;

export interface RetryScope {
  win: WindowKey;
  source: DataSource;
  /** The page's `now` (server time). */
  asOf: string;
  /** The test-switch filter as words ("the outage switch off"), or null. */
  filter: string | null;
}

export interface RetryCard { label: string; value: string; unit: string; note: string; how: HowCounted }

export interface PathLine { text: string; detail: string }

export interface RetryView {
  headline: string;
  tries: RetryCard & { jobs: JobTries[] };
  waits: RetryCard & { job: string; steps: WaitStep[] };
  fails: RetryCard & { buckets: FailBucket[]; per: string; causes: Cause[]; nothingLabel: string; otherLabel: string };
  paths: RetryCard & { unseen: PathLine[]; seen: PathLine[] };
}

function source(scope: RetryScope): string {
  if (scope.source === 'recording') return 'Source: the recording of one run.';
  const runs = (scope.win === 'all' ? 'all recorded runs' : `runs created in ${PERIOD[scope.win]}`) + (scope.filter === null ? '' : ` with ${scope.filter}`);
  return `Source: ${scope.source === 'file' ? 'your file' : "Northstar's ops feed"}, ${runs}.`;
}

function pathLine(p: RetryPath, wf: Workflow): PathLine {
  const text = {
    wait: `A ${formatPlanned(p.plannedS ?? 0)} wait`,
    last_try: `Try ${p.tryNumber ?? 0}`,
    gave_up: 'A job giving up',
    no_report: 'A try that never reported back',
    may_have_sent: 'A failure that may have reached the service',
  }[p.id];
  const why = {
    wait: `planned after try ${p.after ?? 0} fails`,
    last_try: 'the last one allowed',
    gave_up: `after its last try fails`,
    no_report: 'the job would be started again',
    may_have_sent: 'every failure so far sent nothing',
  }[p.id];
  if (p.seen === 0 || p.first === null) return { text, detail: why };
  return { text, detail: `${p.seen === 1 ? 'once' : `${n0(p.seen)} times`}, first ${day(p.first.at)}, ${stepLabel(wf, p.first.kind).toLowerCase()}` };
}

export function retryView(runs: Run[], wf: Workflow, scope: RetryScope): RetryView {
  const period = scope.source === 'recording' ? 'the recording' : PERIOD[scope.win];
  // The test-switch filter is named in the headline, as on the overview, so "no job needed a retry" never reads as all runs.
  const In = scope.source === 'recording' ? 'In the recording' : `In ${period}${scope.filter === null ? '' : ` with ${scope.filter}`}`;
  const jobs = triesPerJob(runs, wf);
  const retried = jobs.reduce((s, j) => s + j.retried, 0);
  const finished = jobs.reduce((s, j) => s + j.succeededOn.reduce((a, b) => a + b, 0) + j.gaveUp, 0);
  const gaveUp = jobs.reduce((s, j) => s + j.gaveUp, 0);
  const recoveredJobs = jobs.reduce((s, j) => s + j.succeededOn.slice(1).reduce((a, b) => a + b, 0), 0);
  const all = jobs.reduce((s, j) => s + j.succeededOn.reduce((a, b) => a + b, 0) + j.gaveUp + j.running, 0);

  let headline = `${In}, no job needed a retry.`;
  if (retried > 0) {
    let outcome = recoveredJobs === retried ? `and all ${n0(retried)} succeeded` : `and ${n0(recoveredJobs)} of them succeeded`;
    if (retried === 1) outcome = recoveredJobs === 1 ? 'and it succeeded' : "and it didn't succeed";
    headline = `${In}, ${plural(retried, 'job', 'jobs')} needed a retry, ${outcome}. ${gaveUp === 0 ? 'No job gave up.' : `${plural(gaveUp, 'job', 'jobs')} gave up.`}`;
  }
  if (runs.length === 0) headline = `${In}, no runs to show.`;

  // ----- tries -----
  const byJob = jobs.map((j) => `${j.label.toLowerCase()} ${n0(j.retried)}`).join(' · ');
  const tries: RetryView['tries'] = {
    label: 'Tries per job',
    value: `${n0(retried)} of ${n0(all)}`,
    unit: 'needed a retry',
    note: `by job: ${byJob}`,
    jobs,
    how: {
      rule: 'Each job of each run, placed on the try it succeeded on, or on "gave up". A job needed a retry when a second try started.',
      working: jobs.map((j) => `${j.label}: ${j.succeededOn.map((n, i) => `try ${i + 1} ${n}`).join(', ')}, gave up ${j.gaveUp}`).join('; '),
      notes: [
        `${plural(finished, 'job', 'jobs')} finished; jobs still running or not started yet aren't placed.`,
        'A try that never reported back starts the job again without a recorded failure, so it still counts as a retry here.',
      ],
      source: source(scope),
    },
  };

  // ----- waits -----
  const kind = retriedJobs(runs, wf)[0] ?? wf.steps[0]?.kind ?? '';
  const steps = kind === '' ? [] : waitSteps(runs, wf, kind);
  const lates = steps.flatMap((s) => s.actual.map((a) => a - s.plannedS)).sort((a, b) => a - b);
  const median = lates.length === 0 ? null : (lates[Math.floor((50 * lates.length + 99) / 100) - 1] ?? 0);
  const planned = steps.map((s) => formatPlanned(s.plannedS)).join(', ');
  const waits: RetryView['waits'] = {
    label: 'Waits, planned vs actual',
    value: median === null ? 'No waits yet' : late(median),
    unit: median === null ? '' : 'median lateness',
    note: `${plural(lates.length, 'wait', 'waits')} · ${kind === '' ? '' : `${stepLabel(wf, kind).toLowerCase()} plans ${planned}`}`,
    job: kind === '' ? '' : stepLabel(wf, kind),
    steps,
    how: {
      rule: 'From the moment a retry was planned to the moment the next try started, minus the wait the plan asked for: how late the scheduler picked it up.',
      working: steps.map((s) => {
        if (s.late === null) return `${formatPlanned(s.plannedS)}: never needed`;
        const span = late(s.late.min) === late(s.late.max) ? late(s.late.min) : `${late(s.late.min)} to ${late(s.late.max)}`;
        return `${formatPlanned(s.plannedS)}: ${plural(s.actual.length, 'wait', 'waits')}, ${span}`;
      }).join('; '),
      notes: [
        'A wait still running (the next try hasn\'t started) is left out until it ends.',
        'The median is by nearest rank over every measured wait.',
      ],
      source: source(scope),
    },
  };

  // ----- failures -----
  const causes = failureCauses(runs, wf);
  const total = causes.reduce((s, c) => s + c.count, 0);
  const nothing = causes.filter((c) => c.sendsNothing);
  const { buckets, unit } = failuresPerBucket(runs, wf, scope.source === 'recording' ? 'all' : scope.win, Date.parse(scope.asOf));
  const causeText = causes.map((c) => `${c.label} ${n0(c.count)}`).join(' · ');
  const fails: RetryView['fails'] = {
    label: 'Failed tries over time',
    value: n0(total),
    unit: total === 1 ? 'failed try' : 'failed tries',
    note: total === 0 ? 'none recorded' : nothing.length === causes.length ? `all from errors that send nothing: ${causeText}` : causeText,
    buckets, per: unit, causes,
    nothingLabel: nothing.length === 0 ? 'sent nothing' : `sent nothing (${nothing.map((c) => c.label).join(', ')})`,
    otherLabel: causes.some((c) => !c.sendsNothing) ? 'may have reached the service' : 'may have reached the service (none yet)',
    how: {
      rule: 'Every recorded failure (a "failed" event), by when the try failed. Hatched: an error the description says sends nothing. Solid: any other.',
      working: total === 0 ? '0 failures' : `${n0(total)} = ${causes.map((c) => `${n0(c.count)} ${c.label}`).join(' + ')}`,
      notes: ['A try that never reported back records no failure, so it isn\'t drawn here; it appears under the paths.'],
      source: source(scope),
    },
  };

  // ----- paths -----
  const all5 = retryPaths(runs, wf);
  const unseen = all5.filter((p) => p.seen === 0).map((p) => pathLine(p, wf));
  const seen = all5.filter((p) => p.seen > 0).map((p) => pathLine(p, wf));
  const paths: RetryView['paths'] = {
    label: 'Not exercised yet',
    value: n0(unseen.length),
    unit: unseen.length === 1 ? 'path' : 'paths',
    note: `never seen in ${scope.source === 'recording' ? 'the recording' : `these ${plural(runs.length, 'run', 'runs')}`} · each becomes a fact the first time it happens`,
    unseen, seen,
    how: {
      rule: 'Every retry path the description allows: each planned wait, the last allowed try, a job giving up, a try that never reported back, and a failure from an error not described as sending nothing.',
      working: `${n0(all5.length)} paths: ${n0(seen.length)} seen, ${n0(unseen.length)} not yet`,
      notes: ['Not exercised means only that these runs never went that way: the code for it exists, untested by this data.'],
      source: source(scope),
    },
  };

  return { headline, tries, waits, fails, paths };
}
