import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import { LANDING_RETRY_MS, chipView, landingFacts, landingNumbers, numbersView, shouldRetry, type LandingFeed } from './landing';
import { STALE_CAP_MS, WAKING_AFTER_MS } from './pollPolicy';
import type { Run, RunsPage } from './types';
import { NORTHSTAR_WF as WF } from '../test/workflow';

const NOW = '2026-10-27T04:36:37.004017+00:00';
const id = (i: number) => `r_${i.toString(16).padStart(12, '0')}`;
const page = (runs: Run[], truncated = false): RunsPage => ({ now: NOW, truncated, workflow: WF, runs });

// The live feed as read on 27 Oct 04:36 UTC: 10 runs, 5 with the outage switch (team notification
// fails tries 1 and 2, then sends), 5 without. 10 failed tries, 10 of 10 sent once, nothing gave up.
const outage = (i: number) => makeRun({ id: id(i), created: '2026-10-24T06:46:00Z', outage: true, notify: { attempts: ['fail', 'fail', 'ok'] } });
const clean = (i: number) => makeRun({ id: id(i), created: '2026-10-25T07:07:00Z' });
const LIVE = page([0, 1, 2, 3, 4].map(outage).concat([5, 6, 7, 8, 9].map(clean)));

describe('landingFacts', () => {
  it('matches the hand-checked live feed of 27 Oct', () => {
    expect(landingFacts(LIVE)).toEqual({
      runs: 10, partial: false, team: { finished: 10, sentOnce: 10 },
      failedTries: 10, outageFailures: 10, recovered: { numerator: 5, denominator: 5 }, gaveUp: 0,
    });
  });

  it('counts only runs created in the last 30 days on the server\'s clock', () => {
    // The window starts at 2026-09-27T04:36:37.004: the first run is 37 s too old, the second 23 s inside.
    const old = makeRun({ id: id(20), created: '2026-09-27T04:36:00Z' });
    const edge = makeRun({ id: id(21), created: '2026-09-27T04:37:00Z' });
    expect(landingFacts(page([old, edge])).runs).toBe(1);
  });

  it('flags a window that Northstar cut at 500 runs', () => {
    const runs = Array.from({ length: 3 }, (_, i) => makeRun({ id: id(i), created: '2026-10-26T00:00:00Z' }));
    expect(landingFacts(page(runs, true)).partial).toBe(true);
  });

  it('keeps simulated results, a still-running job and a give-up apart from "sent once"', () => {
    const facts = landingFacts(page([
      makeRun({ id: id(1), created: '2026-10-26T00:00:00Z', notify: { attempts: ['ok'], result: 'mock' } }),
      makeRun({ id: id(2), created: '2026-10-26T00:00:00Z', notify: { attempts: ['running'] } }),
      makeRun({ id: id(3), created: '2026-10-26T00:00:00Z', notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'], error: 'internal_error' } }),
    ]));
    expect(facts.team).toEqual({ finished: 2, sentOnce: 0 });
    expect(facts).toMatchObject({ failedTries: 4, outageFailures: 0, recovered: { numerator: 0, denominator: 1 }, gaveUp: 1 });
  });
});

describe('landingNumbers', () => {
  it('shows the live numbers of 27 Oct, each with its n', () => {
    expect(landingNumbers(landingFacts(LIVE), 'enquiry')).toEqual([
      { label: 'Runs', value: '10', note: 'one per enquiry · n\u00a0=\u00a010' },
      { label: 'Team email recorded as sent once', value: '10 of 10', note: 'finished team notifications' },
      { label: 'Failed tries', value: '10', note: 'all from the outage test switch · 5 of 5 jobs recovered' },
      { label: 'Gave up', value: '0', note: 'no job stopped without succeeding' },
    ]);
  });

  it('says how many are still running, and splits failures that are not the outage switch', () => {
    const tiles = landingNumbers(landingFacts(page([
      outage(1),
      makeRun({ id: id(2), created: '2026-10-26T00:00:00Z', notify: { attempts: ['fail', 'ok'], error: 'internal_error' } }),
      makeRun({ id: id(3), created: '2026-10-26T00:00:00Z', notify: { attempts: ['running'] } }),
    ])), 'enquiry');
    expect(tiles.slice(1, 3)).toEqual([
      { label: 'Team email recorded as sent once', value: '2 of 2', note: 'finished team notifications · 1 still running' },
      { label: 'Failed tries', value: '3', note: '2 from the outage test switch · 2 of 2 jobs recovered' },
    ]);
  });

  it('names a give-up, and points to the console for its reason', () => {
    const tiles = landingNumbers(landingFacts(page([
      makeRun({ id: id(1), created: '2026-10-26T00:00:00Z', outage: true, notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'] } }),
    ])), 'enquiry');
    expect(tiles.slice(2)).toEqual([
      { label: 'Failed tries', value: '4', note: 'all from the outage test switch · 0 of 1 job recovered' },
      { label: 'Gave up', value: '1', note: '1 job stopped without succeeding · the console shows why' },
    ]);
  });

  it('leaves out the team tile while no team notification has finished', () => {
    const tiles = landingNumbers(landingFacts(page([makeRun({ id: id(1), created: '2026-10-26T00:00:00Z', notify: { attempts: ['running'] } })])), 'order');
    expect(tiles.map((t) => t.label)).toEqual(['Runs', 'Failed tries', 'Gave up']);
    expect(tiles[0]?.note).toBe('one per order · n\u00a0=\u00a01');
    expect(tiles[1]?.note).toBe('none in the last 30 days');
  });

  it('shows no tiles for an empty or cut-off window (no placeholders)', () => {
    expect(landingNumbers(landingFacts(page([])), 'enquiry')).toEqual([]);
    expect(landingNumbers(landingFacts(page([clean(1)], true)), 'enquiry')).toEqual([]);
  });
});

describe('numbersView', () => {
  it('waits (never zeros) while Northstar is asked or wakes', () => {
    expect(numbersView({ kind: 'loading', startedAt: 0 })).toEqual({ kind: 'waiting' });
    expect(numbersView({ kind: 'retrying' })).toEqual({ kind: 'waiting' });
  });

  it('keeps unavailable, cut-off and empty windows apart', () => {
    expect(numbersView({ kind: 'failed' })).toEqual({ kind: 'unavailable' });
    expect(numbersView({ kind: 'ok', page: page([clean(1)], true), receivedAt: 0 })).toEqual({ kind: 'partial' });
    expect(numbersView({ kind: 'ok', page: page([]), receivedAt: 0 })).toEqual({ kind: 'empty' });
  });

  it("dates the tiles by the server's clock", () => {
    const v = numbersView({ kind: 'ok', page: LIVE, receivedAt: 0 });
    expect(v.kind === 'tiles' && v.asOf).toBe('27 Oct, 04:36 UTC');
    expect(v.kind === 'tiles' && v.tiles).toHaveLength(4);
  });
});

describe('chipView', () => {
  const T = 1_000_000;

  it('says a preview build has no live data, and the numbers row says why (7.2a)', () => {
    expect(chipView({ kind: 'preview' }, T)).toEqual({
      tone: 'preview', text: 'Preview build', detail: 'live data on the production site', announce: 'Preview build: no live data',
    });
    expect(numbersView({ kind: 'preview' })).toEqual({ kind: 'preview' });
  });

  it('checks quietly for the first 5 s, then says Northstar is waking', () => {
    const loading: LandingFeed = { kind: 'loading', startedAt: T };
    expect(chipView(loading, T + WAKING_AFTER_MS - 1).text).toBe('Checking Northstar…');
    expect(chipView(loading, T + WAKING_AFTER_MS)).toEqual({
      tone: 'waking', text: 'Waking Northstar', detail: 'its free server sleeps · about 1 min', announce: 'Waking Northstar',
    });
    expect(chipView({ kind: 'retrying' }, T).tone).toBe('waking');
  });

  it('counts the runs, says when NEXUS checked, and when the newest enquiry arrived', () => {
    const ok: LandingFeed = { kind: 'ok', page: LIVE, receivedAt: T };
    // Newest run 25 Oct 07:07:00; server now 27 Oct 04:36:37 + 61 s → 1 d 21 h 30 min → "1 d" (rounded down).
    expect(chipView(ok, T + 61_000)).toMatchObject({
      tone: 'live', text: 'Northstar connected · 10 runs in 30 days', detail: 'checked 1 min ago · newest enquiry 1 d ago',
    });
    expect(chipView({ kind: 'ok', page: page([]), receivedAt: T }, T).detail).toBe('checked 0 s ago');
    expect(chipView({ kind: 'ok', page: page([clean(1)]), receivedAt: T }, T).text).toBe('Northstar connected · 1 run in 30 days');
    expect(chipView({ kind: 'ok', page: page([clean(1)], true), receivedAt: T }, T).text).toBe('Northstar connected · 1+ runs in 30 days');
  });

  it('stops claiming a connection once the answer is older than the stale cap', () => {
    const ok: LandingFeed = { kind: 'ok', page: LIVE, receivedAt: T };
    expect(chipView(ok, T + STALE_CAP_MS).tone).toBe('live');
    expect(chipView(ok, T + STALE_CAP_MS + 1)).toEqual({
      tone: 'stale', text: 'Last updated 27 Oct, 04:36 UTC', detail: 'the console refreshes it', announce: 'Northstar data is a few minutes old',
    });
  });

  it('names Northstar when it can\'t be reached, and points to the recording', () => {
    expect(chipView({ kind: 'failed' }, T)).toMatchObject({ text: "Northstar can't be reached right now", detail: 'the recorded run still works' });
  });
});

describe('shouldRetry (at most two requests per landing visit)', () => {
  it('retries once after no answer or a 503, which is how Render looks while it wakes', () => {
    expect(shouldRetry('network', 0)).toBe(true);
    expect(shouldRetry('unavailable', 0)).toBe(true);
    expect(shouldRetry('network', 1)).toBe(false);
  });

  it('never retries a rate limit, another status or a broken feed', () => {
    expect(shouldRetry('rate_limited', 0)).toBe(false);
    expect(shouldRetry('http', 0)).toBe(false);
    expect(shouldRetry('shape', 0)).toBe(false);
    // A preview was never sent: asking again would be refused the same way (7.2a).
    expect(shouldRetry('refused', 0)).toBe(false);
  });

  it('waits 20 s before the retry', () => {
    expect(LANDING_RETRY_MS).toBe(20_000);
  });
});
