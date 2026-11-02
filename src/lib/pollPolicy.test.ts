import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import {
  CLOCK_MARGIN_MS, IDLE_POLL_MS, POLL_MS, complete, covers, nextDelay, reachesWindow, sinceFor, windowStartMs,
} from './pollPolicy';
import type { RunsPage } from './types';
import { NORTHSTAR_WF as WF } from '../test/workflow';

const NOW = Date.parse('2026-10-24T12:00:00.000Z');
const DAY = 24 * 3600 * 1000;
const ok = { idle: false, errors: 0, rateLimited: false, retryAfterS: null };

describe('nextDelay', () => {
  it('30 s while active, 2 min while idle', () => {
    expect(nextDelay(ok)).toBe(30_000);
    expect(nextDelay({ ...ok, idle: true })).toBe(120_000);
  });

  it('backs off 30 → 60 → 120 s after failures in a row, and stays at 120 s', () => {
    expect([1, 2, 3, 4, 9].map((errors) => nextDelay({ ...ok, errors }))).toEqual([30_000, 60_000, 120_000, 120_000, 120_000]);
  });

  it('never polls faster than the idle interval while idle, even after an error', () => {
    expect(nextDelay({ ...ok, idle: true, errors: 1 })).toBe(IDLE_POLL_MS);
  });

  it('waits as long as a 429 asks, or 60 s without a header, but never less than the interval', () => {
    expect(nextDelay({ ...ok, errors: 1, rateLimited: true, retryAfterS: 45 })).toBe(45_000);
    expect(nextDelay({ ...ok, errors: 1, rateLimited: true, retryAfterS: null })).toBe(60_000);
    expect(nextDelay({ ...ok, errors: 1, rateLimited: true, retryAfterS: 5 })).toBe(POLL_MS);
    expect(nextDelay({ ...ok, idle: true, errors: 1, rateLimited: true, retryAfterS: 45 })).toBe(IDLE_POLL_MS);
  });

  it('an abandoned visible tab makes 23 requests before it pauses at 30 min', () => {
    // t = 0, 30, …, 300 s (11 polls), then every 2 min while idle until 30 min without input.
    const times: number[] = [];
    let t = 0;
    while (t < 30 * 60_000) {
      times.push(t);
      t += nextDelay({ ...ok, idle: t >= 5 * 60_000 });
    }
    expect(times.length).toBe(23);
    expect(times.at(10)).toBe(300_000);
    expect(times.at(-1)).toBe(1_740_000);
  });
});

describe('sinceFor and windows', () => {
  it('asks for the window plus a 60 s margin, on the server clock', () => {
    expect(sinceFor('24h', NOW, 0)).toBe(new Date(NOW - DAY - CLOCK_MARGIN_MS).toISOString());
    // The client runs 10 min fast: the learned offset is −10 min.
    expect(sinceFor('24h', NOW + 600_000, -600_000)).toBe(new Date(NOW - DAY - CLOCK_MARGIN_MS).toISOString());
    expect(sinceFor('all', NOW, 0)).toBeNull();
  });

  it('a request reaches the window only if it started at or before the window start', () => {
    const start = NOW - 7 * DAY;
    expect(windowStartMs('7d', NOW)).toBe(start);
    expect(reachesWindow(start, '7d', NOW)).toBe(true);
    expect(reachesWindow(start + 1, '7d', NOW)).toBe(false);
    expect(reachesWindow(null, '7d', NOW)).toBe(true);
    expect(reachesWindow(start - 1, 'all', NOW)).toBe(false);
  });
});

const page = (createdAgo: number[], truncated: boolean): RunsPage => ({
  now: new Date(NOW).toISOString(),
  truncated,
  workflow: WF,
  runs: createdAgo.map((ago, i) =>
    makeRun({ id: `r_${i.toString(16).padStart(12, '0')}`, created: new Date(NOW - ago).toISOString() })),
});

describe('complete', () => {
  it('a page that is not truncated is complete', () => {
    expect(complete(page([DAY], false), null)).toBe(true);
  });

  it('a truncated page is complete only for windows that start after its oldest run', () => {
    const p = page([1 * DAY, 3 * DAY, 5 * DAY], true); // oldest returned run: 5 days ago
    expect(complete(p, NOW - 1 * DAY)).toBe(true);
    expect(complete(p, NOW - 5 * DAY)).toBe(false); // runs at exactly the start could be missing
    expect(complete(p, NOW - 7 * DAY)).toBe(false);
    expect(complete(p, null)).toBe(false);
  });
});

describe('covers', () => {
  it('narrowing a window needs no request; widening does', () => {
    const p = page([1 * DAY], false);
    const requested = NOW - 30 * DAY - CLOCK_MARGIN_MS;
    expect(covers(p, requested, '7d', NOW)).toBe(true);
    expect(covers(p, requested, '30d', NOW)).toBe(true);
    expect(covers(p, requested, 'all', NOW)).toBe(false);
  });

  it('a truncated page answers a narrower window only when it is complete for it', () => {
    const p = page([1 * DAY, 3 * DAY], true);
    const requested = NOW - 30 * DAY;
    expect(covers(p, requested, '24h', NOW)).toBe(true);
    expect(covers(p, requested, '7d', NOW)).toBe(false);
  });
});
