// Runs → the map's model: `Lead saved` fans out to one lane per job, each with try stations.
import { retryWaits, type RetryWait } from './metrics';
import { JOB_STATUSES, type JobStatus, type Run, type StepKind, type Workflow } from './types';

export interface Station {
  attempt: number;
  started: number;
  failed: number;
  succeeded: number;
  dead: number;
}

export interface Lane {
  kind: StepKind;
  status: Record<JobStatus, number>;
  /** One per attempt number that was ever started, ascending. */
  stations: Station[];
}

export interface Topology {
  /** Lead saved: also the weight of every edge into a lane (each lead gets all three jobs). */
  runs: number;
  lanes: Lane[];
}

const emptyStatus = () =>
  Object.fromEntries(JOB_STATUSES.map((s) => [s, 0])) as Record<JobStatus, number>;

export function buildTopology(runs: Run[], wf: Workflow): Topology {
  const lanes = wf.steps.map(({ kind }) => {
    const status = emptyStatus();
    const stations = new Map<number, Station>();
    const station = (attempt: number) => {
      let s = stations.get(attempt);
      if (!s) stations.set(attempt, (s = { attempt, started: 0, failed: 0, succeeded: 0, dead: 0 }));
      return s;
    };
    for (const run of runs) {
      const step = run.steps.find((s) => s.kind === kind);
      if (step) status[step.status]++;
      for (const e of run.events) {
        if (e.kind !== kind) continue;
        if (e.event === 'started') station(e.attempt).started++;
        else if (e.event === 'failed') station(e.attempt).failed++;
        else if (e.event === 'succeeded') station(e.attempt).succeeded++;
        else if (e.event === 'dead') station(e.attempt).dead++;
      }
    }
    return { kind, status, stations: [...stations.values()].sort((a, b) => a.attempt - b.attempt) };
  });
  return { runs: runs.length, lanes };
}

/** lease_expired: the attempt started, never finished, and the job was claimed again. */
export type AttemptOutcome = 'succeeded' | 'failed' | 'dead' | 'lease_expired' | 'running';

export interface AttemptStep {
  attempt: number;
  outcome: AttemptOutcome;
  /** The result (succeeded), the error code (failed/dead), or `lease_expired`. */
  detail: string | null;
  startedAt: string;
  endedAt: string | null;
  /** The wait before the next attempt, when this attempt failed and a retry was scheduled. */
  wait: RetryWait | null;
}

/** One run's attempts for one job, in order: the siding drawn for a selected run. */
export function attemptChain(run: Run, kind: StepKind): AttemptStep[] {
  const events = run.events.filter((e) => e.kind === kind);
  const waits = retryWaits(run, kind);
  const starts = events.filter((e) => e.event === 'started');
  return starts.map((start) => {
    const a = start.attempt;
    const at = (type: string) => events.find((e) => e.attempt === a && e.event === type);
    const ok = at('succeeded');
    const failed = at('failed');
    const dead = at('dead');
    const later = starts.some((s) => s.attempt > a);
    const wait = waits.find((w) => w.attempt === a) ?? null;
    if (ok) return { attempt: a, outcome: 'succeeded', detail: ok.detail, startedAt: start.at, endedAt: ok.at, wait: null };
    if (dead) {
      return { attempt: a, outcome: 'dead', detail: failed?.detail ?? dead.detail, startedAt: start.at, endedAt: dead.at, wait: null };
    }
    if (failed) return { attempt: a, outcome: 'failed', detail: failed.detail, startedAt: start.at, endedAt: failed.at, wait };
    if (later) return { attempt: a, outcome: 'lease_expired', detail: 'lease_expired', startedAt: start.at, endedAt: null, wait: null };
    return { attempt: a, outcome: 'running', detail: null, startedAt: start.at, endedAt: null, wait: null };
  });
}
