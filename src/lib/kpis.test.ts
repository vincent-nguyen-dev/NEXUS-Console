import { describe, expect, it } from 'vitest';
import { makeRun, runsCompletingIn, type RunSpec } from '../test/runs';
import { GUIDED_META, GUIDED_RUN } from './guided';
import { buildKpis, partialNote, kpiSource, windowHint, type Kpi, type KpiScope } from './kpis';
import { NORTHSTAR_WF as WF } from '../test/workflow';

let n = 0;
const run = (spec: Omit<RunSpec, 'id' | 'created'>, created = '2026-10-24T06:00:00.000Z') =>
  makeRun({ id: `r_${(n++).toString(16).padStart(12, '0')}`, created, ...spec });
const ok = (created?: string) => run({}, created);
const outage = (created?: string) => run({ notify: { attempts: ['fail', 'fail', 'ok'] }, outage: true }, created);
const byId = (kpis: Kpi[]) => Object.fromEntries(kpis.map((k) => [k.id, k]));

const ASOF = '2026-10-27T06:52:29.361426+00:00';
const scope = (patch: Partial<KpiScope> = {}): KpiScope => ({ win: '30d', source: 'live', fileName: null, asOf: ASOF, capturedAt: GUIDED_META.captured_at, ...patch });
const SOURCE = "Source: Northstar's ops feed, runs created in the last 30 days, as of 27 Oct, 06:52 UTC.";

// The live feed of 27 Oct 06:52 UTC: 10 runs, 5 with the outage switch (team notification fails tries 1–2, then
// sends). Hand-checked: first try 5 ÷ 10 = 50%; recovered 5 ÷ 5 = 100%; visitor 10 of 10; 10 of 20 complete runs.
describe('buildKpis: the live feed of 27 Oct (10 runs, 5 with the outage switch)', () => {
  const runs = [
    ...[0, 1, 2, 3, 4].map(() => outage('2026-10-24T06:46:00Z')),
    ...[0, 1, 2, 3].map(() => ok('2026-10-25T07:07:00Z')),
    ok('2026-10-26T09:52:02Z'),
  ];
  const k = byId(buildKpis(runs, false, scope(), WF));

  it('runs: 10, one per enquiry', () => {
    expect(k.runs).toMatchObject({ value: '10', note: 'one per enquiry' });
    expect(k.runs?.how).toEqual({
      rule: 'Runs created in the window, by when each enquiry was saved. One run per enquiry.',
      working: '10 runs', notes: ['Test enquiries from the owner and from visitors, including one scheduled test a day.'], source: SOURCE,
    });
  });

  it('team first try: 5 ÷ 10 = 50%, low by design because of the outage switch', () => {
    expect(k.first_try).toMatchObject({ value: '50%', hasValue: true, note: '5 of 10 succeeded on try 1', progress: null });
    expect(k.first_try?.how).toEqual({
      rule: 'Team notifications that succeeded on try 1 ÷ finished team notifications (finished = succeeded or gave up).',
      working: '5 ÷ 10 = 50%',
      notes: [
        '5 of the 10 runs had the outage switch on, which fails team notification tries 1 and 2 on purpose, so this rate is low by design.',
        'Results: 10 emails sent.',
        'With fewer than 5, a single result moves the rate by 20 points or more (5 is a demo threshold).',
      ],
      source: SOURCE,
    });
  });

  it('team recovered: 5 ÷ 5 = 100%, all from the outage switch', () => {
    expect(k.recovered).toMatchObject({ value: '100%', note: '5 of 5 that failed', progress: null });
    expect(k.recovered?.how.working).toBe('5 ÷ 5 = 100%');
    expect(k.recovered?.how.notes[1]).toBe('All 5 came from runs with the outage switch on.');
  });

  it('visitor confirmation: counts only, simulated', () => {
    expect(k.simulated).toMatchObject({ value: '10 of 10', note: 'finished on try 1 · simulated' });
  });

  it('p95: progress, 10 of the 20 complete runs, with the latest one and a window hint', () => {
    expect(k.completion_p95).toMatchObject({ value: 'No value yet', hasValue: false, note: 'A percentile needs 20 complete runs (demo threshold).' });
    expect(k.completion_p95?.progress).toEqual({
      have: 10, need: 20, noun: 'complete runs',
      latest: 'Latest complete run: 26 Oct, 09:52 UTC',
      hint: 'This 30-day window holds 10 of the 20. Longer windows include older runs: try All.',
    });
    expect(k.completion_p95?.how.working).toBe('10 of the 20 complete runs needed.');
    expect(k.completion_p95?.how.notes).toEqual([
      "Personal data deletion isn't counted: it runs 7 days later.",
      'Left out: none (no run in progress or gave up).',
      'A 95th percentile from fewer than 20 runs would swing with every new run, so NEXUS waits (20 is a demo threshold).',
    ]);
  });
});

