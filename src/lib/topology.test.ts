import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import { GUIDED_RUN } from './guided';
import { attemptChain, buildTopology } from './topology';
import { NORTHSTAR_WF as WF } from '../test/workflow';

describe('buildTopology', () => {
  it('counts the recorded run per lane and per try station', () => {
    const t = buildTopology([GUIDED_RUN], WF);
    expect(t.runs).toBe(1);
    expect(t.lanes.map((l) => l.kind)).toEqual(['notify_team', 'confirm_visitor', 'purge_pii']);

    const notify = t.lanes[0];
    expect(notify?.status).toEqual({ queued: 0, running: 0, retrying: 0, succeeded: 1, dead: 0 });
    expect(notify?.stations).toEqual([
      { attempt: 1, started: 1, failed: 1, succeeded: 0, dead: 0 },
      { attempt: 2, started: 1, failed: 1, succeeded: 0, dead: 0 },
      { attempt: 3, started: 1, failed: 0, succeeded: 1, dead: 0 },
    ]);

    expect(t.lanes[1]?.stations).toEqual([{ attempt: 1, started: 1, failed: 0, succeeded: 1, dead: 0 }]);
    expect(t.lanes[2]?.status.queued).toBe(1);
    expect(t.lanes[2]?.stations).toEqual([]);
  });

  it('adds runs up and handles an empty window', () => {
    const a = makeRun({ id: 'r_a', created: '2026-10-01T00:00:00Z', notify: { attempts: ['fail_dead'] } });
    const t = buildTopology([GUIDED_RUN, a], WF);
    expect(t.runs).toBe(2);
    expect(t.lanes[0]?.status).toMatchObject({ succeeded: 1, dead: 1 });
    expect(t.lanes[0]?.stations[0]).toEqual({ attempt: 1, started: 2, failed: 2, succeeded: 0, dead: 1 });

    const empty = buildTopology([], WF);
    expect(empty.runs).toBe(0);
    expect(empty.lanes.every((l) => l.stations.length === 0)).toBe(true);
  });
});

describe('attemptChain', () => {
  it('lays out the recorded notify_team attempts with planned and actual waits', () => {
    const chain = attemptChain(GUIDED_RUN, 'notify_team');
    expect(chain.map((a) => [a.attempt, a.outcome, a.detail])).toEqual([
      [1, 'failed', 'simulated_outage'],
      [2, 'failed', 'simulated_outage'],
      [3, 'succeeded', 'sent'],
    ]);
    expect(chain[0]?.wait?.plannedS).toBe(10);
    expect(chain[0]?.wait?.actualS).toBeCloseTo(10.190001, 5);
    expect(chain[1]?.wait?.plannedS).toBe(30);
    expect(chain[2]?.wait).toBeNull();
    expect(chain[2]?.startedAt).toBe('2026-10-22T03:08:27.845355+00:00');
    expect(chain[2]?.endedAt).toBe('2026-10-22T03:08:29.046030+00:00');
  });

  it('marks running, retrying and lease-expired attempts', () => {
    const r = makeRun({ id: 'r_b', created: '2026-10-01T00:00:00Z', notify: { attempts: ['lease', 'fail'] }, confirm: { attempts: ['running'] } });
    expect(attemptChain(r, 'notify_team').map((a) => a.outcome)).toEqual(['lease_expired', 'failed']);
    const retry = attemptChain(r, 'notify_team')[1]?.wait;
    expect(retry?.plannedS).toBe(30); // attempt 2's backoff (10 s, 30 s, 120 s by attempt)
    expect(retry?.actualS).toBeNull(); // still waiting
    expect(attemptChain(r, 'confirm_visitor').map((a) => a.outcome)).toEqual(['running']);
  });
});
