// Builds synthetic runs for tests, shaped exactly like Northstar's ops feed (see src/lib/types.ts).
// Times are deterministic so expected values can be worked out by hand.
import type { JobStatus, Run, RunEvent, Step, StepKind } from '../lib/types';

/** What one attempt does. `fail_dead` is a failure on the last allowed attempt or a permanent one. */
export type Attempt = 'ok' | 'fail' | 'fail_dead' | 'lease' | 'lease_dead' | 'running';

export interface JobSpec {
  attempts: Attempt[];
  /** Seconds from the lead's creation to the first attempt's start. Default 0.5. */
  startS?: number;
  /** Seconds each attempt takes. Default 0.5. */
  durS?: number;
  /** Result of a successful attempt. Default: `sent` for notify_team, `mock` for confirm_visitor. */
  result?: string;
  /** Error code of a failed attempt. Default `simulated_outage`. */
  error?: string;
}

export interface RunSpec {
  id: string;
  created: string;
  notify?: JobSpec;
  confirm?: JobSpec;
  /** purge_pii status; it is always created, due 7 days later. Default `queued`. */
  purged?: boolean;
  outage?: boolean;
}

/** Unwraps a value a test expects to exist, failing loudly if it doesn't. */
export function must<T>(value: T | null | undefined, what = 'value'): T {
  if (value === null || value === undefined) throw new Error(`test setup: missing ${what}`);
  return value;
}

const BACKOFF_S = [10, 30, 120];
const LEASE_S = 60;
/** The worker picks a retry up this long after it was due (Northstar measured ~0.19 s). */
export const PICKUP_DELAY_S = 0.2;

const iso = (ms: number) => new Date(ms).toISOString();

function buildJob(kind: StepKind, created: number, spec: JobSpec | undefined, events: RunEvent[]): Step {
  const s = spec ?? { attempts: ['ok'] };
  const dur = (s.durS ?? 0.5) * 1000;
  const error = s.error ?? 'simulated_outage';
  const result = s.result ?? (kind === 'notify_team' ? 'sent' : 'mock');
  events.push({ kind, event: 'queued', attempt: 0, detail: null, at: iso(created) });

  let cursor = created + (s.startS ?? 0.5) * 1000;
  let status: JobStatus = 'queued';
  let runAfter = created;
  let lastError: string | null = null;
  let stepResult: string | null = null;
  let updated = created;

  s.attempts.forEach((outcome, i) => {
    const attempt = i + 1;
    events.push({ kind, event: 'started', attempt, detail: null, at: iso(cursor) });
    updated = cursor;
    status = 'running';
    const end = cursor + dur;
    switch (outcome) {
      case 'ok':
        events.push({ kind, event: 'succeeded', attempt, detail: result, at: iso(end) });
        status = 'succeeded';
        stepResult = result;
        updated = end;
        break;
      case 'fail': {
        const wait = BACKOFF_S[attempt - 1] ?? 120;
        events.push({ kind, event: 'failed', attempt, detail: error, at: iso(end) });
        events.push({ kind, event: 'retry_scheduled', attempt, detail: String(wait), at: iso(end) });
        status = 'retrying';
        lastError = error;
        runAfter = end + wait * 1000;
        updated = end;
        cursor = runAfter + PICKUP_DELAY_S * 1000;
        break;
      }
      case 'fail_dead':
        events.push({ kind, event: 'failed', attempt, detail: error, at: iso(end) });
        events.push({ kind, event: 'dead', attempt, detail: null, at: iso(end) });
        status = 'dead';
        lastError = error;
        updated = end;
        break;
      case 'lease':
        // The worker vanished; the job is claimed again once the lease runs out, with no failed event.
        cursor += LEASE_S * 1000;
        break;
      case 'lease_dead': {
        const expired = cursor + LEASE_S * 1000;
        events.push({ kind, event: 'dead', attempt, detail: 'lease_expired', at: iso(expired) });
        status = 'dead';
        lastError = 'lease_expired';
        updated = expired;
        break;
      }
      case 'running':
        break;
    }
  });

  return {
    kind, status, attempts: s.attempts.length, max_attempts: 4, run_after: iso(runAfter),
    result: stepResult, last_error: lastError, updated_at: iso(updated),
  };
}

export function makeRun(spec: RunSpec): Run {
  const created = Date.parse(spec.created);
  const events: RunEvent[] = [];
  const steps = [
    buildJob('notify_team', created, spec.notify, events),
    buildJob('confirm_visitor', created, spec.confirm, events),
  ];
  const due = created + 7 * 24 * 3600 * 1000;
  events.push({ kind: 'purge_pii', event: 'queued', attempt: 0, detail: null, at: iso(created) });
  if (spec.purged) {
    events.push({ kind: 'purge_pii', event: 'started', attempt: 1, detail: null, at: iso(due) });
    events.push({ kind: 'purge_pii', event: 'succeeded', attempt: 1, detail: 'purged', at: iso(due + 100) });
  }
  steps.push({
    kind: 'purge_pii', status: spec.purged ? 'succeeded' : 'queued', attempts: spec.purged ? 1 : 0,
    max_attempts: 4, run_after: iso(due), result: spec.purged ? 'purged' : null, last_error: null,
    updated_at: iso(spec.purged ? due + 100 : created),
  });
  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return {
    run_id: spec.id, created_at: spec.created, flags: spec.outage ? ['simulate_outage'] : [], steps, events,
  };
}

/** `count` runs whose notify_team succeeds on attempt 1 after `seconds[i]` (confirm takes 1 s). */
export function runsCompletingIn(seconds: number[]): Run[] {
  return seconds.map((s, i) => makeRun({
    id: `r_${i.toString(16).padStart(12, '0')}`,
    created: '2026-10-01T00:00:00.000Z',
    notify: { attempts: ['ok'], startS: 0, durS: s },
    confirm: { attempts: ['ok'], startS: 0, durS: 1 },
  }));
}
