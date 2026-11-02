import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import { GUIDED_RUN } from './guided';
import { heroModel } from './hero';
import { NORTHSTAR_WF as WF } from '../test/workflow';

// Hand-checked from src/fixtures/guided-run.json, offsets from created_at 03:07:46.373512:
// try 1 failed +0.758, try 2 failed +11.281, try 3 sent +42.673; waits 10.948 − 0.758 = 10.190 and
// 41.472 − 11.281 = 30.191 (40.381 in total); confirmation +1.377 (mock); deletion due exactly 7 days later.
describe('heroModel on the recording', () => {
  const m = heroModel(GUIDED_RUN, WF);

  it('labels each team notification try with its outcome and the time it ended', () => {
    expect(m.team.tries.map((t) => t.label)).toEqual([
      'try 1 failed · +0.8 s', 'try 2 failed · +11.3 s', 'try 3 sent · +42.7 s',
    ]);
    expect(m.team.tries.map((t) => t.cause)).toEqual(['email service down (simulated)', 'email service down (simulated)', null]);
    expect(m.team.tries.map((t) => [t.title, t.time])).toEqual([['try 1 failed', '+0.8 s'], ['try 2 failed', '+11.3 s'], ['try 3 sent', '+42.7 s']]);
  });

  it('says once why the tries failed', () => {
    expect(m.team.failureNote).toBe('Why tries 1 and 2 failed: email service down (simulated), so nothing was sent');
  });

  it('writes the waits as what Northstar did, with the measured time', () => {
    expect(m.team.waits.map((w) => w.label)).toEqual(['waited 10.2 s, tried again', 'waited 30.2 s, tried again']);
    expect(m.waitingS).toBeCloseTo(40.381, 3);
  });

  it('says the email was sent exactly once', () => {
    expect(m.team.sentOnce).toBe(true);
  });

  it('marks the visitor confirmation as simulated, and the deletion as due on day 7', () => {
    expect(m.visitor).toEqual({ label: 'worked on try 1 · +1.4 s · simulated', simulated: true });
    expect(m.deletion).toBe('scheduled for day 7');
    expect(m.when).toBe('22 Oct, 03:07 UTC');
  });

  it('sums the run up in one sentence for screen readers', () => {
    expect(m.summary).toBe(
      'One recorded enquiry, 22 Oct, 03:07 UTC. Team notification: try 1 and try 2 failed (simulated outage); ' +
      'after waits of 10.2 s and 30.2 s, try 3 sent the email once at +42.7 s. ' +
      'Visitor confirmation: worked on try 1 · +1.4 s · simulated (no email goes to visitors). Personal data deletion: scheduled for day 7.',
    );
  });
});

describe('heroModel on other runs (the figure must never claim more than the run shows)', () => {
  it('names a failure that is not the outage switch in its own words', () => {
    const run = makeRun({ id: 'r_000000000001', created: '2026-10-01T00:00:00Z', notify: { attempts: ['fail', 'ok'], error: 'internal_error' } });
    const m = heroModel(run, WF);
    expect(m.team.tries[0]?.cause).toBe('internal error');
    // Only the outage switch is known to stop before the email service.
    expect(m.team.failureNote).toBe('Why try 1 failed: internal error');
  });

  it('doesn\'t call a simulated result "sent"', () => {
    const run = makeRun({ id: 'r_000000000002', created: '2026-10-01T00:00:00Z', notify: { attempts: ['ok'], result: 'mock' } });
    const m = heroModel(run, WF);
    expect(m.team.tries[0]?.label).toBe('try 1 ended · +1.0 s');
    expect(m.team.sentOnce).toBe(false);
  });

  it('leaves out a try that is still running', () => {
    const run = makeRun({ id: 'r_000000000003', created: '2026-10-01T00:00:00Z', notify: { attempts: ['fail', 'running'] } });
    expect(heroModel(run, WF).team.tries.map((t) => t.attempt)).toEqual([1]);
  });
});
