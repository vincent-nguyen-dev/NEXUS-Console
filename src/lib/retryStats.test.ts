import { describe, expect, it } from 'vitest';
import { makeRun, type RunSpec } from '../test/runs';
import { NORTHSTAR_WF as WF } from '../test/workflow';
import { failureCauses, failuresPerBucket, retriedJobs, retryPaths, triesPerJob, waitSteps } from './retryStats';
import { parseInstant } from './time';
import type { Run } from './types';

const id = (i: number) => `r_${i.toString(16).padStart(12, '0')}`;
const run = (i: number, spec: Omit<RunSpec, 'id' | 'created'>, day = 24) => makeRun({ id: id(i), created: `2026-10-${day}T09:18:00.000Z`, ...spec });
const outage = (i: number, day?: number) => run(i, { outage: true, notify: { attempts: ['fail', 'fail', 'ok'] } }, day);
const clean = (i: number, day?: number) => run(i, {}, day);
const paths = (runs: Run[]) => Object.fromEntries(retryPaths(runs, WF).map((p) => [`${p.id}${p.after ?? p.tryNumber ?? ''}`, p.seen]));

// The shape of Northstar's 30 days on 31 Oct: 19 runs, 9 with the outage switch (tries 1 and 2 fail, try 3 sends).
const LIVE = [...Array.from({ length: 9 }, (_, i) => outage(i, 22 + (i % 8))), ...Array.from({ length: 10 }, (_, i) => clean(i + 9, 22 + (i % 8)))];

describe('Northstar-shaped month (hand-checked against the feed of 31 Oct)', () => {
  it('counts tries per job: team notification 10 on try 1 and 9 on try 3, visitor confirmation 19 on try 1', () => {
    const [team, visitor] = triesPerJob(LIVE, WF);
    expect(team).toMatchObject({ label: 'Team notification', maxAttempts: 4, succeededOn: [10, 0, 9, 0], gaveUp: 0, running: 0, notStarted: 0, retried: 9 });
    expect(visitor).toMatchObject({ succeededOn: [19, 0, 0, 0], retried: 0 });
  });

  it('measures each planned wait: 9 of 10 s and 9 of 30 s, all 0.2 s late; the 120 s wait never needed', () => {
    const [w1, w2, w3] = waitSteps(LIVE, WF, 'notify_team');
    expect([w1?.after, w1?.plannedS, w1?.actual.length, w1?.waiting]).toEqual([1, 10, 9, 0]);
    expect(w1?.late?.median).toBeCloseTo(0.2, 6);
    expect([w2?.plannedS, w2?.actual.length]).toEqual([30, 9]);
    expect(w2?.actual[0]).toBeCloseTo(30.2, 6);
    expect(w3).toEqual({ after: 3, plannedS: 120, actual: [], waiting: 0, late: null });
  });

  it('shows the waits of the job that retried', () => {
    expect(retriedJobs(LIVE, WF)).toEqual(['notify_team']);
    expect(retriedJobs(LIVE.filter((r) => r.flags.length === 0), WF)).toEqual(['notify_team']); // none retried: the first job
  });

  it('finds 18 failures, every one a simulated outage that sent nothing', () => {
    expect(failureCauses(LIVE, WF)).toEqual([{ code: 'simulated_outage', label: 'simulated outage', sendsNothing: true, count: 18 }]);
  });

  it('places the failed tries by day, all of them hatched (sent nothing)', () => {
    const { buckets, unit } = failuresPerBucket(LIVE, WF, '30d', parseInstant('2026-10-31T08:04:00Z'));
    expect(unit).toBe('day');
    expect(buckets).toHaveLength(31);
    expect(buckets.reduce((s, b) => s + b.sentNothing, 0)).toBe(18);
    expect(buckets.reduce((s, b) => s + b.other, 0)).toBe(0);
  });

  it('lists the five paths not exercised yet', () => {
    expect(paths(LIVE)).toEqual({ wait1: 9, wait2: 9, wait3: 0, last_try4: 0, gave_up: 0, no_report: 0, may_have_sent: 0 });
  });
});

describe('each path, the first time it happens', () => {
  it('a job that gives up after 4 tries exercises the 120 s wait, try 4 and giving up', () => {
    const runs = [run(1, { notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'] } }, 29)];
    expect(paths(runs)).toMatchObject({ wait3: 1, last_try4: 1, gave_up: 1, no_report: 0 });
    expect(triesPerJob(runs, WF)[0]).toMatchObject({ succeededOn: [0, 0, 0, 0], gaveUp: 1, retried: 1 });
    const first = retryPaths(runs, WF).find((p) => p.id === 'gave_up')?.first;
    expect(first?.kind).toBe('notify_team');
    expect(first?.at.slice(0, 10)).toBe('2026-10-29');
  });

  it('a try that never reported back is read as the map reads it', () => {
    expect(paths([run(2, { notify: { attempts: ['lease', 'ok'] } })])).toMatchObject({ no_report: 1, gave_up: 0 });
    expect(paths([run(3, { notify: { attempts: ['lease_dead'] } })])).toMatchObject({ no_report: 1, gave_up: 1 });
  });

  it('a failure from an error that may have reached the service is counted apart, and drawn solid', () => {
    const runs = [run(4, { notify: { attempts: ['fail', 'ok'], error: 'internal_error' } })];
    expect(paths(runs)).toMatchObject({ may_have_sent: 1, wait1: 1 });
    expect(failureCauses(runs, WF)).toEqual([{ code: 'internal_error', label: 'internal error', sendsNothing: false, count: 1 }]);
    const { buckets } = failuresPerBucket(runs, WF, '30d', parseInstant('2026-10-31T00:00:00Z'));
    expect(buckets.reduce((s, b) => s + b.other, 0)).toBe(1);
  });

  it('counts a job still running, and one not started yet', () => {
    const [team] = triesPerJob([run(5, { notify: { attempts: ['fail', 'running'] } }), run(6, { notify: { attempts: [] } })], WF);
    expect(team).toMatchObject({ running: 1, notStarted: 1, retried: 1 });
  });

  it('a wait still running is counted as waiting, not measured', () => {
    const [w1] = waitSteps([run(7, { notify: { attempts: ['fail'] } })], WF, 'notify_team');
    expect([w1?.actual.length, w1?.waiting, w1?.late]).toEqual([0, 1, null]);
  });
});
