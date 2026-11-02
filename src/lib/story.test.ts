import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import { GUIDED_RUN } from './guided';
import {
  BEATS, GUIDED_RESET, checkAnswers, correctChoice, duration, failingJob, finalTry, findJob, parseBeat, recovery,
  recoveryBreakdown, sceneAnswer, sceneFeedback, sendCount, sentOnce, serializeBeat, verdictRows,
} from './story';
import { NORTHSTAR_WF as WF } from '../test/workflow';

describe('the recorded run: findings (hand-checked)', () => {
  it('two failed tries, then the email', () => {
    expect(findJob(GUIDED_RUN, WF)).toBe('Team notification: try 1 and try 2 failed (simulated outage), then try 3 sent the email.');
  });

  it('recovered on try 3 after waits of 10.190001 s and 30.190512 s', () => {
    expect(finalTry(GUIDED_RUN, WF)).toBe(3);
    expect(recovery(GUIDED_RUN, WF)).toBe('Yes. Try 3 sent the email, after waits of 10.2 s and 30.2 s between tries.');
  });

  it('42.672518 s in all; the waits add up to 40.380513 s', () => {
    expect(duration(GUIDED_RUN, WF)).toBe('42.7 s from the enquiry until the last job finished. 40.4 s of it was waiting between tries, on purpose.');
  });

  it('sent once, and the two failed tries sent nothing (the outage switch stops before the email service)', () => {
    expect(sentOnce(GUIDED_RUN, WF)).toBe(
      'Once. Try 3 sent the email. Tries 1 and 2 failed before Northstar contacted the email service ' +
      '(the outage switch stops there), so they sent nothing.',
    );
    expect(sendCount(GUIDED_RUN, WF)).toBe('3 tries · 2 failed · 1 sent');
  });

  it('the console\'s recorded-run mode starts clean', () => {
    expect(GUIDED_RESET).toEqual({ mode: 'guided', view: 'overview', step: null, attempt: null, event: null, run: null, flags: null });
  });
});

describe('beats and the URL', () => {
  it('has five beats with their titles', () => {
    expect(BEATS.map((b) => b.title)).toEqual(['Which job failed?', 'Watch it happen', 'Did it recover?', 'Was it sent twice?', 'Your verdict']);
  });

  it('reads ?beat=1–5 and falls back to beat 1 for anything else', () => {
    expect(parseBeat('')).toBe(1);
    expect(parseBeat('?beat=3')).toBe(3);
    expect(parseBeat('?beat=5')).toBe(5);
    for (const bad of ['?beat=0', '?beat=6', '?beat=2.5', '?beat=x', '?beat=']) expect(parseBeat(bad)).toBe(1);
  });

  it('writes beat 1 as the plain /story', () => {
    expect(serializeBeat(1)).toBe('');
    expect(serializeBeat(4)).toBe('?beat=4');
    for (const n of [1, 2, 3, 4, 5]) expect(parseBeat(serializeBeat(n))).toBe(n);
  });
});

describe('beat 1: which job failed?', () => {
  it('the team notification is the failing job', () => {
    expect(failingJob(GUIDED_RUN)).toBe('notify_team');
  });

  it('confirms the right pick with its cause', () => {
    expect(sceneFeedback(GUIDED_RUN, 'notify_team', WF)).toEqual({
      right: true, text: 'Right: the team notification. Try 1 failed because the email service was down (a simulated outage).',
    });
  });

  it('gives the answer without a mark after a skip', () => {
    expect(sceneAnswer(GUIDED_RUN, WF)).toBe('It was the team notification. Try 1 failed because the email service was down (a simulated outage).');
    expect(sceneAnswer(makeRun({ id: 'r_00000000000f', created: '2026-10-24T06:00:00.000Z' }), WF)).toBe('No job failed in this run.');
  });

  it('explains each wrong pick from the data', () => {
    expect(sceneFeedback(GUIDED_RUN, 'confirm_visitor', WF)).toEqual({
      right: false,
      text: 'Not this one: the visitor confirmation went through on try 1. The team notification is the one that failed.',
    });
    expect(sceneFeedback(GUIDED_RUN, 'purge_pii', WF)).toEqual({
      right: false,
      text: "Not this one: the personal data deletion doesn't run until day 7. The team notification is the one that failed.",
    });
  });
});