describe('progress below a minimum keeps its two reasons apart', () => {
  it('too few finished team notifications (runs) vs too few qualifying failures (failures)', () => {
    const k = byId(buildKpis([ok('2026-10-26T09:52:02Z'), outage('2026-10-25T07:15:00Z')], false, scope({ win: '7d' }), WF));
    expect(k.first_try?.progress).toEqual({
      have: 2, need: 5, noun: 'finished team notifications',
      latest: 'Latest finished team notification: 26 Oct, 09:52 UTC',
      hint: 'This 7-day window holds 2 of the 5. Longer windows include older runs: try 30 days or All.',
    });
    expect(k.recovered?.progress).toMatchObject({ have: 1, need: 5, noun: 'qualifying failures', latest: 'Latest qualifying failure: 25 Oct, 07:15 UTC' });
    expect(k.recovered?.note).toBe('A rate needs 5 qualifying failures (demo threshold).');
    expect(k.recovered?.how.working).toBe('1 qualifying failure so far (1 recovered); a rate needs 5.');
  });

  it('no failures at all is said plainly, and counts as 0 of 5', () => {
    const k = byId(buildKpis([ok()], false, scope(), WF));
    expect(k.recovered?.note).toBe('No team notification has failed in this window.');
    expect(k.recovered?.progress).toMatchObject({ have: 0, need: 5, latest: null });
  });
});

describe('windowHint (facts only: never claims a longer window reaches the minimum)', () => {
  it('points to every longer window, and to nothing from All', () => {
    expect(windowHint(1, 5, 'finished team notifications', '24h', false)).toBe(
      'This 24-hour window holds 1 of the 5. Longer windows include older runs: try 7 days, 30 days or All.',
    );
    expect(windowHint(10, 20, 'complete runs', '7d', false)).toBe('This 7-day window holds 10 of the 20. Longer windows include older runs: try 30 days or All.');
    expect(windowHint(10, 20, 'complete runs', 'all', false)).toBeNull();
  });

  it('says nothing once the minimum is reached', () => {
    expect(windowHint(5, 5, 'qualifying failures', '24h', false)).toBeNull();
  });

  it('with the filter on: the count is of filtered runs, and clearing it can include others', () => {
    expect(windowHint(6, 20, 'complete runs', '30d', false, 'the outage switch off')).toBe(
      'This 30-day window holds 6 of the 20 with the outage switch off. Clearing the filter or choosing a longer window can include other runs.',
    );
    expect(windowHint(6, 20, 'complete runs', 'all', false, 'the outage switch off')).toBe(
      'All recorded runs with the outage switch off hold 6 of the 20. Clearing the filter can include other runs.',
    );
  });

  it('in the recording: one run, and what it would need', () => {
    expect(windowHint(1, 20, 'complete runs', '30d', true)).toBe('The recording is one run; this needs 20 complete runs.');
  });
});

