import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import { GUIDED_RUN } from './guided';
import { DEFAULT_WINDOW, eventRows, filterRows, runBlocks, runsInWindow, sortRows, windowSince } from './filters';

const NOW = Date.parse('2026-10-23T06:00:00Z');

describe('windows', () => {
  it('defaults to 30 days', () => expect(DEFAULT_WINDOW).toBe('30d'));

  it('computes `since` for each window; All has none', () => {
    expect(windowSince('24h', NOW)).toBe('2026-10-22T06:00:00.000Z');
    expect(windowSince('7d', NOW)).toBe('2026-10-16T06:00:00.000Z');
    expect(windowSince('30d', NOW)).toBe('2026-09-23T06:00:00.000Z');
    expect(windowSince('all', NOW)).toBeNull();
  });

  it('keeps runs created at or after `since`, like the server', () => {
    const edge = makeRun({ id: 'r_edge', created: '2026-10-22T06:00:00.000Z' });
    const older = makeRun({ id: 'r_old', created: '2026-10-22T05:59:59.999Z' });
    expect(runsInWindow([edge, older], '24h', NOW).map((r) => r.run_id)).toEqual(['r_edge']);
    expect(runsInWindow([edge, older], 'all', NOW)).toHaveLength(2);
    // The recorded run (2026-10-22 03:07) is outside 24h from this NOW but inside 7d.
    expect(runsInWindow([GUIDED_RUN], '24h', NOW)).toHaveLength(0);
    expect(runsInWindow([GUIDED_RUN], '7d', NOW)).toHaveLength(1);
  });
});

describe('eventRows', () => {
  const rows = eventRows([GUIDED_RUN]);

  it('flattens every event, newest first', () => {
    expect(rows).toHaveLength(GUIDED_RUN.events.length);
    expect(rows[0]).toMatchObject({ runId: 'r_6d15828d95f5', kind: 'notify_team', event: 'succeeded', attempt: 3 });
    expect(rows.at(-1)?.event).toBe('queued');
  });

  it('keeps the recorded order for events with the same time (retry_scheduled before failed, newest first)', () => {
    const same = rows.filter((r) => r.at === '2026-10-22T03:07:47.131988+00:00').map((r) => r.event);
    expect(same).toEqual(['retry_scheduled', 'failed']);
  });

  it('measures the wait since the previous event of the same step', () => {
    const started2 = rows.find((r) => r.kind === 'notify_team' && r.event === 'started' && r.attempt === 2);
    expect(started2?.waitS).toBeCloseTo(10.190001, 5);
    const firstQueued = rows.find((r) => r.kind === 'confirm_visitor' && r.event === 'queued');
    expect(firstQueued?.waitS).toBeNull();
  });

  it('filters by step and event', () => {
    expect(filterRows(rows, { step: 'notify_team', event: 'failed' }).map((r) => r.attempt)).toEqual([2, 1]);
    expect(filterRows(rows, { step: 'purge_pii' })).toHaveLength(1);
    expect(filterRows(rows, {})).toHaveLength(rows.length);
    expect(filterRows(rows, { step: null, attempt: null, event: null })).toHaveLength(rows.length);
  });

  it('filters by try: notify_team try 2 is started, failed and retry_scheduled', () => {
    expect(filterRows(rows, { step: 'notify_team', attempt: 2 }).map((r) => r.event)).toEqual(['retry_scheduled', 'failed', 'started']);
    expect(filterRows(rows, { step: 'notify_team' })).toHaveLength(9);
  });

  it('sorts oldest first by reversing, so same-time events keep their recorded order', () => {
    const oldest = sortRows(rows, 'oldest');
    expect(oldest[0]?.event).toBe('queued');
    expect(oldest.at(-1)).toMatchObject({ kind: 'notify_team', event: 'succeeded', attempt: 3 });
    const same = oldest.filter((r) => r.at === '2026-10-22T03:07:47.131988+00:00').map((r) => r.event);
    expect(same).toEqual(['failed', 'retry_scheduled']);
    expect(sortRows(rows, 'newest')).toBe(rows);
  });
});

describe('runBlocks: where the events table starts a new run', () => {
  const a = makeRun({ id: 'r_00000000000a', created: '2026-10-24T01:00:00.000Z' });
  const b = makeRun({ id: 'r_00000000000b', created: '2026-10-24T02:00:00.000Z' });

  it('marks the first row of each run, newest first and oldest first, and keeps the order', () => {
    const rows = eventRows([a, b]);
    const starts = runBlocks(rows);
    expect(starts).toHaveLength(rows.length);
    expect(starts.filter(Boolean)).toHaveLength(2);
    expect(rows[starts.indexOf(true, 1)]?.runId).toBe('r_00000000000a');
    expect(runBlocks(sortRows(rows, 'oldest')).filter(Boolean)).toHaveLength(2);
    expect(runBlocks([])).toEqual([]);
  });

  it('a filter that interleaves runs starts a block at every change', () => {
    expect(runBlocks([{ runId: 'x' }, { runId: 'y' }, { runId: 'x' }])).toEqual([true, true, true]);
  });
});
