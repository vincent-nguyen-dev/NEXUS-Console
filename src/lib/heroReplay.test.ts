import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import { NORTHSTAR_WF as WF } from '../test/workflow';
import { GUIDED_RUN } from './guided';
import { captionAt, frameAt, promiseFor, restCaption, scrubToDisplayS } from './heroReplay';
import { replayModel } from './replay';

// The recording (hero.test.ts has the hand-checked offsets): 9 moments over 42.7 s, played in 7.9 s because
// the 10.2 s and 30.2 s waits play in 3.1 s and 2.5 s (gaps over 2 s play in 2.5 s; the first one includes the
// visitor confirmation's 0.6 s before it).
const m = replayModel(GUIDED_RUN, WF);
const at = (i: number) => m.moments[i]?.displayS ?? Number.NaN;

describe('heroReplay on the recording', () => {
  it('has the 9 moments and the 42.7 s the plan counts on', () => {
    expect(m.moments).toHaveLength(9);
    expect(m.totalRealS).toBeCloseTo(42.67, 2);
    expect(m.totalDisplayS).toBeCloseTo(7.91, 2);
    expect(m.waits.map((w) => w.label)).toEqual(['real wait 10.2 s · shown in 3.1 s', 'real wait 30.2 s · shown in 2.5 s']);
  });

  it('at rest, says the whole run in one computed sentence', () => {
    expect(restCaption(GUIDED_RUN, WF, m)).toBe('Team notification sent on try 3 after 2 failed tries, 42.7 s after the enquiry. Sent once.');
  });

  it('draws the figure as far as the read head: the start, after try 1 failed, and the end', () => {
    expect(frameAt(m, 0)).toMatchObject({ shown: 1, visitor: 'none', wait: null });
    const afterTry1 = frameAt(m, at(2));
    expect([...afterTry1.ended]).toEqual([[1, 'failed']]);
    expect([...afterTry1.started]).toEqual([1]);
    const end = frameAt(m, m.totalDisplayS);
    expect([...end.ended]).toEqual([[1, 'failed'], [2, 'failed'], [3, 'sent']]);
    expect(end).toMatchObject({ shown: 9, visitor: 'done', wait: null });
  });

  it('knows which wait is running, and the caption says so', () => {
    const inFirst = (at(4) + at(5)) / 2;
    expect(frameAt(m, inFirst).wait?.afterTry).toBe(1);
    // The latest moment comes first, then the wait: a failure right before its wait is still said (7.1b, F5).
    expect(captionAt(m, inFirst)).toBe('Visitor confirmation worked on try 1 (simulated: no email goes out). Northstar waits before try 2 (real wait 10.2 s · shown in 3.1 s).');
    expect(captionAt(m, at(2) + 0.01)).toBe('Try 1 failed: the email service is down (simulated), so nothing was sent. Northstar plans a retry in 10 s. Northstar waits before try 2 (real wait 10.2 s · shown in 3.1 s).');
    expect(frameAt(m, (at(6) + at(7)) / 2).wait?.afterTry).toBe(2);
    expect(frameAt(m, at(5)).wait).toBeNull();
    expect(captionAt(m, at(6))).toBe('Try 2 failed: still down, so nothing was sent. Northstar plans a retry in 30 s.');
    // Every moment's sentence is said at some point while it plays: none is hidden behind a wait.
    m.moments.forEach((x, i) => expect(captionAt(m, (x.displayS + (m.moments[i + 1]?.displayS ?? m.totalDisplayS)) / 2)).toContain(x.text));
  });

  it('maps a scrubber position to replay time, clamped', () => {
    expect(scrubToDisplayS(0.5, m)).toBeCloseTo(m.totalDisplayS / 2, 6);
    expect(scrubToDisplayS(-1, m)).toBe(0);
    expect(scrubToDisplayS(2, m)).toBe(m.totalDisplayS);
    expect(scrubToDisplayS(Number.NaN, m)).toBe(0);
  });

  it('names the promise each moment is about: ran, retried (failures and waits), sent twice (the send)', () => {
    expect(promiseFor(m, 0)).toBe('ran');
    expect(promiseFor(m, at(2))).toBe('retried');
    expect(promiseFor(m, (at(6) + at(7)) / 2)).toBe('retried');
    expect(promiseFor(m, m.totalDisplayS)).toBe('twice');
  });
});

describe('heroReplay on other runs', () => {
  it('a run sent on try 1 has no wait and no "Sent once" unless it really was', () => {
    const ok = makeRun({ id: 'r_00000000000a', created: '2026-10-24T01:00:00.000Z' });
    const mm = replayModel(ok, WF);
    expect(frameAt(mm, mm.totalDisplayS).wait).toBeNull();
    expect(restCaption(ok, WF, mm)).toMatch(/^Team notification sent on try 1, .* after the enquiry\. Sent once\.$/);
    const sim = makeRun({ id: 'r_00000000000b', created: '2026-10-24T01:00:00.000Z', notify: { attempts: ['ok'], result: 'mock' } });
    expect(restCaption(sim, WF, replayModel(sim, WF))).not.toContain('Sent once');
  });
});
