import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import { GUIDED_RUN } from './guided';
import {
  COMPRESS_ABOVE_S, WAIT_SHOWN_S, displayAt, momentsShown, nextStop, playbackMode, prevStop, realAt, replayModel,
} from './replay';
import { NORTHSTAR_WF as WF } from '../test/workflow';

// Hand-checked from the recording (offsets from 03:07:46.373512): moments at 0, 0.421, 0.758, 1.044, 1.377,
// 10.948, 11.281, 41.472, 42.673 s. Gaps 0.421, 0.337, 0.286, 0.333, 9.571, 0.333, 30.191, 1.201: the two over
// 2 s play in 2.5 s each, so the replay lasts 1.377 + 2.5 + 0.333 + 2.5 + 1.201 = 7.911 s.
const m = replayModel(GUIDED_RUN, WF);

describe('replayModel on the recording', () => {
  it('tells the run in 9 moments, in recorded order, with the exact texts', () => {
    expect(m.moments.map((x) => [x.time, x.text])).toEqual([
      ['+0.0 s', 'An enquiry is saved. Three jobs are queued.'],
      ['+0.4 s', 'Team notification, try 1 starts.'],
      ['+0.8 s', 'Try 1 failed: the email service is down (simulated), so nothing was sent. Northstar plans a retry in 10 s.'],
      ['+1.0 s', 'Visitor confirmation, try 1 starts.'],
      ['+1.4 s', 'Visitor confirmation worked on try 1 (simulated: no email goes out).'],
      ['+10.9 s', 'Waited 10.2 s, as planned (10 s). Try 2 starts.'],
      ['+11.3 s', 'Try 2 failed: still down, so nothing was sent. Northstar plans a retry in 30 s.'],
      ['+41.5 s', 'Waited 30.2 s, as planned (30 s). Try 3 starts.'],
      ['+42.7 s', 'Try 3 sent the email. It\'s the only "sent" result recorded.'],
    ]);
    expect(m.moments.map((x) => x.shape)).toEqual(['lead', 'neutral', 'retry', 'neutral', 'simulated', 'neutral', 'retry', 'neutral', 'ok']);
    expect(m.moments.map((x) => x.lane)).toEqual([null, 'team', 'team', 'visitor', 'visitor', 'team', 'team', 'team', 'team']);
  });

  it('compresses only the two long gaps, to 2.5 s each, and lasts 7.911 s', () => {
    // 9.5715 exactly (microsecond times), 9.571 from the rounded offsets above.
    expect(m.segments.filter((s) => s.compressed).map((s) => +(s.toReal - s.fromReal).toFixed(2))).toEqual([9.57, 30.19]);
    expect(m.segments.every((s) => s.compressed === s.toReal - s.fromReal > COMPRESS_ABOVE_S)).toBe(true);
    expect(m.segments.filter((s) => s.compressed).every((s) => s.toDisplay - s.fromDisplay === WAIT_SHOWN_S)).toBe(true);
    expect(m.totalDisplayS).toBeCloseTo(7.911, 2);
    expect(m.totalRealS).toBeCloseTo(42.673, 3);
  });

  it('labels each wait with its real and its replay length', () => {
    // Wait 1 runs from the failure (+0.758) to try 2 (+10.948): 0.619 s in real time, then the 2.5 s compressed part.
    expect(m.waits.map((w) => w.label)).toEqual(['real wait 10.2 s · shown in 3.1 s', 'real wait 30.2 s · shown in 2.5 s']);
    expect(m.waits.map((w) => w.plannedS)).toEqual([10, 30]);
  });

  it('ends on the only "sent" result', () => {
    expect(m.ending).toBe('Try 3 sent the email. It\'s the only "sent" result recorded.');
  });
});

describe('the clock (real time) against the replay position', () => {
  it('reads real time, interpolated inside a shortened wait', () => {
    expect(realAt(m, 0)).toBe(0);
    expect(realAt(m, 1.377 + 1.25)).toBeCloseTo(1.377 + 9.571 / 2, 2); // 6.163 → "+6.2 s"
    expect(realAt(m, m.totalDisplayS)).toBeCloseTo(42.673, 3);
    expect(realAt(m, m.totalDisplayS + 5)).toBeCloseTo(42.673, 3);
  });

  it('round-trips: no replay position changes a recorded timestamp', () => {
    for (const moment of m.moments) expect(realAt(m, displayAt(m, moment.realS))).toBeCloseTo(moment.realS, 6);
  });

  it('reaches the same final state as reading the list: all 9 moments', () => {
    expect(momentsShown(m, m.totalDisplayS)).toBe(9);
    expect(momentsShown(m, 0)).toBe(1);
    expect(momentsShown(m, 1.377 + 1.25)).toBe(5);
  });
});

describe('stepping between moments (the no-animation path)', () => {
  it('walks every moment forward and back, ending at the total', () => {
    const stops: number[] = [];
    let at = 0;
    while (at < m.totalDisplayS - 1e-6) {
      at = nextStop(m, at);
      stops.push(at);
    }
    expect(stops).toHaveLength(8);
    expect(stops.at(-1)).toBeCloseTo(m.totalDisplayS, 6);
    expect(prevStop(m, m.totalDisplayS)).toBeCloseTo(m.moments[7]?.displayS ?? -1, 6);
    expect(prevStop(m, 0)).toBe(0);
  });

  it('chooses steps over animation with reduced motion', () => {
    expect(playbackMode(true)).toBe('step');
    expect(playbackMode(false)).toBe('animate');
  });
});

describe('incomplete or different runs end on a true last moment', () => {
  const created = '2026-10-01T00:00:00Z';

  it('a try still running', () => {
    const run = makeRun({ id: 'r_000000000001', created, notify: { attempts: ['fail', 'running'] } });
    expect(replayModel(run, WF).ending).toBe('Try 2 is still running.');
  });

  it('a retry still waiting', () => {
    const run = makeRun({ id: 'r_000000000002', created, notify: { attempts: ['fail'] } });
    expect(replayModel(run, WF).ending).toBe('Try 1 failed; a retry is still planned.');
  });

  it('a give-up, and a try that never reported back', () => {
    expect(replayModel(makeRun({ id: 'r_000000000003', created, notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'] } }), WF).ending)
      .toBe('Gave up after 4 tries.');
    expect(replayModel(makeRun({ id: 'r_000000000004', created, notify: { attempts: ['lease_dead'] } }), WF).ending)
      .toBe('Gave up: try 1 never reported back.');
  });

  it('a simulated result is never called "sent"', () => {
    const model = replayModel(makeRun({ id: 'r_000000000005', created, notify: { attempts: ['ok'], result: 'mock' } }), WF);
    expect(model.ending).toBe('Try 1 finished: simulated, no email provider.');
    expect(model.moments.some((x) => /sent the email/.test(x.text))).toBe(false);
  });

  it('a wait off its plan says so, and a new cause is named', () => {
    const run = makeRun({ id: 'r_000000000006', created, notify: { attempts: ['fail', 'fail', 'ok'], error: 'internal_error' } });
    const texts = replayModel(run, WF).moments.map((x) => x.text);
    expect(texts).toContain('Try 1 failed: internal error. Northstar plans a retry in 10 s.');
    expect(texts).toContain('Try 2 failed: still down. Northstar plans a retry in 30 s.');
    // Only the outage switch is known to stop before the email service; another error may have reached it.
    expect(texts.some((t) => /nothing was sent/.test(t))).toBe(false);
  });
});
