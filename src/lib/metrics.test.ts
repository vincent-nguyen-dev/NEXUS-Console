import { describe, expect, it } from 'vitest';
import { makeRun, runsCompletingIn } from '../test/runs';
import { GUIDED_RUN } from './guided';
import {
  MIN_P95_RUNS, MIN_RATE_DENOMINATOR, completionP95, completionSeconds, deliveryOf, firstAttemptSuccess,
  jobFacts, nearestRank, scheduledStatus, recovered, retryWaits,
} from './metrics';
import type { Run } from './types';
import { NORTHSTAR_WF as WF } from '../test/workflow';

const created = '2026-10-01T00:00:00.000Z';
const run = (id: string, spec: Omit<Parameters<typeof makeRun>[0], 'id' | 'created'>): Run =>
  makeRun({ id, created, ...spec });

describe('the recorded guided run (hand-checked numbers)', () => {
  const r = GUIDED_RUN;

  it('notify_team failed twice and succeeded on attempt 3; confirm_visitor on attempt 1', () => {
    expect(jobFacts(r, 'notify_team')).toMatchObject({
      status: 'succeeded', failures: 2, succeededAttempt: 3, result: 'sent', finished: true,
    });
    expect(jobFacts(r, 'confirm_visitor')).toMatchObject({
      status: 'succeeded', failures: 0, succeededAttempt: 1, result: 'mock', finished: true,
    });
  });

  it('waited 10.190001 s (planned 10) and 30.190512 s (planned 30) between attempts', () => {
    const waits = retryWaits(r, 'notify_team');
    expect(waits.map((w) => [w.attempt, w.plannedS])).toEqual([[1, 10], [2, 30]]);
    expect(waits[0]?.actualS).toBeCloseTo(10.190001, 5); // 03:07:47.131988 → 03:07:57.321989
    expect(waits[1]?.actualS).toBeCloseTo(30.190512, 5); // 03:07:57.654843 → 03:08:27.845355
  });

  it('completed in 42.672518 s (lead 03:07:46.373512 → team email 03:08:29.046030)', () => {
    expect(completionSeconds(r, WF)).toBeCloseTo(42.672518, 5);
  });

  it('sent the team email exactly once; the visitor confirmation was only simulated', () => {
    expect(deliveryOf(r, 'notify_team', WF)).toEqual({ verdict: 'sent_once', succeededEvents: 1, result: 'sent' });
    expect(deliveryOf(r, 'confirm_visitor', WF)).toEqual({ verdict: 'simulated', succeededEvents: 1, result: 'mock' });
  });

  it('has its personal-data purge still scheduled', () => {
    expect(scheduledStatus([r], 'purge_pii')).toEqual({ scheduled: 1, done: 0, failed: 0 });
  });

  it('is below every guard on its own, with the right reason for each', () => {
    expect(firstAttemptSuccess([r], ['notify_team', 'confirm_visitor'])).toEqual({
      numerator: 1, denominator: 2, value: null, minimum: MIN_RATE_DENOMINATOR, reason: 'too_few_finished_jobs',
    });
    expect(recovered([r], ['notify_team', 'confirm_visitor'])).toEqual({
      numerator: 1, denominator: 1, value: null, minimum: MIN_RATE_DENOMINATOR, reason: 'too_few_failures',
    });
    expect(completionP95([r], WF)).toMatchObject({ value: null, n: 1, minimum: MIN_P95_RUNS, reason: 'too_few_runs' });
  });
});

describe('nearestRank (integer math: rank = ceil(95·n / 100))', () => {
  const ascending = (n: number) => Array.from({ length: n }, (_, i) => i + 1); // 1..n, value = rank

  it('n = 20 → rank 19', () => expect(nearestRank(ascending(20), 95)).toBe(19));
  it('n = 21 → rank 20 (19.95 rounds up)', () => expect(nearestRank(ascending(21), 95)).toBe(20));
  it('n = 40 → rank 38', () => expect(nearestRank(ascending(40), 95)).toBe(38));
  it('n = 1 → the only value', () => expect(nearestRank([7], 95)).toBe(7));
  it('sorts its input first', () => expect(nearestRank([5, 1, 4, 2, 3], 50)).toBe(3));
  it('is undefined for no values', () => expect(nearestRank([], 95)).toBeUndefined());
});

