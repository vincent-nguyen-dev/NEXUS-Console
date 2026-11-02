import { describe, expect, it } from 'vitest';
import { makeRun, type RunSpec } from '../test/runs';
import { GUIDED_PAGE, GUIDED_RUN } from './guided';
import { chainText, lookupRun, runChain, runSummary, stepTimeline } from './runDetail';
import { parseInstant } from './time';
import type { Run } from './types';
import { NORTHSTAR_WF as WF } from '../test/workflow';

const CREATED = '2026-10-24T06:00:00.000Z';
const NOW = '2026-10-25T00:00:00.000Z';
let n = 0;
const run = (spec: Omit<RunSpec, 'id' | 'created'>) =>
  makeRun({ id: `r_${(n++).toString(16).padStart(12, '0')}`, created: CREATED, ...spec });

describe('runSummary: the recorded run (hand-checked)', () => {
  const s = runSummary(GUIDED_RUN, GUIDED_PAGE.now, WF);

  it('says it recovered and sent one email, 42.7 s after the lead (03:08:29.046030 − 03:07:46.373512 = 42.672518 s)', () => {
    expect(s.headline).toBe('The team notification recovered after 2 failed tries: one email was sent, 42.7 s after the enquiry came in.');
  });

  it('calls the visitor confirmation simulated and dates the purge 7 days on', () => {
    expect(s.lines).toEqual([
      'The visitor confirmation was simulated on try 1: nothing was sent.',
      'Personal data deletion is scheduled for 29 Oct 2026, 7 days after the enquiry.',
    ]);
  });

  it('lists the facts', () => {
    expect(s.facts.map(({ id, label, value }) => ({ id, label, value }))).toEqual([
      { id: 'tries', label: 'Team notification tries', value: '3 of 4 allowed' },
      { id: 'sent', label: 'Emails sent', value: '1' },
      { id: 'completion', label: 'Enquiry to last job', value: '42.7 s' },
      { id: 'flag:simulate_outage', label: 'Outage switch', value: 'On (fails team notification tries 1 and 2 on purpose)' },
    ]);
  });

  it('says how each fact is counted', () => {
    expect(s.facts.map((f) => f.how)).toEqual([
      'Tries started, out of the 4 allowed.',
      "Successful tries whose result means it was really sent. Simulated results aren't counted.",
      "From the enquiry until the last of the jobs that start right away finished. Personal data deletion isn't counted: it runs 7 days later.",
      "A test switch set on this run. When it's on, it fails team notification tries 1 and 2 on purpose.",
    ]);
  });

  it('answers "sent once?" with yes', () => {
    expect(s.sentOnce.answer).toBe('yes');
    expect(s.sentOnce.text).toMatch(/^Yes\. The team notification recorded exactly one success \(result: sent\)/);
  });
});

