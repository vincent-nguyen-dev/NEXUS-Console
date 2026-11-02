import { describe, expect, it } from 'vitest';
import { makeRun, must, type RunSpec } from '../test/runs';
import { GUIDED_PAGE, GUIDED_RUN } from './guided';
import { mapGrid, mapModel, neighbor, newSignals, selectionNote, stepPurpose, tabStop, waitSummary, type MapModel } from './map';
import { minWideWidth, wideLayout } from './mapGeometry';
import type { Run, RunsPage } from './types';
import { NORTHSTAR_WF as WF } from '../test/workflow';

let n = 0;
const run = (spec: Omit<RunSpec, 'id' | 'created'>) =>
  makeRun({ id: `r_${(n++).toString(16).padStart(12, '0')}`, created: '2026-10-24T06:00:00.000Z', ...spec });
const ok = () => run({});
const outage = () => run({ notify: { attempts: ['fail', 'fail', 'ok'] }, outage: true });

/** Moves one run's notify try 3 later, as in the live feed where one 30 s wait took 31.46 s. */
function delayTry3(r: Run, ms: number): Run {
  return {
    ...r,
    events: r.events.map((e) =>
      e.kind === 'notify_team' && e.attempt === 3 ? { ...e, at: new Date(Date.parse(e.at) + ms).toISOString() } : e),
  };
}

// The live feed of 24 Oct: 3 normal runs, 3 outage runs (waits 10.2 s ×3; 30.2, 30.2, 31.46 s).
const live = [ok(), ok(), ok(), outage(), outage(), delayTry3(outage(), 1260)];
const lane = (m: MapModel, kind: string) => must(m.lanes.find((l) => l.kind === kind), kind);

describe('mapModel: the live feed of 24 Oct', () => {
  const m = mapModel(live, WF);
  const team = lane(m, 'notify_team');
  const visitor = lane(m, 'confirm_visitor');
  const purge = lane(m, 'purge_pii');

  it('lead: 6 runs, and every lane is reached', () => {
    expect(m.leadSubtitle).toBe('6 runs');
    expect(m.lanes.map((l) => l.feed)).toEqual(['route', 'route', 'route']);
  });

  it('team notification: three tries on a lit siding, 6 emails sent', () => {
    expect(team.subtitle).toBe('3 recovered after retries');
    expect(team.stations.map((s) => [s.attempt, s.detail])).toEqual([
      [1, '6 started · 3 succeeded · 3 failed'],
      [2, '3 started · 3 failed'],
      [3, '3 started · 3 succeeded'],
    ]);
    expect(team.stations.map((s) => s.short)).toEqual(['3 ✓ · 3 ✕', '3 ✕', '3 ✓']);
    expect(team.stations.map((s) => [s.words, s.shape])).toEqual([['3 sent · 3 failed', 'mixed'], ['3 failed', 'failed'], ['3 sent', 'sent']]);
    expect(team.siding).toBe('retry');
    expect([team.toTry1, team.firstPath, team.toEnd]).toEqual(['route', 'ok', 'ok']);
    expect(team.end).toEqual({ text: '6 emails sent', state: 'ok' });
    expect(team.endLabel).toEqual({ lines: ['6 emails sent', null], shape: 'sent' });
  });

  it('waits: planned 10 s, actual 10.2 s; planned 30 s, actual 30.2–31.5 s, each over 3 retries', () => {
    expect(team.waits).toEqual([
      { attempt: 1, planned: 'planned 10 s', actual: 'actual 10.2 s (3)', measured: 3, waiting: 0, text: 'waited 10.2 s · 3' },
      { attempt: 2, planned: 'planned 30 s', actual: 'actual 30.2–31.5 s (3)', measured: 3, waiting: 0, text: 'waited 30.2–31.5 s · 3' },
    ]);
  });

  it('visitor confirmation: simulated, never called sent', () => {
    expect(visitor.subtitle).toBe('All 6 simulated on try 1');
    expect(visitor.siding).toBe('unlit');
    expect(visitor.end).toEqual({ text: '6 simulated · none sent', state: 'ok' });
    expect(visitor.stations.map((s) => [s.words, s.shape])).toEqual([['6 simulated', 'simulated']]);
    expect(visitor.endLabel).toEqual({ lines: ['6 simulated', 'none sent'], shape: 'simulated' });
  });

  it('personal data deletion: scheduled, its track dashed until one runs', () => {
    expect(purge.subtitle).toBe('6 scheduled · 0 done');
    expect(purge.stations).toEqual([]);
    expect([purge.toTry1, purge.firstPath, purge.toEnd]).toEqual(['scheduled', 'scheduled', 'scheduled']);
    expect(purge.end).toEqual({ text: '0 done', state: 'scheduled' });
    expect(purge.endLabel).toEqual({ lines: ['6 scheduled', 'first due 31 Oct'], shape: 'scheduled' }); // created 24 Oct + 7 days
  });
});