describe('completionP95', () => {
  it('needs 20 runs: 19 → too few runs, 20 → a value', () => {
    const secs = Array.from({ length: 20 }, (_, i) => i + 2); // 2..21 s
    expect(completionP95(runsCompletingIn(secs.slice(0, 19)), WF)).toMatchObject({ value: null, n: 19, reason: 'too_few_runs' });
    // 20 values 2..21: rank 19 → 20 s.
    expect(completionP95(runsCompletingIn(secs), WF)).toMatchObject({ value: 20, n: 20, reason: null });
  });

  it('leaves out in-flight and dead runs, and counts them', () => {
    const done = runsCompletingIn(Array.from({ length: 20 }, () => 5));
    const inFlight = run('r_inflight0000', { notify: { attempts: ['fail'] } });
    const dead = run('r_dead00000000', { notify: { attempts: ['fail_dead'] } });
    expect(completionP95([...done, inFlight, dead], WF)).toMatchObject({
      value: 5, n: 20, excluded: { inFlight: 1, dead: 1 },
    });
  });

  it('uses the later of the two successes', () => {
    const r = run('r_000000000001', {
      notify: { attempts: ['ok'], startS: 0, durS: 2 },
      confirm: { attempts: ['ok'], startS: 0, durS: 3 },
    });
    expect(completionSeconds(r, WF)).toBe(3);
  });

  it('is empty-safe', () => {
    expect(completionP95([], WF)).toMatchObject({ value: null, n: 0, reason: 'too_few_runs' });
  });
});