describe('beat 3: the time reconciles', () => {
  // 42.673 = 40.381 waiting + 2.292 working; working = first pickup 0.421 + try 1 0.337 + try 2 0.333 + try 3 1.201.
  const b = recoveryBreakdown(GUIDED_RUN, WF);

  it('splits 42.7 s into 40.4 s waiting and 2.3 s working', () => {
    expect(b?.totalS).toBeCloseTo(42.673, 3);
    expect(b?.waitingS).toBeCloseTo(40.381, 3);
    expect(b?.workingS).toBeCloseTo(2.292, 3);
  });

  it('accounts for every working second: the parts add up within 1 ms', () => {
    expect(b?.parts.map((p) => p.label)).toEqual(['first pickup', 'try 1', 'try 2', 'try 3']);
    expect(b?.parts.map((p) => +p.s.toFixed(3))).toEqual([0.421, 0.337, 0.333, 1.201]);
    const sum = (b?.parts ?? []).reduce((s, p) => s + p.s, 0);
    expect(Math.abs(sum - (b?.workingS ?? 0))).toBeLessThan(0.001);
  });

  it('knows the parts rounded one by one add up to 2.2, not 2.3 (so the page says so)', () => {
    expect(b?.partsRoundedSumS).toBe(2.2);
  });

  it('has no breakdown when the team notification never succeeded', () => {
    const dead = makeRun({ id: 'r_00000000000d', created: '2026-10-24T06:00:00.000Z', notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'] } });
    expect(recoveryBreakdown(dead, WF)).toBeNull();
  });
});

describe('the answers are checked against the data', () => {
  it('the recorded run: yes · 10 s to 1 min · once', () => {
    expect(correctChoice(GUIDED_RUN, 'recovered', WF)).toBe('yes');
    expect(correctChoice(GUIDED_RUN, 'duration', WF)).toBe('10s_1min'); // 42.7 s
    expect(correctChoice(GUIDED_RUN, 'sent', WF)).toBe('once');
  });

  it('marks each answered question on its beat; unanswered ones are left out', () => {
    const checks = checkAnswers(GUIDED_RUN, { recovered: 'yes', sent: 'more' }, WF);
    expect(checks.map((c) => [c.id, c.right])).toEqual([['recovered', true], ['sent', false]]);
    expect(checks[0]?.text).toMatch(/^Right: Yes\. Try 3 sent the email/);
    expect(checks[1]?.text).toMatch(/^The data says: Once\. Try 3 sent the email\./);
  });

  it('the verdict keeps your answer and the data apart, and a skip is neutral', () => {
    const rows = verdictRows(GUIDED_RUN, { recovered: 'yes', duration: 'over_1min' }, WF);
    expect(rows.map((r) => [r.id, r.answer, r.data, r.right])).toEqual([
      ['recovered', 'Yes', 'Yes', true],
      ['duration', 'Over 1 min', '10 s to 1 min', false],
      ['sent', null, 'Once', null],
    ]);
    expect(rows[2]?.question).toBe("How many times was the team's email sent?");
    expect(rows[2]?.fact).toMatch(/^Once\. /);
  });

  it('a reload (no answers) shows every question as not answered', () => {
    expect(verdictRows(GUIDED_RUN, {}, WF).every((r) => r.answer === null && r.right === null)).toBe(true);
  });

  it('is not hard-wired to "yes": a run that gave up', () => {
    const dead = makeRun({ id: 'r_00000000000d', created: '2026-10-24T06:00:00.000Z', notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'] } });
    expect(correctChoice(dead, 'recovered', WF)).toBe('no');
    expect(correctChoice(dead, 'duration', WF)).toBe('never');
    expect(correctChoice(dead, 'sent', WF)).toBe('none');
    expect(findJob(dead, WF)).toBe('Team notification: try 1, try 2 and try 3 failed (simulated outage), then it gave up on try 4.');
    expect(recovery(dead, WF)).toBe('No. The team notification gave up after 4 tries. No email was sent.');
    expect(sentOnce(dead, WF)).toBe('Not at all: the team notification never succeeded, so the email was never sent.');
    expect(sendCount(dead, WF)).toBe('4 tries · 4 failed · 0 sent');
    expect(checkAnswers(dead, { recovered: 'yes' }, WF)[0]?.right).toBe(false);
  });

  it('a fast first-try run: under 10 s, and nothing to recover from', () => {
    const fast = makeRun({ id: 'r_00000000000f', created: '2026-10-24T06:00:00.000Z' });
    expect(correctChoice(fast, 'duration', WF)).toBe('under_10s');
    expect(correctChoice(fast, 'recovered', WF)).toBe('no');
    expect(recovery(fast, WF)).toBe("It didn't need to: try 1 succeeded with no failure before it.");
    expect(duration(fast, WF)).toBe('1.0 s from the enquiry until the last job finished, with no waiting between tries.');
    expect(sentOnce(fast, WF)).toBe('Once. Try 1 sent the email.');
    expect(sendCount(fast, WF)).toBe('1 try · 0 failed · 1 sent');
    expect(sceneFeedback(fast, 'notify_team', WF).text).toBe("Not this one: the team notification went through on try 1. No job failed in this run.");
  });
});

describe('sent once: never claims more than the run shows', () => {
  const created = '2026-10-24T06:00:00.000Z';

  it('another error may have reached the email service, so it gets no "sent nothing" claim', () => {
    const run = makeRun({ id: 'r_000000000011', created, notify: { attempts: ['fail', 'ok'], error: 'internal_error' } });
    expect(sentOnce(run, WF)).toBe('Once: try 2 is the only try that recorded "sent".');
    expect(recovery(run, WF)).toBe('Yes. Try 2 sent the email, after waits of 10.2 s between tries.');
  });

  it('one failed outage try is singular', () => {
    const run = makeRun({ id: 'r_000000000012', created, outage: true, notify: { attempts: ['fail', 'ok'] } });
    expect(sentOnce(run, WF)).toMatch(/Try 1 failed before Northstar contacted the email service \(the outage switch stops there\), so it sent nothing\.$/);
  });

  it('a simulated result is not at all, and recovery names the result instead of "sent"', () => {
    const run = makeRun({ id: 'r_000000000013', created, notify: { attempts: ['fail', 'ok'], result: 'mock' } });
    expect(sentOnce(run, WF)).toBe('Not at all: the one success had the result "mock", so nothing was sent.');
    expect(recovery(run, WF)).toBe('Yes. Try 2 finished (result: mock), after waits of 10.2 s between tries.');
    expect(sendCount(run, WF)).toBe('2 tries · 1 failed · 0 sent');
  });

  it('two success events read as more than once', () => {
    const r = makeRun({ id: 'r_000000000014', created });
    const ok = r.events.find((e) => e.kind === 'notify_team' && e.event === 'succeeded');
    const twice = { ...r, events: ok ? [...r.events, { ...ok, at: '2026-10-24T06:00:05.000Z' }] : r.events };
    expect(sentOnce(twice, WF)).toBe('More than once: Northstar recorded 2 successes, so the email may have gone out more than once.');
  });
});
