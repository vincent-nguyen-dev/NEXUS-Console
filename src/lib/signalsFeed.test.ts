import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import { GUIDED_RUN } from './guided';
import { LATEST_SIGNALS, latestRuns, selectSignals, signalRows } from './signalsFeed';
import { NORTHSTAR_WF as WF } from '../test/workflow';

const all = { step: null, attempt: null };

describe('signalRows: the recorded run', () => {
  const rows = signalRows([GUIDED_RUN], WF);

  it('lists five signals, newest first, with the retry plan joined to its failure', () => {
    expect(rows.map((r) => [r.text, r.tone])).toEqual([
      ['Team notification recovered on try 3 (email sent)', 'ok'],
      ['Team notification failed on try 2 (simulated outage). Retry planned in 30 s', 'retry'],
      ['Visitor confirmation worked on try 1 (simulated, never sent)', 'simulated'],
      ['Team notification failed on try 1 (simulated outage). Retry planned in 10 s', 'retry'],
      ['New enquiry: three jobs queued', 'lead'],
    ]);
    expect(rows.every((r) => r.runId === 'r_6d15828d95f5')).toBe(true);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  it('follows the map selection: a step drops Lead rows, a try keeps only that attempt', () => {
    expect(selectSignals(rows, { step: 'notify_team', attempt: null }).total).toBe(3);
    expect(selectSignals(rows, { step: 'notify_team', attempt: 2 }).rows.map((r) => r.attempt)).toEqual([2]);
    expect(selectSignals(rows, { step: 'confirm_visitor', attempt: null }).total).toBe(1);
    expect(selectSignals(rows, { step: 'purge_pii', attempt: null })).toEqual({ rows: [], total: 0 });
    expect(selectSignals(rows, all).total).toBe(5);
  });
});

describe('signalRows: other shapes', () => {
  const created = '2026-10-24T06:00:00.000Z';

  it('the live feed of 24 Oct: 3 rows per normal run, 5 per outage run, 8 shown', () => {
    const normal = [0, 1, 2].map((i) => makeRun({ id: `r_00000000000${i}`, created }));
    const outage = [3, 4, 5].map((i) => makeRun({ id: `r_00000000000${i}`, created, outage: true, notify: { attempts: ['fail', 'fail', 'ok'] } }));
    const rows = signalRows([...normal, ...outage], WF);
    expect(rows).toHaveLength(3 * 3 + 3 * 5);
    expect(selectSignals(rows, all)).toMatchObject({ total: 24 });
    expect(selectSignals(rows, all).rows).toHaveLength(LATEST_SIGNALS);
  });

  it('a last failure without a retry is marked dead, and the give-up gets its own row', () => {
    const r = makeRun({ id: 'r_00000000000a', created, notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'] } });
    const team = selectSignals(signalRows([r], WF), { step: 'notify_team', attempt: 4 }).rows;
    expect(team.map((s) => [s.text, s.tone])).toEqual([
      ['Team notification gave up after 4 tries', 'dead'],
      ['Team notification failed on try 4 (simulated outage)', 'dead'],
    ]);
  });

  it('a send skipped at the cap is neutral, never a success', () => {
    const r = makeRun({ id: 'r_00000000000b', created, notify: { attempts: ['ok'], result: 'skipped_cap' } });
    const [row] = selectSignals(signalRows([r], WF), { step: 'notify_team', attempt: null }).rows;
    expect(row).toMatchObject({ text: 'Team notification skipped on try 1 (skipped at the daily email cap)', tone: 'neutral' });
  });

  it('leaves out started events, so a running job has no signal yet', () => {
    const r = makeRun({ id: 'r_00000000000c', created, notify: { attempts: ['running'] } });
    expect(selectSignals(signalRows([r], WF), { step: 'notify_team', attempt: null }).total).toBe(0);
  });
});

describe('latestRuns: one row per run (S4b)', () => {
  const at = (h: number) => `2026-10-24T${String(h).padStart(2, '0')}:00:00.000Z`;
  const ok = makeRun({ id: 'r_00000000000a', created: at(1) });
  const outage = makeRun({ id: 'r_00000000000b', created: at(2), notify: { attempts: ['fail', 'fail', 'ok'] }, outage: true });
  const later = makeRun({ id: 'r_00000000000c', created: at(3) });
  const runs = [ok, outage, later];

  it('the same runs the moments showed, newest update first, each told by its primary job', () => {
    const { rows, total } = latestRuns(runs, WF, all);
    expect(rows.map((r) => r.runId)).toEqual(['r_00000000000c', 'r_00000000000b', 'r_00000000000a']);
    expect(total).toBe(3);
    expect(rows[1]).toMatchObject({
      story: { kind: 'recovered', text: 'Team notification sent on try 3 after 2 failed tries' },
      flags: ['Outage switch'], trouble: [],
    });
    expect(new Set(rows[1]?.moments.map((m) => m.runId))).toEqual(new Set(['r_00000000000b']));
    expect(rows[1]?.at).toBe(rows[1]?.moments[0]?.at);
    expect(new Set(rows.map((r) => r.runId))).toEqual(new Set(signalRows(runs, WF).map((r) => r.runId)));
  });

  it('a map selection keeps the runs with a moment there', () => {
    expect(latestRuns(runs, WF, { step: 'notify_team', attempt: 2 }).rows.map((r) => r.runId)).toEqual(['r_00000000000b']);
    expect(latestRuns(runs, WF, { step: 'notify_team', attempt: 4 })).toEqual({ rows: [], total: 0 });
  });

  it('caps the rows but keeps the total; the recording is one row', () => {
    const capped = latestRuns(runs, WF, all, 2);
    expect(capped.rows).toHaveLength(2);
    expect(capped.total).toBe(3);
    expect(latestRuns([GUIDED_RUN], WF, all).rows).toHaveLength(1);
    expect(latestRuns([], WF, all)).toEqual({ rows: [], total: 0 });
  });

  it('trouble in another job gets its own sentence; a scheduled deletion never does', () => {
    const stuck = makeRun({ id: 'r_00000000000d', created: at(4), confirm: { attempts: ['fail'] } });
    expect(latestRuns([stuck], WF, all).rows[0]?.trouble).toEqual(['Visitor confirmation failed 1 time, waiting to retry']);
    expect(latestRuns([ok], WF, all).rows[0]?.trouble).toEqual([]);
  });
});