describe('firstAttemptSuccess and recovered', () => {
  // 3 runs = 6 finished jobs: notify ok on 1, ok on 3 after 2 failures, dead after a failure; confirm all ok on 1.
  const runs = [
    run('r_a', { notify: { attempts: ['ok'] } }),
    run('r_b', { notify: { attempts: ['fail', 'fail', 'ok'] } }),
    run('r_c', { notify: { attempts: ['fail_dead'], error: 'invalid_key' } }),
  ];

  it('first attempt: 4 of 6 finished jobs (r_b and r_c notify are not)', () => {
    expect(firstAttemptSuccess(runs, ['notify_team', 'confirm_visitor'])).toEqual({
      numerator: 4, denominator: 6, value: 4 / 6, minimum: 5, reason: null,
    });
  });

  it('recovered: 1 of 2 jobs with a failure (the dead job stays in the denominator)', () => {
    expect(recovered(runs, ['notify_team', 'confirm_visitor'])).toMatchObject({ numerator: 1, denominator: 2, value: null, reason: 'too_few_failures' });
  });

  it('in-flight jobs are in neither metric', () => {
    const withInFlight = [...runs, run('r_d', { notify: { attempts: ['fail'] }, confirm: { attempts: ['running'] } })];
    expect(firstAttemptSuccess(withInFlight, ['notify_team', 'confirm_visitor'])).toMatchObject({ numerator: 4, denominator: 6 });
    expect(recovered(withInFlight, ['notify_team', 'confirm_visitor'])).toMatchObject({ numerator: 1, denominator: 2 });
  });

  it('a lease expiry is a retry but not a failure', () => {
    const lease = run('r_e', { notify: { attempts: ['lease', 'ok'] } });
    expect(jobFacts(lease, 'notify_team')).toMatchObject({ failures: 0, succeededAttempt: 2 });
    expect(firstAttemptSuccess([lease], ['notify_team', 'confirm_visitor'])).toMatchObject({ numerator: 1, denominator: 2 }); // only confirm
    expect(recovered([lease], ['notify_team', 'confirm_visitor'])).toMatchObject({ numerator: 0, denominator: 0 });
  });

  it('a lease that runs out on the last attempt is dead without a failed event', () => {
    const r = run('r_f', { notify: { attempts: ['lease', 'lease', 'lease', 'lease_dead'] } });
    expect(jobFacts(r, 'notify_team')).toMatchObject({
      status: 'dead', failures: 0, finished: true, deadDetail: 'lease_expired',
    });
  });

  it('reaches a value at exactly 5 qualifying failures', () => {
    const five = ['1', '2', '3', '4', '5'].map((i) => run(`r_${i}`, { notify: { attempts: ['fail', 'ok'] } }));
    expect(recovered(five, ['notify_team', 'confirm_visitor'])).toEqual({ numerator: 5, denominator: 5, value: 1, minimum: 5, reason: null });
    expect(recovered(five.slice(0, 4), ['notify_team', 'confirm_visitor'])).toMatchObject({ value: null, reason: 'too_few_failures' });
  });

  it('can be limited to one step: team notification first try is 1 of 3 (r_a only)', () => {
    expect(firstAttemptSuccess(runs, ['notify_team'])).toMatchObject({ numerator: 1, denominator: 3, reason: 'too_few_finished_jobs' });
    expect(firstAttemptSuccess(runs, ['confirm_visitor'])).toMatchObject({ numerator: 3, denominator: 3 });
    expect(recovered(runs, ['notify_team'])).toMatchObject({ numerator: 1, denominator: 2 });
    expect(recovered(runs, ['confirm_visitor'])).toMatchObject({ numerator: 0, denominator: 0 });
  });

  it('is empty-safe', () => {
    expect(firstAttemptSuccess([], ['notify_team', 'confirm_visitor'])).toMatchObject({ numerator: 0, denominator: 0, value: null, reason: 'too_few_finished_jobs' });
    expect(recovered([], ['notify_team', 'confirm_visitor'])).toMatchObject({ numerator: 0, denominator: 0, value: null, reason: 'too_few_failures' });
  });
});

describe('deliveryOf', () => {
  it('sent_once needs one success with result `sent`', () => {
    expect(deliveryOf(run('r_a', {}), 'notify_team', WF).verdict).toBe('sent_once');
  });
  it('a capped notification succeeded but sent nothing', () => {
    expect(deliveryOf(run('r_b', { notify: { attempts: ['ok'], result: 'skipped_cap' } }), 'notify_team', WF))
      .toEqual({ verdict: 'skipped', succeededEvents: 1, result: 'skipped_cap' });
  });
  it('the mock provider is "simulated"', () => {
    expect(deliveryOf(run('r_c', { notify: { attempts: ['ok'], result: 'mock' } }), 'notify_team', WF).verdict)
      .toBe('simulated');
  });
  it('pending while retrying, not_sent when dead', () => {
    expect(deliveryOf(run('r_d', { notify: { attempts: ['fail'] } }), 'notify_team', WF).verdict).toBe('pending');
    expect(deliveryOf(run('r_e', { notify: { attempts: ['fail_dead'] } }), 'notify_team', WF).verdict).toBe('not_sent');
  });
  it('two success events would be flagged as a duplicate', () => {
    const r = run('r_f', {});
    const ok = r.events.find((e) => e.kind === 'notify_team' && e.event === 'succeeded');
    if (!ok) throw new Error('fixture');
    r.events.push({ ...ok });
    expect(deliveryOf(r, 'notify_team', WF).verdict).toBe('duplicate');
  });
});

describe('scheduledStatus', () => {
  it('counts scheduled and done purges', () => {
    expect(scheduledStatus([run('r_a', {}), run('r_b', { purged: true })], 'purge_pii')).toEqual({ scheduled: 1, done: 1, failed: 0 });
  });
});