describe('kpiSource', () => {
  it('names the feed, the window and the time of the answer', () => {
    expect(kpiSource(scope())).toBe(SOURCE);
    expect(kpiSource(scope({ win: 'all' }))).toBe("Source: Northstar's ops feed, all recorded runs, as of 27 Oct, 06:52 UTC.");
  });

  it('names the filter when one is on', () => {
    expect(kpiSource(scope({ filter: 'the outage switch off' }))).toBe(
      "Source: Northstar's ops feed, runs created in the last 30 days with the outage switch off, as of 27 Oct, 06:52 UTC.",
    );
  });

  it('names the recording and when it was frozen', () => {
    expect(kpiSource(scope({ source: 'recording' }))).toBe('Source: the recording of one run, frozen 23 Oct 2026.');
  });
});

describe('buildKpis: other cases', () => {
  it('names simulated and capped notifications, never as emails', () => {
    const k = byId(buildKpis([
      ok(), ok(), ok(),
      run({ notify: { attempts: ['ok'], result: 'mock' } }),
      run({ notify: { attempts: ['ok'], result: 'skipped_cap' } }),
    ], false, scope(), WF));
    expect(k.first_try?.how.notes).toContain('Results: 3 emails sent · 1 simulated, no email provider · 1 skipped at the daily email cap.');
  });

  it('a recovery rate at 5 qualifying failures, with the one that gave up in the denominator', () => {
    const dead = run({ notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'] } });
    const k = byId(buildKpis([outage(), outage(), outage(), outage(), dead], false, scope(), WF));
    expect(k.recovered).toMatchObject({ value: '80%', note: '4 of 5 that failed' });
    expect(k.recovered?.how.working).toBe('4 ÷ 5 = 80%');
    expect(k.completion_p95?.how.notes[1]).toBe('Left out: 1 gave up.');
  });

  it('a p95 value once 20 runs are complete, with its position shown', () => {
    const secs = Array.from({ length: 20 }, (_, i) => i + 2); // 2..21 s → position ⌈0.95 × 20⌉ = 19 → 20 s
    const k = byId(buildKpis(runsCompletingIn(secs), false, scope(), WF));
    expect(k.completion_p95).toMatchObject({ value: '20.0 s', hasValue: true, note: 'over 20 complete runs · a small sample: the slowest one or two set it', progress: null });
    expect(k.completion_p95?.how.working).toBe('n = 20 → position 19 → 20.0 s');
  });

  it('says a p95 is a small sample below 40 runs, and stops saying so at 40', () => {
    const note = (n: number) => byId(buildKpis(runsCompletingIn(Array.from({ length: n }, (_, i) => i + 2)), false, scope(), WF)).completion_p95?.note;
    expect(note(39)).toBe('over 39 complete runs · a small sample: the slowest one or two set it');
    expect(note(40)).toBe('over 40 complete runs');
  });

  it('nothing finished yet', () => {
    const going = run({ notify: { attempts: ['running'] }, confirm: { attempts: ['running'] } });
    const k = byId(buildKpis([going], false, scope(), WF));
    expect(k.simulated).toMatchObject({ value: 'None yet', hasValue: false });
    expect(k.completion_p95?.how.notes[1]).toBe('Left out: 1 in progress.');
  });

  it('a partial window withholds every rate, claims no progress, and marks the count as a lower bound', () => {
    const kpis = buildKpis([ok(), ok()], true, scope(), WF);
    expect(kpis.map((x) => x.value)).toEqual(['2+', 'Withheld', 'Withheld', 'Withheld', 'Withheld']);
    expect(kpis.every((x) => x.note === partialNote('live') && x.progress === null)).toBe(true);
  });

  it('the recording: one run, every rate below its minimum, the recording as the source', () => {
    const k = byId(buildKpis([GUIDED_RUN], false, scope({ source: 'recording' }), WF));
    expect(k.first_try?.value).toBe('No rate yet');
    expect(k.recovered?.progress).toEqual({
      have: 1, need: 5, noun: 'qualifying failures', latest: null, hint: 'The recording is one run; this needs 5 qualifying failures.',
    });
    expect(k.simulated?.value).toBe('1 of 1');
    expect(k.runs?.how.source).toBe('Source: the recording of one run, frozen 23 Oct 2026.');
  });
});