describe('mapModel: other cases', () => {
  it('an empty window keeps the shape, every track unlit', () => {
    const m = mapModel([], WF);
    expect(m.leadSubtitle).toBe('No runs');
    expect(m.lanes.map((l) => [l.subtitle, l.feed, l.toTry1, l.firstPath, l.toEnd, l.siding, l.end.state])).toEqual([
      ['No runs', 'unlit', 'unlit', 'unlit', 'unlit', 'unlit', 'unlit'],
      ['No runs', 'unlit', 'unlit', 'unlit', 'unlit', 'unlit', 'unlit'],
      ['No runs', 'unlit', 'unlit', 'unlit', 'unlit', 'unlit', 'unlit'],
    ]);
  });

  it('only retried runs (the outage filter on): no straight path from try 1 is lit', () => {
    const team = lane(mapModel([outage(), outage()], WF), 'notify_team');
    expect([team.toTry1, team.firstPath, team.siding, team.toEnd]).toEqual(['route', 'unlit', 'retry', 'ok']);
  });

  it('a step that gave up comes first and ends in a dead terminal', () => {
    const dead = run({ notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'] } });
    const team = lane(mapModel([outage(), dead], WF), 'notify_team');
    expect(team.subtitle).toBe('1 gave up');
    expect(team.stations.at(-1)?.detail).toBe('1 started · 1 failed · 1 gave up');
    expect(team.end).toEqual({ text: '1 email sent · 1 gave up', state: 'dead' });
  });

  it('retrying now, and a wait still open', () => {
    const team = lane(mapModel([run({ notify: { attempts: ['fail'] } })], WF), 'notify_team');
    expect(team.subtitle).toBe('1 retrying');
    // Try 1 failed and the retry hasn't started: nothing went straight on, and nothing reached the end yet.
    expect([team.toTry1, team.firstPath, team.toEnd]).toEqual(['route', 'unlit', 'unlit']);
    expect(team.end).toEqual({ text: 'None finished', state: 'unlit' });
    expect(team.waits).toEqual([{ attempt: 1, planned: 'planned 10 s', actual: null, measured: 0, waiting: 1, text: 'waiting now · 1' }]);
  });

  it('a lease expiry retries without a failure on its station', () => {
    const team = lane(mapModel([run({ notify: { attempts: ['lease', 'ok'] } })], WF), 'notify_team');
    expect(team.stations.map((s) => s.detail)).toEqual(['1 started', '1 started · 1 succeeded']);
    expect(team.stations.map((s) => s.short)).toEqual(['1 started', '1 ✓']); // never "running": the lease ran out
    expect(team.stations.map((s) => [s.words, s.shape])).toEqual([['1 never reported back', 'noresult'], ['1 sent', 'sent']]);
    expect(team.siding).toBe('retry');
  });

  it('mock and capped notifications are named, never counted as emails', () => {
    const m = mapModel([ok(), run({ notify: { attempts: ['ok'], result: 'mock' } }), run({ notify: { attempts: ['ok'], result: 'skipped_cap' } })], WF);
    expect(lane(m, 'notify_team').end.text).toBe('1 email sent · 1 simulated · 1 skipped');
  });

  it('the guided recording: 10 s → 10.2 s, 30 s → 30.2 s', () => {
    expect(waitSummary([GUIDED_RUN], 'notify_team').map((w) => [w.planned, w.actual])).toEqual([
      ['planned 10 s', 'actual 10.2 s (1)'],
      ['planned 30 s', 'actual 30.2 s (1)'],
    ]);
  });

  it('mixed planned waits are shown as a range', () => {
    const a = run({ notify: { attempts: ['fail', 'fail', 'fail', 'ok'] } });
    const b = run({ notify: { attempts: ['fail', 'ok'] } });
    expect(waitSummary([a, b], 'notify_team').map((w) => w.planned)).toEqual(['planned 10 s', 'planned 30 s', 'planned 2 min']);
  });
});

describe('keyboard: mapGrid and neighbor', () => {
  const grid = mapGrid(mapModel(live, WF));

  it('has one Tab stop: the node last focused, else the selection, else the enquiry', () => {
    expect(tabStop(grid, [null, null])).toBe('lead');
    expect(tabStop(grid, [null, 'try:notify_team:2'])).toBe('try:notify_team:2');
    expect(tabStop(grid, ['lane:confirm_visitor', 'try:notify_team:2'])).toBe('lane:confirm_visitor');
    // A node that left the map (a narrower window, fewer tries) doesn't hold the stop.
    expect(tabStop(grid, ['try:notify_team:9', null])).toBe('lead');
  });

  it('columns: lead, lanes, then one column per try', () => {
    expect(grid).toEqual([
      ['lead'],
      ['lane:notify_team', 'lane:confirm_visitor', 'lane:purge_pii'],
      ['try:notify_team:1', 'try:confirm_visitor:1', null],
      ['try:notify_team:2', null, null],
      ['try:notify_team:3', null, null],
    ]);
  });

  it('Right follows the flow; Left goes back; edges stay put', () => {
    expect(neighbor(grid, 'lead', 'ArrowRight')).toBe('lane:notify_team');
    expect(neighbor(grid, 'lane:confirm_visitor', 'ArrowRight')).toBe('try:confirm_visitor:1');
    expect(neighbor(grid, 'try:notify_team:3', 'ArrowRight')).toBe('try:notify_team:3');
    expect(neighbor(grid, 'lane:purge_pii', 'ArrowRight')).toBe('lane:purge_pii'); // no try yet
    expect(neighbor(grid, 'lane:purge_pii', 'ArrowLeft')).toBe('lead');
    expect(neighbor(grid, 'try:notify_team:2', 'ArrowLeft')).toBe('try:notify_team:1');
    expect(neighbor(grid, 'lead', 'ArrowLeft')).toBe('lead');
  });

  it('Up and Down move between lanes, skipping gaps', () => {
    expect(neighbor(grid, 'lane:notify_team', 'ArrowDown')).toBe('lane:confirm_visitor');
    expect(neighbor(grid, 'lane:purge_pii', 'ArrowDown')).toBe('lane:purge_pii');
    expect(neighbor(grid, 'try:confirm_visitor:1', 'ArrowUp')).toBe('try:notify_team:1');
    expect(neighbor(grid, 'try:notify_team:2', 'ArrowDown')).toBe('try:notify_team:2');
  });
});

describe('selectionNote', () => {
  const m = mapModel(live, WF);
  const none = { step: null, attempt: null };

  it('a hint when nothing is selected', () => {
    expect(selectionNote(m, none, null)).toEqual({ heading: '', body: 'Nothing selected. Click a job, a try or a run to see its numbers; hover to preview.' });
  });

  it('a try names its counts and the wait before it', () => {
    expect(selectionNote(m, { step: 'notify_team', attempt: 3 }, null)).toEqual({
      heading: 'Selected: Team notification · try 3',
      body: '3 started · 3 succeeded. It started after the 30 s planned wait; actual 30.2–31.5 s over 3 retries.',
    });
  });

  it('a job says what it is for, then its summary and end', () => {
    expect(selectionNote(m, { step: 'notify_team', attempt: null }, null).body).toBe(
      'Emails the agency about the new enquiry. 3 recovered after retries. 6 emails sent.',
    );
    expect(selectionNote(m, { step: 'confirm_visitor', attempt: null }, null).body).toBe(
      'Confirms receipt to the visitor. Simulated: no email leaves. All 6 simulated on try 1. 6 simulated · none sent.',
    );
    expect(selectionNote(m, { step: 'purge_pii', attempt: null }, null).body).toBe(
      "Erases the visitor's details 7 days after the enquiry. 6 scheduled · 0 done.",
    );
  });

  it('every job has a one-line purpose', () => {
    for (const kind of ['notify_team', 'confirm_visitor', 'purge_pii'] as const) expect(stepPurpose(WF, kind)).toMatch(/^[A-Z].*\.$/);
  });

  it('a preview wins over the selection, and is labelled as one', () => {
    expect(selectionNote(m, { step: 'notify_team', attempt: null }, 'lead')).toEqual({
      heading: 'Preview: New enquiry', body: '6 runs in this window. Every enquiry starts all three jobs.',
    });
    expect(selectionNote(m, { step: 'notify_team', attempt: null }, 'lane:notify_team').heading).toBe('Selected: Team notification');
  });

  it('a try that is not in the window says so', () => {
    expect(selectionNote(m, { step: 'notify_team', attempt: 4 }, null).body).toBe('No try 4 in this window.');
  });
});

describe('newSignals', () => {
  const page = (runs: Run[]): RunsPage => ({ now: '2026-10-24T07:00:00.000Z', truncated: false, workflow: WF, runs });

  it('nothing on the first page, nothing when nothing changed', () => {
    expect(newSignals(null, GUIDED_PAGE).size).toBe(0);
    expect(newSignals(GUIDED_PAGE, GUIDED_PAGE).size).toBe(0);
  });

  it('a new lead lights the feeds and first tries; a retry lights the siding', () => {
    const first = outage();
    const before = page([first]);
    const fresh = ok();
    expect([...newSignals(before, page([fresh, first]))].sort()).toEqual([
      'feed:confirm_visitor', 'feed:notify_team', 'feed:purge_pii', 'main:confirm_visitor', 'main:notify_team',
    ]);
    const half = { ...first, events: first.events.filter((e) => !(e.kind === 'notify_team' && e.attempt >= 2)) };
    expect([...newSignals(page([half]), page([first]))]).toEqual(['siding:notify_team']);
  });
});

describe("the wide map's geometry (mapGeometry.ts) with real models", () => {
  it('fits a 1280 px screen up to try 3, and goes narrow for try 4', () => {
    // 1280 − 18 (a classic Windows scrollbar, measured) − 224 rail − 80 padding − 3 card edge − 40 card padding = 915 px.
    expect(minWideWidth(mapModel(live, WF))).toBeLessThanOrEqual(915);
    const four = run({ notify: { attempts: ['fail', 'fail', 'fail', 'ok'] } });
    expect(minWideWidth(mapModel([four], WF))).toBeGreaterThan(915);
  });

  it('a siding rejoins 110 px after its own last try, before the end', () => {
    const two = run({ notify: { attempts: ['fail', 'ok'] } });
    const team = must(wideLayout(mapModel([two], WF), 1088, new Set()).lanes[0]);
    expect(team.rejoin).toEqual({ from: must(team.stations[1]).x, to: must(team.stations[1]).x + 110 });
    expect(team.endX).toBeGreaterThan(must(team.rejoin).to);
  });

  it('only lanes with a retry get a siding, and lanes never overlap', () => {
    const l = wideLayout(mapModel(live, WF), 1088, new Set());
    expect(l.lanes.map((x) => x.sidingY !== null)).toEqual([true, false, false]);
    for (let i = 1; i < l.lanes.length; i++) {
      expect(must(l.lanes[i]).lineY - 46).toBeGreaterThan(must(l.lanes[i - 1]).lineY + 52);
    }
  });
});
