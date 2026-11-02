import { describe, expect, it } from 'vitest';
import { makeRun, type RunSpec } from '../test/runs';
import { NORTHSTAR_WF as WF } from '../test/workflow';
import { GUIDED_RUN, GUIDED_WF } from './guided';
import { retryView } from './retryText';
import type { Run } from './types';

const id = (i: number) => `r_${i.toString(16).padStart(12, '0')}`;
const run = (i: number, spec: Omit<RunSpec, 'id' | 'created'>, day = 24) => makeRun({ id: id(i), created: `2026-10-${day}T09:18:00.000Z`, ...spec });
const LIVE: Run[] = [
  ...Array.from({ length: 9 }, (_, i) => run(i, { outage: true, notify: { attempts: ['fail', 'fail', 'ok'] } }, 22 + (i % 8))),
  ...Array.from({ length: 10 }, (_, i) => run(i + 9, {}, 22 + (i % 8))),
];
const scope = { win: '30d' as const, source: 'live' as const, asOf: '2026-10-31T08:04:00Z', filter: null };

describe('the Retries view on a Northstar-shaped month', () => {
  const v = retryView(LIVE, WF, scope);

  it('opens with what happened', () => {
    expect(v.headline).toBe('In the last 30 days, 9 jobs needed a retry, and all 9 succeeded. No job gave up.');
  });

  it('says how many needed a retry, by job', () => {
    expect([v.tries.value, v.tries.unit, v.tries.note]).toEqual(['9 of 38', 'needed a retry', 'by job: team notification 9 · visitor confirmation 0']);
  });

  it('gives the waits as lateness, with the never-needed one named', () => {
    expect([v.waits.value, v.waits.unit, v.waits.note]).toEqual(['+0.2 s', 'median lateness', '18 waits · team notification plans 10 s, 30 s, 2 min']);
    expect(v.waits.how.working).toBe('10 s: 9 waits, +0.2 s; 30 s: 9 waits, +0.2 s; 2 min: never needed');
  });

  it('counts the failures and says they sent nothing', () => {
    expect([v.fails.value, v.fails.unit, v.fails.note]).toEqual(['18', 'failed tries', 'all from errors that send nothing: simulated outage 18']);
    expect([v.fails.nothingLabel, v.fails.otherLabel]).toEqual(['sent nothing (simulated outage)', 'may have reached the service (none yet)']);
  });

  it('lists the five paths not exercised, and the two that were', () => {
    expect([v.paths.value, v.paths.unit]).toEqual(['5', 'paths']);
    expect(v.paths.unseen.map((p) => p.text)).toEqual(['A 2 min wait', 'Try 4', 'A job giving up', 'A try that never reported back', 'A failure that may have reached the service']);
    expect(v.paths.seen).toEqual([
      { text: 'A 10 s wait', detail: '9 times, first 22 Oct, team notification' },
      { text: 'A 30 s wait', detail: '9 times, first 22 Oct, team notification' },
    ]);
    expect(v.paths.note).toBe('never seen in these 19 runs · each becomes a fact the first time it happens');
  });
});

describe('other data', () => {
  it('reads the recording: one job retried twice and succeeded', () => {
    const v = retryView([GUIDED_RUN], GUIDED_WF, { ...scope, source: 'recording' });
    expect(v.headline).toBe('In the recording, 1 job needed a retry, and it succeeded. No job gave up.');
    expect(v.fails.value).toBe('2');
  });

  it('a give-up flips its path to a fact', () => {
    const v = retryView([run(1, { notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'] } }, 29)], WF, scope);
    expect(v.headline).toBe("In the last 30 days, 1 job needed a retry, and it didn't succeed. 1 job gave up.");
    expect(v.paths.seen.find((p) => p.text === 'A job giving up')?.detail).toBe('once, first 29 Oct, team notification');
  });

  it('names the test-switch filter in the headline', () => {
    expect(retryView(LIVE.slice(9), WF, { ...scope, filter: 'the outage switch off' }).headline)
      .toBe('In the last 30 days with the outage switch off, no job needed a retry.');
  });

  it('with nothing retried, says so', () => {
    expect(retryView(LIVE.slice(9), WF, scope).headline).toBe('In the last 30 days, no job needed a retry.');
    expect(retryView([], WF, scope).headline).toBe('In the last 30 days, no runs to show.');
  });
});