describe('runSummary: every other outcome', () => {
  const summary = (r: Run) => runSummary(r, NOW, WF);

  it('first try, and a try > 1 after a lease expiry (no failure recorded)', () => {
    expect(summary(run({})).headline).toBe('The team notification was sent on the first try, 1.0 s after the enquiry came in.');
    const lease = summary(run({ notify: { attempts: ['lease', 'ok'] } }));
    expect(lease.headline).toMatch(/^The team notification was sent on try 2, /);
    expect(lease.facts[0]?.value).toBe('2 of 4 allowed');
  });

  it('simulated and skipped results are never an email', () => {
    const mock = summary(run({ notify: { attempts: ['ok'], result: 'mock' } }));
    expect(mock.headline).toBe('The team notification finished on try 1 (simulated, no email provider), so nothing was sent.');
    expect(mock.sentOnce).toEqual({ answer: 'no', text: 'No email was sent: the result was simulated, no email provider.' });
    expect(mock.facts[1]?.value).toBe('0');
    const cap = summary(run({ notify: { attempts: ['ok'], result: 'skipped_cap' } }));
    expect(cap.headline).toBe('The team notification was skipped at the daily email cap on try 1, so nothing was sent.');
    expect(cap.sentOnce.text).toBe('No email was sent: skipped at the daily email cap.');
  });

  it('gave up, by failures or by a timed-out worker', () => {
    const dead = summary(run({ notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'] } }));
    expect(dead.headline).toBe('The team notification gave up after 4 tries. No email was sent.');
    expect(dead.sentOnce).toEqual({ answer: 'no', text: 'No email was sent: the job gave up.' });
    expect(dead.facts[2]?.value).toBe('Not complete');
    const lease = summary(run({ notify: { attempts: ['lease_dead'] } }));
    expect(lease.headline).toBe('The team notification gave up: try 1 never reported back. No email was sent.');
  });

  it('describes unfinished jobs at the last update, never as now', () => {
    const retrying = summary(run({ notify: { attempts: ['fail'] } }));
    expect(retrying.headline).toBe('Not finished at the last update: the team notification failed 1 time and was waiting to retry.');
    expect(retrying.sentOnce).toEqual({ answer: 'not_yet', text: "Not yet: the team notification hadn't finished at the last update." });
    const running = summary(run({ notify: { attempts: ['running'] }, confirm: { attempts: ['running'] } }));
    expect(running.headline).toBe('Not finished at the last update: the team notification was still in progress.');
    expect(running.lines[0]).toBe("The visitor confirmation hadn't finished at the last update.");
  });

  it('flags a duplicate send (two success events, built by hand: Northstar never records one)', () => {
    const r = run({});
    const ok = r.events.find((e) => e.kind === 'notify_team' && e.event === 'succeeded');
    const twice: Run = { ...r, events: ok ? [...r.events, { ...ok, at: '2026-10-24T06:00:05.000Z' }] : r.events };
    const s = summary(twice);
    expect(s.headline).toBe('The team notification recorded 2 successes: the email may have gone out more than once.');
    expect(s.sentOnce).toEqual({ answer: 'no', text: 'No: 2 success events were recorded.' });
    expect(s.facts[1]?.value).toBe('2');
  });

  it('flags an unknown result', () => {
    const s = summary(run({ notify: { attempts: ['ok'], result: 'bounced' } }));
    expect(s.headline).toBe('The team notification finished with an unrecognized result: bounced.');
    expect(s.sentOnce.answer).toBe('unclear');
  });

  it('dates the purge: done, or overdue against the server clock', () => {
    expect(summary(run({ purged: true })).lines[1]).toBe('Personal data deletion finished on 31 Oct 2026 (deleted).');
    const overdue = runSummary(run({}), '2026-11-02T00:00:00.000Z', WF);
    expect(overdue.lines[1]).toBe("Personal data deletion was due on 31 Oct 2026 and hadn't run at the last update.");
  });
});

describe('stepTimeline: the recorded run (hand-checked offsets from 03:07:46.373512)', () => {
  it('team notification: 9 events → 7 rows, each retry plan joined to its failure', () => {
    expect(stepTimeline(GUIDED_RUN, 'notify_team', WF).map((r) => [r.offset, r.text, r.note, r.tone])).toEqual([
      ['+0.0 s', 'Queued when the enquiry came in', null, 'neutral'],
      ['+0.4 s', 'Try 1 started', null, 'neutral'], // 0.421393
      ['+0.8 s', 'Try 1 failed: simulated outage', 'Retry planned for +10.8 s (10 s wait)', 'retry'], // 0.758476 + 10
      ['+10.9 s', 'Try 2 started', 'Waited 10.2 s, planned 10 s (0.2 s later)', 'neutral'], // 10.948477; waited 10.190001
      ['+11.3 s', 'Try 2 failed: simulated outage', 'Retry planned for +41.3 s (30 s wait)', 'retry'], // 11.281331 + 30
      ['+41.5 s', 'Try 3 started', 'Waited 30.2 s, planned 30 s (0.2 s later)', 'neutral'], // 41.471843; waited 30.190512
      ['+42.7 s', 'Try 3 succeeded: email sent', null, 'ok'], // 42.672518
    ]);
  });

  it('visitor confirmation: simulated, never sent', () => {
    expect(stepTimeline(GUIDED_RUN, 'confirm_visitor', WF).map((r) => [r.offset, r.text])).toEqual([
      ['+0.0 s', 'Queued when the enquiry came in'],
      ['+1.0 s', 'Try 1 started'], // 1.044299
      ['+1.4 s', 'Try 1 finished: simulated, never sent'], // 1.376794
    ]);
  });

  it('purge: scheduled, with its due day', () => {
    expect(stepTimeline(GUIDED_RUN, 'purge_pii', WF).map((r) => [r.text, r.note])).toEqual([['Scheduled when the enquiry came in', 'Due 29 Oct 2026']]);
  });

  it("the planned time from the events matches Northstar's own run_after (03:07:57.654843 + 30 s)", () => {
    const retry = GUIDED_RUN.events.find((e) => e.kind === 'notify_team' && e.event === 'retry_scheduled' && e.attempt === 2);
    const step = GUIDED_RUN.steps.find((s) => s.kind === 'notify_team');
    expect(retry && step && parseInstant(retry.at) + Number(retry.detail) * 1000).toBe(step && parseInstant(step.run_after));
  });
});

describe('stepTimeline: other shapes', () => {
  it('explains a retry after a timed-out worker (no failed event)', () => {
    const rows = stepTimeline(run({ notify: { attempts: ['lease', 'ok'] } }), 'notify_team', WF);
    expect(rows.map((r) => r.text)).toEqual(['Queued when the enquiry came in', 'Try 1 started', 'Try 2 started', 'Try 2 succeeded: email sent']);
    expect(rows[2]?.note).toBe('Try 1 never reported back, so the job was started again.');
  });

  it('ends a dead job with the give-up, and its last failure has no retry plan', () => {
    const rows = stepTimeline(run({ notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'] } }), 'notify_team', WF);
    expect(rows.slice(-2).map((r) => [r.text, r.note, r.tone])).toEqual([
      ['Try 4 failed: simulated outage', null, 'dead'],
      ['Gave up after 4 tries', null, 'dead'],
    ]);
    expect(rows.find((r) => r.text === 'Try 4 started')?.note).toBe('Waited 2 min 0 s, planned 2 min (0.2 s later)');
  });

  it('says "on time" when the wait is within 0.05 s of the plan', () => {
    const r = run({ notify: { attempts: ['fail', 'ok'] } });
    const moved: Run = {
      ...r,
      events: r.events.map((e) => (e.kind === 'notify_team' && e.event === 'started' && e.attempt === 2
        ? { ...e, at: new Date(Date.parse(e.at) - 160).toISOString() } // 10.2 s → 10.04 s
        : e)),
    };
    expect(stepTimeline(moved, 'notify_team', WF)[3]?.note).toBe('Waited 10.0 s, planned 10 s (on time)');
  });

  it('shows the simulated and skipped team results as such', () => {
    expect(stepTimeline(run({ notify: { attempts: ['ok'], result: 'mock' } }), 'notify_team', WF).at(-1)?.text)
      .toBe('Try 1 finished: simulated, no email provider');
    const cap = stepTimeline(run({ notify: { attempts: ['ok'], result: 'skipped_cap' } }), 'notify_team', WF).at(-1);
    expect([cap?.text, cap?.tone]).toEqual(['Try 1 finished: skipped at the daily email cap (nothing sent)', 'neutral']);
  });
});

describe('runChain', () => {
  it('the recorded run: ✕ 10.2 s ✕ 30.2 s ✓', () => {
    const chain = runChain(GUIDED_RUN, 'notify_team', WF);
    expect(chain.map((l) => [l.attempt, l.label, l.tone, l.waitBefore])).toEqual([
      [1, 'failed', 'retry', null], [2, 'failed', 'retry', '10.2 s'], [3, 'sent', 'ok', '30.2 s'],
    ]);
    expect(chainText(chain)).toBe('Try 1 failed, waited 10.2 s, try 2 failed, waited 30.2 s, try 3 sent');
    // The visitor confirmation succeeds, but it is simulated: the chain never says "sent" for it.
    expect(chainText(runChain(GUIDED_RUN, 'confirm_visitor', WF))).toBe('Try 1 simulated');
    expect(runChain(GUIDED_RUN, 'confirm_visitor', WF).map((l) => l.tone)).toEqual(['simulated']);
    expect(runChain(GUIDED_RUN, 'purge_pii', WF)).toEqual([]);
  });

  it('ends in a wait while a retry is planned, and marks a timed-out worker', () => {
    expect(chainText(runChain(run({ notify: { attempts: ['fail'] } }), 'notify_team', WF))).toBe('Try 1 failed, waiting, try 2 not started yet');
    // A try that never reported back was retried: its own shape, never the ✕ that means the job gave up.
    expect(runChain(run({ notify: { attempts: ['lease', 'ok'] } }), 'notify_team', WF).map((l) => [l.label, l.tone]))
      .toEqual([['never reported back', 'noresult'], ['sent', 'ok']]);
    const cap = runChain(run({ notify: { attempts: ['ok'], result: 'skipped_cap' } }), 'notify_team', WF);
    expect(cap.map((l) => [l.label, l.tone])).toEqual([['skipped', 'neutral']]);
  });
});

describe('lookupRun', () => {
  const page = { now: NOW, truncated: false, workflow: WF, runs: [GUIDED_RUN] };

  it('finds the run, or waits for data', () => {
    expect(lookupRun('r_6d15828d95f5', page, { source: 'live', win: '30d' })).toEqual({ kind: 'found', run: GUIDED_RUN });
    expect(lookupRun('r_6d15828d95f5', null, { source: 'live', win: '30d' })).toEqual({ kind: 'loading' });
  });

  it('says why a run is missing', () => {
    const missing = (id: string, p: typeof page, guided: boolean, win: '30d' | 'all') => lookupRun(id, p, { source: guided ? 'recording' : 'live', win });
    expect(missing('r_000000000000', GUIDED_PAGE, true, '30d')).toEqual({ kind: 'missing', reason: 'recording' });
    expect(missing('r_000000000000', page, false, '30d')).toEqual({ kind: 'missing', reason: 'window' });
    expect(missing('r_000000000000', page, false, 'all')).toEqual({ kind: 'missing', reason: 'unknown' });
    expect(missing('r_000000000000', { ...page, truncated: true }, false, 'all')).toEqual({ kind: 'missing', reason: 'truncated' });
  });
});
