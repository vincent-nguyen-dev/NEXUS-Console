import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import { NORTHSTAR_WF as WF } from '../test/workflow';
import { GUIDED_PAGE, GUIDED_RUN } from './guided';
import { traceNote, traceOf } from './runTrace';

describe('traceOf: one run on the map', () => {
  const t = traceOf(GUIDED_RUN, WF);
  const team = t.lanes.find((l) => l.kind === 'notify_team');
  const visitor = t.lanes.find((l) => l.kind === 'confirm_visitor');
  const purge = t.lanes.find((l) => l.kind === 'purge_pii');

  it('the recorded run: two failed tries, two waits, sent on try 3 (hand-checked offsets)', () => {
    expect(team?.tries).toEqual([
      { attempt: 1, outcome: 'failed', at: '+0.8 s' }, // 0.758476
      { attempt: 2, outcome: 'failed', at: '+11.3 s' }, // 11.281331
      { attempt: 3, outcome: 'sent', at: '+42.7 s' }, // 42.672518
    ]);
    expect(team?.waits).toEqual([{ afterTry: 1, text: 'waited 10.2 s' }, { afterTry: 2, text: 'waited 30.2 s' }]);
    expect(team?.finished).toBe(true);
  });

  it('the visitor confirmation is simulated, and the deletion is due a week later', () => {
    expect(visitor?.tries).toEqual([{ attempt: 1, outcome: 'simulated', at: '+1.4 s' }]);
    expect(purge?.tries).toEqual([]);
    expect(purge?.due).toBe('29 Oct 2026');
  });

  it('a try that never reported back, and a retry still waiting', () => {
    const lease = traceOf(makeRun({ id: 'r_00000000000a', created: '2026-10-24T06:00:00.000Z', notify: { attempts: ['lease', 'ok'] } }), WF);
    expect(lease.lanes[0]?.tries.map((x) => x.outcome)).toEqual(['noresult', 'sent']);
    const waiting = traceOf(makeRun({ id: 'r_00000000000b', created: '2026-10-24T06:00:00.000Z', notify: { attempts: ['fail'] } }), WF);
    expect(waiting.lanes[0]?.waits).toEqual([{ afterTry: 1, text: 'waiting now' }]);
    expect(waiting.lanes[0]?.finished).toBe(false);
  });
});

describe('traceNote: what the note under the map says', () => {
  it('the run, its test switch, then the same summary as its drawer', () => {
    expect(traceNote(GUIDED_RUN, GUIDED_PAGE.now, WF, '6d15')).toBe(
      'Run 6d15 · outage switch on. The team notification recovered after 2 failed tries: one email was sent, 42.7 s after the enquiry came in. '
      + 'The visitor confirmation was simulated on try 1: nothing was sent. Personal data deletion is scheduled for 29 Oct 2026, 7 days after the enquiry.',
    );
  });
});
