import { describe, expect, it } from 'vitest';
import { SHOP_WF, shopRun } from '../test/otherWorkflow';
import { makeRun, type RunSpec } from '../test/runs';
import { NORTHSTAR_WF as WF } from '../test/workflow';
import { flowSummary, runStory, stripRuns, STRIP_MAX } from './runStory';

const CREATED = '2026-10-24T06:00:00.000Z';
let n = 0;
const run = (spec: Omit<RunSpec, 'id' | 'created'>, created = CREATED) =>
  makeRun({ id: `r_${(n++).toString(16).padStart(12, '0')}`, created, ...spec });
const ok = () => run({});
const outage = () => run({ notify: { attempts: ['fail', 'fail', 'ok'] }, outage: true });

describe('runStory: one run, the primary job', () => {
  it('sent on try 1, and sent after failed tries', () => {
    expect(runStory(ok(), WF)).toEqual({ kind: 'sent', text: 'Team notification sent on try 1' });
    expect(runStory(outage(), WF)).toEqual({ kind: 'recovered', text: 'Team notification sent on try 3 after 2 failed tries' });
    expect(runStory(run({ notify: { attempts: ['fail', 'ok'] } }), WF).text).toBe('Team notification sent on try 2 after 1 failed try');
  });

  it('simulated and skipped results sent nothing', () => {
    expect(runStory(run({ notify: { attempts: ['ok'], result: 'mock' } }), WF))
      .toEqual({ kind: 'simulated', text: 'Team notification simulated on try 1, nothing sent' });
    expect(runStory(run({ notify: { attempts: ['ok'], result: 'skipped_cap' } }), WF))
      .toEqual({ kind: 'skipped', text: 'Team notification skipped at the daily email cap on try 1, nothing sent' });
  });

  it('gave up, with its reason', () => {
    expect(runStory(run({ notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'] } }), WF))
      .toEqual({ kind: 'gaveup', text: 'Team notification gave up after 4 tries' });
    expect(runStory(run({ notify: { attempts: ['lease_dead'] } }), WF))
      .toEqual({ kind: 'gaveup', text: 'Team notification gave up: try 1 never reported back' });
  });

  it('still going: waiting to retry, or running', () => {
    expect(runStory(run({ notify: { attempts: ['fail'] } }), WF)).toEqual({ kind: 'waiting', text: 'Team notification failed 1 time, waiting to retry' });
    expect(runStory(run({ notify: { attempts: ['running'] } }), WF)).toEqual({ kind: 'running', text: 'Team notification still running' });
  });

  it('reads another workflow in its own words', () => {
    expect(runStory(shopRun('r_00000000000d', CREATED, 1, false), SHOP_WF)).toEqual({
      kind: 'recovered', text: 'Card payment sent on try 2 after 1 failed try',
    });
  });
});

describe('flowSummary: the line under the map title', () => {
  it('the live feed of 29 Oct: 6 on try 1, 7 on try 3 after 2 failed tries, 0 gave up', () => {
    const runs = [...Array.from({ length: 6 }, ok), ...Array.from({ length: 7 }, outage)];
    expect(flowSummary(runs, WF)).toBe('13 team notifications: 6 sent on try 1 · 7 sent on try 3 after 2 failed tries · 0 gave up');
  });

  it('only switch-off runs: no retries in the line', () => {
    expect(flowSummary(Array.from({ length: 6 }, ok), WF)).toBe('6 team notifications: 6 sent on try 1 · 0 gave up');
  });

  it('lists each group by its try, then what is still going', () => {
    const runs = [
      ok(), run({ notify: { attempts: ['fail', 'ok'] } }), outage(), outage(),
      run({ notify: { attempts: ['ok'], result: 'mock' } }),
      run({ notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'] } }),
      run({ notify: { attempts: ['fail'] } }),
    ];
    expect(flowSummary(runs, WF)).toBe(
      '7 team notifications: 1 sent on try 1 · 1 simulated on try 1 · 1 sent on try 2 after 1 failed try · 2 sent on try 3 after 2 failed tries · 1 gave up · 1 still going',
    );
  });

  it('one run reads in the singular, and no runs give no line', () => {
    expect(flowSummary([ok()], WF)).toBe('1 team notification: 1 sent on try 1 · 0 gave up');
    expect(flowSummary([], WF)).toBeNull();
  });
});

describe('stripRuns: the run strip', () => {
  it('oldest left, newest right', () => {
    const a = run({}, '2026-10-22T00:00:00.000Z');
    const b = run({}, '2026-10-24T00:00:00.000Z');
    const c = run({}, '2026-10-23T00:00:00.000Z');
    const s = stripRuns([b, a, c]);
    expect(s.runs.map((r) => r.created_at.slice(0, 10))).toEqual(['2026-10-22', '2026-10-23', '2026-10-24']);
    expect(s.label).toBe('3 runs in this window, oldest → newest.');
  });

  it(`keeps the newest ${STRIP_MAX}, and says they are the newest of the same runs the summary counts`, () => {
    const many = Array.from({ length: 57 }, (_, i) => run({}, new Date(Date.parse(CREATED) + i * 60_000).toISOString()));
    const s = stripRuns(many);
    expect(STRIP_MAX).toBe(40);
    expect(s.runs).toHaveLength(40);
    expect(s.runs[0]?.created_at).toBe(many[17]?.created_at);
    expect(s.label).toBe('The newest 40 of these 57 runs, oldest → newest.');
  });

  it('one run', () => {
    expect(stripRuns([ok()]).label).toBe('1 run in this window.');
  });
});
